#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ecom manita — AGENT 4 : SCALING
===============================
Cet outil CALCULE. Il ne touche jamais Meta ni Tassyir.
C'est le Claude du client qui a les mains ; cet outil a les regles.

AUCUNE INSTALLATION. Aucun mot de passe administrateur.
Il n'utilise que ce qui est deja dans Python.

LES CINQ LOIS DU SCALING, posees par le vendeur :
  1. On juge sur le LIVRE **et** sur l'audience qui fait PEU DE RETOURS.
  2. Le scaling ne demarre qu'avec assez de data sur les CREAS.
  3. Au debut : les CUSTOM AUDIENCES, exclude ET include. Le lookalike apres.
  4. A mesure que la data s'accumule, on analyse.
  5. On scale EN PARALLELE DU STOCK. Le stock donne le budget, pas l'inverse.
Et : un BREAK EVEN PAR PRODUIT, jamais un seul pour la boutique.

DEUX LOIS D'AFFICHAGE, controlees a chaque sortie :
  1. jamais un chiffre sur une ligne arabe — le nombre vit SEUL sur sa ligne
  2. jamais un mot francais dans ce que lit le client
Si une des deux casse, l'outil REFUSE d'afficher.

LES PIEGES QUE CET OUTIL FERME EXPRES — tous trouves a l'audit, aucun
n'est theorique, chacun coutait de l'argent reel :
  A. un « benefice net » qui oublie la depense publicitaire affiche un profit
     sur un produit qui perd  -> la depense est OBLIGATOIRE dans --classer.
  B. le plafond du stock MONTE quand le cout par commande monte
     -> il est confronte au break even, et refuse au lieu de plafonner.
  C. « rentable hier » ne se devine pas  -> --hier est OBLIGATOIRE.
  D. un chiffre Meta en dollars traite comme des dinars divise le cout par
     deux cent soixante  -> --devise-depenses est OBLIGATOIRE, et le
     taux avec, des qu'on n'est pas en dinars.
  E. un angle qui a brule un budget sans sortir un colis etait hors du
     verdict  -> le TOTAL de la campagne est calcule sur TOUS les angles.
  F. les heures depuis le lancement et depuis la derniere hausse etaient
     deux nombres que l'agent inventait  -> ils se calculent sur des DATES,
     et la derniere hausse s'ecrit dans un fichier.

LE SCALING DU VENDEUR (v4.3, 06/10/2026) : le gagnant du test (--gagnant)
entre dans une campagne de SCALE dediee, en CBO, de un a trois ad sets broad
(--depart-scale), par DUPLICATION DE SON POST ID (object_story_id : il garde
ses commentaires). Jamais une campagne dupliquee. Tout nait EN PAUSE, le
client lance. Les hausses portent sur le budget de la CAMPAGNE : +20 a 30 %
par 48 heures au plus (--echelle), bornees par le stock et le break even.
Aucun plafond de depense. Cet outil calcule tout ca ; il ne touche a rien.
"""

import argparse
import datetime
import json
import math
import os
import re
import sys

VERSION = "4.3"

# ===========================================================================
# 1. LES CONSTANTES
# ===========================================================================

BROAD_JOURS = 3                 # les trois premiers jours, on ne touche a rien
BROAD_HEURES = BROAD_JOURS * 24  # soit 72 heures avant la PREMIERE hausse
# LA HAUSSE, regle du vendeur (06/10/2026) : « +20 a 30 % par 48 heures au
# plus ». L'outil choisit dans la fourchette sur la MESURE, pas sur une envie :
# +30 % quand la commande coute au moins 30 % de moins que son break even,
# +20 % sinon. Jamais au-dessus de trente, jamais plus d'une fois par 48 h.
HAUSSE_MIN = 0.20               # le bas de la fourchette (la hausse prudente)
HAUSSE_MAX = 0.30               # +30 % au plus d'un coup
MARGE_HAUSSE_FORTE = 0.30       # marge sous le break even qui autorise +30 %
HEURES_ENTRE_HAUSSES = 48       # et ensuite pas plus d'une fois par 48 heures
# LA CAMPAGNE DE SCALE (regle du vendeur, 06/10/2026) : le gagnant du test
# entre dans une campagne DEDIEE, en CBO (le budget sur la campagne), de un a
# trois ad sets broad, par son POST ID. Chaque ad set y vaut au depart ce que
# le gagnant depensait au test ; on en ouvre autant que le stock le porte.
SCALE_AD_SETS_MAX = 3
RESULTATS_MINI_GAGNANT = 3      # sous trois resultats, une annonce ne se couronne pas
LOOKALIKE_MINI_RETROUVES = 100  # minimum de Meta pour une graine de lookalike
LOOKALIKE_CONSEILLE = 1000      # ce que Meta recommande vraiment

# LES DEUX MODES DE TEST, ecrits par l'agent Testing dans le fichier de
# passage. Le scaling ne s'en sert pas pour calculer — sa porte se joue sur
# des colis, pas sur des jours — mais il les AFFICHE, parce qu'en mode
# message il n'y a pas de lien marque : l'angle qui a ramene une commande
# n'est connu que si quelqu'un l'a ecrit a la main.
MODES_TEST = ("site", "message")

# la porte, la meme que celle de l'agent coach — relue, jamais recalculee ici
PORTE_CONFIRMATION = 0.50
PORTE_LIVRAISON = 0.40
PORTE_LIVREES = 20
PIRE_CAS_LIVRAISON = 0.30  # les colis en route se comptent a trois sur dix

COLIS_MINI_PAR_ANGLE = 10       # en dessous, un angle ne se juge pas

DEVISES = ("DZD", "USD", "EUR")
ALIAS_DEVISE = {"DA": "DZD", "DZ": "DZD", "DINAR": "DZD", "DINARS": "DZD",
                "DOLLAR": "USD", "DOLLARS": "USD", "EURO": "EUR", "EUROS": "EUR"}
PLANCHER_JOUR_DA = 260.0        # sous un dollar par jour, ce n'est pas un budget
# en COD algerien, un colis expedie n'a JAMAIS coute vingt dinars de publicite.
# Sous ce plancher, c'est une depense en dollars passee comme des dinars.
PLANCHER_PAR_COLIS_DA = 100.0

# un montant en dinars qui descend sous ce plancher est presque toujours un
# montant en dollars qu'on a oublie de convertir. On refuse au lieu de calculer.
PLANCHER_PLAUSIBLE_DA = {
    "--prix": 200.0,
    "--marge-livree": 100.0,
    "--cout-livree": 100.0,
    "--be-livree": 100.0,
    "--cout-commande": 50.0,
    "--be-commande": 50.0,
    "--cout-retour": 50.0,
    "--nouveau-budget": PLANCHER_JOUR_DA,
    # le budget du jour de l'ad set gagnant au test : sept dollars passes
    # comme sept dinars ouvriraient une campagne de scale a quelques dinars
    "--budget-gagnant": PLANCHER_JOUR_DA,
    # --budget-actuel n'est PAS ici a dessein : son refus doit sortir en
    # arabe, par echelle_budget, pas en francais par ce garde-la.
    # --plafond N'EST PLUS ICI NON PLUS, et pour une raison differente : il
    # ne vient pas du client, il sort de --plafond-stock, DEJA en dinars.
    # Ce garde-la le refusait en conseillant de convertir ; l'agent obeissait,
    # multipliait 169,95 par le taux et repassait 42 317 DA, accepte, sur un
    # stock de deux pieces. Un plafond bas n'est pas une erreur de monnaie,
    # c'est un stock trop petit : --echelle le dit maintenant en clair.
}

FICHIER_PASSAGE = "test-en-cours.json"
FICHIER_SCALING = "scaling-en-cours.json"
FICHIER_DECISIONS = "mes-decisions.txt"

DEVISE_COMPTE = "USD"
VERS_DINARS = {"USD": 255.0, "EUR": 280.0, "DZD": 1.0}
TAUX_DINAR = None   # le taux REEL du client, donne par lui, pour convertir

# ===========================================================================
# 2. LES DEUX LOIS D'AFFICHAGE
# ===========================================================================

ARABE = re.compile(r'[؀-ۿ]')
# les chiffres arabo-indiens sont DANS la plage arabe : sans eux dans cette
# classe, « عندك ٢٣ كولي » passait le controle et s'affichait a l'envers.
CHIFFRE = re.compile(r'[0-9٠-٩۰-۹]')
FRANCAIS_INTERDIT = re.compile(
    r'\b(seuil|budget|campagne|d[eé]pense|livr[eé]e?s?|livraison|confirm[eé]e?s?|'
    r'commande|b[eé]n[eé]fice|perte|marge|retour|stock|annonce|vid[eé]o|prix|'
    r'co[uû]t|audience|exclusion|paiement|client|boutique|produit|rentable|'
    r'gagner|perdre|argent|semaine|lien|angle|test|r[eé]sultat|moyenne|taux)\b',
    re.I)
# 10/10/2026 : le motif de l'agent Testing (« C O D », « c-o-d », « cash on delivery » passaient)
COD_INTERDIT = re.compile(
    r'\bc[\s.\-_]*o[\s.\-_]*d\b|\bcash[\s\-]+on[\s\-]+deliver', re.I)
# uniquement des mots qui ne se disent PAS en Algerie — pas de faux positif
MAROCAIN = ["تحوّس", "تحوس", "تحوسي", "تحوّسي", "الكاس", "الصوردي",
            "دابا", "واخا"]
TECHNIQUE = re.compile(r'https?://|utm_|\s\|\s|^\s*[A-Z0-9_\-]{8,}\s*$')
LATIN_PERMIS = re.compile(
    r'^[\s=|\-·.:%+/]*$|^\s*[\d\s.,%|+\-]*(DA|USD|EUR|DZD|%)?[\s\d.,]*$')
MOT_LATIN = re.compile(r'[A-Za-zÀ-ÿ]{3,}')


def controle_affichage(texte, exempts=()):
    """Rend la liste des fautes. Vide = l'affichage est permis.

    `exempts` : les lignes qui portent un NOM donne par le client (un nom
    d'angle, un nom d'audience). Ce sont ses etiquettes, pas des phrases : un
    angle qu'il a appele « A1 prix casse » ne doit pas bloquer tout son
    classement. Le mot COD, les mots marocains et les chiffres poses sur une
    ligne arabe restent verifies MEME sur ces lignes.

    CE QUE CE CONTROLE N'ATTRAPE PAS : une phrase francaise ecrite avec
    d'autres mots que ceux de la liste. Ce n'est pas un detecteur de
    francais — c'est un filet sur les fautes connues. L'agent relit."""
    exempts = set(e.strip() for e in exempts if e.strip())
    fautes = []
    for i, ligne in enumerate(texte.split("\n"), 1):
        arabe = bool(ARABE.search(ligne))
        exempt = ligne.strip() in exempts
        technique = bool(TECHNIQUE.search(ligne)) and not arabe
        if arabe and CHIFFRE.search(ligne):
            fautes.append((i, "un chiffre sur une ligne arabe", ligne))
        # le mot COD se verifie TOUJOURS : une ligne qui contient une adresse
        # web sautait tous les filtres, COD compris.
        if COD_INTERDIT.search(ligne):
            fautes.append((i, "le mot COD est interdit partout", ligne))
        for mot in MAROCAIN:
            if mot in ligne:
                fautes.append((i, "un mot marocain : %s" % mot, ligne))
                break
        if technique or exempt:
            continue
        if FRANCAIS_INTERDIT.search(ligne):
            if arabe:
                fautes.append((i, "un mot francais dans une phrase arabe", ligne))
            elif not LATIN_PERMIS.match(ligne):
                fautes.append((i, "une phrase francaise que le client ne lit pas", ligne))
    return fautes


def controle_message_client(texte, exempts=()):
    """Le controle d'un texte destine au client : en plus des deux lois, il
    DOIT contenir de l'arabe. Un texte entierement latin qui passe la liste
    des mots interdits reste un texte que le client ne lit pas."""
    fautes = controle_affichage(texte, exempts)
    if not ARABE.search(texte) and MOT_LATIN.search(texte):
        fautes.append((0, "ce texte n'a pas un seul mot d'arabe", texte[:60]))
    return fautes


def mots_latins_dans(bloc, permis=()):
    """Un bloc de prose destine au client s'ecrit EN ARABE. La liste des mots
    francais interdits est fermee : « tout de suite » ou « tunnel » passaient
    a travers. Ici on ne cherche pas les mots d'une liste — on refuse TOUT mot
    latin dans un bloc qui doit etre en arabe. Les noms propres ont leur
    place : celle du nom du modele, pas celle du texte."""
    permis = set(p.lower() for p in permis)
    return [m for m in MOT_LATIN.findall(str(bloc)) if m.lower() not in permis]


def montrer(texte, exempts=()):
    fautes = controle_affichage(texte, exempts)
    if fautes:
        print("REFUS D'AFFICHAGE — les lois de la langue ne passent pas :")
        for i, quoi, ligne in fautes:
            print("   ligne %d — %s" % (i, quoi))
            print("      %s" % ligne)
        sys.exit(1)
    print(texte)


def lignes_nom(nom):
    """Un nom d'angle comme « A4 الاعتراض » melange un code latin et de
    l'arabe sur la MEME ligne : chez le client ca s'affiche a l'envers.
    On le coupe en deux lignes — le code seul, le nom arabe seul.
    Le client nomme ses angles comme il veut ; c'est a l'outil de savoir
    les afficher, pas a lui de changer sa facon d'ecrire."""
    nom = nom_propre(nom)
    arabe = "".join(c for c in nom if ARABE.match(c) or c in " ،؛؟").strip()
    latin = "".join(c for c in nom if not ARABE.match(c)).strip(" -·:")
    lignes = []
    if latin:
        lignes.append("      " + latin)
    if arabe:
        lignes.append("  " + arabe)
    return lignes or ["      " + nom]


def ligne_nombre(valeur_da):
    """Le deuxieme montant se calcule avec le taux REEL du client des qu'il
    l'a donne. Sinon l'ecran affichait toujours le meme cours, quel que soit
    ce que sa banque lui prend."""
    d = DEVISE_COMPTE if DEVISE_COMPTE in VERS_DINARS else "USD"
    if d == "DZD":
        return "      %d DA" % arrondi(valeur_da)
    taux = TAUX_DINAR if TAUX_DINAR else VERS_DINARS[d]
    return "      %d DA   =   %.2f %s" % (arrondi(valeur_da), valeur_da / taux, d)


def ligne_pourcent(part):
    return "      %d %%" % arrondi(part * 100.0)


# ===========================================================================
# 3. LES MONNAIES — le piege le plus cher de tous
# ===========================================================================

def lire_devise(mot):
    if not mot:
        return None
    m = str(mot).strip().upper()
    m = ALIAS_DEVISE.get(m, m)
    if m not in DEVISES:
        raise ValueError("devise inconnue : %s — attendu DZD, USD ou EUR" % mot)
    return m


def convertir_en_dinars(valeur, devise, taux_dinar):
    """Meta compte dans la devise du compte. L'outil compte en dinars.
    Un montant en dollars traite comme des dinars divise le cout par deux
    cent soixante : l'angle le plus cher devient le plus rentable.

    LE TAUX VIENT DU CLIENT, pas de l'outil. Ce n'est pas le cours du jour :
    c'est ce que sa banque lui prend reellement. Personne d'autre ne le sait."""
    if devise == "DZD":
        return float(valeur)
    if taux_dinar is None or taux_dinar <= 0:
        raise ValueError(
            "il faut --taux-dinar : combien de dinars pour un %s, "
            "le taux REEL du client, pas un cours trouve quelque part" % devise)
    if not (50.0 <= taux_dinar <= 500.0):
        raise ValueError(
            "taux suspect : %s dinars pour un %s. Redemande-lui." % (taux_dinar, devise))
    return float(valeur) * float(taux_dinar)


def nombre_fini(valeur, nom):
    """float() accepte « nan » et « inf ». Les deux traversaient tous les
    calculs et sortaient en traceback au moment de l'affichage."""
    v = float(valeur)
    if v != v or v in (float("inf"), float("-inf")):
        raise ValueError("%s n'est pas un nombre : %r" % (nom, valeur))
    return v


def nom_propre(nom):
    """Un nom d'angle peut contenir un retour chariot : il efface sa propre
    ligne dans le terminal et un faux montant peut apparaitre a sa place.
    Et les chiffres arabo-indiens, dans un nom, bloquaient tout l'affichage :
    on les ramene en chiffres latins, qui partent sur la ligne du code."""
    nom = "".join(c for c in str(nom) if c.isprintable() or c == " ")
    for i, arabe in enumerate("٠١٢٣٤٥٦٧٨٩"):
        nom = nom.replace(arabe, str(i))
    for i, persan in enumerate("۰۱۲۳۴۵۶۷۸۹"):
        nom = nom.replace(persan, str(i))
    return nom.strip()


def arrondi(valeur):
    """round() de Python arrondit au pair : 802.5 devenait 802, et le chiffre
    affiche ne valait plus celui qu'on demande de repasser a l'outil."""
    import math
    return math.floor(valeur + 0.5) if valeur >= 0 else -math.floor(-valeur + 0.5)


def garde_plancher(nom_option, valeur_da):
    """Un montant en dinars sous son plancher est presque toujours un montant
    en dollars qu'on a oublie de convertir. On refuse au lieu de calculer."""
    mini = PLANCHER_PLAUSIBLE_DA.get(nom_option)
    if mini is None or valeur_da <= 0:
        return
    if valeur_da < mini:
        raise ValueError(
            "%s vaut %s : c'est trop bas pour des DINARS. "
            "Tu as sans doute donne des dollars. Convertis d'abord."
            % (nom_option, valeur_da))


# ===========================================================================
# 4. LES DATES — pour que les delais ne soient plus des nombres inventes
# ===========================================================================

def lire_date(texte, nom="la date"):
    """Accepte AAAA-MM-JJ ou AAAA-MM-JJTHH:MM (ou avec un espace).

    Et une date ISO avec son fuseau (« 2026-10-06T19:30:00.000Z », le lanceLe
    de la fiche du bureau) : elle est RAMENEE A L'HEURE DU PC, celle sur
    laquelle l'outil compte. Avant, elle etait refusee (« ne se lit pas ») —
    et recopiee a la main sans son Z, l'heure de Greenwich passait pour
    l'heure locale : en Algerie, la premiere hausse partait une heure avant
    la fin des 72 heures."""
    t = str(texte).strip()
    if "T" in t and re.search(r"(Z|[+-]\d\d:?\d\d)$", t):
        try:
            d = datetime.datetime.fromisoformat(re.sub(r"Z$", "+00:00", t))
            return d.astimezone().replace(tzinfo=None)
        except ValueError:
            raise ValueError("%s ne se lit pas : %r — attendu AAAA-MM-JJ" % (nom, texte))
    t = t.replace("T", " ")
    for forme in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.datetime.strptime(t, forme)
        except ValueError:
            continue
    raise ValueError("%s ne se lit pas : %r — attendu AAAA-MM-JJ" % (nom, texte))


def heures_entre(debut, fin):
    return (fin - debut).total_seconds() / 3600.0


# ===========================================================================
# 5. LE BREAK EVEN — PAR PRODUIT. Meme formule que l'agent testing.
# ===========================================================================

def break_even(prix_vente, cout_produit, emballage, livraison, frais_cod,
               cout_retour, taux_confirmation, taux_livraison):
    """IDENTIQUE a celle de l'agent testing, volontairement.
    Un controle plus bas verifie qu'elles rendent le meme chiffre sur un
    cas de reference : deux formules dans deux fichiers finissent toujours
    par se contredire, alors on le teste au lieu de l'esperer.

    CE QU'ELLE REND N'EST PAS UN BENEFICE NET : c'est ce qui reste AVANT de
    payer la publicite. C'est exactement le plafond de ce qu'une commande
    peut couter en publicite. D'ou le nom : break even."""
    for nom, v in (("prix", prix_vente), ("produit", cout_produit),
                   ("emballage", emballage), ("livraison", livraison),
                   ("frais", frais_cod), ("retour", cout_retour)):
        if v < 0:
            raise ValueError("un montant negatif : %s" % nom)
    for nom, t in (("confirmation", taux_confirmation), ("livraison", taux_livraison)):
        if not (0.0 < t <= 1.0):
            raise ValueError("taux de %s hors de 0 a 1 : %s" % (nom, t))

    marge_livree = prix_vente - cout_produit - emballage - livraison - frais_cod
    confirmees = 100.0 * taux_confirmation
    livrees = confirmees * taux_livraison
    retours = confirmees - livrees
    net = livrees * marge_livree - retours * cout_retour
    return {
        "marge_livree": marge_livree, "net_sur_100": net,
        "par_commande": net / 100.0,
        "par_confirmee": net / confirmees if confirmees else 0.0,
        "par_livree": net / livrees if livrees else 0.0,
        "confirmees": confirmees, "livrees": livrees, "retours": retours,
        "passe": net > 0.0,
    }


# ===========================================================================
# 6. LOI 1 — le BENEFICE NET par colis expedie, DEPENSE PUBLICITAIRE COMPRISE
# ===========================================================================

def benefice_net_par_colis(livres, retours, marge_livree, cout_retour, depense):
    """LA MESURE QUI COMPTE. Deux audiences peuvent livrer le meme nombre
    de colis : celle qui retourne moins rapporte beaucoup plus.

    LA DEPENSE PUBLICITAIRE EST DEDANS, ET ELLE EST OBLIGATOIRE.
    Sans elle, ce chiffre n'est pas un benefice : c'est une marge brute, et
    elle affiche un profit sur un angle qui a coute deux fois ce qu'il a
    rapporte. C'est exactement l'ecran sur lequel se prend la decision de
    monter le budget — il ne peut pas mentir."""
    if depense is None or depense < 0:
        raise ValueError("la depense publicitaire est obligatoire et positive")
    if livres < 0 or retours < 0:
        raise ValueError("un nombre de colis negatif")
    expedies = livres + retours
    net = livres * marge_livree - retours * cout_retour - depense
    return {
        "expedies": expedies, "livres": livres, "retours": retours,
        "depense": depense,
        "taux_livraison": (float(livres) / expedies) if expedies else 0.0,
        "benefice_net": net,
        "benefice_net_par_colis": (net / expedies) if expedies else None,
        "sans_colis": expedies == 0,
        "juge": expedies >= COLIS_MINI_PAR_ANGLE,
    }


def classer(elements, marge_livree, cout_retour):
    """elements : [(nom, livres, retours, depense_en_dinars), ...]

    Rend le classement par BENEFICE NET par colis expedie, le classement
    trompeur pour comparaison, la liste de ceux qui n'ont RIEN sorti, et
    surtout LE TOTAL DE LA CAMPAGNE.

    Le total n'est pas un ornement : sans lui, une campagne ou un seul angle
    brule quatre cent mille dinars sans sortir un colis affichait quand meme
    un « gagnant » a scaler, parce que le verdict ne regardait que les angles
    qui avaient sorti quelque chose."""
    avec, sans = [], []
    for nom, liv, ret, dep in elements:
        r = benefice_net_par_colis(liv, ret, marge_livree, cout_retour, dep)
        r["nom"] = nom
        (sans if r["sans_colis"] else avec).append(r)
    tous = avec + sans
    # les angles trop maigres ne sont ni classes ni couronnes : un angle de
    # deux colis passait premier et l'outil le designait gagnant dans la ligne
    # suivante celle ou il ecrivait « العدد قليل ».
    juges = [r for r in avec if r["juge"]]
    maigres = [r for r in avec if not r["juge"]]
    par_benefice = sorted(juges, key=lambda r: -r["benefice_net_par_colis"])
    par_livres = sorted(juges, key=lambda r: -r["livres"])
    total_net = sum(r["benefice_net"] for r in tous)
    total_depense = sum(r["depense"] for r in tous)
    total_expedies = sum(r["expedies"] for r in tous)
    total_livres = sum(r["livres"] for r in tous)
    return {
        "par_benefice": par_benefice,
        "par_livres": par_livres,
        "maigres": sorted(maigres, key=lambda r: -r["depense"]),
        "sans_colis": sorted(sans, key=lambda r: -r["depense"]),
        "noms": [r["nom"] for r in tous],
        "jugeables": len(juges),
        "assez": len(juges) >= 2,
        "manque": max(0, 2 - len(juges)),
        "meme_gagnant": bool(par_benefice) and bool(par_livres)
                        and par_benefice[0]["nom"] == par_livres[0]["nom"],
        "total_net": total_net,
        "total_depense": total_depense,
        "total_expedies": total_expedies,
        "total_livres": total_livres,
        # une campagne qui n'a rien depense n'est pas « en perte » : elle
        # n'a rien fait. Sans ce garde-fou, l'alarme criait dans le vide.
        "total_en_perte": total_depense > 0 and total_net <= 0,
    }


def garde_depenses(elements):
    """LE PIEGE QUE CE GARDE FERME : une depense Meta en dollars passee comme
    des dinars. Quatre cent soixante-dix dollars deviennent quatre cent
    soixante-dix dinars, et l'angle qui a le plus brule devient le plus
    rentable du classement.

    On ne peut pas deviner la monnaie d'un nombre. Mais on connait ce marche :
    en COD algerien, un colis expedie n'a jamais coute vingt dinars de
    publicite. Alors on regarde la depense PAR COLIS, et sous le plancher on
    refuse au lieu de calculer."""
    total = sum(dep for _, _, _, dep in elements)
    if total <= 0:
        raise ValueError("la depense publicitaire totale est nulle : "
                         "il n'y a rien a juger")
    if not any(liv + ret > 0 for _, liv, ret, _ in elements):
        raise ValueError(
            "aucun angle n'a sorti un seul colis. Il n'y a rien a classer, et "
            "je ne peux meme pas verifier ta monnaie : c'est le nombre de "
            "colis qui la trahit. Verifie la periode que tu as demandee des "
            "deux cotes, et les marques dans les liens.")
    if total < PLANCHER_JOUR_DA:
        raise ValueError(
            "la depense totale vaut %.2f : c'est moins d'une journee au "
            "minimum de Meta. Ce sont des dinars ? Verifie ta monnaie." % total)
    for nom, liv, ret, dep in elements:
        colis = liv + ret
        if colis >= 1 and dep / colis < PLANCHER_PAR_COLIS_DA:
            raise ValueError(
                "l'angle %s a sorti %d colis pour %.2f : ca fait %.1f par "
                "colis.\nAucun colis ne coute si peu en publicite chez nous. "
                "Deux causes possibles, regarde les DEUX :\n"
                "  1. la depense est en dollars et declaree en dinars\n"
                "     -> corrige --devise-depenses et --taux-dinar\n"
                "  2. les colis et la depense ne parlent pas du meme produit,\n"
                "     de la meme campagne, ou de la meme periode\n"
                "     -> c'est le plus frequent, et aucun flag ne le repare.\n"
                "        Reprends les deux lectures sur les MEMES dates et la\n"
                "        MEME campagne avant de relancer."
                % (nom, colis, dep, dep / colis))


# ===========================================================================
# 7. LOI 5 — le STOCK donne le budget, ET le break even le borne
# ===========================================================================

def plafond_stock(stock_restant, jours_avant_reappro, taux_confirmation,
                  cout_par_commande_da, be_par_commande_da):
    """Le stock se consomme quand on EXPEDIE, donc sur les confirmees.
    commandes/jour supportees = stock / (jours x taux_confirmation)
    budget/jour max = commandes/jour x ce que coute une commande

    LE PIEGE, ferme ici : pris tout seul, ce plafond MONTE quand le cout par
    commande monte, et il monte aussi quand la confirmation baisse. Deux
    mauvaises nouvelles qui donnent le droit de depenser plus. C'est pour ca
    que le break even par commande est OBLIGATOIRE : si une commande coute
    plus qu'elle ne rapporte, il n'y a pas de plafond a donner, il y a un
    produit a reparer. Le scaling ne repare rien — il agrandit."""
    if stock_restant <= 0:
        raise ValueError(
            "le stock est a zero. Il n'y a pas de budget a calculer : il y a "
            "une campagne a mettre en pause. Vendre ce qu'on n'a pas, c'est "
            "une cliente qui attend et un colis qui revient.")
    if jours_avant_reappro <= 0:
        raise ValueError("le nombre de jours avant reapprovisionnement doit etre positif")
    if not (0.0 < taux_confirmation <= 1.0):
        raise ValueError("taux de confirmation hors de 0 a 1")
    if cout_par_commande_da <= 0:
        raise ValueError("le cout par commande doit etre positif")
    if be_par_commande_da is None or be_par_commande_da <= 0:
        raise ValueError("le break even par commande est obligatoire et positif")
    commandes_jour = stock_restant / (jours_avant_reappro * taux_confirmation)
    gain = be_par_commande_da - cout_par_commande_da
    # a cout EGAL au break even, on ne gagne rien : dire « baisse d'au moins
    # zero » n'est pas une instruction. On demande une baisse reelle.
    doit_baisser = (-gain) if gain < 0 else (0.0 if gain > 0 else 1.0)
    return {
        "commandes_par_jour": commandes_jour,
        "budget_max_da": commandes_jour * cout_par_commande_da,
        "cout_par_commande_da": cout_par_commande_da,
        "be_par_commande_da": be_par_commande_da,
        "gain_par_commande_da": gain,
        "rentable": gain > 0,
        "doit_baisser_de_da": doit_baisser,
        "sous_le_plancher": commandes_jour * cout_par_commande_da < PLANCHER_JOUR_DA,
    }


def hausse_permise(be_par_commande_da, cout_par_commande_da):
    """Dans la fourchette du vendeur (+20 a 30 %), laquelle ? La MESURE
    tranche : une commande qui coute au moins trente pour cent de moins que
    son break even laisse de la place, +30 %. Plus pres du break even, la
    hausse prudente, +20 %. Une commande au-dessus du break even n'a droit a
    rien — c'est --echelle qui le refuse, pas cette fonction."""
    if be_par_commande_da is None or be_par_commande_da <= 0:
        raise ValueError("le break even par commande est obligatoire et positif")
    marge = (be_par_commande_da - cout_par_commande_da) / float(be_par_commande_da)
    return HAUSSE_MAX if marge >= MARGE_HAUSSE_FORTE else HAUSSE_MIN


def lire_hausse(valeur):
    """--hausse 0.25 ou --hausse 25 : les deux veulent dire vingt-cinq pour
    cent. Hors de la fourchette du vendeur, c'est un REFUS, pas un rabot :
    « +50 % » ramene en silence a trente ferait croire au client qu'on a
    pose ce qu'il a demande."""
    v = nombre_fini(valeur, "--hausse")
    if v > 1.0:
        v = v / 100.0
    if not (HAUSSE_MIN - 1e-9 <= v <= HAUSSE_MAX + 1e-9):
        raise ValueError("--hausse vaut %d %% : la regle du vendeur est de %d a %d %% "
                         "d'un coup, une fois par 48 heures au plus"
                         % (arrondi(v * 100), arrondi(HAUSSE_MIN * 100),
                            arrondi(HAUSSE_MAX * 100)))
    return v


def echelle_budget(budget_actuel_da, plafond_stock_da, heures_depuis_derniere,
                   rentable_hier, heures_depuis_lancement, hausse=HAUSSE_MIN):
    """La montee : +20 a 30 % d'un coup (la hausse est choisie par
    hausse_permise), jamais avant la fin des trois premiers
    jours, ensuite pas plus d'une fois par 48 heures, jamais au-dessus du
    plafond du stock, jamais apres un jour en perte.

    LES DEUX DELAIS NE SE CONTREDISENT PAS : 72 heures avant la PREMIERE
    hausse (Meta apprend, on ne touche a rien), puis 48 heures entre deux
    hausses. C'est une porte d'entree et un rythme, pas deux regles rivales.

    heures_depuis_derniere vaut None quand il n'y a jamais eu de hausse."""
    if not (HAUSSE_MIN - 1e-9 <= hausse <= HAUSSE_MAX + 1e-9):
        raise ValueError("une hausse de %d %% sort de la fourchette du vendeur "
                         "(%d a %d %%)" % (arrondi(hausse * 100),
                                           arrondi(HAUSSE_MIN * 100),
                                           arrondi(HAUSSE_MAX * 100)))
    if budget_actuel_da < PLANCHER_JOUR_DA:
        return {"autorise": False, "pourquoi": "BUDGET_SUSPECT",
                "propose_da": budget_actuel_da}
    if not rentable_hier:
        return {"autorise": False, "pourquoi": "PERTE",
                "propose_da": budget_actuel_da}
    if heures_depuis_lancement < BROAD_HEURES:
        return {"autorise": False, "pourquoi": "BROAD",
                "heures_a_attendre": BROAD_HEURES - heures_depuis_lancement,
                "propose_da": budget_actuel_da}
    if heures_depuis_derniere is not None and heures_depuis_derniere < HEURES_ENTRE_HAUSSES:
        return {"autorise": False, "pourquoi": "TROP_TOT",
                "heures_a_attendre": HEURES_ENTRE_HAUSSES - heures_depuis_derniere,
                "propose_da": budget_actuel_da}
    if budget_actuel_da >= plafond_stock_da:
        return {"autorise": False, "pourquoi": "PLAFOND_STOCK",
                "propose_da": budget_actuel_da}
    propose = budget_actuel_da * (1.0 + hausse)
    bride = propose > plafond_stock_da
    if bride:
        propose = plafond_stock_da
    return {"autorise": True, "propose_da": propose,
            "bride_par_le_stock": bride, "hausse": hausse,
            "pourquoi": "OK"}


# ===========================================================================
# 7 bis. LA CAMPAGNE DE SCALE — le gagnant, puis son depart en CBO
# ===========================================================================

def choisir_gagnant(annonces):
    """annonces : [(code, resultats, depense_en_dinars), ...] — une ligne par
    annonce du TEST, lue dans Meta sur la meme periode (depuis le lancement).

    LE GAGNANT est l'annonce dont le resultat coute le MOINS, parmi celles qui
    ont au moins RESULTATS_MINI_GAGNANT resultats : deux achats qui tombent
    bien ne sont pas une preuve. A cout egal, celle qui en a le plus.

    Pourquoi pas de break even ici : la porte du coach s'est ouverte sur le
    TOTAL de la campagne (toutes les annonces, depense comprise). Le moins
    cher des resultats est au plus egal a la moyenne : si le total gagne, le
    gagnant gagne. Ce que cette fonction ferme, c'est le gagnant au hasard
    — un seul resultat a deux dollars couronne devant quarante a quatre."""
    if not annonces:
        raise ValueError("aucune annonce a juger")
    vus = set()
    lignes = []
    for code, res, dep in annonces:
        code = nom_propre(code)
        if not code:
            raise ValueError("une annonce sans identifiant")
        if code in vus:
            raise ValueError("l'annonce %s est donnee deux fois" % code)
        vus.add(code)
        if res < 0 or dep < 0:
            raise ValueError("un nombre negatif pour l'annonce %s" % code)
        lignes.append({"code": code, "resultats": int(res), "depense_da": float(dep),
                       "cout_resultat_da": (float(dep) / res) if res > 0 else None,
                       "juge": res >= RESULTATS_MINI_GAGNANT and dep > 0})
    total = sum(l["depense_da"] for l in lignes)
    if total < PLANCHER_JOUR_DA:
        raise ValueError(
            "la depense totale des annonces vaut %.2f : c'est moins d'une "
            "journee au minimum de Meta. Ce sont des dinars ? Verifie ta "
            "monnaie, et la periode." % total)
    juges = sorted([l for l in lignes if l["juge"]],
                   key=lambda l: (l["cout_resultat_da"], -l["resultats"]))
    meilleur = max(lignes, key=lambda l: l["resultats"])
    return {
        "autorise": bool(juges),
        "pourquoi": "OK" if juges else "PAS_ASSEZ",
        "gagnant": juges[0] if juges else None,
        "classement": juges,
        "pas_juges": [l for l in lignes if not l["juge"]],
        "manque": 0 if juges else max(0, RESULTATS_MINI_GAGNANT - meilleur["resultats"]),
        "total_depense_da": total,
        "total_resultats": sum(l["resultats"] for l in lignes),
    }


def depart_scale(budget_gagnant_da, plafond_stock_da, budget_test_da,
                 be_par_commande_da, cout_par_commande_da):
    """Le depart de la campagne de SCALE, en CBO : combien d'ad sets (un a
    trois) et quel budget de CAMPAGNE.

    CHAQUE AD SET vaut au depart ce que le gagnant depensait au test — le
    budget sur lequel il a fait ses preuves. On en ouvre autant que le STOCK
    le porte, trois au plus. Le stock se partage : un test qui tourne encore
    consomme les memes pieces, son budget sort du plafond avant le calcul.

    LES REFUS, dans l'ordre : une commande qui coute plus que son break even
    (on ne scale pas une perte), un stock qui ne porte meme pas le plancher
    de Meta une fois le test servi. Un stock qui porte moins d'un ad set
    entier ouvre UN ad set, bride au plafond — et le dit."""
    for nom, v in (("le budget du gagnant", budget_gagnant_da),
                   ("le plafond du stock", plafond_stock_da),
                   ("le budget du test", budget_test_da)):
        if v is None or v != v or v < 0:
            raise ValueError("%s est impossible : %r" % (nom, v))
    if budget_gagnant_da < PLANCHER_JOUR_DA:
        raise ValueError(
            "le budget du gagnant vaut %.2f par jour : c'est trop bas pour des "
            "DINARS. Tu as sans doute donne des dollars. Convertis d'abord."
            % budget_gagnant_da)
    if be_par_commande_da is None or be_par_commande_da <= 0:
        raise ValueError("le break even par commande est obligatoire et positif")
    if cout_par_commande_da <= 0:
        raise ValueError("le cout par commande doit etre positif")
    dispo = plafond_stock_da - budget_test_da
    base = {"budget_gagnant_da": budget_gagnant_da, "plafond_stock_da": plafond_stock_da,
            "budget_test_da": budget_test_da, "plafond_dispo_da": dispo,
            "ad_sets": 0, "budget_campagne_da": 0.0, "bride_par_le_stock": False}
    if cout_par_commande_da >= be_par_commande_da:
        return dict(base, autorise=False, pourquoi="PERTE",
                    doit_baisser_de_da=cout_par_commande_da - be_par_commande_da)
    if dispo < PLANCHER_JOUR_DA:
        return dict(base, autorise=False, pourquoi="PLAFOND_STOCK")
    n = int(math.floor(dispo / budget_gagnant_da + 1e-9))
    n = max(1, min(SCALE_AD_SETS_MAX, n))
    budget = n * budget_gagnant_da
    bride = budget > dispo
    if bride:
        budget = dispo
    return dict(base, autorise=True, pourquoi="OK", ad_sets=n,
                budget_campagne_da=budget, budget_par_ad_set_da=budget / n,
                bride_par_le_stock=bride)


def centimes_meta(montant_da, devise, taux_dinar):
    """Le budget que Meta attend : un ENTIER, dans la plus petite unite de la
    devise du COMPTE (des centimes, en USD, en EUR comme en DZD).

    LE PIEGE, ferme ici : la ligne « a repasser » donnait le budget de la
    campagne EN DINARS, avec la consigne « dans la plus petite unite de la
    devise du compte ». Sur un compte en dollars, 5502 DA devenaient 550200
    centimes : 5502 dollars par jour au lieu de 21, et aucun plafond de
    depense ne l'arretait. L'outil donne maintenant le nombre a poser.

    MEME CALCUL QUE LE BUREAU (missions.mjs, depart de la scale) :
    floor(dinars / taux * 100), vers le BAS — on ne pose jamais un centime de
    plus que ce que le stock porte."""
    if devise == "DZD":
        return int(math.floor(float(montant_da) * 100 + 1e-6))
    if not taux_dinar or taux_dinar <= 0:
        raise ValueError("il faut le taux du client pour donner des centimes de %s"
                         % devise)
    return int(math.floor(float(montant_da) / float(taux_dinar) * 100 + 1e-6))


# ===========================================================================
# 8. LOI 3 — les audiences : exclude et include d'abord, lookalike apres
# ===========================================================================

PLANCHERS_META_AUDIENCE = (20, 1000)


def porte_audiences(retrouves_par_meta):
    """retrouves_par_meta : le nombre que META annonce apres l'envoi,
    PAS le nombre de numeros envoyes. Le taux de correspondance sur des
    numeros algeriens ne se devine pas — on le LIT chez Meta.
    Meta rend souvent une FOURCHETTE : on passe la borne BASSE."""
    if retrouves_par_meta is None:
        return {"exclusion": False, "lookalike": False,
                "etat": "PAS_ENCORE_ENVOYE"}
    # Meta sert TRES souvent 20 pile ou 1000 pile, borne basse egale a la
    # borne haute : ce ne sont pas des mesures, ce sont ses planchers
    # d'affichage. Prendre 1000 pile pour « mille personnes » fait ouvrir un
    # lookalike sur un nombre que personne n'a jamais compte.
    plancher = retrouves_par_meta in PLANCHERS_META_AUDIENCE
    return {
        "retrouves": retrouves_par_meta,
        # une exclusion sert des le premier nom : elle ne cible pas, elle retire
        "exclusion": retrouves_par_meta > 0,
        "lookalike": retrouves_par_meta >= LOOKALIKE_MINI_RETROUVES and not plancher,
        "confortable": retrouves_par_meta >= LOOKALIKE_CONSEILLE and not plancher,
        "plancher_meta": plancher,
        "manque_pour_lookalike": max(0, LOOKALIKE_MINI_RETROUVES - retrouves_par_meta),
        "etat": ("CHIFFRE_INCONNU" if plancher
                 else "LOOKALIKE_POSSIBLE" if retrouves_par_meta >= LOOKALIKE_MINI_RETROUVES
                 else "EXCLUSION_SEULEMENT" if retrouves_par_meta > 0
                 else "VIDE"),
    }


# ===========================================================================
# 9. LA PORTE DU SCALING — RELUE, jamais recalculee ici
# ===========================================================================

def porte_scaling(confirmees, commandes, livrees, expediees, stock_restant,
                  be_par_livree, cout_par_livree, retours=0):
    if commandes <= 0 or expediees <= 0:
        raise ValueError("il faut des commandes et des colis expedies")
    if confirmees > commandes:
        raise ValueError("plus de confirmees que de commandes : %s contre %s"
                         % (confirmees, commandes))
    if expediees > confirmees:
        raise ValueError("plus d'expediees que de confirmees : %s contre %s. "
                         "Un colis ne part pas avant d'etre confirme."
                         % (expediees, confirmees))
    if livrees > expediees:
        raise ValueError("plus de livrees que d'expediees : %s contre %s"
                         % (livrees, expediees))
    if confirmees < 0 or livrees < 0 or stock_restant < 0:
        raise ValueError("un nombre negatif")
    if retours < 0 or livrees + retours > expediees:
        raise ValueError("retours incoherents : %s livrees + %s retours sur %s expediees"
                         % (livrees, retours, expediees))
    t_conf = float(confirmees) / commandes
    # LA LIVRAISON, SA LOI : un colis encore en route se compte a TROIS SUR DIX.
    # Diviser les livrees par les expediees en ignorant les colis en route
    # rendait la porte fausse tant que le calendrier du colis n'avait pas
    # tourne : elle s'ouvrait APRES l'arret de la publicite (mesure sur les
    # trois scenarios, 19/09/2026). On garde le taux brut pour l'afficher.
    en_route = expediees - livrees - retours
    t_liv_brut = float(livrees) / expediees
    t_liv = (livrees + en_route * PIRE_CAS_LIVRAISON) / float(expediees)
    controles = [
        ("confirmation", t_conf >= PORTE_CONFIRMATION),
        ("livraison", t_liv >= PORTE_LIVRAISON),
        ("colis livres", livrees >= PORTE_LIVREES),
        ("rentabilite", cout_par_livree is not None and cout_par_livree <= be_par_livree),
        ("stock", stock_restant > 0),
    ]
    fermes = [n for n, ok in controles if not ok]
    return {"controles": controles, "ouverte": not fermes, "ferme_par": fermes,
            "taux_confirmation": t_conf, "taux_livraison": t_liv,
            "taux_livraison_brut": t_liv_brut, "en_route": en_route, "retours": retours,
            "livrees": livrees, "stock": stock_restant,
            "cout_par_livree": cout_par_livree, "be_par_livree": be_par_livree}


# ===========================================================================
# 10. LES AFFICHAGES — en arabe, les nombres seuls sur leur ligne
# ===========================================================================

BARRE = "=============================================================="
RIEN_NE_PART = ["  هاذا ما يبدّل والو في ميتا.",
                "  يحسب برك. اليد تاعك هي لي تبدّل."]


def vue_break_even(r, prix):
    L = [BARRE, "  البريك إيفن تاع هاذ المنتج", BARRE, "",
         "  الثمن", ligne_nombre(prix), "",
         "  لي يبقى في كل كولي يوصل، قبل الإشهار",
         ligne_nombre(r["marge_livree"]), "",
         "  على كل مية طلبية :", "",
         "  لي يتأكدو", "      %d" % arrondi(r["confirmees"]), "",
         "  لي يوصلو", "      %d" % arrondi(r["livrees"]), "",
         "  لي يرجعو", "      %d" % arrondi(r["retours"]), "", ""]
    L += ["  لي يبقى في كل طلبية، قبل الإشهار",
          ligne_nombre(r["par_commande"]), "",
          "  لي يبقى في كل وحدة تأكدت، قبل الإشهار",
          ligne_nombre(r["par_confirmee"]), "",
          "  لي يبقى في كل كولي وصل، قبل الإشهار",
          ligne_nombre(r["par_livree"]), "", ""]
    L += ["  هاذا ماشي الربح الصافي.",
          "  هاذا هو أكبر حاجة تقدر تخلّص في الإشهار",
          "  على كل طلبية. لهيه سمّيناه البريك إيفن.", "", ""]
    if r["passe"]:
        L += ["  بهاذ الريتم، إذا الطلبية تكلّفك في الإشهار أكثر من",
              ligne_nombre(r["par_commande"]),
              "  راك لا رابح لا خاسر. فوقها، راك تخسر.", ""]
    else:
        L += ["  بهاذ الريتم، حتى كي الإشهار يكون بلاش،",
              "  المنتج يخسر. ما يتسكّالاش.",
              "  لازم تبدّل الثمن، ولا تنقص التكلفة،",
              "  ولا تحسّن التوصيل. السكايلينغ ما يصلّح والو.", ""]
    L += ["  هاذا محسوب على الأرقام لي عطيتني.", ""]
    L.append(BARRE)
    return "\n".join(L)


def vue_plafond(p, stock, jours):
    L = [BARRE, "  السطوك هو لي يعطي البودجي", BARRE, "",
         "  السطوك لي باقي", "      %d" % stock, "",
         "  الأيام قبل ما يجي الجديد", "      %d" % jours, "",
         "  الطلبيات لي السطوك يحملهم في النهار",
         "      %.1f" % p["commandes_par_jour"], "", ""]
    if not p["rentable"]:
        L += ["  وقف. ما نعطيكش حد.", "",
              "  الطلبية اليوم تكلّفك", ligne_nombre(p["cout_par_commande_da"]), "",
              "  والبريك إيفن في كل طلبية", ligne_nombre(p["be_par_commande_da"]), "",
              "  لازم التكلفة تنقص على الأقل ب",
              ligne_nombre(p["doit_baisser_de_da"]), "",
              "  كل طلبية زايدة تزيد الخسارة.",
              "  السكايلينغ ما يصلّحش حاجة تخسر — يكبّرها.", "",
              "  واش تدير :",
              "  نقّص تكلفة الطلبية، ولا طلّع الثمن،",
              "  ولا حسّن التأكيد والتوصيل. ومن بعد عاود احسب.", "",
              "  وما كاين حتى حد نعطيوهولك اليوم.",
              "  يعني ما كاين حتى زيادة في البودجي. الجواب : لا.", ""]
        L += RIEN_NE_PART + [""]
        L.append(BARRE)
        return "\n".join(L)
    L += ["  الربح في كل طلبية بهاذ التكلفة",
          ligne_nombre(p["gain_par_commande_da"]), "", "",
          "  أكبر بودجي في النهار", ligne_nombre(p["budget_max_da"]), "",
          "  فوق هاذا، راك تبيع حاجة ما عندكش.",
          "  الزبونة تستنى، والكولي يرجع، والدراهم تروح.", ""]
    if p["sous_le_plancher"]:
        L += ["  انتبه. هاذ الحد صغير بزاف على ميتا.",
              "  السطوك ما يحملش كامباين تخدم مليح.",
              "  لازم إنتاج قبل ما نكبّرو.", ""]
    L += RIEN_NE_PART
    L.append(BARRE)
    return "\n".join(L)


def vue_classement(c, titre_ar):
    L = [BARRE, "  " + titre_ar, BARRE, ""]
    if not c["assez"]:
        L += ["  انتبه. مازال ما نقدروش نحكمو.", "",
              "  لي نقدرو نحكمو عليهم", "      %d" % c["jugeables"], "",
              "  لي ناقص", "      %d" % c["manque"], "",
              "  الأرقام لتحت نوريهملك باش تشوف،",
              "  بصح ما نسمّيو حتى واحد رابح.",
              "  السكايلينغ ما يبداش حيت الباب تحلّ.",
              "  يبدا كي نعرفو أنهي كرياتيف تخدم وأنهي لا.", "",
              "  " + "-" * 50, ""]
    for i, r in enumerate(c["par_benefice"], 1):
        L += ["  المرتبة", "      %d" % i, ""]
        L += lignes_nom(r["nom"])
        L += ["",
              "  وصلو", "      %d" % r["livres"], "",
              "  رجعو", "      %d" % r["retours"], "",
              "  الدراهم لي خرجو عليه", ligne_nombre(r["depense"]), "",
              "  الربح الصافي في كل كولي خرج،",
              "  من بعد ما نقصنا دراهم الإشهار",
              ligne_nombre(r["benefice_net_par_colis"]), ""]
        if r["benefice_net"] <= 0:
            L += ["  هاذا خاسر.", ""]
        L.append("  " + "-" * 50)
        L.append("")
    for r in c["maigres"]:
        L += lignes_nom(r["nom"])
        L += ["",
              "  وصلو", "      %d" % r["livres"], "",
              "  رجعو", "      %d" % r["retours"], "",
              "  الدراهم لي خرجو عليه", ligne_nombre(r["depense"]), "",
              "  العدد قليل. ما نحكموش عليه، وما نرتّبوهش.", "",
              "  " + "-" * 50, ""]
    for r in c["sans_colis"]:
        L += lignes_nom(r["nom"])
        L += ["", "  ما خرج حتى كولي.", "",
              "  الدراهم لي خرجو عليه", ligne_nombre(r["depense"]), "",
              "  خلّص وما جابش. ما ننساوهش.", "",
              "  " + "-" * 50, ""]
    L += ["  الجملة تاع الكامباين كامل", "",
          "  الكوالي لي خرجو", "      %d" % c["total_expedies"], "",
          "  الكوالي لي وصلو", "      %d" % c["total_livres"], "",
          "  الدراهم لي خرجو كامل", ligne_nombre(c["total_depense"]), "",
          "  الربح الصافي كامل", ligne_nombre(c["total_net"]), ""]
    if c["total_en_perte"]:
        L += ["  الكامباين كامل خاسرة.", "",
              "  حتى لو واحد من الأنقل يبان رابح،",
              "  الجملة تخسر. ما كاين والو نكبّروه.",
              "  لازم نحبسو لي يخسر، ولا كرياتيف جداد،",
              "  ولا ثمن جديد، ولا تكلفة أقل.", ""]
    L.append("  " + "-" * 50)
    L.append("")
    if c["assez"] and not c["meme_gagnant"] and c["par_benefice"] and c["par_livres"]:
        L += ["  انتبه.", "",
              "  إذا رتّبت على شحال وصل، الرابح هو"]
        L += lignes_nom(c["par_livres"][0]["nom"])
        L += ["", "  وإذا رتّبت على الربح الصافي، الرابح هو"]
        L += lignes_nom(c["par_benefice"][0]["nom"])
        L += ["", "  الثاني هو الصح. لي يرجّع أقل يربّح أكثر،",
              "  حتى لو وصّل أقل.", ""]
    L += RIEN_NE_PART
    L.append(BARRE)
    return "\n".join(L)


def vue_porte(p):
    L = [BARRE, "  الباب تاع السكايلينغ", BARRE, "",
         "  التأكيد", ligne_pourcent(p["taux_confirmation"]), "",
         "  التوصيل — الكولي لي في الطريق محسوبين ثلاثة على عشرة", ligne_pourcent(p["taux_livraison"]), "",
         "  التوصيل على لي وصلو برك", ligne_pourcent(p.get("taux_livraison_brut", p["taux_livraison"])), "",
         "  الكولي لي مازالهم في الطريق", "      %d" % p.get("en_route", 0), "",
         "  الكوالي لي وصلو", "      %d" % p["livrees"], "",
         "  السطوك لي باقي", "      %d" % p["stock"], ""]
    if p["cout_par_livree"] is not None:
        L += ["  الكولي لي وصل يكلّفك في الإشهار",
              ligne_nombre(p["cout_par_livree"]), "",
              "  والبريك إيفن في كل كولي وصل",
              ligne_nombre(p["be_par_livree"]), ""]
    L += ["", "  النتيجة :", ""]
    for nom, ok in p["controles"]:
        L += ["  " + {"confirmation": "التأكيد", "livraison": "التوصيل",
                      "colis livres": "الكوالي لي وصلو",
                      "rentabilite": "الربح", "stock": "السطوك"}[nom],
              "  " + ("واه" if ok else "لا"), ""]
    if p["ouverte"]:
        L += ["  الباب محلول.", "",
              "  هاذا ما يطلق والو. يعطيك الحق تطلب برك.", ""]
    else:
        L += ["  الباب مسدود.", "",
              "  واحد برك يكفي باش يسدّو.",
              "  التأكيد المليح ما يعوّضش التوصيل الخايب —",
              "  الكولي لي ما يخرجش ما يربّحش.", ""]
    L += RIEN_NE_PART
    L.append(BARRE)
    return "\n".join(L)


def vue_audiences(a):
    L = [BARRE, "  الأوديونس — واش نقدرو نديرو بيها", BARRE, ""]
    if a["etat"] == "PAS_ENCORE_ENVOYE":
        L += ["  مازال ما بعثنا والو لميتا.", "",
              "  ابعث الليستة الأول، ومن بعد ميتا تقولك",
              "  شحال من واحد لقات. الرقم يجي منها هي،",
              "  ما يتحسبش ولا يتخمّن.", ""]
        L += RIEN_NE_PART
        L.append(BARRE)
        return "\n".join(L)
    L += ["  شحال ميتا لقات", "      %d" % a["retrouves"], ""]
    L += ["  الإقصاء", "  " + ("واه" if a["exclusion"] else "لا"), ""]
    L += ["  اللوكالايك", "  " + ("واه" if a["lookalike"] else "لا"), ""]
    if a["plancher_meta"]:
        L += ["", "  انتبه. هاذ الرقم ماشي عدّة حقيقية.", "",
              "  ميتا تعطي هاذ الرقم بالضبط كي ما تحبش تقولك",
              "  الرقم الصحيح. معناها ما نعرفوش شحال لقات.", "",
              "  الإقصاء يخدم على كل حال — ينحّي برك.",
              "  بصح اللوكالايك ما نفتحوهش على رقم ما نعرفوهش.", "",
              "  واش تدير : شوف شحال من نمرة بعثت، ومن وقتاش،",
              "  ومن بعد قرّر بهاذوك، ماشي بهاذ الرقم.", ""]
        L += RIEN_NE_PART
        L.append(BARRE)
        return "\n".join(L)
    if not a["lookalike"]:
        L += ["  باش يولّي اللوكالايك ممكن، يلزمك زيادة",
              "      %d" % a["manque_pour_lookalike"], ""]
        L += ["  بصح الإقصاء يخدم من أول واحد.",
              "  الإقصاء ما يهدفش — ينحّي. ما يحتاجش عدد.", ""]
    elif not a["confortable"]:
        L += ["  يخدم، بصح الزريعة مازال صغيرة.",
              "  كي تكبر، النتيجة تولّي أحسن.", ""]
    L += RIEN_NE_PART
    L.append(BARRE)
    return "\n".join(L)


def vue_echelle(e, budget_actuel):
    L = [BARRE, "  نطلّعو البودجي ولا لا", BARRE, "",
         "  البودجي تاع اليوم", ligne_nombre(budget_actuel), ""]
    if e["autorise"]:
        L += ["  إيه. البودجي الجديد", ligne_nombre(e["propose_da"]), ""]
        if e.get("hausse"):
            L += ["  الزيادة", ligne_pourcent(e["hausse"]), ""]
        if e["bride_par_le_stock"]:
            L += ["  حبسناه على السطوك. ما نطلعوش أكثر.", ""]
        L += ["  هاذا ما طلّع والو.",
              "  هاذا رقم برك. يستنّى الكلمة تاعك.", ""]
    else:
        raisons = {
            "PERTE": ["  لا. البارح كنت تخسر.",
                      "  ما نطلعوش بودجي على حاجة تخسر —",
                      "  الخسارة تكبر، ما تصغرش.", "",
                      "  واش تدير : شوف أنهي أنقل خاسر ونحّيه،",
                      "  ومن بعد عاود اقرا غدوة."],
            "BROAD": ["  لا. مازال في الأيام الأولى.",
                      "  في هاذ الوقت ما نلمسو والو —",
                      "  لا بودجي لا أوديونس لا كرياتيف.",
                      "  ميتا مازالها تقلّب على الناس."],
            "TROP_TOT": ["  لا. مازال بكري على الزيادة الجاية.",
                         "  ميتا تحتاج وقت باش تتعلّم.",
                         "  كي تبدّل كل نهار، ما تتعلّم أبدا."],
            "PLAFOND_STOCK": ["  لا. وصلت لحد السطوك.",
                              "  إذا تحب تطلّع أكثر، لازم إنتاج الأول.",
                              "  ولا نقّص الأيام لي تستنى فيهم السطوك."],
            "BUDGET_SUSPECT": ["  وقف. هاذ الرقم صغير بزاف باش يكون بالدينار.",
                               "  يبان لي عطيتني دولار وحسبتهم دينار.",
                               "  عاود احسبو بالدينار وجيب."],
        }
        L += raisons[e["pourquoi"]] + [""]
        if e["pourquoi"] in ("TROP_TOT", "BROAD"):
            # vers le HAUT, jamais vers le bas : "%.0f" affichait zero sous
            # trente minutes alors que la hausse etait REFUSEE. Un ecran qui
            # dit « il te reste 0 heures » et « non » a la fois autorise la
            # hausse dans la tete de celui qui le lit.
            L += ["  الساعات لي باقين",
                  "      %d" % int(math.ceil(e["heures_a_attendre"])), ""]
    L += RIEN_NE_PART
    L.append(BARRE)
    return "\n".join(L)


def vue_gagnant(g):
    L = [BARRE, "  الفيديو لي ربح في التيست", BARRE, ""]
    if g["autorise"]:
        w = g["gagnant"]
        L += ["  الأد الرابح", "      " + w["code"], "",
              "  عدد النتائج", "      %d" % w["resultats"], "",
              "  النتيجة تكلّفك", ligne_nombre(w["cout_resultat_da"]), ""]
        if len(g["classement"]) > 1:
            L += ["  لي من موراه"]
            for l in g["classement"][1:3]:
                L += ["      " + l["code"], ligne_nombre(l["cout_resultat_da"])]
            L.append("")
        L += ["  هاذا هو لي يدخل للسكايلينغ،",
              "  بالبوست تاعو، بالكومنتارات تاعو.", ""]
    else:
        L += ["  مازال ما كاينش فيديو رابح بالصح.",
              "  حتى أد ما جاب نتائج كفاية باش نحكمو.", "",
              "  النتائج لي ناقصين للأحسن واحد", "      %d" % g["manque"], "",
              "  نستناو، ومن بعد نعاودو نقراو."]
    L += RIEN_NE_PART
    L.append(BARRE)
    return "\n".join(L)


def vue_depart_scale(d):
    L = [BARRE, "  كامباين السكايلينغ — البداية", BARRE, ""]
    if d["autorise"]:
        L += ["  عدد الأد ست", "      %d" % d["ad_sets"], "",
              "  البودجي تاع الكامباين في النهار", ligne_nombre(d["budget_campagne_da"]), ""]
        if d["bride_par_le_stock"]:
            L += ["  حبسناه على السطوك. ما نزيدوش أكثر.", ""]
        L += ["  البودجي على الكامباين، ماشي على الأد ست.",
              "  ميتا هي لي تقسمو بيناتهم.",
              "  كلش يتحضّر محبوس، والكلمة تاعك هي لي تشعّلو.", ""]
    elif d["pourquoi"] == "PERTE":
        L += ["  لا. الكوموند تكلّف أكثر من البريك إيفن.",
              "  ما نكبّروش حاجة تخسر.", "",
              "  لازم تنقص على الكوموند", ligne_nombre(d["doit_baisser_de_da"]), ""]
    else:
        L += ["  لا. السطوك ما يكفيش للسكايلينغ.",
              "  كي نحسبو التيست لي راهو يخدم، ما يبقى والو.",
              "  لازم إنتاج الأول.", "",
              "  البودجي لي يقدر عليه السطوك", ligne_nombre(d["plafond_stock_da"]), ""]
    L += RIEN_NE_PART
    L.append(BARRE)
    return "\n".join(L)


def vue_rapport(produit, observation, ou, decision, choix, prochaine):
    """Le rapport quotidien, cinq blocs, exactement comme dans son cahier.
    Il passe par les lois de la langue comme tout le reste : c'est la que
    l'agent se fait attraper s'il glisse un chiffre dans une phrase arabe."""
    L = [BARRE, "  التقرير اليومي", BARRE, "",
         "  المنتج"] + lignes_nom(produit) + ["",
         "  واش شفنا", "", "  " + str(observation), "",
         "  وين شفناه", "", "  " + str(ou), "",
         "  القرار", "", "  " + str(decision), "",
         "  أحسن ثلاثة اختيارات", ""]
    for i, c in enumerate(choix[:3], 1):
        L += ["      %d" % i, "  " + str(c), ""]
    L += ["  الخطوة الجاية", "", "  " + str(prochaine), "", BARRE]
    return "\n".join(L)


def vue_broad():
    return "\n".join([
        BARRE, "  الأيام الأولى — ما نلمسو والو", BARRE, "",
        "  عدد الأيام", "      %d" % BROAD_JOURS, "",
        "  في هاذ الأيام ما نبدّلو :",
        "  لا الأوديونس · لا الكرياتيف الرابح · لا البودجي", "",
        "  نقراو ونسجّلو برك.", "",
        "  ميتا تحتاج هاذ الوقت باش تلقى الناس.",
        "  كي تبدّل فيها، ترجع للبداية وتخلّص من جديد.", "",
        "  الحاجة الوحيدة لي تحبس كلش :",
        "  السطوك خلص · الصفحة طاحت · البيكسل مات ·",
        "  الحساب توقّف · ولا الدراهم وصلو للحد.", "",
        "  وأول زيادة في البودجي ما تجيش قبل ما يكملو.", BARRE])


# ===========================================================================
# 11. LES FICHIERS — le passage, et la memoire des hausses
# ===========================================================================

def lieux_passage(dossier=None):
    """Ou chercher le fichier de passage. LE CLIENT NE DOIT PAS AVOIR A LE
    DEPLACER A LA MAIN d'un dossier d'agent a l'autre : chaque agent vit dans
    son propre dossier, et le fichier est ecrit par un autre. On regarde donc
    le dossier courant, celui de l'outil, et les dossiers VOISINS — ceux qui
    sont a cote du notre dans le meme dossier parent."""
    if dossier:
        return [dossier]
    lieux = [os.getcwd(), dossier_outil()]
    parent = os.path.dirname(dossier_outil())
    try:
        for nom in sorted(os.listdir(parent)):
            chemin = os.path.join(parent, nom)
            if os.path.isdir(chemin) and chemin not in lieux:
                lieux.append(chemin)
    except OSError:
        pass
    return lieux


def lire_passage(dossier=None, fichier=None):
    """Cherche des DEUX cotes : le dossier d'ou on lance, et celui de l'outil.
    Sinon, un fichier pose a cote de l'outil restait introuvable et l'agent
    annoncait au client que l'agent Testing n'avait pas livre — alors qu'il
    avait livre.

    ELLE REND MAINTENANT LE CHEMIN REELLEMENT LU, en troisieme. Onze endroits
    sont balayes, les dossiers VOISINS compris : sans le chemin a l'ecran,
    l'outil lisait le test d'un autre dossier — un dossier voisin pendant
    qu'on travaillait dans 4-SCALING — et l'agent l'annoncait au client comme
    le sien. Un chemin qu'on ne nomme pas est un chiffre qu'on ne peut pas verifier.

    ET --fichier DESIGNE LE FICHIER, pas son dossier. Il etait ramene a son
    dossier par dirname : un chemin qui n'existe pas rendait zero en lisant
    tranquillement le fichier d'a cote, sans un mot."""
    if fichier:
        chemin = os.path.abspath(os.path.expanduser(str(fichier)))
        if os.path.isdir(chemin):
            return None, ("--fichier designe le FICHIER de passage, pas un "
                          "dossier :\n   %s" % chemin), None
        if not os.path.exists(chemin):
            return None, ("le fichier de passage demande n'existe pas :\n   %s\n"
                          "   Rien n'a ete lu ailleurs : un fichier nomme qui "
                          "manque est un refus, pas un autre fichier." % chemin), None
    else:
        lieux = lieux_passage(dossier)
        cherches = []
        chemin = None
        for lieu in lieux:
            c = os.path.join(lieu, FICHIER_PASSAGE)
            if c not in cherches:
                cherches.append(c)
            if os.path.exists(c):
                chemin = c
                break
        if chemin is None:
            return None, ("le fichier de passage n'est pas la. Cherche dans :\n   %s"
                          % "\n   ".join(cherches)), None
    try:
        with open(chemin, encoding="utf-8") as f:
            d = json.load(f)
    except Exception as e:
        return None, "le fichier de passage ne se lit pas : %s\n   %s" % (e, chemin), chemin
    # ad_account_id et product_id sont OBLIGATOIRES : sans eux, l'agent se
    # retrouve devant vingt-sept comptes publicitaires et quatorze produits,
    # et il DEVINE lequel est le bon. Une deduction sur un compte
    # publicitaire, c'est une decision prise sur l'argent de quelqu'un
    # d'autre.
    manque = [c for c in ("cle", "couts", "break_even_par_commande_da", "devise",
                          "date_lancement", "ad_account_id", "product_id")
              if not d.get(c)]
    if manque:
        return None, ("il manque dans le fichier de passage : %s\n   lu dans %s"
                      % (", ".join(manque), chemin)), chemin
    return d, None, chemin


def dossier_outil():
    """Le journal vit A COTE DE L'OUTIL, pas dans le dossier courant.
    Lance depuis ailleurs, il ne trouvait plus le journal, ne voyait plus la
    derniere hausse, et le delai des quarante-huit heures disparaissait sans
    que rien ne s'affiche."""
    return os.path.dirname(os.path.abspath(__file__))


def chemin_journal(dossier=None, pour_ecrire=False):
    """Le journal vit a cote de l'outil. Mais un dossier de skill est souvent
    monte en LECTURE SEULE : l'ecriture partait alors en traceback, la hausse
    n'etait pas inscrite, et le delai entre deux hausses disparaissait.
    Alors : s'il existe deja quelque part, c'est celui-la. Sinon, on ecrit
    la ou on peut, et on DIT ou."""
    # LE BUREAU (03/10/2026) : un journal PAR MODELE. Sans ca, deux modeles du
    # meme client partageaient le meme delai entre deux hausses.
    dossier = dossier or os.environ.get("MANITA_DOSSIER_SCALING") or None
    if dossier:
        return os.path.join(dossier, FICHIER_SCALING)
    lieux = [dossier_outil(), os.getcwd()]
    for lieu in lieux:
        c = os.path.join(lieu, FICHIER_SCALING)
        if os.path.exists(c):
            return c
    if pour_ecrire:
        for lieu in lieux:
            if os.access(lieu, os.W_OK):
                return os.path.join(lieu, FICHIER_SCALING)
    return os.path.join(lieux[0], FICHIER_SCALING)


def lire_scaling(dossier=None):
    """Le journal des hausses. Rend (donnees, erreur).
    Absent = il n'y en a jamais eu, et ce n'est pas une erreur.
    Illisible = une ERREUR qu'on montre, jamais un silence : un journal casse
    rendait un dictionnaire vide, et une hausse faite il y a une heure
    devenait « aucune hausse jamais »."""
    chemin = chemin_journal(dossier)
    if not os.path.exists(chemin):
        return {}, None
    try:
        with open(chemin, encoding="utf-8") as f:
            d = json.load(f)
    except Exception as e:
        return None, "le journal des hausses ne se lit pas (%s) : %s" % (chemin, e)
    if not isinstance(d, dict):
        return None, "le journal des hausses n'a pas la bonne forme : %s" % chemin
    hist = d.get("hausses") or []
    if hist and not d.get("derniere_hausse"):
        # une liste de hausses sans derniere date etait lue comme
        # « aucune hausse jamais ». On la reconstitue au lieu de l'ignorer.
        d["derniere_hausse"] = hist[-1].get("quand")
    if d.get("derniere_hausse"):
        try:
            lire_date(d["derniere_hausse"], "la derniere hausse du journal")
        except ValueError as e:
            return None, str(e)
    elif hist:
        return None, ("le journal contient des hausses sans date lisible : %s"
                      % chemin)
    return d, None


def ecrire_scaling(donnees, dossier=None):
    chemin = chemin_journal(dossier, pour_ecrire=True)
    try:
        with open(chemin, "w", encoding="utf-8") as f:
            json.dump(donnees, f, ensure_ascii=False, indent=2)
    except OSError as e:
        raise ValueError(
            "impossible d'ecrire le journal des hausses (%s) : %s\n"
            "Sans lui, le delai entre deux hausses ne protege plus rien. "
            "Dis-le au client, et ne monte plus de budget avant que ce soit "
            "regle." % (chemin, e))
    return chemin


def noter_hausse(quand, budget_da, dossier=None):
    """A lancer APRES que le client a ecrit « monte » et que la hausse est
    faite dans Meta. C'est ce fichier qui donne les heures de la prochaine
    fois : sans lui, l'agent devrait inventer un nombre, et les deux delais
    ne protegeraient plus rien."""
    d, err = lire_scaling(dossier)
    if err:
        raise ValueError(err)
    if quand > datetime.datetime.now() + datetime.timedelta(minutes=5):
        raise ValueError(
            "cette hausse est datee dans le futur. Une date fausse ici bloque "
            "les hausses pendant des semaines, et ce fichier ne se repare pas "
            "a la main.")
    hist = d.get("hausses", [])
    if hist:
        derniere = lire_date(hist[-1]["quand"])
        if quand < derniere:
            raise ValueError(
                "cette hausse est ANTERIEURE a la derniere inscrite (%s). "
                "Verifie la date avant de l'ecrire." % hist[-1]["quand"])
    hist.append({"quand": quand.strftime("%Y-%m-%d %H:%M"), "budget_da": budget_da})
    d["hausses"] = hist
    d["derniere_hausse"] = hist[-1]["quand"]
    d["budget_actuel_da"] = budget_da
    return ecrire_scaling(d, dossier)


# ===========================================================================
# 12. LES CONTROLES — l'outil se verifie lui-meme
# ===========================================================================

def _leve(fonction, *args):
    """Vrai si la fonction refuse. Un refus attendu qui n'arrive pas est un
    trou, et c'est ca qu'on teste."""
    try:
        fonction(*args)
        return False
    except ValueError:
        return True


def _essai(nom, condition, detail=""):
    print("  [%s] %s" % ("OK  " if condition else "RATE", nom))
    if not condition and detail:
        print("       %s" % detail)
    return bool(condition)


def chercher_outil(noms):
    """Trouve l'outil d'un AUTRE agent, pour prouver qu'on donne le meme
    chiffre que lui.

    LE CLIENT NE COPIE RIEN. Les six dossiers sont poses cote a cote ; on
    regarde donc le notre, le dossier courant, et les VOISINS — la meme
    facon de chercher que pour le fichier de passage.
    Une version precedente n'acceptait qu'une copie nommee « _ref-... »
    posee a la main a cote : chez le client elle n'y etait jamais, et la
    concordance — le controle qui prouve que les trois agents comptent
    pareil — n'etait JAMAIS testee. Il lisait « une chose n'a pas pu etre
    testee » des sa premiere commande.
    """
    import os as _os
    ici = _os.path.dirname(_os.path.abspath(__file__))
    lieux = [ici, _os.getcwd()]
    parent = _os.path.dirname(ici)
    try:
        for nom in sorted(_os.listdir(parent)):
            chemin = _os.path.join(parent, nom)
            if _os.path.isdir(chemin) and chemin not in lieux:
                lieux.append(chemin)
    except OSError:
        pass
    for lieu in lieux:
        for nom in noms:
            chemin = _os.path.join(lieu, nom)
            if _os.path.exists(chemin) and _os.path.abspath(chemin) != \
                    _os.path.abspath(__file__):
                return chemin
    return None


def charger_outil(noms):
    chemin = chercher_outil(noms)
    if chemin is None:
        return None
    import importlib.util
    import sys as _sys
    spec = importlib.util.spec_from_file_location("_voisin", chemin)
    mod = importlib.util.module_from_spec(spec)
    # ON N'ECRIT RIEN CHEZ LE VOISIN. Charger son outil laissait un dossier
    # de fichiers compiles dans SON dossier a lui : un controle ne doit pas
    # deposer quoi que ce soit dans les dossiers du client.
    avant = _sys.dont_write_bytecode
    _sys.dont_write_bytecode = True
    try:
        spec.loader.exec_module(mod)
    except Exception:
        return None
    finally:
        _sys.dont_write_bytecode = avant
    return mod


def verifier():
    print(BARRE)
    print("  CONTROLES DE L'OUTIL — version %s" % VERSION)
    print(BARRE)
    ok = True
    concordance = False

    # --- le break even, et la CONCORDANCE avec l'agent testing
    r = break_even(5900, 1500, 100, 0, 0, 600, 0.50, 0.45)
    ok &= _essai("le break even par commande est juste",
                 abs(r["par_commande"] - 802.5) < 0.5, str(r["par_commande"]))
    ok &= _essai("la marge du colis livre est juste", r["marge_livree"] == 4300)
    mod = charger_outil(["manita-testing.py", "_ref-testing.py"])
    if mod is not None and hasattr(mod, "break_even"):
        a = mod.break_even(5900, 1500, 100, 0, 0, 600, 0.50, 0.45)["par_commande"]
        concordance = abs(a - r["par_commande"]) < 0.01
        ok &= _essai("MEME chiffre que l'agent testing, sur le meme cas",
                     concordance, "%s contre %s" % (a, r["par_commande"]))
    perdant = break_even(2000, 1500, 100, 0, 0, 600, 0.50, 0.45)
    ok &= _essai("un produit qui ne passe pas est dit perdant", not perdant["passe"])
    ok &= _essai("le break even ne se fait JAMAIS appeler benefice net",
                 "هاذا ماشي الربح الصافي" in vue_break_even(r, 5900))

    # --- LES MONNAIES
    ok &= _essai("des dinars restent des dinars",
                 convertir_en_dinars(1000, "DZD", None) == 1000.0)
    ok &= _essai("des dollars se convertissent avec le taux du client",
                 convertir_en_dinars(100, "USD", 255) == 25500.0)
    for mauvais in ((100, "USD", None), (100, "USD", 0), (100, "USD", 5),
                    (100, "USD", 5000)):
        try:
            convertir_en_dinars(*mauvais)
            ok &= _essai("un taux absent ou absurde est refuse", False, str(mauvais))
        except ValueError:
            pass
    ok &= _essai("un taux absent ou absurde est refuse", True)
    ok &= _essai("DA est compris comme des dinars", lire_devise("DA") == "DZD")
    for mot in ("POULET", "GBP", "da$"):
        try:
            lire_devise(mot)
            ok &= _essai("une devise inconnue est refusee", False, mot)
        except ValueError:
            pass
    ok &= _essai("une devise inconnue est refusee", True)
    try:
        garde_plancher("--cout-livree", 23.5)
        ok &= _essai("un cout par colis a vingt-trois est refuse comme suspect", False)
    except ValueError:
        ok &= _essai("un cout par colis a vingt-trois est refuse comme suspect", True)
    try:
        garde_plancher("--cout-livree", 6000.0)
        ok &= _essai("un cout par colis plausible passe", True)
    except ValueError:
        ok &= _essai("un cout par colis plausible passe", False)

    # --- LES DATES
    ok &= _essai("une date simple se lit", lire_date("2026-09-15").day == 15)
    ok &= _essai("une date avec l'heure se lit",
                 lire_date("2026-09-15 14:30").hour == 14)
    try:
        lire_date("15/09/2026")
        ok &= _essai("une date mal ecrite est refusee", False)
    except ValueError:
        ok &= _essai("une date mal ecrite est refusee", True)
    ok &= _essai("les heures entre deux dates sont justes",
                 abs(heures_entre(lire_date("2026-09-12"),
                                  lire_date("2026-09-15")) - 72.0) < 0.01)
    # le lanceLe du bureau (ISO, heure de Greenwich) : ramene a l'heure du PC
    _utc = datetime.datetime(2026, 10, 6, 19, 30, tzinfo=datetime.timezone.utc)
    ok &= _essai("une date ISO en heure de Greenwich (Z) est ramenee a l'heure du PC",
                 lire_date("2026-10-06T19:30:00.000Z")
                 == _utc.astimezone().replace(tzinfo=None))
    ok &= _essai("et une date ISO avec son decalage (+01:00) aussi",
                 lire_date("2026-10-06T20:30+01:00")
                 == _utc.astimezone().replace(tzinfo=None))
    ok &= _essai("une date ISO au fuseau illisible est refusee, pas devinee",
                 _leve(lire_date, "2026-13-06T19:30Z"))

    # --- LOI 1 : le benefice net par colis expedie, DEPENSE COMPRISE
    a = benefice_net_par_colis(40, 10, 4300, 600, 0)
    b = benefice_net_par_colis(40, 60, 4300, 600, 0)
    ok &= _essai("meme nombre de livres, benefice net different",
                 a["livres"] == b["livres"] and a["benefice_net"] != b["benefice_net"])
    ok &= _essai("celle qui retourne moins rapporte plus par colis",
                 a["benefice_net_par_colis"] > b["benefice_net_par_colis"],
                 "%s contre %s" % (a["benefice_net_par_colis"], b["benefice_net_par_colis"]))
    ok &= _essai("le benefice net de reference est juste",
                 abs(a["benefice_net"] - 166000) < 1, str(a["benefice_net"]))

    # LE PIEGE DE L'AUDIT : sans la depense, un perdant s'affichait gagnant
    sans_dep = benefice_net_par_colis(20, 4, 4300, 600, 0)
    avec_dep = benefice_net_par_colis(20, 4, 4300, 600, 120000)
    ok &= _essai("sans la depense, l'angle parait gagnant",
                 sans_dep["benefice_net"] > 0, str(sans_dep["benefice_net"]))
    ok &= _essai("AVEC la depense, le meme angle est perdant",
                 avec_dep["benefice_net"] < 0, str(avec_dep["benefice_net"]))
    ok &= _essai("la perte reelle est bien celle de l'audit",
                 abs(avec_dep["benefice_net"] + 36400) < 1, str(avec_dep["benefice_net"]))
    for mauvais in ((20, 4, 4300, 600, None), (20, 4, 4300, 600, -5),
                    (-1, 4, 4300, 600, 100)):
        try:
            benefice_net_par_colis(*mauvais)
            ok &= _essai("une entree impossible de classement est refusee", False, str(mauvais))
        except ValueError:
            pass
    ok &= _essai("une depense absente, negative ou des colis negatifs : refuses", True)

    # LE CAS QUI PROUVE LA LOI : classer sur « livres » choisit le mauvais
    angles = [("A4", 20, 4, 30000), ("A2", 22, 5, 40000), ("A1", 18, 7, 30000),
              ("A3", 12, 9, 30000), ("A5", 8, 11, 30000)]
    c = classer(angles, 4300, 600)
    ok &= _essai("classe sur le benefice net, A4 gagne",
                 c["par_benefice"][0]["nom"] == "A4", c["par_benefice"][0]["nom"])
    ok &= _essai("classe sur les livres seuls, A2 gagne",
                 c["par_livres"][0]["nom"] == "A2", c["par_livres"][0]["nom"])
    ok &= _essai("l'outil SIGNALE que les deux classements different",
                 not c["meme_gagnant"])
    ok &= _essai("un angle avec trop peu de colis n'est pas juge",
                 benefice_net_par_colis(3, 1, 4300, 600, 0)["juge"] is False)
    ok &= _essai("cinq angles bien fournis : assez de data", c["assez"])
    maigre = classer([("A1", 2, 1, 5000), ("A2", 3, 0, 5000)], 4300, 600)
    ok &= _essai("deux angles a trois colis : PAS assez de data", not maigre["assez"])
    ok &= _essai("et on ne couronne personne quand c'est maigre",
                 "ما نسمّيو حتى واحد رابح" in vue_classement(maigre, "ترتيب"))

    # LE PIEGE DE L'AUDIT : l'angle muet qui brule tout etait hors du verdict
    muet = classer([("A1", 12, 0, 45000), ("A2", 11, 1, 45000),
                    ("A9", 0, 0, 400000)], 4300, 600)
    ok &= _essai("un angle a zero colis ne disparait pas du classement",
                 len(muet["sans_colis"]) == 1 and muet["sans_colis"][0]["nom"] == "A9")
    ok &= _essai("sa depense brulee est affichee",
                 "ما خرج حتى كولي" in vue_classement(muet, "ترتيب"))
    ok &= _essai("le TOTAL compte l'angle muet",
                 abs(muet["total_net"] + 391700) < 1, str(muet["total_net"]))
    ok &= _essai("et le verdict de la campagne est : perte",
                 muet["total_en_perte"]
                 and "الكامباين كامل خاسرة" in vue_classement(muet, "ترتيب"))
    ok &= _essai("le total des depenses est juste",
                 abs(muet["total_depense"] - 490000) < 1, str(muet["total_depense"]))
    gagnante = classer([("A1", 20, 2, 20000), ("A2", 18, 3, 20000)], 4300, 600)
    ok &= _essai("une campagne vraiment gagnante n'est pas dite perdante",
                 not gagnante["total_en_perte"])
    vide = classer([("A1", 0, 0, 0)], 4300, 600)
    ok &= _essai("une campagne qui n'a rien depense n'est pas dite perdante",
                 not vide["total_en_perte"])

    # UN ANGLE TROP MAIGRE N'EST NI CLASSE NI COURONNE
    mixte = classer([("AX", 2, 0, 50000), ("A1", 20, 2, 60000),
                     ("A2", 22, 5, 70000)], 4300, 600)
    ok &= _essai("un angle de deux colis n'entre pas dans le classement",
                 [r["nom"] for r in mixte["par_benefice"]] == ["A1", "A2"],
                 str([r["nom"] for r in mixte["par_benefice"]]))
    ok &= _essai("il est quand meme affiche, avec ce qu'il a coute",
                 len(mixte["maigres"]) == 1
                 and "ما نحكموش عليه، وما نرتّبوهش" in vue_classement(mixte, "ترتيب"))
    ok &= _essai("et il ne peut plus etre designe gagnant",
                 "AX" not in vue_classement(mixte, "ترتيب").split("انتبه")[-1])

    # LE PIEGE DE LA MONNAIE SUR LA DEPENSE
    faux = [("A4", 20, 4, 470.59), ("A2", 22, 5, 156.86)]
    try:
        garde_depenses(faux)
        ok &= _essai("une depense en dollars passee en dinars est REFUSEE", False)
    except ValueError as e:
        ok &= _essai("une depense en dollars passee en dinars est REFUSEE",
                     "par colis" in str(e), str(e)[:80])
    try:
        garde_depenses([("A1", 12, 0, 600), ("A2", 11, 1, 600), ("A9", 0, 0, 300)])
        ok &= _essai("le deuxieme cas de dollars deguises est REFUSE aussi", False)
    except ValueError:
        ok &= _essai("le deuxieme cas de dollars deguises est REFUSE aussi", True)
    try:
        garde_depenses([("A4", 20, 4, 120000), ("A2", 22, 5, 40000)])
        ok &= _essai("de vraies depenses en dinars passent", True)
    except ValueError as e:
        ok &= _essai("de vraies depenses en dinars passent", False, str(e))
    try:
        garde_depenses([("A1", 0, 0, 0)])
        ok &= _essai("une depense totale nulle est refusee", False)
    except ValueError:
        ok &= _essai("une depense totale nulle est refusee", True)

    # UN NOM D'ANGLE AVEC UN DEUX-POINTS NE CASSE PLUS LA COMMANDE
    bloc = "A1: الوجع الكبير:18:7:30000"
    parts = bloc.rsplit(":", 3) if bloc.count(":") > 3 else bloc.split(":")
    ok &= _essai("un nom d'angle avec un deux-points se coupe par la droite",
                 len(parts) == 4 and parts[0] == "A1: الوجع الكبير", str(parts))

    # UN NOM D'ANGLE AVEC UN MOT DE LA LISTE NE TUE PAS L'AFFICHAGE
    nomme = classer([("A1 prix casse", 18, 7, 30000), ("A2 الرغبة", 22, 5, 40000)],
                    4300, 600)
    ok &= _essai("un angle nomme avec un mot interdit s'affiche quand meme",
                 controle_affichage(vue_classement(nomme, "ترتيب"),
                                    exempts=_exempts(nomme)) == [],
                 str(controle_affichage(vue_classement(nomme, "ترتيب"),
                                        exempts=_exempts(nomme))[:2]))
    ok &= _essai("mais le mot COD dans un nom reste attrape",
                 len(controle_affichage("      A1 cod rapide",
                                        exempts=["A1 cod rapide"])) >= 1)

    # --- LOI 5 : le stock, BORNE PAR LE BREAK EVEN
    p = plafond_stock(40, 10, 0.65, 357.0, 802.5)
    ok &= _essai("le plafond stock est juste",
                 abs(p["budget_max_da"] - 2196.9) < 2, str(p["budget_max_da"]))
    ok &= _essai("et il est declare rentable a ce cout", p["rentable"])
    p2 = plafond_stock(200, 10, 0.65, 357.0, 802.5)
    ok &= _essai("plus de stock = plus de budget",
                 p2["budget_max_da"] > p["budget_max_da"])
    ok &= _essai("le plafond monte bien en proportion du stock",
                 abs(p2["budget_max_da"] / p["budget_max_da"] - 5.0) < 0.01)

    # LE PIEGE DE L'AUDIT : le plafond MONTE quand le cout monte
    cher = plafond_stock(40, 10, 0.65, 3000.0, 802.5)
    ok &= _essai("un cout par commande plus haut donne un plafond plus haut",
                 cher["budget_max_da"] > p["budget_max_da"],
                 "%s contre %s" % (cher["budget_max_da"], p["budget_max_da"]))
    ok &= _essai("MAIS l'outil le declare NON rentable", not cher["rentable"])
    ok &= _essai("et il dit de combien la commande doit baisser",
                 abs(cher["doit_baisser_de_da"] - 2197.5) < 1,
                 str(cher["doit_baisser_de_da"]))
    ok &= _essai("l'affichage REFUSE de donner un plafond quand ca perd",
                 "وقف. ما نعطيكش حد." in vue_plafond(cher, 40, 10))
    ok &= _essai("et il ne montre PAS le chiffre du plafond dans ce cas",
                 "أكبر بودجي في النهار" not in vue_plafond(cher, 40, 10))
    faible = plafond_stock(40, 10, 0.05, 357.0, 802.5)
    ok &= _essai("une confirmation qui s'ecroule gonfle aussi le plafond",
                 faible["budget_max_da"] > p["budget_max_da"])
    petit = plafond_stock(2, 10, 0.65, 357.0, 802.5)
    ok &= _essai("un plafond sous le plancher de Meta est signale",
                 petit["sous_le_plancher"]
                 and "صغير بزاف على ميتا" in vue_plafond(petit, 2, 10))
    for mauvais in ((40, 0, 0.65, 357.0, 802.5), (40, 10, 0.0, 357.0, 802.5),
                    (40, 10, 0.65, 0.0, 802.5), (-1, 10, 0.65, 357.0, 802.5),
                    (40, 10, 0.65, 357.0, 0.0), (40, 10, 0.65, 357.0, None)):
        try:
            plafond_stock(*mauvais)
            ok &= _essai("une valeur impossible de stock est refusee", False, str(mauvais))
        except ValueError:
            pass
    ok &= _essai("les valeurs impossibles de stock sont refusees, break even compris", True)

    # --- l'echelle du budget
    e = echelle_budget(1000, 5000, 50, True, 200)
    ok &= _essai("hausse autorisee apres deux jours et en profit", e["autorise"])
    ok &= _essai("la hausse est bien de vingt pour cent",
                 abs(e["propose_da"] - 1200) < 1, str(e["propose_da"]))
    e2 = echelle_budget(1000, 1100, 50, True, 200)
    ok &= _essai("la hausse est bridee par le plafond du stock",
                 e2["propose_da"] == 1100 and e2["bride_par_le_stock"])
    e3 = echelle_budget(1000, 5000, 10, True, 200)
    ok &= _essai("pas deux hausses en moins de quarante-huit heures",
                 not e3["autorise"] and e3["pourquoi"] == "TROP_TOT")
    e4 = echelle_budget(1000, 5000, 50, False, 200)
    ok &= _essai("AUCUNE hausse apres un jour en perte",
                 not e4["autorise"] and e4["pourquoi"] == "PERTE")
    e5 = echelle_budget(5000, 5000, 50, True, 200)
    ok &= _essai("au plafond du stock, on ne monte plus",
                 not e5["autorise"] and e5["pourquoi"] == "PLAFOND_STOCK")
    e6 = echelle_budget(1000, 5000, 50, True, 40)
    ok &= _essai("AUCUNE hausse pendant les trois premiers jours",
                 not e6["autorise"] and e6["pourquoi"] == "BROAD")
    e7 = echelle_budget(10, 2197, 50, True, 200)
    ok &= _essai("un budget a dix — des dollars pris pour des dinars — est refuse",
                 not e7["autorise"] and e7["pourquoi"] == "BUDGET_SUSPECT")
    e8 = echelle_budget(1000, 5000, None, True, 200)
    ok &= _essai("sans hausse precedente, seul le delai du lancement compte",
                 e8["autorise"])
    ok &= _essai("les soixante-douze heures et les quarante-huit se suivent",
                 BROAD_HEURES > HEURES_ENTRE_HAUSSES
                 and echelle_budget(1000, 5000, 50, True, BROAD_HEURES)["autorise"])
    ok &= _essai("l'echelle dit qu'elle ne lance rien toute seule",
                 "يستنّى الكلمة تاعك" in vue_echelle(e, 1000))

    # --- la fourchette du vendeur : +20 a 30 %, choisie sur la marge MESUREE
    ok &= _essai("une commande a moins de soixante-dix pour cent du break even : +30 %",
                 hausse_permise(1000, 690) == HAUSSE_MAX)
    ok &= _essai("pres du break even, la hausse reste prudente : +20 %",
                 hausse_permise(1000, 750) == HAUSSE_MIN)
    e30 = echelle_budget(1000, 5000, 50, True, 200, hausse=HAUSSE_MAX)
    ok &= _essai("une hausse de trente pour cent se calcule",
                 e30["autorise"] and abs(e30["propose_da"] - 1300) < 1, str(e30))
    ok &= _essai("au-dela de trente pour cent, l'echelle REFUSE",
                 _leve(echelle_budget, 1000, 5000, 50, True, 200, 0.35))
    ok &= _essai("--hausse 25 et --hausse 0.25 disent la meme chose",
                 abs(lire_hausse(25) - 0.25) < 1e-9 and abs(lire_hausse(0.25) - 0.25) < 1e-9)
    ok &= _essai("--hausse 50 ou 10 est refusee, pas rabotee en silence",
                 _leve(lire_hausse, 50) and _leve(lire_hausse, 0.1))
    e30b = echelle_budget(1000, 1250, 50, True, 200, hausse=HAUSSE_MAX)
    ok &= _essai("trente pour cent restent brides par le stock",
                 e30b["propose_da"] == 1250 and e30b["bride_par_le_stock"])
    ok &= _essai("et les quarante-huit heures valent aussi pour trente pour cent",
                 not echelle_budget(1000, 5000, 10, True, 200, HAUSSE_MAX)["autorise"])

    # --- le gagnant du test : le resultat le moins cher, sur assez de resultats
    g = choisir_gagnant([("111", 40, 38250.0), ("222", 25, 38250.0), ("333", 2, 1000.0)])
    ok &= _essai("le gagnant est l'annonce dont le resultat coute le moins",
                 g["autorise"] and g["gagnant"]["code"] == "111", str(g.get("gagnant")))
    ok &= _essai("deux resultats pas chers ne se couronnent pas",
                 all(l["code"] != "333" for l in g["classement"]))
    gt = choisir_gagnant([("111", 10, 10000.0), ("222", 20, 20000.0)])
    ok &= _essai("a cout egal, celle qui a le plus de resultats",
                 gt["gagnant"]["code"] == "222")
    gp = choisir_gagnant([("111", 2, 5000.0), ("222", 1, 1000.0)])
    ok &= _essai("sans annonce a trois resultats, pas de gagnant (et il dit combien il en manque)",
                 not gp["autorise"] and gp["manque"] == 1, str(gp))
    ok &= _essai("une depense en dollars passee comme des dinars est refusee",
                 _leve(choisir_gagnant, [("111", 40, 150.0), ("222", 25, 100.0)]))
    ok &= _essai("une annonce donnee deux fois est refusee",
                 _leve(choisir_gagnant, [("111", 4, 5000.0), ("111", 5, 5000.0)]))

    # --- le depart de la campagne de SCALE : CBO, un a trois ad sets, borne par le stock
    d3 = depart_scale(1785, 21857, 3570, 2169.6, 956)
    ok &= _essai("le stock porte trois ad sets : trois, chacun au budget du gagnant",
                 d3["autorise"] and d3["ad_sets"] == 3
                 and abs(d3["budget_campagne_da"] - 5355) < 1, str(d3))
    d2 = depart_scale(1785, 7500, 3570, 2169.6, 956)
    ok &= _essai("le budget du test qui tourne sort du stock : il n'en reste que pour deux",
                 d2["ad_sets"] == 2 and abs(d2["budget_campagne_da"] - 3570) < 1, str(d2))
    d1 = depart_scale(1785, 4500, 3570, 2169.6, 956)
    ok &= _essai("moins d'un ad set entier : un seul, bride au stock, et il le dit",
                 d1["ad_sets"] == 1 and d1["bride_par_le_stock"]
                 and abs(d1["budget_campagne_da"] - 930) < 1, str(d1))
    d0 = depart_scale(1785, 3700, 3570, 2169.6, 956)
    ok &= _essai("le test servi, un stock sous le plancher de Meta : pas de scale",
                 not d0["autorise"] and d0["pourquoi"] == "PLAFOND_STOCK")
    dp = depart_scale(1785, 21857, 0, 900, 956)
    ok &= _essai("une commande au-dessus du break even : pas de scale, et de combien baisser",
                 not dp["autorise"] and dp["pourquoi"] == "PERTE"
                 and abs(dp["doit_baisser_de_da"] - 56) < 0.01)
    ok &= _essai("jamais plus de trois ad sets, meme sur un gros stock",
                 depart_scale(1785, 1e7, 0, 2169.6, 956)["ad_sets"] == SCALE_AD_SETS_MAX)
    ok &= _essai("un budget du gagnant en dollars passe comme des dinars est refuse",
                 _leve(depart_scale, 7, 21857, 0, 2169.6, 956))
    # --- le budget pose dans Meta : des centimes de la devise du COMPTE,
    # le meme calcul que le bureau, floor(dinars / taux * 100)
    ok &= _essai("5502 DA au taux 262 : 2100 centimes de dollar, pas 550200",
                 centimes_meta(5502, "USD", 262) == 2100,
                 str(centimes_meta(5502, "USD", 262)))
    ok &= _essai("les centimes s'arrondissent vers le BAS, comme au bureau",
                 centimes_meta(930, "USD", 262) == 354
                 and centimes_meta(5355, "EUR", 280) == 1912,
                 "%s / %s" % (centimes_meta(930, "USD", 262),
                              centimes_meta(5355, "EUR", 280)))
    ok &= _essai("un compte en dinars : les dinars fois cent",
                 centimes_meta(5355, "DZD", None) == 535500)
    ok &= _essai("des centimes de dollar sans le taux du client : refus",
                 _leve(centimes_meta, 5502, "USD", None)
                 and _leve(centimes_meta, 5502, "USD", 0))

    # --- le journal des hausses
    import tempfile
    with tempfile.TemporaryDirectory() as dossier:
        j, err = lire_scaling(dossier)
        ok &= _essai("sans journal, il n'y a jamais eu de hausse",
                     j == {} and err is None)
        noter_hausse(lire_date("2026-09-13 10:00"), 1200.0, dossier)
        j, err = lire_scaling(dossier)
        ok &= _essai("une hausse notee se relit",
                     j.get("derniere_hausse") == "2026-09-13 10:00", str(j))
        noter_hausse(lire_date("2026-09-15 10:00"), 1440.0, dossier)
        j, err = lire_scaling(dossier)
        ok &= _essai("le journal garde l'historique et la derniere",
                     len(j["hausses"]) == 2
                     and j["derniere_hausse"] == "2026-09-15 10:00")
        ok &= _essai("les heures depuis la derniere hausse se calculent",
                     abs(heures_entre(lire_date(j["derniere_hausse"]),
                                      lire_date("2026-09-16 10:00")) - 24.0) < 0.01)
        # UN JOURNAL CASSE NE DOIT JAMAIS S'EFFACER EN SILENCE
        with open(os.path.join(dossier, FICHIER_SCALING), "w") as f:
            f.write("ceci n'est pas du json")
        j, err = lire_scaling(dossier)
        ok &= _essai("un journal illisible est une ERREUR, pas un journal vide",
                     j is None and err is not None)
        with open(os.path.join(dossier, FICHIER_SCALING), "w") as f:
            json.dump({"derniere_hausse": "15/09/2026 09:00"}, f)
        j, err = lire_scaling(dossier)
        ok &= _essai("une date de hausse mal ecrite est une ERREUR",
                     j is None and err is not None)
    ok &= _essai("le journal vit a cote de l'outil, pas dans le dossier courant",
                 dossier_outil() == os.path.dirname(os.path.abspath(__file__)))

    # --- LOI 3 : les audiences
    a0 = porte_audiences(None)
    ok &= _essai("sans envoi, on ne conclut rien", a0["etat"] == "PAS_ENCORE_ENVOYE")
    a1 = porte_audiences(15)
    ok &= _essai("quinze personnes : exclusion OUI, lookalike NON",
                 a1["exclusion"] and not a1["lookalike"])
    ok &= _essai("il manque bien quatre-vingt-cinq personnes",
                 a1["manque_pour_lookalike"] == 85)
    a2 = porte_audiences(150)
    ok &= _essai("cent cinquante personnes : lookalike possible", a2["lookalike"])
    ok &= _essai("mais pas encore confortable", not a2["confortable"])
    ok &= _essai("mille trois cents personnes : confortable",
                 porte_audiences(1300)["confortable"])
    ok &= _essai("zero personne : rien du tout", porte_audiences(0)["etat"] == "VIDE")
    # LES PLANCHERS D'AFFICHAGE DE META NE SONT PAS DES MESURES
    for plancher in PLANCHERS_META_AUDIENCE:
        pa = porte_audiences(plancher)
        ok &= _essai("le chiffre %d pile de Meta est declare inconnu" % plancher,
                     pa["etat"] == "CHIFFRE_INCONNU" and not pa["lookalike"]
                     and not pa["confortable"] and pa["exclusion"])
    ok &= _essai("et l'ecran le dit au client",
                 "ماشي عدّة حقيقية" in vue_audiences(porte_audiences(1000)))

    # --- la porte
    bon = porte_scaling(confirmees=60, commandes=100, livrees=25, expediees=50,
                        stock_restant=40, be_par_livree=3567, cout_par_livree=1530)
    ok &= _essai("tout passe : la porte est ouverte", bon["ouverte"])
    for etiquette, modif in (("confirmation", dict(confirmees=40, expediees=35)),
                             ("colis livres", dict(livrees=15)),
                             ("stock", dict(stock_restant=0))):
        base = dict(confirmees=60, commandes=100, livrees=25, expediees=50,
                    stock_restant=40, be_par_livree=3567, cout_par_livree=1530)
        base.update(modif)
        ok &= _essai("un seul non ferme la porte : %s" % etiquette,
                     not porte_scaling(**base)["ouverte"])
    haut = porte_scaling(confirmees=95, commandes=100, livrees=10, expediees=50,
                         stock_restant=40, be_par_livree=3567, cout_par_livree=1530)
    # --- LES COLIS EN ROUTE COMPTENT A TROIS SUR DIX (sa loi), pas a zero
    tot = porte_scaling(confirmees=60, commandes=100, livrees=22, expediees=60,
                        stock_restant=40, be_par_livree=3567, cout_par_livree=1530, retours=8)
    ok &= _essai("22 livres, 8 refus, 30 en route : la livraison prudente passe (51,7 %)",
                 tot["ouverte"] and abs(tot["taux_livraison"] - (22 + 30 * 0.30) / 60.0) < 1e-9,
                 str(tot["ferme_par"]))
    ok &= _essai("et le taux brut est bien garde a cote (36,7 %)",
                 abs(tot["taux_livraison_brut"] - 22 / 60.0) < 1e-9)
    mauvais = porte_scaling(confirmees=60, commandes=100, livrees=20, expediees=60,
                            stock_restant=40, be_par_livree=3567, cout_par_livree=1530, retours=30)
    ok &= _essai("20 livres, 30 refus : la porte reste FERMEE meme avec des colis en route",
                 not mauvais["ouverte"] and "livraison" in mauvais["ferme_par"])
    ok &= _essai("des retours incoherents sont refuses",
                 _leve(porte_scaling, 60, 100, 40, 50, 40, 3567, 1530, 20))
    ok &= _essai("une bonne confirmation NE compense PAS une mauvaise livraison",
                 not haut["ouverte"])
    cout_haut = porte_scaling(confirmees=60, commandes=100, livrees=25, expediees=50,
                              stock_restant=40, be_par_livree=3567,
                              cout_par_livree=6000)
    ok &= _essai("un colis livre qui coute plus que le break even ferme la porte",
                 not cout_haut["ouverte"] and "rentabilite" in cout_haut["ferme_par"])
    ok &= _essai("aucun mot latin sur l'ecran arabe de la porte",
                 "OK" not in vue_porte(bon) and "NON" not in vue_porte(bon),
                 [l for l in vue_porte(bon).split("\n") if "OK" in l or "NON" in l][:2])
    ok &= _essai("la porte montre SES chiffres, pas seulement un oui et un non",
                 "الكولي لي وصل يكلّفك في الإشهار" in vue_porte(cout_haut))
    for mauvais in (dict(confirmees=900, commandes=10, livrees=5, expediees=10,
                         stock_restant=1, be_par_livree=1, cout_par_livree=1),
                    dict(confirmees=5, commandes=10, livrees=60, expediees=50,
                         stock_restant=1, be_par_livree=1, cout_par_livree=1),
                    dict(confirmees=5, commandes=0, livrees=1, expediees=10,
                         stock_restant=1, be_par_livree=1, cout_par_livree=1)):
        try:
            porte_scaling(**mauvais)
            ok &= _essai("des chiffres incoherents sont refuses par la porte",
                         False, str(mauvais))
        except ValueError:
            pass
    ok &= _essai("des chiffres incoherents sont refuses par la porte", True)

    # --- LES DEUX LOIS DE LA LANGUE, sur TOUS les affichages
    vues = [vue_plafond(p, 40, 10), vue_plafond(cher, 40, 10),
            vue_plafond(petit, 2, 10),
            vue_break_even(r, 5900), vue_break_even(perdant, 2000),
            vue_classement(c, "ترتيب الأنقل"),
            vue_classement(maigre, "ترتيب"), vue_classement(muet, "ترتيب"),
            vue_classement(gagnante, "ترتيب"),
            vue_porte(bon), vue_porte(haut), vue_porte(cout_haut),
            vue_audiences(a0), vue_audiences(a1), vue_audiences(a2),
            vue_echelle(e, 1000), vue_echelle(e3, 1000),
            vue_echelle(e4, 1000), vue_echelle(e5, 5000), vue_echelle(e6, 1000),
            vue_echelle(e7, 10), vue_echelle(e30, 1000),
            vue_gagnant(g), vue_gagnant(gp),
            vue_depart_scale(d3), vue_depart_scale(d1), vue_depart_scale(d0),
            vue_depart_scale(dp),
            vue_broad(),
            vue_rapport("فستان درابيه", "الكرياتيف الرابح ما تبدلش",
                        "في تسيير وفي العلامة تاع الرابط",
                        "نخلّيو كلش كيما راهو",
                        ["نخلّيو البرود يخدم", "نفتحو تست موازي", "نستنّاو السطوك"],
                        "غدوة نعاودو نقراو")]
    fautes = []
    for v in vues:
        fautes += controle_affichage(v)
    ok &= _essai("aucun chiffre sur une ligne arabe, dans TOUS les affichages",
                 not any(f[1].startswith("un chiffre") for f in fautes),
                 str(fautes[:2]))
    ok &= _essai("aucune phrase francaise dans ce que lit le client",
                 not any("francais" in f[1] for f in fautes), str(fautes[:2]))
    ok &= _essai("le controle attrape un chiffre glisse dans une phrase arabe",
                 len(controle_affichage("  عندك 23 كولي")) >= 1)
    ok &= _essai("le controle attrape AUSSI les chiffres arabes",
                 len(controle_affichage("  عندك ٢٣ كولي")) >= 1)
    ok &= _essai("le controle attrape le mot COD en minuscules",
                 len(controle_affichage("  الدفع cod عند الاستلام")) >= 1)
    ok &= _essai("le mot COD est attrape MEME sur une ligne avec une adresse web",
                 len(controle_affichage("  cod ici https://exemple.dz/produit")) >= 1)
    ok &= _essai("le controle attrape un mot marocain",
                 len(controle_affichage("  تقدري تحوّس")) >= 1)
    ok &= _essai("une ligne de nombres seuls passe",
                 controle_affichage("      674 DA   =   2.64 USD") == [])
    ok &= _essai("une ligne de nombres NEGATIFS passe aussi",
                 controle_affichage("      -36400 DA   =   -142.75 USD") == [])
    ok &= _essai("une ligne de pourcentage passe",
                 controle_affichage("      65 %") == [])
    ok &= _essai("un message client sans un mot d'arabe est refuse",
                 len(controle_message_client("Bonjour, tout va bien aujourd hui")) >= 1)
    ok &= _essai("meme court : deux mots latins sans arabe sont refuses",
                 len(controle_message_client("Bonjour Amine")) >= 1)
    ok &= _essai("un message client en arabe passe",
                 controle_message_client("  راهو كلش مليح") == [])
    ok &= _essai("un mot francais HORS LISTE est attrape dans un bloc du rapport",
                 mots_latins_dans("نوقفو tout de suite الإشهار") == ["tout", "suite"],
                 str(mots_latins_dans("نوقفو tout de suite الإشهار")))
    ok &= _essai("et le mot tunnel aussi, qui n'est dans aucune liste",
                 mots_latins_dans("نفتحو tunnel جديد") == ["tunnel"])
    ok &= _essai("un bloc tout en arabe ne declenche rien",
                 mots_latins_dans("نخلّيو كلش كيما راهو") == [])
    ok &= _essai("le taux du client atteint bien l'ecran",
                 _avec_taux(300, lambda: ligne_nombre(900)).strip().endswith("3.00 USD"),
                 _avec_taux(300, lambda: ligne_nombre(900)))
    import subprocess
    _ici = os.path.dirname(os.path.abspath(__file__))
    _be = subprocess.run(
        [sys.executable, os.path.join(_ici, "manita-scaling.py"), "--break-even",
         "--prix", "5900", "--cout-produit", "1500", "--emballage", "100",
         "--livraison", "0", "--frais-cod", "0", "--cout-retour", "600",
         "--taux-confirmation", "0.50", "--taux-livraison", "0.45",
         "--devise", "USD", "--taux-dinar", "262"],
        capture_output=True, text=True).stdout
    ok &= _essai("le taux du client atteint AUSSI l'ecran du break even",
                 "22.52 USD" in _be,
                 [l for l in _be.split("\n") if "5900 DA" in l][:1])
    _sans = subprocess.run(
        [sys.executable, os.path.join(_ici, "manita-scaling.py"), "--break-even",
         "--prix", "5900", "--cout-produit", "1500", "--emballage", "100",
         "--livraison", "0", "--frais-cod", "0", "--cout-retour", "600",
         "--taux-confirmation", "0.50", "--taux-livraison", "0.45",
         "--devise", "USD"],
        capture_output=True, text=True)
    ok &= _essai("SANS le taux, le break even en devise etrangere est REFUSE",
                 _sans.returncode == 2 and "--taux-dinar" in _sans.stdout,
                 _sans.stdout.strip().split("\n")[0][:70])
    _dzd = subprocess.run(
        [sys.executable, os.path.join(_ici, "manita-scaling.py"), "--break-even",
         "--prix", "5900", "--cout-produit", "1500", "--emballage", "100",
         "--livraison", "0", "--frais-cod", "0", "--cout-retour", "600",
         "--taux-confirmation", "0.50", "--taux-livraison", "0.45",
         "--devise", "DZD"],
        capture_output=True, text=True)
    ok &= _essai("mais en dinars seuls, aucun taux n'est demande",
                 _dzd.returncode == 0)
    ok &= _essai("a cout EGAL au break even, on ne dit pas « baisse de zero »",
                 plafond_stock(40, 10, 0.65, 802.5, 802.5)["doit_baisser_de_da"] > 0)
    ok &= _essai("et ce cas-la n'est pas declare rentable",
                 not plafond_stock(40, 10, 0.65, 802.5, 802.5)["rentable"])
    ok &= _essai("le refus du plafond dit qu'il n'y a pas de hausse non plus",
                 "الجواب : لا" in vue_plafond(cher, 40, 10))

    # --- LE NOM D'ANGLE QUI MELANGE ARABE ET CODE
    lg = lignes_nom("A4 الاعتراض")
    ok &= _essai("un nom melange est coupe en deux lignes", len(lg) == 2, str(lg))
    ok &= _essai("le code se retrouve seul sur sa ligne", lg[0].strip() == "A4", str(lg))
    ok &= _essai("le nom arabe se retrouve seul sur sa ligne",
                 not CHIFFRE.search(lg[1]), str(lg))
    ok &= _essai("un nom tout arabe reste sur une seule ligne",
                 len(lignes_nom("الاعتراض")) == 1)
    ok &= _essai("un nom tout latin reste sur une seule ligne",
                 len(lignes_nom("A4")) == 1)

    # --- le fichier de passage
    # --- UN REFUS N'AFFICHE JAMAIS ZERO HEURE A ATTENDRE
    for _reste in (0.01, 0.4, 0.5, 0.99, 1.0, 1.5, 47.9):
        _e = {"autorise": False, "pourquoi": "TROP_TOT",
              "heures_a_attendre": _reste, "propose_da": 1500.0}
        _lignes = [l.strip() for l in vue_echelle(_e, 1500.0).split("\n")]
        _i = _lignes.index("الساعات لي باقين")
        ok &= _essai("%.2f heure(s) a attendre ne s'affiche pas zero" % _reste,
                     _lignes[_i + 1] != "0" and int(_lignes[_i + 1]) >= _reste,
                     "affiche %r" % _lignes[_i + 1])

    # --- LES GARDES PLANCHER VISENT-ILS UNE OPTION QUE LA TABLE CONNAIT ?
    # garde_plancher("--budget-actuel", 5) passait en silence : le nom n'est
    # pas dans la table, .get() rendait None, et le garde ne gardait rien.
    for _nom in PLANCHER_PLAUSIBLE_DA:
        ok &= _essai("le plancher de %s protege bien quelque chose" % _nom,
                     _leve(garde_plancher, _nom, 5.0))
    with open(os.path.abspath(__file__), encoding="utf-8") as _f:
        _source = _f.read()
    _vises = set(re.findall(r'garde_plancher\(\s*"(--[a-z-]+)"', _source))
    _vises |= set(re.findall(r'en_dinars\([^,]+,\s*"(--[a-z-]+)"', _source))
    _orphelins = sorted(n for n in _vises if n not in PLANCHER_PLAUSIBLE_DA
                        and n != "--budget-actuel")
    ok &= _essai("aucun garde plancher ne vise une option absente de la table",
                 not _orphelins, "orphelins : %s" % ", ".join(_orphelins))
    _inutiles = sorted(n for n in PLANCHER_PLAUSIBLE_DA if n not in _vises)
    ok &= _essai("aucun plancher de la table ne dort sans etre appele",
                 not _inutiles, "jamais appeles : %s" % ", ".join(_inutiles))

    d1, err, c1 = lire_passage("/tmp/dossier-qui-n-existe-pas-manita")
    ok &= _essai("un fichier de passage absent est signale proprement",
                 d1 is None and err is not None and c1 is None)
    d2, err2, c2 = lire_passage(
        fichier=os.path.join(dossier_outil(), "un-fichier-qui-nexiste-pas.json"))
    ok &= _essai("--fichier qui n'existe pas : refus, et RIEN n'est lu ailleurs",
                 d2 is None and err2 is not None and "nexiste-pas" in err2,
                 str(err2))
    d3, err3, c3 = lire_passage(fichier=dossier_outil())
    ok &= _essai("--fichier qui designe un dossier est refuse",
                 d3 is None and err3 is not None and "pas un dossier" in err3,
                 str(err3))

    # --- LES PIEGES DU TROISIEME AUDIT
    ok &= _essai("l'arrondi ne tombe plus au pair : 802.5 s'affiche 803",
                 arrondi(802.5) == 803, str(arrondi(802.5)))
    ok &= _essai("un nombre qui n'en est pas est refuse",
                 all(_leve(nombre_fini, v, "x") for v in ("nan", "inf", "-inf")))
    ok &= _essai("un retour chariot est retire d'un nom",
                 "\r" not in nom_propre("A1\rfaux"))
    ok &= _essai("un chiffre arabe dans un nom devient un chiffre latin",
                 nom_propre("الوجع٢") == "الوجع2", nom_propre("الوجع٢"))
    ok &= _essai("et ce nom ne bloque plus tout le classement",
                 controle_affichage(
                     vue_classement(classer([("الوجع٢", 20, 2, 60000),
                                             ("A2", 22, 5, 70000)], 4300, 600),
                                    "ترتيب"),
                     exempts=["الوجع2", "2"]) == [])
    ok &= _essai("un nom melange arabe et code s'affiche dans le rapport",
                 controle_affichage(
                     vue_rapport("فستان DEMO M01", "واش", "وين", "قرار",
                                 ["أ", "ب", "ج"], "غدوة")) == [])
    ok &= _essai("une campagne sans UN SEUL colis est refusee, pas jugee",
                 _leve(garde_depenses, [("A1", 0, 0, 470.0), ("A2", 0, 0, 300.0)]))
    ok &= _essai("un stock a zero est un arret, pas un budget a zero",
                 _leve(plafond_stock, 0, 10, 0.65, 357.0, 802.5))
    ok &= _essai("plus d'expediees que de confirmees est refuse",
                 _leve(porte_scaling, 30, 100, 10, 60, 40, 3567, 1530))
    ok &= _essai("une hausse datee dans le futur est refusee",
                 _leve(noter_hausse,
                       datetime.datetime.now() + datetime.timedelta(days=90),
                       1200.0))
    with tempfile.TemporaryDirectory() as dossier:
        noter_hausse(lire_date("2026-09-15 10:00"), 1200.0, dossier)
        ok &= _essai("une hausse anterieure a la derniere est refusee",
                     _leve(noter_hausse, lire_date("2026-09-10 10:00"),
                           1200.0, dossier))
        with open(os.path.join(dossier, FICHIER_SCALING), encoding="utf-8") as f:
            j = json.load(f)
        j["derniere_hausse"] = ""
        with open(os.path.join(dossier, FICHIER_SCALING), "w", encoding="utf-8") as f:
            json.dump(j, f)
        relu, err = lire_scaling(dossier)
        ok &= _essai("une liste de hausses sans derniere date se reconstitue",
                     relu and relu.get("derniere_hausse") == "2026-09-15 10:00",
                     str(relu))

    # --- TOUTES LES VUES SONT ATTEIGNABLES DEPUIS LA LIGNE DE COMMANDE
    import io
    import contextlib
    drapeaux = ["--installer", "--verifier", "--break-even", "--plafond-stock",
                "--classer", "--porte", "--audiences", "--echelle", "--broad",
                "--passage", "--rapport", "--controler", "--noter-hausse",
                "--devise-depenses", "--taux-dinar", "--date-lancement", "--hier",
                "--hausse", "--gagnant", "--annonces", "--depart-scale",
                "--budget-gagnant", "--budget-test"]
    aide = io.StringIO()
    with contextlib.redirect_stdout(aide):
        _construire_parser().print_help()
    texte_aide = aide.getvalue()
    absents = [d for d in drapeaux if d not in texte_aide]
    ok &= _essai("chaque calcul a bien son entree en ligne de commande",
                 not absents, "manquent : %s" % ", ".join(absents))

    # --- LE CHEMIN DE LA LIGNE DE COMMANDE, pas seulement les fonctions.
    # porte_scaling etait JUSTE et la porte s'ouvrait quand meme : --retours
    # n'existait pas dans le parser et le getattr retombait sur zero. Aucun
    # controle ne l'a vu parce qu'ils appelaient tous la FONCTION en direct.
    # Ceux-ci lancent la VRAIE commande et lisent son code de sortie.
    import subprocess

    def _cli(*args, **env_plus):
        env = dict(os.environ)
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        env.update(env_plus)
        p = subprocess.Popen([sys.executable, os.path.abspath(__file__)] + list(args),
                             stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                             env=env)
        sortie = p.communicate()[0].decode("utf-8", "replace")
        return p.returncode, sortie

    _be = ["--break-even", "--cout-produit", "900", "--emballage", "50",
           "--livraison", "400", "--frais-cod", "0", "--cout-retour", "300",
           "--taux-livraison", "0.6", "--taux-confirmation", "0.58",
           "--devise-depenses", "DZD", "--devise", "DZD"]
    _code, _sortie = _cli(*_be)
    ok &= _essai("--break-even REFUSE de calculer sans --prix",
                 _code == 2 and "--prix" in _sortie, "sortie %d" % _code)
    _code, _sortie = _cli(*(_be + ["--prix", "0"]))
    ok &= _essai("et un prix a zero est refuse aussi, pas calcule",
                 _code == 2 and "--prix" in _sortie, "sortie %d" % _code)
    _code, _sortie = _cli(*(_be + ["--prix", "6900"]))
    ok &= _essai("avec le prix, le break even se calcule normalement",
                 _code == 0 and "--be-livree" in _sortie, "sortie %d" % _code)

    _base = ["--porte", "--commandes", "280", "--confirmees", "140",
             "--expediees", "140", "--livrees", "20", "--stock", "23",
             "--be-livree", "4044.62", "--cout-livree", "2870",
             "--devise-depenses", "DZD", "--devise", "DZD"]
    _code, _sortie = _cli(*_base)
    ok &= _essai("la porte REFUSE de juger sans --retours, elle ne suppose pas zero",
                 _code == 2 and "--retours" in _sortie, "sortie %d" % _code)
    _code, _sortie = _cli(*(_base + ["--retours", "120"]))
    ok &= _essai("20 livres sur 140 partis et 120 rendus : la porte reste FERMEE",
                 _code == 3, "sortie %d" % _code)
    _code, _sortie = _cli(*(_base + ["--retours", "0"]))
    ok &= _essai("les memes chiffres avec zero rendu : 120 en route, la porte s'ouvre",
                 _code == 0, "sortie %d" % _code)

    # CE QUE L'OUTIL DONNE, L'OUTIL L'ACCEPTE. Un plafond sorti de
    # --plafond-stock qui se faisait refuser par --echelle avec « convertis
    # d'abord » lancait l'agent dans une conversion : 169,95 x 249 = 42 317,
    # accepte, sur un stock de deux pieces.
    _ech = ["--echelle", "--hier", "rentable", "--date-lancement", "2026-09-01",
            "--budget-actuel", "1500", "--be-commande", "1219.86",
            "--cout-commande", "690", "--devise-depenses", "DZD", "--devise", "DZD"]

    def _plafond_rendu(sortie):
        return [l.split()[-1] for l in sortie.split("\n")
                if l.strip().startswith("--plafond ")]

    _petit = ["--plafond-stock", "--stock", "2", "--jours-reappro", "14",
              "--taux-confirmation", "0.58", "--cout-commande", "690",
              "--be-commande", "1219.86", "--devise-depenses", "DZD",
              "--devise", "DZD"]
    _code, _sortie = _cli(*_petit)
    ok &= _essai("un stock de deux pieces ne rend PLUS de plafond a repasser",
                 _code != 0 and not _plafond_rendu(_sortie), "sortie %d" % _code)
    ok &= _essai("et il dit la verite : produire avant, pas convertir",
                 "PRODUIRE avant" in _sortie and "Convertis" not in _sortie,
                 _sortie[-300:])
    _code, _sortie = _cli(*(_ech + ["--plafond", "169.95"]))
    ok &= _essai("un plafond sous le plancher n'est plus dit « des dollars »",
                 "Convertis d'abord" not in _sortie, _sortie[:220])
    ok &= _essai("il est refuse pour la VRAIE raison : le stock est trop petit",
                 _code == 3 and "PRODUIRE avant" in _sortie, "sortie %d" % _code)
    # et le va-et-vient normal tient toujours : ce que l'outil donne, il le reprend
    _gros = ["--plafond-stock", "--stock", "400", "--jours-reappro", "14",
             "--taux-confirmation", "0.58", "--cout-commande", "690",
             "--be-commande", "1219.86", "--devise-depenses", "DZD",
             "--devise", "DZD"]
    _code, _sortie = _cli(*_gros)
    _rendu = _plafond_rendu(_sortie)
    ok &= _essai("un stock qui porte une campagne rend bien son plafond",
                 _code == 0 and bool(_rendu), "sortie %d" % _code)
    if _rendu:
        _code, _sortie = _cli(*(_ech + ["--plafond", _rendu[0]]))
        ok &= _essai("et ce plafond-la est REPRIS par --echelle, tel quel",
                     _code == 0 and "Convertis d'abord" not in _sortie,
                     "plafond %s, sortie %d" % (_rendu[0], _code))

    # LE SCALING DU VENDEUR, par la vraie ligne de commande
    _code, _sortie = _cli(*(_ech + ["--plafond", "100000"]))
    ok &= _essai("--echelle choisit seule +30 % sur une marge de quarante pour cent",
                 _code == 0 and "Hausse : +30 %" in _sortie, _sortie[-300:])
    _iso = [x if x != "2026-09-01" else "2026-09-01T10:00:00.000Z" for x in _ech]
    _code, _sortie = _cli(*(_iso + ["--plafond", "100000"]))
    ok &= _essai("--echelle lit le lanceLe du bureau tel quel (ISO, Z compris)",
                 _code == 0 and "ne se lit pas" not in _sortie, "sortie %d" % _code)
    _code, _sortie = _cli(*(_ech + ["--plafond", "100000", "--hausse", "0.5"]))
    ok &= _essai("--echelle --hausse 0.5 est REFUSEE (regle : 20 a 30 %)",
                 _code == 2 and "20 a 30" in _sortie, "sortie %d" % _code)
    _gag = ["--gagnant", "--devise-depenses", "USD", "--devise", "USD", "--taux-dinar", "255"]
    _code, _sortie = _cli(*(_gag + ["--annonces", "120211:40:150,120222:25:150,120233:2:4"]))
    ok &= _essai("--gagnant couronne l'annonce au resultat le moins cher (dollars convertis)",
                 _code == 0 and "LE GAGNANT : 120211" in _sortie, _sortie[-300:])
    _code, _sortie = _cli(*(_gag + ["--annonces", "120211:2:20,120222:1:4"]))
    ok &= _essai("--gagnant sans assez de resultats ne couronne personne (code 3)",
                 _code == 3 and "LE GAGNANT" not in _sortie, "sortie %d" % _code)
    _code, _sortie = _cli(*(_gag + ["--annonces", "120211:40"]))
    ok &= _essai("--gagnant refuse une annonce sans sa depense",
                 _code == 2, "sortie %d" % _code)
    _dep = ["--depart-scale", "--budget-gagnant", "1785", "--budget-test", "3570",
            "--be-commande", "2169.6", "--cout-commande", "956",
            "--devise-depenses", "DZD", "--devise", "DZD"]
    _code, _sortie = _cli(*(_dep + ["--plafond", "21857"]))
    ok &= _essai("--depart-scale : trois ad sets, le budget sur la CAMPAGNE",
                 _code == 0 and "ad sets ............ 3" in _sortie
                 and "5355.00 DA" in _sortie, _sortie[-300:])
    _code, _sortie = _cli(*(_dep + ["--plafond", "3700"]))
    ok &= _essai("--depart-scale refuse quand le test a deja pris le stock (code 3)",
                 _code == 3, "sortie %d" % _code)

    def _json_de(sortie, quoi):
        for l in sortie.split("\n"):
            if l.startswith("MANITA_JSON "):
                try:
                    j = json.loads(l[len("MANITA_JSON "):])
                except ValueError:
                    continue
                if j.get("quoi") == quoi:
                    return j
        return None

    def _a_repasser(sortie):
        bloc = sortie.split("A REPASSER TEL QUEL", 1)
        return bloc[1].split("POUR INFORMATION", 1)[0] if len(bloc) == 2 else ""

    # LE COMPTE EN DOLLARS (la commande d'exemple de la skill) : la ligne a
    # repasser porte les CENTIMES que Meta attend, jamais les dinars.
    _usd = ["--depart-scale", "--budget-gagnant", "1834", "--budget-test", "3668",
            "--plafond", "21857.14", "--be-commande", "2169.60",
            "--cout-commande", "956.25", "--devise-depenses", "DZD",
            "--devise", "USD", "--taux-dinar", "262"]
    _code, _sortie = _cli(*_usd, MANITA_JSON="1")
    _rep = _a_repasser(_sortie)
    _j = _json_de(_sortie, "depart_scale") or {}
    ok &= _essai("--depart-scale sur un compte en USD : campaign_daily_budget 2100 a repasser",
                 _code == 0 and re.search(r"campaign_daily_budget 2100\b", _rep) is not None
                 and "21.00 USD" in _rep, _rep[:300])
    ok &= _essai("et le montant en DA n'est plus « a repasser tel quel »",
                 "DA par jour" not in _rep and "550200" not in _sortie
                 and "5502.00 DA par jour" in _sortie.split("POUR INFORMATION", 1)[-1],
                 _sortie[-500:])
    ok &= _essai("le JSON porte budget_campagne_centimes, le calcul du bureau",
                 _j.get("budget_campagne_centimes") == 2100
                 and _j.get("devise_compte") == "USD"
                 and _j.get("budget_campagne_centimes")
                 == int(math.floor(_j.get("budget_campagne_da", 0) / 262.0 * 100 + 1e-6)),
                 str(_j)[:300])
    _code, _sortie = _cli("--depart-scale", "--budget-gagnant", "1785",
                          "--budget-test", "3570", "--plafond", "4500",
                          "--be-commande", "2169.60", "--cout-commande", "956.25",
                          "--devise-depenses", "DZD", "--devise", "EUR",
                          "--taux-dinar", "280", MANITA_JSON="1")
    _j = _json_de(_sortie, "depart_scale") or {}
    ok &= _essai("un ad set bride au stock, en euros : centimes arrondis vers le bas",
                 _code == 0 and _j.get("budget_campagne_centimes") == 332
                 and re.search(r"campaign_daily_budget 332\b", _a_repasser(_sortie)) is not None,
                 str(_j)[:300])
    # LE BUREAU appelle en DZD et convertit lui-meme : son JSON ne change pas
    _code, _sortie = _cli(*(_dep + ["--plafond", "21857"]), MANITA_JSON="1")
    _j = _json_de(_sortie, "depart_scale") or {}
    ok &= _essai("en DZD (l'appel du bureau), le JSON reste celui que le bureau lit",
                 _code == 0 and abs(_j.get("budget_campagne_da", 0) - 5355) < 1e-6
                 and "budget_campagne_centimes" not in _j, str(_j)[:300])
    ok &= _essai("et en DZD, la ligne dit que le montant ne vaut que pour un compte en DZD",
                 "campaign_daily_budget = 535500" in _sortie
                 and "SEULEMENT si le compte est en DZD" in _sortie, _sortie[-400:])
    # AFFICHE EN DINARS, DEPENSES EN DOLLARS : le compte est en dollars (Meta
    # compte dans sa devise). Avant, « campaign_daily_budget = 550200 » sortait
    # quand meme sous « A REPASSER TEL QUEL » : 5502 dollars par jour.
    _code, _sortie = _cli("--depart-scale", "--budget-gagnant", "7", "--budget-test", "14",
                          "--plafond", "21857.14", "--be-commande", "2169.60",
                          "--cout-commande", "3.65", "--devise-depenses", "USD",
                          "--devise", "DZD", "--taux-dinar", "262", MANITA_JSON="1")
    _rep = _a_repasser(_sortie)
    _j = _json_de(_sortie, "depart_scale") or {}
    ok &= _essai("--devise DZD et des depenses en USD : les centimes de USD, jamais 550200",
                 _code == 0 and re.search(r"campaign_daily_budget 2100\b", _rep) is not None
                 and "550200" not in _sortie and "DA par jour" not in _rep
                 and _j.get("budget_campagne_centimes") == 2100
                 and _j.get("devise_compte") == "USD", _sortie[-500:])
    _code, _sortie = _cli("--gagnant", "--depart-scale", "--devise-depenses", "DZD")
    ok &= _essai("--gagnant et --depart-scale ensemble : une seule chose a la fois",
                 _code == 2, "sortie %d" % _code)

    print(BARRE)
    if not ok:
        print("  QUELQUE CHOSE NE VA PAS. NE PAS UTILISER.")
    elif not concordance:
        print("  TOUT EST BON ICI — MAIS UNE CHOSE N'A PAS PU ETRE TESTEE :")
        print("  la concordance avec l'agent testing (son fichier n'est pas la).")
        print("  Dis-le au client au lieu de dire que tout est verifie.")
    else:
        print("  TOUT EST BON, concordance avec l'agent testing comprise.")
    print(BARRE)
    return 0 if ok else 1


def _exempts(c):
    """Les lignes d'affichage qui portent un nom donne par le client."""
    lignes = []
    for nom in c["noms"]:
        lignes += [l.strip() for l in lignes_nom(nom)]
    return lignes


def _avec_taux(taux, fonction):
    """Pour les controles : pose le taux du client, appelle, remet en place."""
    global TAUX_DINAR
    ancien = TAUX_DINAR
    TAUX_DINAR = taux
    try:
        return fonction()
    finally:
        TAUX_DINAR = ancien


# ===========================================================================
# 13. LA LIGNE DE COMMANDE
# ===========================================================================

def _construire_parser():
    p = argparse.ArgumentParser(
        description="ecom manita — agent scaling. TOUS les montants sont en "
                    "DINARS, sauf ce qui vient de Meta : pour ceux-la, "
                    "--devise-depenses et --taux-dinar.")
    p.add_argument("--installer", action="store_true")
    p.add_argument("--verifier", action="store_true")
    p.add_argument("--devise", default="USD",
                   help="la devise du compte, pour l'affichage seulement")
    p.add_argument("--devise-depenses", default="",
                   help="DZD, USD ou EUR : la devise des montants qui viennent "
                        "de Meta (depenses, budgets, couts par commande)")
    p.add_argument("--taux-dinar", type=float, default=0.0,
                   help="combien de dinars pour une unite de cette devise — "
                        "le taux REEL du client")

    p.add_argument("--break-even", action="store_true",
                   help="le break even DE CE PRODUIT")
    p.add_argument("--prix", type=float, default=None,
                   help="le prix de vente en DINARS — OBLIGATOIRE : oublie, "
                        "il tombait a zero et le break even sortait negatif")
    p.add_argument("--cout-produit", type=float, default=None,
                   help="obligatoire, meme a zero")
    p.add_argument("--emballage", type=float, default=None,
                   help="obligatoire, meme a zero")
    p.add_argument("--livraison", type=float, default=None,
                   help="obligatoire, meme a zero")
    p.add_argument("--frais-cod", type=float, default=None,
                   help="obligatoire, meme a zero")
    p.add_argument("--taux-livraison", type=float, default=0.0,
                   help="LIVREES divisees par CONFIRMEES, pas par expediees")

    p.add_argument("--plafond-stock", action="store_true")
    p.add_argument("--stock", type=int, default=0)
    p.add_argument("--jours-reappro", type=int, default=0)
    p.add_argument("--taux-confirmation", type=float, default=0.0)
    p.add_argument("--cout-commande", type=float, default=0.0,
                   help="ce que coute une commande en publicite")
    p.add_argument("--be-commande", type=float, default=0.0,
                   help="le break even par commande, en DINARS — OBLIGATOIRE")

    p.add_argument("--classer", action="store_true")
    p.add_argument("--angles", default="",
                   help='"A1:18:7:30000" — nom:livres:retours:DEPENSE')
    p.add_argument("--sur", default="angles", choices=["angles", "audiences"])
    p.add_argument("--marge-livree", type=float, default=0.0,
                   help="en DINARS — elle sort de --break-even")
    p.add_argument("--cout-retour", type=float, default=None,
                   help="en DINARS — OBLIGATOIRE, meme a zero")

    p.add_argument("--porte", action="store_true")
    p.add_argument("--commandes", type=int, default=0)
    p.add_argument("--confirmees", type=int, default=0)
    p.add_argument("--livrees", type=int, default=0)
    p.add_argument("--expediees", type=int, default=0)
    p.add_argument("--retours", type=int, default=-1,
                   help="OBLIGATOIRE des qu'on parle de colis, meme a zero")
    p.add_argument("--be-livree", type=float, default=0.0,
                   help="en DINARS, il vient de Tassyir")
    p.add_argument("--cout-livree", type=float, default=0.0,
                   help="ce que coute un colis livre en publicite")

    p.add_argument("--audiences", action="store_true")
    p.add_argument("--retrouves", type=int, default=-1,
                   help="le nombre que META annonce, pas celui qu'on a envoye")

    p.add_argument("--echelle", action="store_true")
    p.add_argument("--budget-actuel", type=float, default=0.0)
    p.add_argument("--plafond", type=float, default=0.0,
                   help="le plafond du stock, en DINARS")
    p.add_argument("--date-lancement", default="",
                   help="AAAA-MM-JJ — elle est dans le fichier de passage")
    p.add_argument("--hier", default="", choices=["", "rentable", "perte"],
                   help="OBLIGATOIRE : rentable ou perte. Rien par defaut.")
    p.add_argument("--maintenant", default="",
                   help="AAAA-MM-JJ HH:MM — par defaut, l'heure d'ici")
    p.add_argument("--hausse", type=float, default=0.0,
                   help="la hausse voulue, de 0.20 a 0.30 (ou 20 a 30) — par "
                        "defaut l'outil la choisit sur la marge mesuree")

    p.add_argument("--gagnant", action="store_true",
                   help="le gagnant du test : l'annonce dont le resultat coute le moins")
    p.add_argument("--annonces", default="",
                   help='"<id annonce>:<resultats>:<DEPENSE>,..." — lus dans Meta, '
                        "depuis le lancement")
    p.add_argument("--depart-scale", action="store_true",
                   help="la campagne de SCALE en CBO : combien d'ad sets, quel budget")
    p.add_argument("--budget-gagnant", type=float, default=0.0,
                   help="le budget du jour de l'ad set du gagnant au test (Meta)")
    p.add_argument("--budget-test", type=float, default=0.0,
                   help="le budget du jour du test s'il tourne encore (Meta), sinon 0")

    p.add_argument("--noter-hausse", action="store_true",
                   help="a lancer APRES une hausse reellement faite dans Meta")
    p.add_argument("--nouveau-budget", type=float, default=0.0)

    p.add_argument("--broad", action="store_true")
    p.add_argument("--passage", action="store_true")
    p.add_argument("--fichier", default="",
                   help="le chemin du fichier de passage, si tu le connais")
    p.add_argument("--rapport", action="store_true",
                   help="le rapport quotidien, controle par les lois de la langue")
    p.add_argument("--produit", default="")
    p.add_argument("--observation", default="")
    p.add_argument("--ou", default="")
    p.add_argument("--decision", default="")
    p.add_argument("--choix", default="", help='trois choix separes par des |')
    p.add_argument("--prochaine", default="")
    p.add_argument("--controler", default="")
    return p


TITRES = {"angles": "ترتيب الأنقل على الربح الصافي",
          "audiences": "ترتيب الأوديونس على الربح الصافي"}

AIDE_DEVISE = (
    "REFUS : il faut --devise-depenses DZD|USD|EUR.\n"
    "Meta compte dans la devise du compte, cet outil compte en dinars.\n"
    "Des dollars pris pour des dinars divisent le cout par deux cent\n"
    "soixante : l'angle le plus cher devient le plus rentable.\n"
    "Si ce n'est pas DZD, ajoute --taux-dinar <le taux REEL du client>.")


MODES = ("installer", "verifier", "break_even", "plafond_stock", "classer",
         "porte", "audiences", "echelle", "noter_hausse", "broad", "passage",
         "rapport", "controler", "gagnant", "depart_scale")


def sortie_json(quoi, donnees):
    """POUR LE BUREAU (ajout du 03/10/2026) : quand la variable MANITA_JSON vaut 1,
    l'outil imprime AUSSI une ligne « MANITA_JSON {...} » avec les nombres qu'il
    vient de calculer. Le calcul ne change pas : c'est la meme valeur que
    l'ecran, lue par une machine au lieu d'un humain."""
    if os.environ.get("MANITA_JSON") != "1":
        return
    d = dict(donnees)
    d["quoi"] = quoi
    print("MANITA_JSON " + json.dumps(d, ensure_ascii=False, default=float))


def main():
    p = _construire_parser()
    a = p.parse_args()

    # UN SEUL MODE A LA FOIS. Avant, la premiere condition trouvee gagnait et
    # les autres etaient ignorees SANS UN MOT : « --echelle --hier perte
    # --noter-hausse » inscrivait une hausse sur un jour de perte, sans qu'un
    # seul controle de l'echelle ait tourne.
    demandes = [m for m in MODES if getattr(a, m, None)]
    if len(demandes) > 1:
        print("REFUS : une seule chose a la fois. Tu en as demande %d :"
              % len(demandes))
        for m in demandes:
            print("   --%s" % m.replace("_", "-"))
        print("Relance-les l'une apres l'autre, et lis chaque reponse.")
        return 2

    global DEVISE_COMPTE
    try:
        d = lire_devise(a.devise)
    except ValueError as e:
        print("REFUS : %s" % e)
        return 2
    if d:
        DEVISE_COMPTE = d

    if a.installer:
        print(BARRE)
        print("  RIEN A INSTALLER.")
        print("  Cet outil n'utilise que ce qui est deja dans Python.")
        print("  Aucun mot de passe administrateur. Aucun telechargement.")
        print(BARRE)
        return 0

    if a.verifier:
        return verifier()

    if a.controler:
        f = controle_message_client(a.controler)
        if f:
            print("REFUS — ce texte ne passe pas :")
            for i, quoi, ligne in f:
                print("   ligne %d — %s" % (i, quoi))
            return 1
        print("[OK] ce texte passe les controles connus.")
        print("     Ce n'est pas un detecteur de francais : relis quand meme.")
        return 0

    if a.broad:
        montrer(vue_broad())
        return 0

    if a.passage:
        # --fichier EST UN FICHIER. dirname le ramenait a son dossier, et un
        # chemin qui n'existe pas rendait zero en lisant le fichier d'a cote.
        d, err, chemin = lire_passage(fichier=a.fichier or None)
        if err:
            print("REFUS : %s" % err)
            print("L'agent testing doit l'avoir ecrit avant. Ne pas le fabriquer.")
            return 2
        print(BARRE)
        print("  FICHIER DE PASSAGE LU")
        print(BARRE)
        # LE CHEMIN, TOUJOURS. Onze endroits sont balayes : sans lui, on ne
        # sait pas de quel produit ni de quel dossier on parle.
        print("  lu dans ...........   %s" % chemin)
        print("  marque de la campagne  %s" % d.get("cle"))
        print("  date du lancement ...  %s" % d.get("date_lancement"))
        print("  compte publicitaire    %s" % d.get("ad_account_id"))
        print("  produit ............   %s" % d.get("product_id"))
        print("  devise .............   %s" % d.get("devise"))
        # LE MODE DU TEST. Il ne change pas la porte — elle se joue sur des
        # colis, pas sur des jours — mais il change ce que le client doit
        # savoir : un test message n'a pas de lien marque, donc l'angle qui
        # a ramene une commande n'est connu que si la fille de la
        # confirmation l'a ecrit. Le taire ferait promettre au client une
        # lecture par angle qui n'existe pas.
        mode_test = d.get("mode")
        if mode_test in MODES_TEST:
            print("  mode du test .......   %s" % mode_test)
        else:
            print("  mode du test .......   non note (fichier ancien)")
        print("  break even/commande    %s DA" % d.get("break_even_par_commande_da"))
        c = d.get("couts", {})
        for k in ("prix", "cout_produit", "emballage", "livraison", "frais_cod", "cout_retour"):
            print("  %-19s %s" % (k, c.get(k)))
        t = d.get("taux_declares", {})
        if t:
            print("  taux DECLARES au test  confirmation %s / livraison %s"
                  % (t.get("confirmation"), t.get("livraison")))
        # LE BLOC DU COACH. Sans lui, cet ecran affichait le break even du
        # TEST — celui d'avant les vraies commandes — sous la phrase « ces
        # chiffres font foi ». Sur un cas reel, il etait faux de soixante-deux
        # pour cent, et rien ne le signalait.
        co = d.get("coach") or {}
        if not co:
            print(BARRE)
            print("CES CHIFFRES SONT CEUX DU TEST, avant les vraies commandes.")
            print("Le fichier ne porte aucun bloc « coach » : l'agent Coach")
            print("n'est pas passe, ou il n'a pas passe la main.")
            print("Tu peux travailler avec, mais dis-le au client : ce break")
            print("even est une estimation faite sur des taux declares de")
            print("memoire, pas sur ce qui s'est vraiment vendu.")
            print(BARRE)
            return 0
        print(BARRE)
        print("  CE QUE L'AGENT COACH A MESURE — C'EST CECI QUI FAIT FOI")
        print(BARRE)
        print("  date ................   %s" % co.get("date"))
        print("  source des chiffres    %s" % co.get("source_des_chiffres"))
        print("  porte ..............   %s" % co.get("porte"))
        tr = co.get("taux_reels", {})
        if tr:
            print("  taux REELS             confirmation %s / livraison %s"
                  % (tr.get("confirmation"), tr.get("livraison")))
        for cle, etiquette in (("be_par_commande_reel_da", "break even/commande REEL"),
                               ("be_par_livree_da", "break even/colis livre"),
                               ("cout_par_livree_da", "cout par colis livre")):
            if co.get(cle) is not None:
                print("  %-22s %s DA" % (etiquette, co.get(cle)))
        m = co.get("mesures", {})
        if m:
            print("  mesures                %s" % json.dumps(m, ensure_ascii=False))
        au = co.get("audit_erp", {})
        casse = au.get("casse") or []
        pas_vu = au.get("pas_vu") or []
        if casse or pas_vu:
            print(BARRE)
            print("  CE QUI EST ENCORE CASSE DANS SON BACK OFFICE :")
            for c in casse:
                print("    casse   %s" % c)
            for c in pas_vu:
                print("    pas vu  %s" % c)
            print("  La porte s'est ouverte sur les commandes, pas sur ca.")
            print("  Dis-le au client AVANT de parler de faire grandir.")
        print(BARRE)
        ancien = d.get("break_even_par_commande_da")
        nouveau = co.get("be_par_commande_reel_da")
        if ancien and nouveau:
            try:
                ecart = abs(float(nouveau) - float(ancien)) / float(ancien) * 100.0
            except (TypeError, ValueError):
                ecart = None
            if ecart is not None and ecart >= 5:
                print("ATTENTION : le break even a bouge depuis le test.")
                print("  au test ........ %s DA" % ancien)
                print("  mesure ......... %s DA" % nouveau)
                print("  ecart .......... %.0f %%" % ecart)
                print("C'est le MESURE qui sert, pas celui du test.")
                print(BARRE)
        print("EN CAS DE DOUTE : ce que le client te dit aujourd'hui par ecrit")
        print("gagne, puis le bloc coach, puis le bloc du test. Jamais une")
        print("moyenne, et jamais en silence : montre-lui les deux.")
        print(BARRE)
        return 0

    # LE TAUX DU CLIENT S'APPLIQUE A TOUT CE QUI S'AFFICHE, dans tous les
    # modes. Avant, il n'etait pose que dans les modes qui convertissent, et
    # --break-even — le seul ecran que le client lit vraiment — affichait
    # toujours au cours code en dur, meme quand le client avait donne le sien.
    global TAUX_DINAR
    if a.taux_dinar and a.taux_dinar > 0 and DEVISE_COMPTE != "DZD":
        if not (50.0 <= a.taux_dinar <= 500.0):
            print("REFUS : taux suspect : %s dinars. Redemande-lui." % a.taux_dinar)
            return 2
        TAUX_DINAR = a.taux_dinar
    # AUCUN ECRAN EN DEVISE ETRANGERE SANS LE TAUX DU CLIENT.
    # Avant, sans --taux-dinar, l'outil convertissait en silence a un cours
    # code en dur. L'ecran que le client lit le plus — son break even —
    # sortait faux, et personne ne le voyait.
    if (DEVISE_COMPTE != "DZD" and not TAUX_DINAR
            and (a.break_even or a.classer or a.plafond_stock or a.porte
                 or a.echelle or a.gagnant or a.depart_scale)):
        print("REFUS : il faut --taux-dinar.")
        print("Tu affiches en %s, et je ne connais pas son taux." % DEVISE_COMPTE)
        print("Je ne vais pas en inventer un : ce qu'une banque prend a un")
        print("commercant algerien n'est pas un cours qu'on trouve quelque part.")
        print("Demande-lui, une fois : un %s, il te revient a combien de dinars ?"
              % DEVISE_COMPTE)
        print("Ou affiche en dinars seulement : --devise DZD")
        return 2

    # --- la devise des montants qui viennent de Meta
    besoin_devise = (a.classer or a.plafond_stock or a.porte or a.echelle
                     or a.noter_hausse or a.gagnant or a.depart_scale)
    dev_dep, taux = None, None
    if besoin_devise:
        if not a.devise_depenses:
            print(AIDE_DEVISE)
            return 2
        try:
            dev_dep = lire_devise(a.devise_depenses)
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
        taux = a.taux_dinar if a.taux_dinar > 0 else None
        if dev_dep != "DZD" and DEVISE_COMPTE != "DZD" and dev_dep != DEVISE_COMPTE:
            print("REFUS : tu affiches en %s et tu declares des depenses en %s."
                  % (DEVISE_COMPTE, dev_dep))
            print("Deux monnaies etrangeres a la fois, avec un seul taux :")
            print("je ne saurais pas laquelle convertir. Mets la meme des deux")
            print("cotes, ou declare les depenses en DZD.")
            return 2

    def en_dinars(valeur, nom_option):
        v = convertir_en_dinars(valeur, dev_dep, taux)
        garde_plancher(nom_option, v)
        return v

    if a.break_even:
        # LE PRIX A SON PROPRE REFUS. Les cinq couts sont acceptes a zero —
        # un emballage peut ne rien couter. Un prix de vente, jamais : il
        # tombait a zero en silence, le break even sortait NEGATIF, et
        # l'ecran annoncait au client que son produit perd quoi qu'il fasse,
        # sur un chiffre que personne n'avait donne.
        if a.prix is None or a.prix <= 0:
            print("REFUS : il faut --prix, le prix de vente REEL en dinars.")
            print("Lui, ce n'est PAS « meme a zero » : a zero, le break even")
            print("sort negatif et l'ecran annonce au client que son produit")
            print("perd quoi qu'il fasse. Ce n'est pas un verdict, c'est un")
            print("chiffre manquant.")
            return 2
        oublis = [n for n, v in (("--cout-produit", a.cout_produit),
                                 ("--emballage", a.emballage),
                                 ("--livraison", a.livraison),
                                 ("--frais-cod", a.frais_cod),
                                 ("--cout-retour", a.cout_retour))
                  if v is None]
        if oublis:
            print("REFUS : il manque %s — meme a zero." % ", ".join(oublis))
            print("Les oublier ne fait pas planter l'outil : ils tombent a zero")
            print("en silence et le break even sort trop haut. Un break even")
            print("trop haut ouvre la porte et autorise des hausses sur un")
            print("produit qui perd. Oublier les trois d'un coup le gonfle de")
            print("soixante-cinq pour cent.")
            return 2
        try:
            garde_plancher("--prix", a.prix)
            r = break_even(a.prix, a.cout_produit, a.emballage, a.livraison,
                           a.frais_cod, a.cout_retour, a.taux_confirmation,
                           a.taux_livraison)
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
        montrer(vue_break_even(r, a.prix))
        # les chiffres EXACTS, a repasser tels quels aux autres commandes :
        # l'ecran arrondit, et 802.5 affiche 802 n'est plus le bon nombre.
        print("")
        print("A REPASSER TEL QUEL, sans arrondir :")
        print("  --be-commande %.2f" % r["par_commande"])
        print("  --be-livree %.2f" % r["par_livree"])
        print("  --marge-livree %.2f   (c'est d'ici qu'elle vient, pas de tasyir)"
              % r["marge_livree"])
        return 0 if r["passe"] else 3

    if a.plafond_stock:
        if a.be_commande <= 0:
            print("REFUS : il faut --be-commande, le break even par commande.")
            print("Sans lui, ce plafond monte quand le cout par commande monte :")
            print("il donnerait le droit de bruler plus vite.")
            return 2
        try:
            cout = en_dinars(a.cout_commande, "--cout-commande")
            garde_plancher("--be-commande", a.be_commande)
            r = plafond_stock(a.stock, a.jours_reappro, a.taux_confirmation,
                              cout, a.be_commande)
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
        montrer(vue_plafond(r, a.stock, a.jours_reappro))
        sortie_json("plafond_stock", dict(r, plancher_jour_da=PLANCHER_JOUR_DA))
        if r["rentable"] and r["budget_max_da"] < PLANCHER_JOUR_DA:
            # Le plafond est vrai, mais il est SOUS le plancher de Meta :
            # --echelle le refusera. Le donner quand meme faisait croire a un
            # nombre mal converti, et l'agent le multipliait par le taux.
            print("")
            print("PAS DE PLAFOND A REPASSER — et ce n'est pas un probleme de")
            print("monnaie. Le plafond du stock vaut %d DA par jour, sous le"
                  % arrondi(r["budget_max_da"]))
            print("plancher de Meta a %d DA. Ce stock ne porte pas de campagne."
                  % arrondi(PLANCHER_JOUR_DA))
            print("Il faut PRODUIRE avant de scaler, ou raccourcir les jours de")
            print("reappro. Ne lance pas --echelle, et ne convertis rien.")
            return 3
        if r["rentable"]:
            print("")
            print("A REPASSER TEL QUEL, sans arrondir :")
            print("  --plafond %.2f" % r["budget_max_da"])
            return 0
        print("")
        print("PAS DE PLAFOND A REPASSER. Il n'y a pas de hausse a calculer :")
        print("ne lance pas --echelle, et ne fabrique pas un plafond.")
        return 2

    if a.classer:
        elements = []
        for bloc in a.angles.split(","):
            bloc = bloc.strip()
            if not bloc:
                continue
            if bloc.count(":") > 3:
                # on coupe par la DROITE : un nom d'angle peut contenir un
                # deux-points, le client nomme ses angles comme il veut.
                parts = bloc.rsplit(":", 3)
            else:
                parts = bloc.split(":")
            if len(parts) == 3:
                print("REFUS : il manque la DEPENSE — nom:livres:retours:depense")
                print("Sans la depense publicitaire, ce n'est pas un benefice net :")
                print("c'est une marge brute, et elle affiche un profit sur un")
                print("angle qui a coute plus qu'il n'a rapporte.")
                print("La depense par annonce se lit dans Meta.")
                return 2
            if len(parts) != 4:
                print("REFUS : format attendu nom:livres:retours:depense — recu %r" % bloc)
                return 2
            try:
                nom = nom_propre(parts[0])
                if not nom:
                    print("REFUS : un angle sans nom — %r" % bloc)
                    print("Deux angles sans nom sont impossibles a distinguer.")
                    return 2
                dep = convertir_en_dinars(nombre_fini(parts[3], "la depense"),
                                          dev_dep, taux)
                elements.append((nom, int(parts[1]), int(parts[2]), dep))
            except ValueError as e:
                print("REFUS : %s — %r" % (e, bloc))
                return 2
        if not elements:
            print("Il manque --angles")
            return 2
        if a.marge_livree <= 0:
            print("REFUS : il manque --marge-livree, en DINARS.")
            print("Elle sort de --break-even, pas de tasyir.")
            return 2
        if a.cout_retour is None:
            print("REFUS : il manque --cout-retour, meme a zero.")
            print("Oublie, il tombe a zero en silence — et c'est exactement")
            print("ce qui fait gagner l'angle qui retourne le plus. La loi 1")
            print("dit le contraire : celui qui retourne moins gagne.")
            return 2
        try:
            garde_plancher("--marge-livree", a.marge_livree)
            garde_plancher("--cout-retour", a.cout_retour)
            garde_depenses(elements)
            c = classer(elements, a.marge_livree, a.cout_retour)
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
        montrer(vue_classement(c, TITRES[a.sur]), exempts=_exempts(c))
        return 3 if (c["total_en_perte"] or not c["assez"]) else 0

    if a.porte:
        # LES RETOURS NE SE DEVINENT PAS, ET ZERO N'EST PAS UNE SUPPOSITION
        # NEUTRE. --retours n'etait pas declare : le getattr retombait
        # toujours sur zero, en_route valait expediees - livrees, et TOUT
        # colis non livre etait credite a trois sur dix. La porte s'ouvrait
        # des 14,29 % de livraison reelle — 20 colis livres sur 140 partis.
        if a.retours < 0:
            print("REFUS : il faut --retours, meme a zero.")
            print("Sans lui, les colis RENDUS sont comptes comme des colis")
            print("encore en route, credites a trois sur dix : la porte")
            print("s'ouvre sur un produit que personne ne recoit.")
            print("Le chiffre se lit dans Tassyir. Il ne se deduit pas.")
            return 2
        try:
            cout = en_dinars(a.cout_livree, "--cout-livree") if a.cout_livree > 0 else None
            garde_plancher("--be-livree", a.be_livree)
            r = porte_scaling(a.confirmees, a.commandes, a.livrees, a.expediees,
                              a.stock, a.be_livree, cout, a.retours)
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
        montrer(vue_porte(r))
        return 0 if r["ouverte"] else 3

    if a.audiences:
        montrer(vue_audiences(porte_audiences(None if a.retrouves < 0 else a.retrouves)))
        return 0

    if a.noter_hausse:
        if a.nouveau_budget <= 0:
            print("REFUS : il faut --nouveau-budget, le budget REELLEMENT pose.")
            return 2
        try:
            quand = lire_date(a.maintenant) if a.maintenant else datetime.datetime.now()
            budget = en_dinars(a.nouveau_budget, "--nouveau-budget")
            chemin = noter_hausse(quand, budget)
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
        sortie_json("hausse_notee", {"chemin": chemin, "budget_da": budget})
        print("Hausse notee dans %s" % chemin)
        print("Budget enregistre : %d DA" % arrondi(budget))
        print("C'est ce fichier qui donnera le delai de la prochaine fois.")
        return 0

    if a.echelle:
        if not a.hier:
            print("REFUS : il faut --hier rentable   ou   --hier perte")
            print("Ca ne se devine pas. Par defaut, l'outil ne suppose RIEN :")
            print("supposer « rentable » autoriserait une hausse sur une perte.")
            return 2
        if not a.date_lancement:
            print("REFUS : il faut --date-lancement AAAA-MM-JJ.")
            print("Elle est dans le fichier de passage de l'agent testing.")
            print("Sans elle, le delai des trois premiers jours ne protege rien.")
            return 2
        # LA RENTABILITE NE SE DECLARE PAS, ELLE SE CALCULE.
        # « --hier rentable » est une phrase. Si la commande coute plus que le
        # break even, aucune phrase ne rend la hausse raisonnable.
        if a.be_commande <= 0 or a.cout_commande <= 0:
            print("REFUS : il faut --be-commande et --cout-commande.")
            print("Sans eux, cette commande ne sait pas si le produit gagne :")
            print("elle te croit sur parole. Ce sont les memes deux chiffres")
            print("que --plafond-stock.")
            return 2
        try:
            maintenant = lire_date(a.maintenant) if a.maintenant else datetime.datetime.now()
            lancement = lire_date(a.date_lancement, "la date de lancement")
            # --budget-actuel vient de Meta : il suit la devise.
            # --plafond vient de --plafond-stock : il est DEJA en dinars.
            # Le convertir multipliait le plafond par le taux et autorisait
            # une hausse tres au-dessus de ce que le stock peut suivre.
            budget = en_dinars(a.budget_actuel, "--budget-actuel")
            cout = en_dinars(a.cout_commande, "--cout-commande")
            garde_plancher("--be-commande", a.be_commande)
            plafond = nombre_fini(a.plafond, "--plafond")
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
        manque = [n for n, v in (("--budget-actuel", budget),
                                 ("--plafond", plafond)) if v <= 0]
        if manque:
            print("REFUS : il manque %s." % ", ".join(manque))
            print("Le plafond sort de --plafond-stock. S'il a refuse de t'en")
            print("donner un, c'est qu'il n'y a pas de hausse a calculer :")
            print("la reponse est NON, et tu ne fabriques pas un plafond.")
            return 2
        # UN PLAFOND BAS N'EST PAS UNE ERREUR DE MONNAIE. Il sort de
        # --plafond-stock, deja en DINARS. Le refuser en disant « tu as sans
        # doute donne des dollars, convertis d'abord » etait faux ET cher :
        # l'agent convertissait, 169,95 devenait 42 317, et ce plafond gonfle
        # passait — sur un stock de deux pieces. La verite est plus simple.
        if plafond < PLANCHER_JOUR_DA:
            print(BARRE)
            print("REFUS : et ce n'est PAS une erreur de monnaie.")
            print("  plafond du stock ...... %d DA par jour" % arrondi(plafond))
            print("  plancher de Meta ...... %d DA par jour" % arrondi(PLANCHER_JOUR_DA))
            print("Ce plafond sort de --plafond-stock, il est DEJA en dinars.")
            print("NE LE CONVERTIS PAS : le multiplier par un taux fabrique un")
            print("budget que le stock ne peut pas suivre, et on vend alors ce")
            print("qu'on n'a pas. Ce que disent ces deux nombres, c'est que le")
            print("stock est trop petit pour scaler : il faut PRODUIRE avant,")
            print("ou raccourcir les jours de reappro. Il n'y a pas de hausse")
            print("a calculer aujourd'hui.")
            print(BARRE)
            return 3
        if a.be_commande - cout <= 0:
            print(BARRE)
            print("REFUS : la commande coute plus qu'elle ne rapporte.")
            print("  cout par commande ..... %d DA" % arrondi(cout))
            print("  break even par commande %d DA" % arrondi(a.be_commande))
            print("Tu as peut-etre ecrit « --hier rentable », mais les chiffres")
            print("disent le contraire, et ce sont eux qui comptent. On ne")
            print("monte pas le budget d'un produit qui perd : on le repare.")
            print(BARRE)
            return 3
        if maintenant < lancement:
            print("REFUS : la date de lancement est dans le futur.")
            return 2
        # LA HAUSSE : la fourchette du vendeur, +20 a 30 %. Sans --hausse,
        # la marge MESUREE choisit (hausse_permise) ; avec, on la verifie.
        try:
            hausse = lire_hausse(a.hausse) if a.hausse else hausse_permise(a.be_commande, cout)
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
        journal, err = lire_scaling()
        if err:
            print("REFUS : %s" % err)
            print("Tant que ce journal ne se lit pas, le delai entre deux")
            print("hausses ne protege plus rien. Repare-le ou efface-le, mais")
            print("ne monte pas de budget en attendant.")
            return 2
        h_lancement = heures_entre(lancement, maintenant)
        h_derniere = None
        if journal.get("derniere_hausse"):
            h_derniere = heures_entre(lire_date(journal["derniere_hausse"]),
                                      maintenant)
        e = echelle_budget(budget, plafond, h_derniere,
                           a.hier == "rentable", h_lancement, hausse=hausse)
        montrer(vue_echelle(e, budget))
        sortie_json("echelle", dict(e, budget_actuel_da=budget))
        print("")
        if h_derniere is None:
            print("NOTE : aucune hausse n'est inscrite dans le journal. L'outil")
            print("a donc suppose qu'il n'y en a jamais eu. Si une hausse a ete")
            print("faite sans etre notee, ce calcul est faux — dis-le au client.")
        else:
            print("Derniere hausse notee : %s" % journal["derniere_hausse"])
        if e["autorise"]:
            print("Hausse : +%d %% (fourchette du vendeur : %d a %d %%, une fois"
                  % (arrondi(e["hausse"] * 100), arrondi(HAUSSE_MIN * 100),
                     arrondi(HAUSSE_MAX * 100)))
            print("par 48 heures au plus). Une campagne de SCALE en CBO : c'est le")
            print("daily_budget de la CAMPAGNE qui monte, jamais celui des ad sets.")
            print("Si le client ecrit « monte » et que la hausse est faite dans")
            print("Meta, note-la : --noter-hausse --nouveau-budget <le budget pose>")
        return 0 if e["autorise"] else 3

    if a.gagnant:
        elements = []
        for bloc in a.annonces.split(","):
            bloc = bloc.strip()
            if not bloc:
                continue
            parts = bloc.rsplit(":", 2)
            if len(parts) != 3:
                print("REFUS : format attendu id:resultats:depense — recu %r" % bloc)
                print("Les trois se lisent dans Meta, au niveau de l'ANNONCE,")
                print("sur la meme periode : depuis le lancement du test.")
                return 2
            try:
                res = nombre_fini(parts[1], "les resultats")
                if res != int(res):
                    raise ValueError("un nombre de resultats a virgule : %s" % parts[1])
                dep = convertir_en_dinars(nombre_fini(parts[2], "la depense"),
                                          dev_dep, taux)
                elements.append((parts[0], int(res), dep))
            except ValueError as e:
                print("REFUS : %s — %r" % (e, bloc))
                return 2
        if not elements:
            print("REFUS : il manque --annonces (id:resultats:depense, une par annonce du test)")
            return 2
        try:
            g = choisir_gagnant(elements)
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
        montrer(vue_gagnant(g), exempts=[l["code"] for l in g["classement"]])
        sortie_json("gagnant", g)
        if g["autorise"]:
            print("")
            print("LE GAGNANT : %s — c'est SON post (effective_object_story_id de"
                  % g["gagnant"]["code"])
            print("sa creative) qui entre dans la campagne de SCALE. On ne copie")
            print("ni la campagne ni l'annonce : on recree l'annonce sur le POST ID.")
        return 0 if g["autorise"] else 3

    if a.depart_scale:
        if a.be_commande <= 0 or a.cout_commande <= 0:
            print("REFUS : il faut --be-commande et --cout-commande.")
            print("On ne scale pas sans savoir si la commande gagne.")
            return 2
        if a.plafond <= 0:
            print("REFUS : il faut --plafond, celui que --plafond-stock a rendu.")
            print("S'il a refuse d'en donner un, il n'y a pas de scale a preparer.")
            return 2
        try:
            gagnant = en_dinars(a.budget_gagnant, "--budget-gagnant") if a.budget_gagnant > 0 else 0.0
            test = convertir_en_dinars(a.budget_test, dev_dep, taux) if a.budget_test > 0 else 0.0
            cout = en_dinars(a.cout_commande, "--cout-commande")
            garde_plancher("--be-commande", a.be_commande)
            if gagnant <= 0:
                raise ValueError("il faut --budget-gagnant, le budget du jour de "
                                 "l'ad set du gagnant au test")
            d = depart_scale(gagnant, nombre_fini(a.plafond, "--plafond"), test,
                             a.be_commande, cout)
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
        # LE NOMBRE QUE META ATTEND, quand le compte n'est pas en dinars. Le
        # montant en DA ne se pose JAMAIS tel quel sur un compte en dollars :
        # 5502 DA lus comme « la plus petite unite de la devise » faisaient
        # 550200 centimes, 5502 dollars par jour. En DZD (et pour le bureau,
        # qui appelle en DZD et convertit lui-meme), le JSON ne change pas.
        # LA DEVISE DU COMPTE : celle de l'affichage (--devise), sinon celle
        # des depenses lues dans Meta (--devise-depenses) : Meta compte dans
        # la devise du compte. Affiche en dinars (--devise DZD) avec des
        # depenses en dollars, le compte EST en dollars ; l'outil le savait et
        # ecrivait pourtant « campaign_daily_budget = 550200 » sous « A
        # REPASSER TEL QUEL » : le meme piege, 5502 dollars par jour.
        devise_meta, taux_meta = DEVISE_COMPTE, TAUX_DINAR
        if devise_meta == "DZD" and dev_dep and dev_dep != "DZD":
            devise_meta, taux_meta = dev_dep, taux
        centimes = None
        if d["autorise"] and devise_meta != "DZD":
            try:
                centimes = centimes_meta(d["budget_campagne_da"], devise_meta, taux_meta)
            except ValueError as e:
                print("REFUS : %s" % e)
                return 2
        montrer(vue_depart_scale(d))
        if centimes is None:
            sortie_json("depart_scale", d)
        else:
            sortie_json("depart_scale", dict(d, budget_campagne_centimes=centimes,
                                             devise_compte=devise_meta,
                                             taux_dinar=taux_meta))
        if d["autorise"] and centimes is not None:
            print("")
            print("A REPASSER TEL QUEL, sans arrondir :")
            print("  ad sets ............ %d   (broad, les memes wilayas que le test)" % d["ad_sets"])
            print("  campaign_daily_budget %d   (CBO, sur la CAMPAGNE : DEJA en centimes"
                  % centimes)
            print("                       de %s, soit %.2f %s par jour. Ne le multiplie"
                  % (devise_meta, centimes / 100.0, devise_meta))
            print("                       pas, ne le convertis pas.)")
            print("Ce nombre vaut SEULEMENT pour un compte publicitaire en %s (currency"
                  % devise_meta)
            print("de ads_get_ad_accounts). Compte dans une autre devise : relance avec")
            print("--devise <sa devise> --taux-dinar <son taux>.")
            print("")
            print("POUR INFORMATION SEULEMENT, ne se pose pas dans Meta :")
            print("  budget de campagne en dinars : %.2f DA par jour (taux : %s DA pour 1 %s)"
                  % (d["budget_campagne_da"], ("%g" % taux_meta), devise_meta))
            print("Aucun budget sur les ad sets, aucun plafond de depense, tout EN PAUSE.")
        elif d["autorise"]:
            print("")
            print("A REPASSER TEL QUEL, sans arrondir :")
            print("  ad sets ............ %d   (broad, les memes wilayas que le test)" % d["ad_sets"])
            print("  budget de CAMPAGNE . %.2f DA par jour   (CBO : campaign_daily_budget = %d,"
                  % (d["budget_campagne_da"], centimes_meta(d["budget_campagne_da"], "DZD", None)))
            print("                       en centimes de DZD : SEULEMENT si le compte est en DZD)")
            print("Compte publicitaire en USD ou en EUR (currency de ads_get_ad_accounts) : ce")
            print("montant en DA ne se pose PAS dans Meta. Relance avec --devise <sa devise>")
            print("--taux-dinar <son taux> : l'outil donne alors les centimes a poser.")
            print("Aucun budget sur les ad sets, aucun plafond de depense, tout EN PAUSE.")
        return 0 if d["autorise"] else 3

    if a.rapport:
        manque = [n for n, v in (("--produit", a.produit),
                                 ("--observation", a.observation),
                                 ("--ou", a.ou), ("--decision", a.decision),
                                 ("--choix", a.choix),
                                 ("--prochaine", a.prochaine)) if not v]
        if manque:
            print("REFUS : il manque %s" % ", ".join(manque))
            print("Le rapport a cinq blocs. On n'en saute aucun.")
            return 2
        choix = [c.strip() for c in a.choix.split("|") if c.strip()]
        if len(choix) != 3:
            print("REFUS : il faut TROIS choix, separes par des | — recu %d."
                  % len(choix))
            print("Au-dela de trois, les suivants etaient coupes en silence.")
            return 2
        # chaque bloc est verifie SEPAREMENT : le gabarit du rapport contient
        # deja de l'arabe, alors un rapport ecrit entierement en francais
        # passait le controle d'ensemble sans qu'un mot soit en arabe.
        blocs = ([("--observation", a.observation), ("--ou", a.ou),
                  ("--decision", a.decision), ("--prochaine", a.prochaine)]
                 + [("--choix (le %d)" % (i + 1), c) for i, c in enumerate(choix)])
        sans_arabe = [n for n, v in blocs if not ARABE.search(str(v))]
        if sans_arabe:
            print("REFUS : le client lit l'arabe. Ces blocs n'en ont pas un mot :")
            for nom in sans_arabe:
                print("   %s" % nom)
            return 1
        # la liste des mots francais interdits est fermee : « tout de suite »
        # ou « tunnel » passaient a travers. Dans un bloc de prose destine au
        # client, on refuse TOUT mot latin, liste ou pas.
        latins = [(n, mots_latins_dans(v)) for n, v in blocs]
        latins = [(n, m) for n, m in latins if m]
        if latins:
            print("REFUS : ces blocs sont pour le client. Ils s'ecrivent en arabe,")
            print("et ils contiennent des mots latins :")
            for nom, mots in latins:
                print("   %s : %s" % (nom, ", ".join(mots)))
            print("Un nom de modele se met dans --produit, pas dans le texte.")
            return 1
        texte = vue_rapport(a.produit, a.observation, a.ou, a.decision,
                            choix, a.prochaine)
        f = controle_message_client(texte, exempts=[str(a.produit).strip()])
        if f:
            print("REFUS D'AFFICHAGE — les lois de la langue ne passent pas :")
            for i, quoi, ligne in f:
                print("   ligne %d — %s" % (i, quoi))
                print("      %s" % ligne)
            return 1
        print(texte)
        return 0

    p.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
