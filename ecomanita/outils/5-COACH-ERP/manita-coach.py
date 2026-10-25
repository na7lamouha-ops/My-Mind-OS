#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ecom manita — AGENT 5 : COACH ERP
=================================
Il reprend la main quand l'agent Testing a fini ses trois jours.
Il lit CHAQUE JOUR, il corrige l'ERP avec la permission du client, et c'est
LUI qui tient la porte du scaling. Quand elle s'ouvre, il passe la main a
l'agent Scaling.

CE QU'IL NE FAIT PAS, ET C'EST VOULU :
  - il ne coupe RIEN tout seul. Meme en pleine perte, il MONTRE et il ATTEND
    le mot du client. L'agent Testing, lui, coupe pendant le test ; le coach
    non, parce qu'a ce stade la campagne a deja de l'histoire et qu'une
    coupure rebrule l'apprentissage.
  - il n'ecrit RIEN dans Tassyir sans montrer d'abord la ligne exacte et
    recevoir un oui.

AUCUNE INSTALLATION. Aucun mot de passe administrateur.

LA LOI DU ROAS, celle du vendeur, appliquee sans qu'on la redemande :
  - le ROAS se calcule sur les commandes LIVREES, jamais sur les brutes ni
    sur les confirmees
  - au denominateur : la depense publicitaire PLUS toutes les charges
  - on donne TOUJOURS la part des colis encore en route : leur depense est
    partie, leur argent n'est pas rentre
  - ces en-cours se comptent au PIRE DES CAS, trois colis livres sur dix

DEUX LOIS D'AFFICHAGE, controlees a chaque sortie :
  1. jamais un chiffre sur une ligne arabe — le nombre vit SEUL sur sa ligne
  2. jamais un mot francais dans ce que lit le client
Si une des deux casse, l'outil REFUSE d'afficher.
"""

import argparse
import datetime
import json
import os
import re
import sys

VERSION = "5.0"

# ===========================================================================
# 1. LES CONSTANTES
# ===========================================================================

JOUR_PASSAGE = 3          # l'agent Testing rend la main a la fin du jour trois
JOUR_VERDICT = 10         # avant ce jour, on lit sur la confirmation
CONFIRMEES_VERDICT = 25   # ou des qu'on a autant de commandes confirmees

# ===========================================================================
# LES DEUX MODES DE TEST — ils ne se lisent pas au meme rythme
# ===========================================================================
#
# SITE     la cliente remplit le formulaire de la page : la commande existe
#          tout de suite. L'agent Testing rend la main a la fin du jour
#          trois, et le verdict se prend au jour dix.
#
# MESSAGE  la cliente ECRIT, sur Messenger ou en direct sur Instagram. Elle
#          repond le soir, le lendemain, parfois deux jours apres, et c'est
#          la fille de la confirmation qui cree la commande a la main. Tout
#          arrive donc en retard : le verdict se prend plus tard. Appliquer
#          le calendrier du site au VERDICT d'un test message revient a
#          condamner un modele qui n'a pas fini de parler.
#
# LA REGLE DES TROIS JOURS (decision du vendeur, 06/10/2026) : l'agent
# Testing rend la main a la fin du jour TROIS dans les DEUX modes (avant,
# le mode message la rendait au jour cinq). Seul le verdict garde son
# rythme par mode. Le bureau lit le meme jour (missions.mjs JOUR_VERDICT,
# manita-testing.py JOURS_LECTURE) : le verificateur recoupe les trois.
#
# Le mode est ECRIT DANS LE FICHIER DE PASSAGE par l'agent Testing. On ne
# le devine pas. Un fichier ancien qui ne le porte pas est traite comme un
# test site, et l'outil le DIT au lieu de le supposer en silence.

MODES_TEST = ("site", "message")
JOUR_PASSAGE_MODE = {"site": 3, "message": 3}   # la regle des trois jours, dans les deux modes (06/10/2026)
JOUR_VERDICT_MODE = {"site": 10, "message": 12}

# la porte du scaling — c'est ICI qu'elle vit. L'agent Scaling la RELIT.
PORTE_CONFIRMATION = 0.50
PORTE_LIVRAISON = 0.40
PORTE_LIVREES = 20
# --- LA PORTE DE PRODUCTION et LE BON DE COMMANDE (regles du client, 19/09/2026)
PORTE_PRODUCTION_PEU = 35   # confirmees exigees quand il y a MOINS de trois couleurs
PORTE_PRODUCTION_BCP = 50   # confirmees exigees a partir de trois couleurs
MINI_ATELIER = 10           # l'atelier ne coud pas moins de dix pieces par reference

PIRE_CAS_LIVRAISON = 0.30  # les colis en route se comptent a trois sur dix

# les paliers de la lecture quotidienne, en multiples du break even
PALIER_PERTE_LEGERE = 1.5
PALIER_PERTE_LOURDE = 3.0
DEPENSE_MINIMUM_POUR_JUGER = 3.0   # en multiples du break even par commande
DEPENSE_DISJONCTEUR_A_ZERO = 10.0  # depense sans UNE SEULE confirmee
BASE_MINI_STOCK_COACH = 1.0        # 10/10/2026 : comme BASE_MINI_STOCK du testing

DECISIONS = ("RENTABLE", "PERTE_LEGERE", "PERTE_LOURDE", "DISJONCTEUR",
             "DONNEES_INSUFFISANTES")

DEVISES = ("DZD", "USD", "EUR")
ALIAS_DEVISE = {"DA": "DZD", "DZ": "DZD", "DINAR": "DZD", "DINARS": "DZD",
                "DOLLAR": "USD", "DOLLARS": "USD", "EURO": "EUR", "EUROS": "EUR"}

PLANCHER_PLAUSIBLE_DA = {
    "--prix": 200.0, "--be-commande": 50.0, "--be-confirmee": 50.0,
    "--be-livree": 100.0, "--charges": 0.0, "--cout-livree": 100.0,
}

FICHIER_PASSAGE = "test-en-cours.json"
FICHIER_DECISIONS = "mes-decisions.txt"

DEVISE_COMPTE = "USD"
VERS_DINARS = {"USD": 255.0, "EUR": 280.0, "DZD": 1.0}
TAUX_DINAR = None

# ===========================================================================
# 2. LES DEUX LOIS D'AFFICHAGE
# ===========================================================================

ARABE = re.compile(r'[؀-ۿ]')
CHIFFRE = re.compile(r'[0-9٠-٩۰-۹]')
FRANCAIS_INTERDIT = re.compile(
    r'\b(seuil|budget|campagne|d[eé]pense|livr[eé]e?s?|livraison|confirm[eé]e?s?|'
    r'commande|b[eé]n[eé]fice|perte|marge|retour|stock|annonce|vid[eé]o|prix|'
    r'co[uû]t|audience|exclusion|paiement|client|boutique|produit|rentable|'
    r'gagner|perdre|argent|semaine|lien|angle|test|r[eé]sultat|moyenne|taux|'
    # 21/09/2026 : les huit termes du tableau de traduction qui
    # passaient au travers, dont les deux plus employes du metier.
    r'roas|pixel|ad[\s-]*set|cr[eé]a|creative|scaling|colis|confirmation|'
    r'emballage|spend|even|breakeven)\b',
    re.I)
# 10/10/2026 : le motif de l'agent Testing (« C O D », « c-o-d », « cash on delivery » passaient)
COD_INTERDIT = re.compile(
    r'\bc[\s.\-_]*o[\s.\-_]*d\b|\bcash[\s\-]+on[\s\-]+deliver', re.I)
MAROCAIN = ["تحوّس", "تحوس", "تحوسي", "تحوّسي", "الكاس", "الصوردي",
            "دابا", "واخا"]
TECHNIQUE = re.compile(r'https?://|utm_|\s\|\s|^\s*[A-Z0-9_\-]{8,}\s*$')
LATIN_PERMIS = re.compile(
    r'^[\s=|\-·.:%+/]*$|^\s*[\d\s.,%|+\-]*(DA|USD|EUR|DZD|%)?[\s\d.,]*$')
MOT_LATIN = re.compile(r'[A-Za-zÀ-ÿ]{3,}')


def controle_affichage(texte, exempts=()):
    """Rend la liste des fautes. Vide = l'affichage est permis.
    `exempts` : les lignes qui portent un nom donne par le client.
    CE QU'IL N'ATTRAPE PAS : une phrase francaise avec d'autres mots que ceux
    de la liste. Ce n'est pas un detecteur de francais — c'est un filet."""
    exempts = set(e.strip() for e in exempts if e.strip())
    fautes = []
    for i, ligne in enumerate(texte.split("\n"), 1):
        arabe = bool(ARABE.search(ligne))
        exempt = ligne.strip() in exempts
        technique = bool(TECHNIQUE.search(ligne)) and not arabe
        if arabe and CHIFFRE.search(ligne):
            fautes.append((i, "un chiffre sur une ligne arabe", ligne))
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
    fautes = controle_affichage(texte, exempts)
    if not ARABE.search(texte) and MOT_LATIN.search(texte):
        fautes.append((0, "ce texte n'a pas un seul mot d'arabe", texte[:60]))
    return fautes


def mots_latins_dans(bloc, permis=()):
    """Un bloc de prose pour le client s'ecrit EN ARABE. La liste des mots
    francais interdits est fermee : « tout de suite » passait a travers.
    Ici on refuse TOUT mot latin dans un bloc qui doit etre en arabe."""
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


def nom_propre(nom):
    nom = "".join(c for c in str(nom) if c.isprintable() or c == " ")
    for i, ar in enumerate("٠١٢٣٤٥٦٧٨٩"):
        nom = nom.replace(ar, str(i))
    for i, pe in enumerate("۰۱۲۳۴۵۶۷۸۹"):
        nom = nom.replace(pe, str(i))
    return nom.strip()


def lignes_nom(nom):
    """Un nom qui melange un code latin et de l'arabe sur la MEME ligne
    s'affiche a l'envers chez le client. On le coupe en deux lignes."""
    nom = nom_propre(nom)
    arabe = "".join(c for c in nom if ARABE.match(c) or c in " ،؛؟").strip()
    latin = "".join(c for c in nom if not ARABE.match(c)).strip(" -·:")
    lignes = []
    if latin:
        lignes.append("      " + latin)
    if arabe:
        lignes.append("  " + arabe)
    return lignes or ["      " + nom]


def arrondi(valeur):
    """round() de Python arrondit au pair : 802.5 devenait 802."""
    import math
    return math.floor(valeur + 0.5) if valeur >= 0 else -math.floor(-valeur + 0.5)


def ligne_nombre(valeur_da):
    d = DEVISE_COMPTE if DEVISE_COMPTE in VERS_DINARS else "USD"
    if d == "DZD":
        return "      %d DA" % arrondi(valeur_da)
    taux = TAUX_DINAR if TAUX_DINAR else VERS_DINARS[d]
    return "      %d DA   =   %.2f %s" % (arrondi(valeur_da), valeur_da / taux, d)


def ligne_pourcent(part):
    return "      %d %%" % arrondi(part * 100.0)


# ===========================================================================
# 3. LES MONNAIES
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
    """LE TAUX VIENT DU CLIENT. Ce n'est pas le cours du jour : c'est ce que
    sa banque lui prend. Personne d'autre ne le sait."""
    if devise == "DZD":
        return float(valeur)
    if taux_dinar is None or taux_dinar <= 0:
        raise ValueError(
            "il faut --taux-dinar : combien de dinars pour un %s, le taux REEL "
            "du client, pas un cours trouve quelque part" % devise)
    if not (50.0 <= taux_dinar <= 500.0):
        raise ValueError("taux suspect : %s dinars pour un %s. Redemande-lui."
                         % (taux_dinar, devise))
    return float(valeur) * float(taux_dinar)


def garde_plancher(nom_option, valeur_da):
    mini = PLANCHER_PLAUSIBLE_DA.get(nom_option)
    if mini is None or valeur_da <= 0 or mini <= 0:
        return
    if valeur_da < mini:
        raise ValueError(
            "%s vaut %s : c'est trop bas pour des DINARS. Tu as sans doute "
            "donne des dollars. Convertis d'abord." % (nom_option, valeur_da))


def nombre_fini(valeur, nom):
    v = float(valeur)
    if v != v or v in (float("inf"), float("-inf")):
        raise ValueError("%s n'est pas un nombre : %r" % (nom, valeur))
    return v


# ===========================================================================
# 4. LE BREAK EVEN — la MEME formule que les agents Testing et Scaling
# ===========================================================================

def break_even(prix_vente, cout_produit, emballage, livraison, frais_cod,
               cout_retour, taux_confirmation, taux_livraison):
    """IDENTIQUE aux deux autres agents, volontairement. Un controle plus bas
    verifie qu'ils rendent le meme chiffre sur un cas de reference : trois
    formules dans trois fichiers finissent toujours par se contredire.

    CE QU'ELLE REND N'EST PAS UN BENEFICE NET : c'est ce qui reste AVANT de
    payer la publicite. C'est le plafond de ce qu'une commande peut couter."""
    for nom, v in (("prix", prix_vente), ("produit", cout_produit),
                   ("emballage", emballage), ("livraison", livraison),
                   ("frais", frais_cod), ("retour", cout_retour)):
        if v is None:
            raise ValueError("il manque un cout : %s" % nom)
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
# 5. LES VRAIS TAUX — le coeur du coaching
# ===========================================================================

def taux_reels(commandes, confirmees, expediees, livrees, retours):
    """Les taux DECLARES au test etaient une estimation de memoire.
    Ceux-la sont mesures. L'ecart entre les deux, c'est tout le coaching."""
    if commandes <= 0:
        raise ValueError("il faut des commandes pour mesurer un taux")
    for nom, a, b in (("confirmees", confirmees, commandes),
                      ("expediees", expediees, confirmees),
                      ("livrees", livrees, expediees)):
        if a > b:
            raise ValueError(
                "plus de %s que de l'etape d'avant : %s contre %s. "
                "Tu n'as pas lu la meme periode des deux cotes." % (nom, a, b))
    if min(commandes, confirmees, expediees, livrees, retours) < 0:
        raise ValueError("un nombre negatif")
    if livrees + retours > expediees:
        raise ValueError(
            "livrees plus retours depasse expediees : %s contre %s"
            % (livrees + retours, expediees))
    en_route = expediees - livrees - retours
    return {
        "commandes": commandes, "confirmees": confirmees,
        "expediees": expediees, "livrees": livrees, "retours": retours,
        "en_route": en_route,
        "taux_confirmation": float(confirmees) / commandes,
        # DEUX taux de livraison, et ils ne servent PAS a la meme chose :
        #   sur les EXPEDIEES  -> la porte du scaling. Combien de colis
        #                         partis arrivent au bout.
        #   sur les CONFIRMEES -> le BREAK EVEN. Sa formule fait
        #                         livrees = confirmees x taux, et les colis
        #                         jamais partis comptent dedans.
        # Passer celui des expediees au break even le gonfle dans le sens
        # qui OUVRE la porte : sur un cas reel, sept pour cent de trop.
        "taux_livraison": (float(livrees) / expediees) if expediees else 0.0,
        "taux_livraison_sur_confirmees": (float(livrees) / confirmees) if confirmees else 0.0,
        "taux_retour": (float(retours) / expediees) if expediees else 0.0,
        "part_en_route": (float(en_route) / expediees) if expediees else 0.0,
        "juge_livraison": (livrees + retours) >= PORTE_LIVREES,
    }


def ecart_taux(declare, reel):
    """L'ecart en POINTS, pas en pourcentage du pourcentage.
    « Dix points » veut dire : de soixante-cinq a cinquante-cinq."""
    return {"declare": declare, "reel": reel,
            "points": (reel - declare) * 100.0,
            "pire": reel < declare}


# ===========================================================================
# 6. LA LOI DU ROAS — sur les LIVREES, au pire des cas
# ===========================================================================

def roas_livre(prix, livrees, en_route, depense_da, charges_da, retours=0, encaisse_reel=None):
    """Le ROAS du vendeur, et aucun autre :
      - sur les colis LIVRES, jamais sur les bruts ni les confirmes
      - au denominateur, la depense PLUS toutes les charges
      - les colis encore en route comptent au PIRE DES CAS, trois sur dix
    On donne toujours la part encore en route : leur depense est partie,
    leur argent n'est pas rentre."""
    if prix <= 0:
        raise ValueError("le prix doit etre positif")
    if livrees < 0 or en_route < 0 or retours < 0:
        raise ValueError("un nombre de colis negatif")
    denominateur = depense_da + charges_da
    if denominateur <= 0:
        raise ValueError("la depense plus les charges doit etre positive")
    # l'argent RENTRE, tel que Tassyir le compte : une deuxieme piece dans le
    # colis, une autre couleur a prix reduit, un lot solde — le prix de la
    # fiche ne suffit plus. Sans --encaisse on retombe sur livrees x prix.
    encaisse = float(encaisse_reel) if encaisse_reel is not None else livrees * prix
    if encaisse < 0:
        raise ValueError("l'encaisse ne peut pas etre negatif")
    attendus = en_route * PIRE_CAS_LIVRAISON
    prudent = encaisse + attendus * prix
    # les colis EXPEDIES, retours compris : le meme denominateur que --taux.
    total_colis = livrees + en_route + retours
    return {
        "encaisse_da": encaisse,
        "colis_en_route": en_route,
        "livres_attendus": attendus,
        "revenu_prudent_da": prudent,
        "depense_da": depense_da,
        "charges_da": charges_da,
        "denominateur_da": denominateur,
        "roas_encaisse": encaisse / denominateur,
        "roas_prudent": prudent / denominateur,
        # le MEME denominateur que --taux : les colis EXPEDIES. Deux ecrans
        # qui appellent « la part en route » deux fractions differentes
        # donnent deux nombres au client pour la meme chose.
        "expedies": total_colis,
        "part_en_route": (float(en_route) / total_colis) if total_colis else 0.0,
    }


# ===========================================================================
# 7. LA LECTURE QUOTIDIENNE — elle MONTRE, elle ne coupe pas
# ===========================================================================

def mode_du_test(mode_donne="", fichier=None):
    """D'OU VIENT LE MODE, dans cet ordre, et on le DIT :
       1. ce que le client a ecrit sur la ligne de commande
       2. le fichier de passage, ecrit par l'agent Testing
       3. rien : on prend le site ET ON PREVIENT que c'est une supposition.
    Un fichier ancien ne porte pas le mode. Le supposer en silence ferait
    juger un test message au calendrier du site."""
    mode = (mode_donne or "").strip().lower()
    if mode:
        if mode not in MODES_TEST:
            raise ValueError("mode inconnu : %s" % mode)
        return mode, "toi"
    # `fichier` peut etre un chemin de FICHIER (c'est ce que --fichier
    # designe) ou un dossier. lire_passage attend un dossier : on convertit.
    ou = None
    if fichier:
        ou = (os.path.dirname(os.path.abspath(fichier))
              if not os.path.isdir(fichier) else fichier)
    d, err, _ = lire_passage(ou)
    if d and d.get("mode") in MODES_TEST:
        return d["mode"], "le fichier de passage"
    return "site", "suppose"


def lecture(jour, depense_da, commandes, confirmees, livrees, be_par_commande,
            be_par_confirmee, be_par_livree, mode="site", base_test=None):
    """Le mode voyage AVEC la decision. Une lecture qui ne dit pas sous quel
    calendrier elle a ete prise ne peut pas etre relue.

    base_test (10/10/2026, la regle du vendeur du 08/10/2026) : ce que rend
    base_du_test de l'agent Testing ({stock, volume}). Donnee, la lecture sur
    le LIVRE prend la MEME base que lui : sans stock les confirmees, avec stock
    les livraisons attendues (livrees + en route a trente pour cent +
    confirmees pas encore expediees x livraison declaree) ; une base attendue
    sous une livraison = pas assez de donnees, jamais une perte."""
    r = _lecture_brute(jour, depense_da, commandes, confirmees, livrees,
                       be_par_commande, be_par_confirmee, be_par_livree, mode,
                       base_test)
    r["mode"] = mode
    r["jour_verdict"] = JOUR_VERDICT_MODE[mode]
    return r


def _lecture_brute(jour, depense_da, commandes, confirmees, livrees,
                   be_par_commande, be_par_confirmee, be_par_livree,
                   mode="site", base_test=None):
    """AVANT le jour dix, on lit sur la CONFIRMATION : a trois jours presque
    rien n'est livre, et juger sur la livraison a ce moment-la tue des
    campagnes qui gagnent. APRES, on lit sur le LIVRE.

    CETTE FONCTION NE COUPE RIEN. Elle rend une decision, le coach la montre,
    et il attend le mot du client. Meme DISJONCTEUR."""
    if jour < 1:
        raise ValueError("le jour doit etre au moins un")
    if depense_da < 0 or commandes < 0 or confirmees < 0 or livrees < 0:
        raise ValueError("un nombre negatif")
    if confirmees > commandes:
        raise ValueError("plus de confirmees que de commandes : %s contre %s"
                         % (confirmees, commandes))
    for nom, v in (("break even par commande", be_par_commande),
                   ("break even par confirmee", be_par_confirmee)):
        if v is None or v <= 0:
            raise ValueError("il faut le %s" % nom)

    if mode not in MODES_TEST:
        raise ValueError("mode inconnu : %s" % mode)
    jour_verdict = JOUR_VERDICT_MODE[mode]
    sur_le_livre = jour >= jour_verdict or confirmees >= CONFIRMEES_VERDICT
    base = "LIVRE" if sur_le_livre else "CONFIRMATION"

    # trop tot pour dire quoi que ce soit
    if depense_da < DEPENSE_MINIMUM_POUR_JUGER * be_par_commande:
        return {"decision": "DONNEES_INSUFFISANTES", "base": base, "jour": jour,
                "pourquoi": "pas assez depense pour juger",
                "depense_da": depense_da, "cout": None, "be": None,
                "ratio": None, "manque_da":
                    DEPENSE_MINIMUM_POUR_JUGER * be_par_commande - depense_da}

    if sur_le_livre and base_test is not None:
        # LA MEME BASE QUE L'AGENT TESTING (10/10/2026). Avant, livrees = 0
        # avec vingt colis en route sortait DISJONCTEUR au troisieme jour
        # quand le testing disait RENTABLE : deux voix, deux verdicts.
        if base_test.get("stock") == "stock":
            nombre, be = float(base_test.get("volume") or 0.0), be_par_livree
            base = "LIVRAISONS_ATTENDUES"
            if be is None or be <= 0:
                raise ValueError("avec stock il faut le break even par colis livre")
            if 0 < nombre < BASE_MINI_STOCK_COACH:
                return {"decision": "DONNEES_INSUFFISANTES", "base": base,
                        "jour": jour, "pourquoi": "base attendue sous une livraison",
                        "depense_da": depense_da, "cout": None, "be": be,
                        "ratio": None, "manque_da": 0.0, "volume": nombre}
        else:
            nombre, be = confirmees, be_par_confirmee
            base = "CONFIRMATION"
    elif sur_le_livre:
        nombre, be = livrees, be_par_livree
        if be is None or be <= 0:
            raise ValueError("il faut le break even par colis livre a ce stade")
    else:
        nombre, be = confirmees, be_par_confirmee

    if nombre <= 0:
        # rien du tout, et la depense continue
        gros = depense_da >= DEPENSE_DISJONCTEUR_A_ZERO * be_par_commande
        return {"decision": "DISJONCTEUR" if gros else "PERTE_LOURDE",
                "base": base, "jour": jour,
                "pourquoi": "zero", "depense_da": depense_da,
                "cout": None, "be": be, "ratio": None,
                "perdu_da": depense_da}

    cout = depense_da / nombre
    ratio = cout / be
    if ratio <= 1.0:
        decision = "RENTABLE"
    elif ratio <= PALIER_PERTE_LEGERE:
        decision = "PERTE_LEGERE"
    elif ratio <= PALIER_PERTE_LOURDE:
        decision = "PERTE_LOURDE"
    else:
        decision = "DISJONCTEUR"
    return {"decision": decision, "base": base, "jour": jour,
            "pourquoi": "", "depense_da": depense_da, "nombre": nombre,
            "cout": cout, "be": be, "ratio": ratio,
            "perte_par_unite_da": max(0.0, cout - be),
            # le MEME nombre que celui qu'on affiche, fois cent : sinon le
            # client lit « mille » puis « quatre-vingt-dix-neuf mille » et il
            # a raison de ne plus nous croire.
            "perte_par_cent_da": arrondi(max(0.0, cout - be)) * 100.0}


# ===========================================================================
# 8. LA PORTE DU SCALING — elle vit ICI. L'agent Scaling la RELIT.
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
# 9. L'AUDIT DE L'ERP — le coach regarde le back office, pas que la publicite
# ===========================================================================

# chaque controle : (cle, ce qu'on regarde, gravite, ce que ca coute)
CONTROLES_ERP = [
    ("couts", "les cinq couts du produit sont-ils connus", "BLOQUANT",
     "sans eux, le break even est invente, et tout le reste avec"),
    ("stock", "le stock restant est-il declare", "BLOQUANT",
     "on vend ce qu'on n'a pas : la cliente attend et le colis revient"),
    ("pixel", "le pixel est-il dans l'ad set", "BLOQUANT",
     "sans lui, Meta optimise a l'aveugle et la depense se perd"),
    ("liens_marques", "les liens des annonces portent-ils leur marque", "GRAVE",
     "sans marque, on ne saura jamais quelle crea a ramene la commande"),
    ("exclusion_attachee", "l'exclusion est-elle branchee sur un ad set", "GRAVE",
     "on repaie pour retrouver des clientes deja servies"),
    ("commandes_vieilles", "des commandes attendent-elles depuis trop longtemps",
     "GRAVE", "une commande qui dort se transforme en refus de colis"),
    ("tarifs_livraison", "les tarifs par wilaya sont-ils connus", "MOYEN",
     "le cout du colis est faux, donc la marge aussi"),
    ("page_en_ligne", "la page du produit repond-elle", "BLOQUANT",
     "la depense part et personne n'arrive"),
]

JOURS_COMMANDE_VIEILLE = 3


def audit_erp(constats):
    """constats : {cle: True si c'est BON, False si c'est casse, None si on
    n'a pas pu regarder}. Un None n'est pas un oui : c'est un trou, et il
    s'affiche comme tel."""
    inconnues = [c for c in CONTROLES_ERP if constats.get(c[0]) is None]
    cassees = [c for c in CONTROLES_ERP if constats.get(c[0]) is False]
    bonnes = [c for c in CONTROLES_ERP if constats.get(c[0]) is True]
    ordre = {"BLOQUANT": 0, "GRAVE": 1, "MOYEN": 2}
    cassees.sort(key=lambda c: ordre[c[2]])
    return {
        "cassees": cassees, "inconnues": inconnues, "bonnes": bonnes,
        "bloquants": [c for c in cassees if c[2] == "BLOQUANT"],
        "propre": not cassees and not inconnues,
    }


# ===========================================================================
# 10. LES AFFICHAGES — en arabe, les nombres seuls sur leur ligne
# ===========================================================================

BARRE = "=============================================================="
RIEN_NE_PART = ["  هاذا ما يبدّل والو في ميتا ولا في تسيير.",
                "  يحسب برك. اليد تاعك هي لي تبدّل."]

NOMS_ARABES = {"confirmation": "التأكيد", "livraison": "التوصيل",
               "colis livres": "الكوالي لي وصلو", "rentabilite": "الربح",
               "stock": "السطوك"}


def vue_taux(t, decl_conf=None, decl_liv=None):
    L = [BARRE, "  الأرقام الحقيقية تاعك", BARRE, "",
         "  الطلبيات", "      %d" % t["commandes"], "",
         "  لي تأكدو", "      %d" % t["confirmees"], "",
         "  لي خرجو", "      %d" % t["expediees"], "",
         "  لي وصلو", "      %d" % t["livrees"], "",
         "  لي رجعو", "      %d" % t["retours"], "",
         "  لي مازالهم في الطريق", "      %d" % t["en_route"], "", "",
         "  التأكيد", ligne_pourcent(t["taux_confirmation"]), "",
         "  التوصيل"]
    if t["juge_livraison"]:
        L += [ligne_pourcent(t["taux_livraison"]), "",
              "  الرتور", ligne_pourcent(t["taux_retour"]), ""]
    else:
        # a deux ou trois colis, « cent pour cent » n'est pas un taux :
        # c'est du hasard, et le client le lit comme une promesse.
        L += ["  مازال بكري. الكوالي قلال بزاف باش نعطيو نسبة.", ""]
    L += [""]
    # LES DEUX ECARTS, TOUJOURS LES DEUX, ET AVEC LE SENS.
    # Avant, un seul des deux s'affichait selon l'etat, et le nombre sortait
    # sans signe : le client lisait « 22 » sans savoir si c'etait en hausse
    # ou en baisse.
    if decl_conf is not None:
        e = ecart_taux(decl_conf, t["taux_confirmation"])
        L += ["  في التست قلتلي التأكيد", ligne_pourcent(decl_conf), "",
              "  والحقيقة", ligne_pourcent(t["taux_confirmation"]), "",
              "  " + ("طاح بالنقاط" if e["pire"] else "طلع بالنقاط"),
              "      %.0f" % abs(e["points"]), ""]
        if abs(e["points"]) >= 5:
            L += ["  هاذا ماشي تفصيل. البريك إيفن تاعك يتبدّل معاه.", ""]
        L.append("")
    if decl_liv is not None and t["juge_livraison"]:
        e = ecart_taux(decl_liv, t["taux_livraison"])
        L += ["  في التست قلتلي التوصيل", ligne_pourcent(decl_liv), "",
              "  والحقيقة", ligne_pourcent(t["taux_livraison"]), "",
              "  " + ("طاح بالنقاط" if e["pire"] else "طلع بالنقاط"),
              "      %.0f" % abs(e["points"]), ""]
        if abs(e["points"]) >= 5:
            L += ["  وهاذا تاني يبدّل البريك إيفن.", ""]
        L.append("")
    elif decl_liv is not None:
        L += ["  التوصيل مازال ما نحكموش عليه : الكوالي قلال.", "",
              "  ما نبدّلو والو في البريك إيفن على التوصيل،",
              "  نخلّيو لي قلتلي في التست حتى يكثرو الكوالي.", ""]
    if t["part_en_route"] > 0:
        L += ["  انتبه. من الكوالي لي خرجو، هاذ الجزء مازال في الطريق",
              ligne_pourcent(t["part_en_route"]), "",
              "  الدراهم تاع الإشهار خرجات عليهم،",
              "  والدراهم تاعهم مازال ما دخلاتش.", ""]
    L += RIEN_NE_PART
    L.append(BARRE)
    return "\n".join(L)


def vue_roas(r):
    L = [BARRE, "  الروّاص على لي وصل", BARRE, "",
         "  لي دخل بصح", ligne_nombre(r["encaisse_da"]), "",
         "  الكوالي لي مازالهم في الطريق",
         "      %d" % r["colis_en_route"], "",
         "  منهم نستناو يوصلو، في أسوأ حالة",
         "      %.0f" % r["livres_attendus"], "", "",
         "  الدخل بحساب حذر", ligne_nombre(r["revenu_prudent_da"]), "",
         "  الإشهار", ligne_nombre(r["depense_da"]), "",
         "  والتكاليف كامل", ligne_nombre(r["charges_da"]), "",
         "  الجملة لي خرجات", ligne_nombre(r["denominateur_da"]), "", "",
         "  الروّاص على لي دخل بصح", "      %.2f" % r["roas_encaisse"], "",
         "  والروّاص بحساب حذر", "      %.2f" % r["roas_prudent"], "", ""]
    if r["part_en_route"] > 0:
        L += ["  الجزء لي مازال في الطريق", ligne_pourcent(r["part_en_route"]), "",
              "  ما نحسبوهش كامل. نحسبو تلاتة من عشرة برك.",
              "  إذا حسبناهم كامل، نكذبو على روحنا.", ""]
    if r["roas_prudent"] < 1.0:
        L += ["  تحت الواحد، معناها الدراهم لي دخلات",
              "  أقل من لي خرجات. راك تخسر.", ""]
    L += RIEN_NE_PART
    L.append(BARRE)
    return "\n".join(L)


def vue_lecture(r):
    L = [BARRE, "  القراية تاع اليوم", BARRE, "",
         "  الموود", "      %s" % r.get("mode", "site"), "",
         "  النهار تاع الحكم", "      %d" % r.get("jour_verdict", JOUR_VERDICT), ""]
    if r.get("mode_vient_de") == "suppose":
        L += ["  ما لقيتش الموود مكتوب. خدمت على أساس السيت.",
              "  إذا التست تاعك بالميساج، قوللي وعاود.", ""]
    L += ["  النهار", "      %d" % r["jour"], "",
         "  نقراو على",
         "  " + ("الكوالي لي وصلو" if r["base"] == "LIVRE" else
                 "لي وصلو و لي في الطريق و لي باقي ما خرجوش" if r["base"] == "LIVRAISONS_ATTENDUES"
                 else "لي تأكدو"), "",
         "  الدراهم لي خرجات", ligne_nombre(r["depense_da"]), "", ""]
    if r["decision"] == "DONNEES_INSUFFISANTES" and r.get("pourquoi") == "base attendue sous une livraison":
        L += ["  مازال بكري باش نحكمو.", "",
              "  الكوالي لي راهم في الطريق مازال ما وصلوش،",
              "  وما نحكمش بخسارة على كولي يقدر يوصل.", ""]
        L += RIEN_NE_PART
        L.append(BARRE)
        return "\n".join(L)
    if r["decision"] == "DONNEES_INSUFFISANTES":
        L += ["  مازال بكري باش نحكمو.", "",
              "  باقي نخلّصو على الأقل", ligne_nombre(r["manque_da"]), "",
              "  قبل هاذ الحد، الأرقام تتبدّل كل ساعة",
              "  وما تقول والو. ما نقرّرو والو اليوم.", ""]
        L += RIEN_NE_PART
        L.append(BARRE)
        return "\n".join(L)
    if r.get("cout") is not None:
        L += ["  الوحدة الوحدة تكلّفك", ligne_nombre(r["cout"]), "",
              "  والبريك إيفن", ligne_nombre(r["be"]), "", ""]
    messages = {
        "RENTABLE": ["  راك رابح.", "",
                     "  نخلّيو كلش كيما راهو. ما نلمسو والو.",
                     "  لي يخدم، نخلّيوه يخدم."],
        "PERTE_LEGERE": ["  راك تخسر شوية.", "",
                         "  ماشي كارثة، بصح ماشي حاجة نكبّروها.",
                         "  نقلّب على الكرياتيف لي تجيب غالي، نوريهالك،",
                         "  وإذا قلتلي نحبسوها نحبسوها."],
        "PERTE_LOURDE": ["  راك تخسر بزاف.", "",
                         "  كل يوم زايد يزيد الخسارة.",
                         "  لازم قرار اليوم، ماشي غدوة."],
        "DISJONCTEUR": ["  وقف. هاذي خسارة كبيرة.", "",
                        "  الدراهم تخرج بسرعة والنتيجة ما جاتش.",
                        "  رأيي : نحبسو دروك."],
    }
    L += messages[r["decision"]] + [""]
    if r.get("perte_par_unite_da"):
        L += ["  تخسر في كل وحدة", ligne_nombre(r["perte_par_unite_da"]), "",
              "  وعلى كل مية", ligne_nombre(r["perte_par_cent_da"]), ""]
    if r.get("perdu_da") and r.get("pourquoi") == "zero":
        L += ["  وحتى وحدة ما جات.", "",
              "  هاذو الدراهم راحو بلا نتيجة", ligne_nombre(r["perdu_da"]), ""]
    if r["decision"] != "RENTABLE":
        L += ["", "  بصح ما نحبس والو وحدي.",
              "  نوريلك الأرقام وأنت لي تقرّر.",
              "  كتبلي الكلمة وأنا نحبس في الثانية.", ""]
    L += RIEN_NE_PART
    L.append(BARRE)
    return "\n".join(L)


def couleur_de(ref):
    """« noir standard » -> noir ; « noir M » -> noir. La couleur est le 1er mot."""
    return str(ref).strip().split()[0].lower() if str(ref).strip() else ""


def porte_production(confirmees_par_ref):
    """On ne commande pas le premier lot sans assez de CONFIRMEES :
    35 si moins de trois couleurs, 50 a partir de trois couleurs."""
    total = sum(int(v) for v in confirmees_par_ref.values())
    couleurs = len(set(couleur_de(r) for r in confirmees_par_ref))
    seuil = PORTE_PRODUCTION_PEU if couleurs < 3 else PORTE_PRODUCTION_BCP
    return {"ouverte": total >= seuil, "seuil": seuil, "confirmees": total,
            "couleurs": couleurs, "manque": max(0, seuil - total)}


def bon_de_commande(total, confirmees_par_ref, mini=MINI_ATELIER):
    """Le bon DECOUPE par reference, en pieces et en part — jamais un total.
    La part de chaque reference vient des CONFIRMEES, pas des leads : une
    cliente venue par la video noire peut commander le rouge.
    L'atelier impose un minimum par reference ; le reste se repartit selon
    la demande, et la derniere reference absorbe l'arrondi.
    PIEGE NOMME : si minimum x references >= total, la commande devient
    PLATE — chaque reference recoit le meme nombre et la demande est ignoree."""
    refs = list(confirmees_par_ref.keys())
    n = len(refs)
    if n == 0:
        raise ValueError("aucune reference")
    somme = float(sum(int(v) for v in confirmees_par_ref.values()))
    if somme <= 0:
        raise ValueError("aucune confirmee : on ne decoupe pas sur du vide")
    parts = [int(confirmees_par_ref[r]) / somme for r in refs]
    total_effectif = max(int(total), n * mini)
    restant = total_effectif - n * mini
    lignes, pose = [], 0
    for i, r in enumerate(refs):
        q = mini + (restant - pose if i == n - 1 else int(round(restant * parts[i])))
        lignes.append({"reference": r, "pieces": q,
                       "part": q / float(total_effectif), "demande": parts[i]})
        pose += q - mini
    plate = (n * mini >= int(total))
    return {"total_demande": int(total), "total_effectif": total_effectif,
            "references": n, "minimum": mini, "lignes": lignes, "plate": plate,
            "controle_somme": sum(l["pieces"] for l in lignes) == total_effectif}


def vue_bon(b, pp=None):
    L = [BARRE, "  البون تاع الكوموند — للأتولييه", BARRE, ""]
    if pp is not None:
        L += ["  الكوموند لي تأكّدو", "      %d" % pp["confirmees"], "",
              "  لي لازم قبل ما نكوموندو", "      %d" % pp["seuil"], ""]
        if not pp["ouverte"]:
            L += ["  مازال ما وصلناش. ناقصين", "      %d" % pp["manque"], "",
                  "  ما نكوموندوش. نستنّاو ونعاودو نقراو.", "", BARRE]
            return "\n".join(L)
        L += ["  الباب تاع البرودوكسيون محلول.", ""]
    L += ["  المجموع", "      %d" % b["total_effectif"], ""]
    if b["total_effectif"] != b["total_demande"]:
        L += ["  طلبت", "      %d" % b["total_demande"], "",
              "  بصح الأتولييه ما يخيّطش أقل من", "      %d" % b["minimum"],
              "  في كل ريفيرونس، فطلعنا المجموع.", ""]
    for l in b["lignes"]:
        L += ["  " + str(l["reference"]),
              "      %d   ·   %.1f %%" % (l["pieces"], l["part"] * 100.0), ""]
    if b["plate"]:
        L += ["  انتبه : الكوموند ولّات مسطّحة.", "",
              "  الحد الأدنى ضرب عدد الريفيرونسات وصل للمجموع،",
              "  فكل ريفيرونس دات نفس العدد والطلب ما تحسبش.",
              "  ولا تنقّص الريفيرونسات، ولا تكبّر المجموع.", ""]
    L += ["  هاذا يقدر يتبدّل في اللانسمون الثاني تاع الكرياتيف.", "", BARRE]
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
        L += ["  " + NOMS_ARABES[nom], "  " + ("واه" if ok else "لا"), ""]
    if p["ouverte"]:
        L += ["  الباب محلول.", "",
              "  دروك نقدرو نسلّمو للأجون تاع السكايلينغ.",
              "  هاذا ما يطلق والو وحدو : يعطيك الحق تطلب برك.", ""]
    else:
        L += ["  الباب مسدود.", "",
              "  واحد برك يكفي باش يسدّو.",
              "  التأكيد المليح ما يعوّضش التوصيل الخايب —",
              "  الكولي لي ما يخرجش ما يربّحش.", "",
              "  نبقاو نقراو كل يوم حتى تتحلّ.", ""]
    L += RIEN_NE_PART
    L.append(BARRE)
    return "\n".join(L)


def vue_audit(a):
    L = [BARRE, "  الفحص تاع الباك أوفيس", BARRE, ""]
    if a["propre"]:
        L += ["  كلش مليح. ما لقيت والو.", ""]
        L += RIEN_NE_PART
        L.append(BARRE)
        return "\n".join(L)
    gravites = {"BLOQUANT": "يحبس كلش", "GRAVE": "خطير", "MOYEN": "متوسط"}
    if a["cassees"]:
        L += ["  واش لقيت :", ""]
        for cle, quoi, grav, cout in a["cassees"]:
            L += ["  " + gravites[grav], "", "  " + _ar_controle(cle), "",
                  "  " + _ar_cout(cle), "", "  " + "-" * 50, ""]
    if a["inconnues"]:
        L += ["", "  وهاذو ما قدرتش نشوفهم :", ""]
        for cle, quoi, grav, cout in a["inconnues"]:
            L += ["  " + _ar_controle(cle), ""]
        L += ["  ما نعرفش واش راهم داروا. ماشي معناها مليح.",
              "  نحتاج نشوفهم قبل ما نقول كلش مليح.", ""]
    if a["bloquants"]:
        L += ["", "  كاين حاجة تحبس كلش.", "",
              "  ما نكبّرو والو قبل ما تتصلّح.", ""]
    L += RIEN_NE_PART
    L.append(BARRE)
    return "\n".join(L)


_AR_CONTROLES = {
    "couts": "التكاليف تاع المنتج ما هماش كاملين",
    "stock": "السطوك ما هوش معروف",
    "pixel": "البيكسل ماشي في الأد ست",
    "liens_marques": "الروابط تاع الإعلانات ما معلّمينش",
    "exclusion_attachee": "الإقصاء ما هوش مربوط بأد ست",
    "commandes_vieilles": "كاين طلبيات راقدين من بكري",
    "tarifs_livraison": "أسعار التوصيل حسب الولاية ما هماش معروفين",
    "page_en_ligne": "الصفحة تاع المنتج ما تجاوبش",
}
_AR_COUTS = {
    "couts": "بلاهم، البريك إيفن مخترع، وكلش لي بعدو مخترع",
    "stock": "تبيع حاجة ما عندكش : الزبونة تستنى والكولي يرجع",
    "pixel": "ميتا تخدم في العميان والدراهم تروح",
    "liens_marques": "عمرك ما تعرف أنهي كرياتيف جابت الطلبية",
    "exclusion_attachee": "تخلّص مرتين على زبونة خدمتها من قبل",
    "commandes_vieilles": "الطلبية لي ترقد تولّي رفض للكولي",
    "tarifs_livraison": "تكلفة الكولي غالطة، والربح معاها",
    "page_en_ligne": "الدراهم تخرج وحتى واحد ما يوصل",
}


def _ar_controle(cle):
    return _AR_CONTROLES.get(cle, cle)


def _ar_cout(cle):
    return _AR_COUTS.get(cle, "")


def vue_rapport(produit, observation, ou, decision, choix, prochaine):
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


# ===========================================================================
# 11. LE FICHIER DE PASSAGE — lu de l'agent Testing, enrichi pour le Scaling
# ===========================================================================

def dossier_outil():
    return os.path.dirname(os.path.abspath(__file__))


CHAMPS_PASSAGE = ("cle", "couts", "break_even_par_commande_da", "devise",
                  "date_lancement", "ad_account_id", "product_id")


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


def lire_passage(dossier=None):
    """Cherche des DEUX cotes : le dossier d'ou on lance, et celui de l'outil."""
    lieux = lieux_passage(dossier)
    cherches, chemin = [], None
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
        return None, "le fichier de passage ne se lit pas : %s" % e, chemin
    manque = [c for c in CHAMPS_PASSAGE if not d.get(c)]
    if manque:
        return None, ("il manque dans le fichier de passage : %s"
                      % ", ".join(manque)), chemin
    return d, None, chemin


def ecrire_passage(donnees, chemin):
    """On REECRIT le fichier de l'agent Testing en gardant tout ce qu'il
    contenait. On n'efface jamais ses chiffres : on ajoute les notres a
    cote. C'est le meme fichier qui descend toute la chaine."""
    try:
        with open(chemin, "w", encoding="utf-8") as f:
            json.dump(donnees, f, ensure_ascii=False, indent=2)
    except OSError as e:
        raise ValueError("impossible d'ecrire le fichier de passage : %s" % e)
    return chemin


# ===========================================================================
# 12. LES CONTROLES — l'outil se verifie lui-meme
# ===========================================================================

def _leve(fonction, *args):
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


def _charger(nom_fichier):
    chemin = os.path.join(dossier_outil(), nom_fichier)
    if not os.path.exists(chemin):
        return None
    import importlib.util
    spec = importlib.util.spec_from_file_location("_ref_%s" % nom_fichier, chemin)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


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
    concordances = []

    # --- LE ROAS sur l'argent RENTRE, pas sur le prix de la fiche
    r1 = roas_livre(6900, 100, 0, 100000, 400000)
    r2 = roas_livre(6900, 100, 0, 100000, 400000, encaisse_reel=750000)
    ok &= _essai("sans --encaisse : livrees x prix", abs(r1["encaisse_da"] - 690000) < 0.01)
    ok &= _essai("avec --encaisse : l'argent rentre remplace livrees x prix",
                 abs(r2["encaisse_da"] - 750000) < 0.01 and r2["roas_prudent"] > r1["roas_prudent"])

    # --- LA PORTE DE PRODUCTION : 35 sous trois couleurs, 50 a partir de trois
    ok &= _essai("deux couleurs : la porte de production demande 35",
                 porte_production({"noir standard": 20, "rouge standard": 14})["seuil"] == 35)
    ok &= _essai("trois couleurs : elle demande 50",
                 porte_production({"noir S": 20, "rouge M": 14, "beige L": 16})["seuil"] == 50)
    ok &= _essai("34 confirmees sur deux couleurs : fermee, il en manque une",
                 porte_production({"noir standard": 20, "rouge standard": 14})["manque"] == 1)
    ok &= _essai("35 confirmees sur deux couleurs : ouverte",
                 porte_production({"noir standard": 21, "rouge standard": 14})["ouverte"])

    # --- LE BON DE COMMANDE : les nombres du scenario, retrouves
    b = bon_de_commande(60, {"noir standard": 48, "rouge standard": 21})
    ok &= _essai("A jour 4 : 60 pieces -> 38 noir, 22 rouge",
                 [l["pieces"] for l in b["lignes"]] == [38, 22], str([l["pieces"] for l in b["lignes"]]))
    b = bon_de_commande(100, {"noir standard": 48, "rouge standard": 21})
    ok &= _essai("A jour 8 : 100 pieces -> 66 noir, 34 rouge",
                 [l["pieces"] for l in b["lignes"]] == [66, 34], str([l["pieces"] for l in b["lignes"]]))
    b = bon_de_commande(90, {"noir standard": 48, "rouge standard": 21, "beige standard": 18})
    ok &= _essai("C jour 4 : 90 pieces -> 43 / 24 / 23",
                 [l["pieces"] for l in b["lignes"]] == [43, 24, 23], str([l["pieces"] for l in b["lignes"]]))
    b = bon_de_commande(150, {"noir standard": 48, "rouge standard": 21, "beige standard": 18})
    ok &= _essai("C jour 8 : 150 pieces -> 76 / 39 / 35",
                 [l["pieces"] for l in b["lignes"]] == [76, 39, 35], str([l["pieces"] for l in b["lignes"]]))
    douze = {}
    for c, pc in (("noir", 48), ("rouge", 21), ("beige", 18), ("vert", 13)):
        for t, pt in (("S", 25), ("M", 45), ("L", 30)):
            douze["%s %s" % (c, t)] = pc * pt
    b = bon_de_commande(120, douze)
    ok &= _essai("B : douze references x dix = 120 -> la commande est PLATE, et c'est DIT",
                 b["plate"] and all(l["pieces"] == 10 for l in b["lignes"]))
    b = bon_de_commande(240, douze)
    ok &= _essai("B avec 240 pieces : plus plate, et la somme tombe juste",
                 not b["plate"] and b["controle_somme"])
    ok &= _essai("la somme des lignes fait toujours le total",
                 all(bon_de_commande(t, {"a x": 5, "b x": 3, "c x": 2})["controle_somme"] for t in (30, 31, 47, 100)))
    ok &= _essai("le bon respecte la loi de la langue",
                 not controle_affichage(vue_bon(bon_de_commande(60, {"noir standard": 48, "rouge standard": 21}),
                                                porte_production({"noir standard": 48, "rouge standard": 21})),
                                        exempts=["noir standard", "rouge standard"]))

    # --- LE BREAK EVEN, et la concordance avec LES DEUX AUTRES AGENTS
    cas = (5900, 1500, 100, 0, 0, 600, 0.50, 0.45)
    r = break_even(*cas)
    ok &= _essai("le break even par commande est juste",
                 abs(r["par_commande"] - 802.5) < 0.5, str(r["par_commande"]))
    ok &= _essai("la marge du colis livre est juste", r["marge_livree"] == 4300)
    for nom, fichiers in (("Testing", ["manita-testing.py", "_ref-testing.py"]),
                          ("Scaling", ["manita-scaling.py", "_ref-scaling.py"])):
        mod = charger_outil(fichiers)
        if mod is None:
            print("  [NOTE] l'agent %s n'est pas a cote : concordance non testee" % nom)
            concordances.append((nom, None))
            continue
        a = mod.break_even(*cas)["par_commande"]
        bon = abs(a - r["par_commande"]) < 0.01
        concordances.append((nom, bon))
        ok &= _essai("MEME chiffre que l'agent %s, sur le meme cas" % nom, bon,
                     "%s contre %s" % (a, r["par_commande"]))
    ok &= _essai("les couts manquants sont refuses",
                 _leve(break_even, 5900, None, 100, 0, 0, 600, 0.5, 0.45))
    ok &= _essai("les taux hors bornes sont refuses",
                 _leve(break_even, 5900, 1500, 100, 0, 0, 600, 0.0, 0.45)
                 and _leve(break_even, 5900, 1500, 100, 0, 0, 600, 50.0, 0.45))

    # --- LA PORTE : LE MEME VERDICT QUE L'AGENT SCALING, sur le meme cas
    cas_porte = dict(confirmees=60, commandes=100, livrees=25, expediees=50,
                     stock_restant=40, be_par_livree=3567, cout_par_livree=1530)
    p = porte_scaling(**cas_porte)
    ok &= _essai("tout passe : la porte est ouverte", p["ouverte"])
    mod4 = charger_outil(["manita-scaling.py", "_ref-scaling.py"])
    if mod4 is not None:
        p4 = mod4.porte_scaling(**cas_porte)
        ok &= _essai("MEME verdict de porte que l'agent Scaling",
                     p4["ouverte"] == p["ouverte"]
                     and p4["ferme_par"] == p["ferme_par"])
        ok &= _essai("et les MEMES seuils dans les deux fichiers",
                     (mod4.PORTE_CONFIRMATION, mod4.PORTE_LIVRAISON,
                      mod4.PORTE_LIVREES)
                     == (PORTE_CONFIRMATION, PORTE_LIVRAISON, PORTE_LIVREES))
    for etiquette, modif in (("confirmation", dict(confirmees=40, expediees=35)),
                             ("colis livres", dict(livrees=15)),
                             ("stock", dict(stock_restant=0))):
        base = dict(cas_porte)
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
    cher = porte_scaling(confirmees=60, commandes=100, livrees=25, expediees=50,
                         stock_restant=40, be_par_livree=3567, cout_par_livree=6000)
    ok &= _essai("un colis livre trop cher ferme la porte",
                 not cher["ouverte"] and "rentabilite" in cher["ferme_par"])
    ok &= _essai("des chiffres incoherents sont refuses",
                 _leve(porte_scaling, 30, 100, 10, 60, 40, 3567, 1530)
                 and _leve(porte_scaling, 900, 10, 5, 5, 1, 1, 1))

    # --- LES VRAIS TAUX
    t = taux_reels(commandes=150, confirmees=95, expediees=90, livrees=60, retours=20)
    ok &= _essai("le taux de confirmation reel est juste",
                 abs(t["taux_confirmation"] - 0.6333) < 0.001)
    ok &= _essai("le taux de livraison sur les EXPEDIEES est juste",
                 abs(t["taux_livraison"] - 0.6667) < 0.001)
    ok &= _essai("et celui sur les CONFIRMEES aussi, il est different",
                 abs(t["taux_livraison_sur_confirmees"] - 0.6316) < 0.001
                 and t["taux_livraison_sur_confirmees"] < t["taux_livraison"],
                 str(t["taux_livraison_sur_confirmees"]))
    _be_juste = break_even(5900, 1500, 100, 0, 0, 600,
                           t["taux_confirmation"],
                           t["taux_livraison_sur_confirmees"])["par_commande"]
    _be_gonfle = break_even(5900, 1500, 100, 0, 0, 600,
                            t["taux_confirmation"],
                            t["taux_livraison"])["par_commande"]
    ok &= _essai("le mauvais denominateur GONFLE le break even",
                 _be_gonfle > _be_juste * 1.05,
                 "%.2f contre %.2f" % (_be_gonfle, _be_juste))
    ok &= _essai("les colis encore en route sont comptes", t["en_route"] == 10)
    ok &= _essai("des etapes impossibles sont refusees",
                 _leve(taux_reels, 100, 150, 90, 60, 20)
                 and _leve(taux_reels, 150, 95, 100, 60, 20)
                 and _leve(taux_reels, 150, 95, 90, 80, 30))
    e = ecart_taux(0.65, 0.55)
    ok &= _essai("un ecart de taux se compte en POINTS",
                 abs(e["points"] + 10.0) < 0.01 and e["pire"], str(e["points"]))

    # --- LA LOI DU ROAS
    rs = roas_livre(prix=5900, livrees=60, en_route=100, depense_da=200000,
                    charges_da=150000)
    ok &= _essai("le revenu encaisse est juste",
                 abs(rs["encaisse_da"] - 354000) < 1, str(rs["encaisse_da"]))
    ok &= _essai("les colis en route comptent a trois sur dix",
                 abs(rs["livres_attendus"] - 30.0) < 0.01)
    ok &= _essai("le revenu prudent ajoute bien ces trois sur dix",
                 abs(rs["revenu_prudent_da"] - 531000) < 1,
                 str(rs["revenu_prudent_da"]))
    ok &= _essai("le denominateur prend la depense PLUS les charges",
                 abs(rs["denominateur_da"] - 350000) < 1)
    ok &= _essai("le roas prudent est juste",
                 abs(rs["roas_prudent"] - 1.517) < 0.01, str(rs["roas_prudent"]))
    ok &= _essai("le roas encaisse est plus bas que le prudent",
                 rs["roas_encaisse"] < rs["roas_prudent"])
    ok &= _essai("la part encore en route est donnee",
                 abs(rs["part_en_route"] - 0.625) < 0.001)
    # LE PIEGE : compter les en-cours a cent pour cent
    optimiste = (354000 + 100 * 5900) / 350000.0
    ok &= _essai("compter les en-cours en entier gonflerait le roas",
                 optimiste > rs["roas_prudent"] * 1.5,
                 "%.2f contre %.2f" % (optimiste, rs["roas_prudent"]))
    ok &= _essai("un denominateur nul est refuse",
                 _leve(roas_livre, 5900, 60, 100, 0, 0))

    # --- LA LECTURE QUOTIDIENNE
    be = break_even(5900, 1500, 100, 0, 0, 600, 0.60, 0.45)
    bc, bconf, bliv = be["par_commande"], be["par_confirmee"], be["par_livree"]
    tot = lecture(3, 1000, 5, 2, 0, bc, bconf, bliv)
    ok &= _essai("trop tot pour juger : l'outil le dit",
                 tot["decision"] == "DONNEES_INSUFFISANTES")
    # le break even par confirmee, sur ce cas, vaut mille six cent cinq
    bon = lecture(3, 20000, 40, 20, 0, bc, bconf, bliv)
    ok &= _essai("a trois jours on lit sur la CONFIRMATION",
                 bon["base"] == "CONFIRMATION", bon["base"])
    ok &= _essai("une campagne qui gagne est dite rentable",
                 bon["decision"] == "RENTABLE", bon["decision"])
    leger = lecture(3, 40000, 40, 20, 0, bc, bconf, bliv)
    ok &= _essai("une perte legere n'est pas confondue avec une lourde",
                 leger["decision"] == "PERTE_LEGERE",
                 "%s ratio %.2f" % (leger["decision"], leger["ratio"]))
    lourd = lecture(3, 80000, 40, 20, 0, bc, bconf, bliv)
    ok &= _essai("une perte lourde est nommee",
                 lourd["decision"] == "PERTE_LOURDE",
                 "%s ratio %.2f" % (lourd["decision"], lourd["ratio"]))
    disj = lecture(3, 200000, 40, 20, 0, bc, bconf, bliv)
    ok &= _essai("un gouffre declenche le disjoncteur",
                 disj["decision"] == "DISJONCTEUR", disj["decision"])
    ok &= _essai("les quatre paliers se suivent dans le bon ordre",
                 bon["ratio"] < leger["ratio"] < lourd["ratio"] < disj["ratio"])
    zero = lecture(3, 60000, 10, 0, 0, bc, bconf, bliv)
    ok &= _essai("zero confirmee et beaucoup depense : disjoncteur",
                 zero["decision"] == "DISJONCTEUR", zero["decision"])
    tard = lecture(12, 200000, 150, 95, 60, bc, bconf, bliv)
    ok &= _essai("au dixieme jour on lit sur le LIVRE", tard["base"] == "LIVRE")
    tot25 = lecture(4, 200000, 100, 30, 15, bc, bconf, bliv)
    ok &= _essai("ou des vingt-cinq confirmees, meme avant le dixieme jour",
                 tot25["base"] == "LIVRE")
    ok &= _essai("le mot CONTINUER n'existe pas dans les decisions",
                 "CONTINUER" not in DECISIONS)
    # LA MEME BASE QUE L'AGENT TESTING (10/10/2026) : jour 3, 26 confirmees,
    # 0 livree, 20 en route, 30 000 DA depenses — avant : DISJONCTEUR ici,
    # RENTABLE chez le testing. Maintenant les deux disent la meme chose.
    mt = charger_outil(["manita-testing.py", "_ref-testing.py"])
    if mt is not None and hasattr(mt, "base_du_test"):
        for st in ("stock", "test"):
            bt = mt.base_du_test(st, 26, 0, 20, 20, 0, 0.7)
            co = lecture(3, 30000, 30, 26, 0, bc, bconf, bliv, "site", bt)
            te = mt.lecture(30000, 30, 26, bc, mode="site", be_par_confirmee=bconf,
                            base_test=bt, be_par_livree=bliv)
            ok &= _essai("lecture du coach = lecture du testing (%s, 20 colis en route, 0 livre)" % st,
                         co["decision"] == te["decision"] and co["decision"] not in ("DISJONCTEUR", "PERTE_LOURDE"),
                         "%s contre %s" % (co["decision"], te["decision"]))
        sous = lecture(12, 30000, 40, 3, 0, bc, bconf, bliv, "site", mt.base_du_test("stock", 3, 0, 3, 3, 0, 0.7))
        ok &= _essai("avec stock, une base attendue sous une livraison : pas assez de donnees, jamais une perte",
                     sous["decision"] == "DONNEES_INSUFFISANTES" and "كولي" in vue_lecture(sous), sous["decision"])
    else:
        ok &= _essai("l'outil de l'agent Testing est a cote (la base commune)", False, "manita-testing.py introuvable")
    for d in ("RENTABLE", "PERTE_LEGERE", "PERTE_LOURDE", "DISJONCTEUR",
              "DONNEES_INSUFFISANTES"):
        ok &= _essai("la decision %s est prevue" % d, d in DECISIONS)
    # LA REGLE DU COACH : il ne coupe pas, il montre et il attend
    for r_ in (leger, lourd, disj, zero):
        if "كتبلي الكلمة" not in vue_lecture(r_):
            ok &= _essai("chaque perte dit qu'on attend le mot du client", False,
                         r_["decision"])
            break
    else:
        ok &= _essai("chaque perte dit qu'on attend le mot du client", True)
    ok &= _essai("et le rentable ne demande rien",
                 "كتبلي الكلمة" not in vue_lecture(lecture(3, 20000, 40, 20, 0,
                                                           bc, bconf, bliv)))
    ok &= _essai("des chiffres impossibles sont refuses a la lecture",
                 _leve(lecture, 3, 1000, 10, 20, 0, bc, bconf, bliv)
                 and _leve(lecture, 0, 1000, 10, 5, 0, bc, bconf, bliv))

    # --- L'AUDIT DE L'ERP
    a_propre = audit_erp({c[0]: True for c in CONTROLES_ERP})
    ok &= _essai("un back office propre est declare propre", a_propre["propre"])
    constats = {c[0]: True for c in CONTROLES_ERP}
    constats["pixel"] = False
    constats["tarifs_livraison"] = False
    a = audit_erp(constats)
    ok &= _essai("les problemes sont classes, le bloquant d'abord",
                 a["cassees"][0][0] == "pixel", str([c[0] for c in a["cassees"]]))
    ok &= _essai("un bloquant est signale comme tel", len(a["bloquants"]) == 1)
    inconnu = dict((c[0], True) for c in CONTROLES_ERP)
    inconnu["stock"] = None
    ai = audit_erp(inconnu)
    ok &= _essai("ce qu'on n'a pas pu voir n'est PAS compte comme bon",
                 not ai["propre"] and len(ai["inconnues"]) == 1)
    ok &= _essai("et l'ecran le dit au client",
                 "ماشي معناها مليح" in vue_audit(ai))
    ok &= _essai("chaque controle a son texte arabe",
                 all(c[0] in _AR_CONTROLES and c[0] in _AR_COUTS
                     for c in CONTROLES_ERP))

    # --- LES MONNAIES
    ok &= _essai("des dinars restent des dinars",
                 convertir_en_dinars(1000, "DZD", None) == 1000.0)
    ok &= _essai("des dollars se convertissent au taux du client",
                 convertir_en_dinars(100, "USD", 262) == 26200.0)
    ok &= _essai("un taux absent ou absurde est refuse",
                 _leve(convertir_en_dinars, 100, "USD", None)
                 and _leve(convertir_en_dinars, 100, "USD", 5)
                 and _leve(convertir_en_dinars, 100, "USD", 5000))
    ok &= _essai("DA est compris comme des dinars", lire_devise("DA") == "DZD")
    ok &= _essai("une devise inconnue est refusee", _leve(lire_devise, "POULET"))
    ok &= _essai("le taux du client atteint l'ecran",
                 _avec_taux(262, lambda: ligne_nombre(5900)).strip().endswith("22.52 USD"),
                 _avec_taux(262, lambda: ligne_nombre(5900)))
    ok &= _essai("un montant trop bas pour des dinars est refuse",
                 _leve(garde_plancher, "--be-livree", 23.5))
    ok &= _essai("l'arrondi ne tombe plus au pair", arrondi(802.5) == 803)
    ok &= _essai("nan et inf sont refuses",
                 all(_leve(nombre_fini, v, "x") for v in ("nan", "inf")))

    # --- LES DEUX LOIS DE LA LANGUE, sur TOUS les affichages
    vues = [vue_taux(t, 0.65, 0.45),
            vue_taux(taux_reels(50, 30, 10, 3, 1), 0.65, 0.45),
            vue_roas(rs),
            vue_roas(roas_livre(5900, 5, 0, 200000, 150000)),
            vue_lecture(tot), vue_lecture(bon), vue_lecture(leger),
            vue_lecture(lourd), vue_lecture(disj), vue_lecture(zero),
            vue_lecture(tard),
            vue_porte(p), vue_porte(haut), vue_porte(cher),
            vue_audit(a_propre), vue_audit(a), vue_audit(ai),
            vue_rapport("فستان درابيه", "التأكيد طاح عشر نقاط",
                        "في تسيير، على أربعتاش يوم",
                        "نستنّاو يومين ونعاودو نقراو",
                        ["نصلّحو البيكسل", "نربطو الإقصاء", "نستنّاو السطوك"],
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
    ok &= _essai("il attrape AUSSI les chiffres arabes",
                 len(controle_affichage("  عندك ٢٣ كولي")) >= 1)
    ok &= _essai("il attrape le mot COD, meme sur une ligne avec une adresse web",
                 len(controle_affichage("  cod ici https://exemple.dz")) >= 1)
    ok &= _essai("il attrape un mot marocain",
                 len(controle_affichage("  تقدري تحوّس")) >= 1)
    ok &= _essai("une ligne de nombres seuls passe",
                 controle_affichage("      674 DA   =   2.64 USD") == [])
    ok &= _essai("une ligne de pourcentage passe",
                 controle_affichage("      65 %") == [])
    ok &= _essai("un message client sans un mot d'arabe est refuse",
                 len(controle_message_client("Bonjour Amine")) >= 1)
    ok &= _essai("un mot francais HORS LISTE est attrape dans un bloc",
                 mots_latins_dans("نوقفو tout de suite") == ["tout", "suite"])

    # --- LE NOM QUI MELANGE ARABE ET CODE
    lg = lignes_nom("A4 الاعتراض")
    ok &= _essai("un nom melange est coupe en deux lignes", len(lg) == 2, str(lg))
    ok &= _essai("un chiffre arabe dans un nom devient latin",
                 nom_propre("الوجع٢") == "الوجع2")
    ok &= _essai("un retour chariot est retire", "\r" not in nom_propre("A1\rx"))

    # --- LE FICHIER DE PASSAGE
    d1, err, _ = lire_passage("/tmp/dossier-qui-n-existe-pas-manita")
    ok &= _essai("un fichier de passage absent est signale proprement",
                 d1 is None and err is not None)
    import tempfile
    with tempfile.TemporaryDirectory() as dossier:
        chemin = os.path.join(dossier, FICHIER_PASSAGE)
        with open(chemin, "w", encoding="utf-8") as f:
            json.dump({"cle": "X"}, f)
        d2, err2, _ = lire_passage(dossier)
        ok &= _essai("un fichier de passage incomplet est refuse",
                     d2 is None and "manque" in err2)
        complet = {c: "x" for c in CHAMPS_PASSAGE}
        complet["couts"] = {"prix": 5900}
        with open(chemin, "w", encoding="utf-8") as f:
            json.dump(complet, f)
        d3, err3, ch3 = lire_passage(dossier)
        ok &= _essai("un fichier complet se lit", d3 is not None and err3 is None)
        d3["coach"] = {"porte": "ouverte"}
        ecrire_passage(d3, ch3)
        d4, _, _ = lire_passage(dossier)
        ok &= _essai("le coach ecrit sans effacer ce que Testing avait mis",
                     d4.get("coach", {}).get("porte") == "ouverte"
                     and d4.get("cle") == "x")

    # --- LES PIEGES DE L'AUDIT A BLANC
    ok &= _essai("aucun mot latin sur l'ecran de la porte",
                 "OK" not in vue_porte(p) and "NON" not in vue_porte(p),
                 [l for l in vue_porte(p).split("\n") if "OK" in l or "NON" in l][:2])
    ok &= _essai("les DEUX ecarts de taux s'affichent, pas un seul",
                 vue_taux(t, 0.65, 0.45).count("طاح بالنقاط")
                 + vue_taux(t, 0.65, 0.45).count("طلع بالنقاط") == 2)
    ok &= _essai("et l'ecart dit s'il monte ou s'il descend",
                 "طاح بالنقاط" in vue_taux(t, 0.65, 0.45)
                 and "طلع بالنقاط" in vue_taux(t, 0.65, 0.45))
    maigre = taux_reels(50, 30, 30, 0, 0)
    ok &= _essai("sans colis arrives, on ne juge pas la livraison",
                 not maigre["juge_livraison"]
                 and "ما نحكموش عليه" in vue_taux(maigre, 0.65, 0.45))
    ok &= _essai("la part en route a le MEME denominateur des deux cotes",
                 abs(taux_reels(150, 95, 90, 60, 20)["part_en_route"]
                     - roas_livre(5900, 60, 10, 200000, 150000, 20)["part_en_route"])
                 < 0.001)
    ok &= _essai("la perte legere rappelle aussi qu'on ne coupe pas",
                 "وإذا قلتلي نحبسوها" in vue_lecture(leger))
    ok &= _essai("et elle ne dit plus qu'on coupe tout seul",
                 "ونحبسوها،" not in vue_lecture(leger))
    ok &= _essai("un stock a zero ferme la porte au lieu d'etre refuse",
                 not porte_scaling(95, 150, 60, 90, 0, 3567, 1530)["ouverte"])
    ok &= _essai("un cout par colis livre a treize dinars est refuse",
                 _leve(garde_plancher, "--cout-livree", 12.72))
    ok &= _essai("et un cout plausible passe",
                 not _leve(garde_plancher, "--cout-livree", 3333.0))
    ok &= _essai("la perte par cent est cent fois celle qu'on affiche",
                 abs(leger["perte_par_cent_da"]
                     - arrondi(leger["perte_par_unite_da"]) * 100) < 0.01)
    _un = vue_taux(taux_reels(10, 5, 1, 1, 0), 0.65, 0.45)
    ok &= _essai("a un seul colis, aucune part de livraison n'est montree",
                 "مازال بكري. الكوالي قلال" in _un
                 and "الرتور" not in _un.split("التأكيد")[0],
                 _un.split("التوصيل")[1][:60] if "التوصيل" in _un else _un[:60])
    # les trois break even doivent se deduire l'un de l'autre
    _t = taux_reels(150, 95, 90, 60, 20)
    _be = break_even(5900, 1500, 100, 0, 0, 600,
                     _t["taux_confirmation"], _t["taux_livraison"])
    ok &= _essai("le triplet du break even se recoupe avec les vrais taux",
                 abs(_be["par_livree"] * _t["taux_livraison"]
                     * _t["taux_confirmation"] - _be["par_commande"]) < 0.01,
                 "%s contre %s" % (_be["par_livree"] * _t["taux_livraison"]
                                   * _t["taux_confirmation"], _be["par_commande"]))
    _ancien = break_even(5900, 1500, 100, 0, 0, 600, 0.65, 0.45)
    _melange = _ancien["par_livree"] * _t["taux_livraison"] * _t["taux_confirmation"]
    ok &= _essai("et un ANCIEN break even melange a un nouveau ne se recoupe pas",
                 abs(_melange - _be["par_commande"]) / _melange > 0.05)

    # --- CHAQUE CALCUL A SON ENTREE EN LIGNE DE COMMANDE
    import io
    import contextlib
    drapeaux = ["--installer", "--verifier", "--passage", "--break-even",
                "--taux", "--roas", "--lecture", "--porte", "--audit",
                "--rapport", "--controler", "--passer-la-main", "--taux-dinar",
                "--noter-decision", "--source"]
    aide = io.StringIO()
    with contextlib.redirect_stdout(aide):
        _construire_parser().print_help()
    texte_aide = aide.getvalue()
    absents = [d for d in drapeaux if d not in texte_aide]
    ok &= _essai("chaque calcul a bien son entree en ligne de commande",
                 not absents, "manquent : %s" % ", ".join(absents))

    # =====================================================================
    # LES DEUX MODES DE TEST
    # Le mode vient de l'agent Testing, par le fichier de passage. Le coach
    # ne le devine pas : appliquer le calendrier du site a un test message,
    # c'est juger un modele qui n'a pas fini de parler.
    # =====================================================================
    ok &= _essai("les deux modes existent, et seulement eux",
                 MODES_TEST == ("site", "message"))
    ok &= _essai("les deux modes rendent la main a la fin du jour trois (regle des trois jours)",
                 JOUR_PASSAGE_MODE["message"] == JOUR_PASSAGE_MODE["site"] == JOUR_PASSAGE == 3,
                 JOUR_PASSAGE_MODE)
    ok &= _essai("et son verdict se prend plus tard",
                 JOUR_VERDICT_MODE["message"] > JOUR_VERDICT_MODE["site"])
    ok &= _essai("le mode site garde exactement l'ancien calendrier",
                 JOUR_PASSAGE_MODE["site"] == JOUR_PASSAGE
                 and JOUR_VERDICT_MODE["site"] == JOUR_VERDICT)

    jour_pivot = JOUR_VERDICT_MODE["site"]
    l_site = lecture(jour_pivot, 200000, 150, 20, 10, bc, bconf, bliv, "site")
    l_msg = lecture(jour_pivot, 200000, 150, 20, 10, bc, bconf, bliv, "message")
    ok &= _essai("au meme jour, le mode site lit deja sur le livre",
                 l_site["base"] == "LIVRE", l_site["base"])
    ok &= _essai("et le mode message lit encore sur la confirmation",
                 l_msg["base"] == "CONFIRMATION", l_msg["base"])
    ok &= _essai("le mode voyage avec la decision",
                 l_msg["mode"] == "message"
                 and l_msg["jour_verdict"] == JOUR_VERDICT_MODE["message"])
    ok &= _essai("un mode inconnu est refuse a la lecture",
                 _leve(lecture, 5, 200000, 150, 20, 10, bc, bconf, bliv,
                       "messenger"))
    ok &= _essai("les deux lectures passent les lois de la langue",
                 not controle_affichage(vue_lecture(l_site))
                 and not controle_affichage(vue_lecture(l_msg)))

    # d'ou vient le mode : ce qu'on dit au client
    import tempfile as _tf2
    import json as _js2
    dm = _tf2.mkdtemp()
    ok &= _essai("sans rien, le mode est SUPPOSE, et c'est annonce",
                 mode_du_test("", os.path.join(dm, FICHIER_PASSAGE))
                 == ("site", "suppose"))
    ok &= _essai("ce que le client ecrit passe avant tout",
                 mode_du_test("message", None) == ("message", "toi"))
    ok &= _essai("un mode ecrit a la main mais inconnu est refuse",
                 _leve(mode_du_test, "messenger", None))
    ch_m = os.path.join(dm, FICHIER_PASSAGE)
    with open(ch_m, "w", encoding="utf-8") as f:
        _js2.dump({"cle": "x", "couts": {"prix": 1}, "devise": "USD",
                   "break_even_par_commande_da": 800,
                   "date_lancement": "2026-09-16", "ad_account_id": "act_1",
                   "product_id": "p1", "mode": "message"}, f)
    ok &= _essai("sinon il est LU dans le fichier de l'agent Testing",
                 mode_du_test("", ch_m) == ("message", "le fichier de passage"))
    r_sup = dict(l_site)
    r_sup["mode_vient_de"] = "suppose"
    ok &= _essai("quand il est suppose, la vue le dit au client",
                 "قوللي وعاود" in vue_lecture(r_sup))

    print(BARRE)
    non_testees = [n for n, b in concordances if b is None]
    if not ok:
        print("  QUELQUE CHOSE NE VA PAS. NE PAS UTILISER.")
    elif non_testees:
        print("  TOUT EST BON ICI — MAIS UNE CHOSE N'A PAS PU ETRE TESTEE :")
        print("  la concordance avec l'agent %s (son fichier n'est pas la)."
              % " et l'agent ".join(non_testees))
        print("  Dis-le au client au lieu de dire que tout est verifie.")
        print("  Code de sortie : quatre, pas zero.")
    else:
        print("  TOUT EST BON, concordance avec les deux autres agents comprise.")
    print(BARRE)
    if not ok:
        return 1
    # un agent qui regarde le code de sortie et pas le texte ne doit pas
    # pouvoir conclure « tout est verifie » quand un controle a saute.
    return 4 if non_testees else 0


def _avec_taux(taux, fonction):
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
        description="ecom manita — agent coach. TOUS les montants sont en "
                    "DINARS, sauf ce qui vient de Meta : pour ceux-la, "
                    "--devise-depenses et --taux-dinar.")
    p.add_argument("--installer", action="store_true")
    p.add_argument("--verifier", action="store_true")
    p.add_argument("--devise", default="USD",
                   help="la devise du compte, pour l'affichage")
    p.add_argument("--devise-depenses", default="",
                   help="DZD, USD ou EUR : la devise des montants venus de Meta")
    p.add_argument("--taux-dinar", type=float, default=0.0,
                   help="combien de dinars pour une unite — le taux REEL du client")

    p.add_argument("--passage", action="store_true")
    p.add_argument("--mode", default="",
                   help="site ou message. Sans lui, il est lu dans le "
                        "fichier de passage ecrit par l'agent Testing.")
    p.add_argument("--fichier", default="",
                   help="le chemin du fichier de passage, si tu le connais")

    p.add_argument("--break-even", action="store_true")
    p.add_argument("--prix", type=float, default=0.0)
    p.add_argument("--cout-produit", type=float, default=None)
    p.add_argument("--emballage", type=float, default=None)
    p.add_argument("--livraison", type=float, default=None)
    p.add_argument("--frais-cod", type=float, default=None)
    p.add_argument("--cout-retour", type=float, default=None)

    p.add_argument("--taux", action="store_true",
                   help="les VRAIS taux, mesures, contre ceux declares au test")
    p.add_argument("--commandes", type=int, default=0)
    p.add_argument("--confirmees", type=int, default=0)
    p.add_argument("--expediees", type=int, default=0)
    p.add_argument("--livrees", type=int, default=0)
    p.add_argument("--retours", type=int, default=-1,
                   help="OBLIGATOIRE des qu'on parle de colis, meme a zero")
    p.add_argument("--declare-confirmation", type=float, default=0.0)
    p.add_argument("--declare-livraison", type=float, default=0.0)

    p.add_argument("--roas", action="store_true",
                   help="le roas sur les LIVREES, en-cours au pire des cas")
    p.add_argument("--en-route", type=int, default=-1,
                   help="les colis partis qui ne sont ni livres ni revenus")
    p.add_argument("--encaisse", type=float, default=None,
                   help="l'argent RENTRE en dinars, lu dans Tassyir (deuxiemes pieces, remises, solde compris) ; sans lui : livrees x prix")
    p.add_argument("--charges", type=float, default=None,
                   help="toutes les charges en DINARS, hors publicite")

    p.add_argument("--lecture", action="store_true")
    p.add_argument("--base-test", default="", choices=["", "test", "stock"],
                   help="la reponse « السلعة » du client (test ou stock) : "
                        "la MEME base que l'agent Testing pour la lecture sur le livre")
    p.add_argument("--jour", type=int, default=0,
                   help="le nombre de jours depuis le lancement")
    p.add_argument("--depense", type=float, default=0.0)
    p.add_argument("--be-commande", type=float, default=0.0)
    p.add_argument("--be-confirmee", type=float, default=0.0)
    p.add_argument("--be-livree", type=float, default=0.0)

    p.add_argument("--porte", action="store_true")
    p.add_argument("--bon-de-commande", action="store_true",
                   help="le bon decoupe par reference, en pieces et en part")
    p.add_argument("--total", type=int, default=0, help="pieces du lot")
    p.add_argument("--par-reference", default="",
                   help='confirmees par reference : "noir standard:38,rouge standard:22"')
    p.add_argument("--minimum-atelier", type=int, default=MINI_ATELIER)
    p.add_argument("--stock", type=int, default=0)
    p.add_argument("--cout-livree", type=float, default=0.0)

    p.add_argument("--audit", action="store_true")
    # prefixe erp- : « --stock » existe deja ailleurs, et un nom qui sert a
    # deux choses finit toujours par etre passe a la mauvaise.
    for cle, _, _, _ in CONTROLES_ERP:
        p.add_argument("--erp-%s" % cle.replace("_", "-"),
                       default="", choices=["", "ok", "casse"],
                       help="ok ou casse — rien veut dire : pas pu regarder")

    p.add_argument("--rapport", action="store_true")
    p.add_argument("--produit", default="")
    p.add_argument("--observation", default="")
    p.add_argument("--ou", default="")
    p.add_argument("--decision", default="")
    p.add_argument("--choix", default="")
    p.add_argument("--prochaine", default="")
    p.add_argument("--controler", default="")

    p.add_argument("--passer-la-main", action="store_true",
                   help="ecrit les vrais chiffres dans le fichier de passage")
    p.add_argument("--source", default="", choices=["", "lu", "declare"],
                   help="lu = compte dans Tassyir · declare = donne de memoire")

    p.add_argument("--noter-decision", action="store_true",
                   help="ecrit sa reponse, la date et les chiffres")
    p.add_argument("--sa-reponse", default="")
    p.add_argument("--les-chiffres", default="")
    return p


MODES = ("installer", "verifier", "passage", "break_even", "taux", "roas",
         "lecture", "porte", "audit", "rapport", "controler", "passer_la_main",
         "noter_decision")

AIDE_DEVISE = (
    "REFUS : il faut --devise-depenses DZD|USD|EUR.\n"
    "Meta compte dans la devise du compte, cet outil compte en dinars.\n"
    "Des dollars pris pour des dinars divisent le cout par deux cent\n"
    "soixante. Si ce n'est pas DZD, ajoute --taux-dinar.")


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

    demandes = [m for m in MODES if getattr(a, m, None)]
    if len(demandes) > 1:
        print("REFUS : une seule chose a la fois. Tu en as demande %d :"
              % len(demandes))
        for m in demandes:
            print("   --%s" % m.replace("_", "-"))
        print("Relance-les l'une apres l'autre, et lis chaque reponse.")
        return 2

    global DEVISE_COMPTE, TAUX_DINAR
    try:
        d = lire_devise(a.devise)
    except ValueError as e:
        print("REFUS : %s" % e)
        return 2
    if d:
        DEVISE_COMPTE = d
    if a.taux_dinar and a.taux_dinar > 0 and DEVISE_COMPTE != "DZD":
        if not (50.0 <= a.taux_dinar <= 500.0):
            print("REFUS : taux suspect : %s dinars. Redemande-lui." % a.taux_dinar)
            return 2
        TAUX_DINAR = a.taux_dinar

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

    besoin_taux = (a.break_even or a.taux or a.roas or a.lecture or a.porte)
    if DEVISE_COMPTE != "DZD" and not TAUX_DINAR and besoin_taux:
        print("REFUS : il faut --taux-dinar.")
        print("Tu affiches en %s, et je ne connais pas son taux." % DEVISE_COMPTE)
        print("Je ne vais pas en inventer un : ce qu'une banque prend a un")
        print("commercant algerien n'est pas un cours qu'on trouve quelque part.")
        print("Demande-lui, une fois : un %s, il te revient a combien de dinars ?"
              % DEVISE_COMPTE)
        print("Ou affiche en dinars seulement : --devise DZD")
        return 2

    if a.noter_decision:
        if not a.sa_reponse or not a.les_chiffres:
            print("REFUS : il faut --sa-reponse et --les-chiffres.")
            print("On ecrit ce qu'il a repondu ET ce qu'il savait en le")
            print("disant. Sa reponse seule, sans les chiffres du jour, ne")
            print("lui servira a rien quand il relira dans un mois.")
            return 2
        chemin = os.path.join(os.getcwd(), FICHIER_DECISIONS)
        quand = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        try:
            with open(chemin, "a", encoding="utf-8") as f:
                f.write("%s\n" % ("-" * 62))
                f.write("%s\n" % quand)
                f.write("ce qu'il savait : %s\n" % a.les_chiffres)
                f.write("ce qu'il a repondu : %s\n" % a.sa_reponse)
        except OSError as e:
            print("REFUS : impossible d'ecrire %s : %s" % (chemin, e))
            return 2
        print("Ecrit dans %s" % chemin)
        print("Ce n'est pas pour te couvrir : c'est pour qu'il relise dans un")
        print("mois ce qu'il savait le jour ou il a decide.")
        return 0

    if a.passage or a.passer_la_main:
        d, err, chemin = lire_passage(
            os.path.dirname(os.path.abspath(a.fichier)) if a.fichier else None)
        if err:
            print("REFUS : %s" % err)
            print("L'agent Testing doit l'avoir ecrit avant. Ne pas le fabriquer.")
            return 2
        if a.passage:
            print(BARRE)
            print("  FICHIER DE PASSAGE LU")
            print(BARRE)
            print("  chemin ............... %s" % chemin)
            print("  marque de la campagne  %s" % d.get("cle"))
            print("  date du lancement ...  %s" % d.get("date_lancement"))
            print("  compte publicitaire    %s" % d.get("ad_account_id"))
            print("  produit .............  %s" % d.get("product_id"))
            print("  devise ..............  %s" % d.get("devise"))
            print("  break even/commande    %s DA" % d.get("break_even_par_commande_da"))
            c = d.get("couts", {})
            for k in ("prix", "cout_produit", "emballage", "livraison",
                      "frais_cod", "cout_retour"):
                print("  %-19s  %s" % (k, c.get(k)))
            t = d.get("taux_declares", {})
            if t:
                print("  taux DECLARES au test  confirmation %s / livraison %s"
                      % (t.get("confirmation"), t.get("livraison")))
            co = d.get("coach", {})
            if co:
                print(BARRE)
                print("  DEJA ECRIT PAR LE COACH")
                for k, v in co.items():
                    print("  %-19s  %s" % (k, v))
            print(BARRE)
            print("CES CHIFFRES FONT FOI. Si le client t'en donne d'autres, ne")
            print("choisis pas tout seul : montre-lui les deux, cote a cote.")
            print(BARRE)
            return 0
        # --passer-la-main
        # --stock N'EST PAS dans cette liste : zero est une VRAIE reponse,
        # et c'est celle qui ferme la porte. L'exiger non nul poussait a en
        # ressaisir un, donc a en inventer un — et un stock invente ouvre la
        # porte sur un entrepot vide.
        manque = [n for n, v in (("--commandes", a.commandes),
                                 ("--confirmees", a.confirmees),
                                 ("--expediees", a.expediees)) if v <= 0]
        if manque:
            print("REFUS : il manque %s." % ", ".join(manque))
            print("On ne passe pas la main sur des chiffres qu'on n'a pas lus.")
            return 2
        if a.stock < 0:
            print("REFUS : le stock ne peut pas etre negatif.")
            return 2
        if a.retours < 0:
            print("REFUS : il faut --retours, meme a zero.")
            return 2
        # F3 : --source etait ecrit OBLIGATOIRE partout et ne l'etait pas.
        if not a.source:
            print("REFUS : il faut --source lu   ou   --source declare.")
            print("« lu » = compte dans Tassyir. « declare » = donne de memoire")
            print("par le client. Ca descend la chaine avec les chiffres, parce")
            print("qu'un taux dicte et un taux mesure ne se traitent pas pareil,")
            print("et que l'agent Scaling n'a aucun moyen de faire la difference.")
            return 2
        try:
            t = taux_reels(a.commandes, a.confirmees, a.expediees, a.livrees,
                           a.retours)
            cout = a.cout_livree if a.cout_livree > 0 else None
            if cout is not None:
                garde_plancher("--cout-livree", cout)
            garde_plancher("--be-livree", a.be_livree)
            pg = porte_scaling(a.confirmees, a.commandes, a.livrees, a.expediees,
                               a.stock, a.be_livree, cout,
                               max(0, getattr(a, "retours", 0) or 0))
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
        # F5 : on acceptait un ancien --be-livree avec un nouveau
        # --be-commande. Les trois se deduisent l'un de l'autre : s'ils ne se
        # recoupent pas, l'un des deux vient d'un autre calcul.
        if a.be_commande > 0 and a.be_livree > 0:
            # le MEME denominateur que la formule du break even : les
            # livrees sur les CONFIRMEES. Avec celui des expediees, ce
            # controle accusait un break even juste d'etre faux.
            attendu = (a.be_livree * t["taux_livraison_sur_confirmees"]
                       * t["taux_confirmation"])
            if attendu > 0 and abs(attendu - a.be_commande) / attendu > 0.05:
                print(BARRE)
                print("REFUS : tes deux break even ne se recoupent pas.")
                print("  --be-livree ............. %d DA" % arrondi(a.be_livree))
                print("  avec tes VRAIS taux, il donne %d DA par commande"
                      % arrondi(attendu))
                print("  mais tu passes --be-commande %d DA" % arrondi(a.be_commande))
                print("L'un des deux vient d'un autre calcul — souvent l'ancien,")
                print("celui du test. Relance --break-even avec les VRAIS taux et")
                print("recopie les trois chiffres du meme bloc.")
                print(BARRE)
                return 2

        if not pg["ouverte"]:
            print(BARRE)
            print("REFUS : la porte n'est pas ouverte. On ne passe pas la main.")
            print("  fermee par : %s" % ", ".join(pg["ferme_par"]))
            print("Le coach continue a lire chaque jour jusqu'a ce qu'elle")
            print("s'ouvre. Passer la main maintenant ferait grandir une")
            print("campagne que personne n'a declaree prete.")
            print(BARRE)
            return 3

        # L'AUDIT DESCEND LA CHAINE. Un bloquant casse — le pixel absent, la
        # page morte, les couts inconnus — ne ferme aucun des cinq controles
        # de la porte, et l'agent Scaling n'en saurait rien.
        constats = {}
        for cle, _, _, _ in CONTROLES_ERP:
            v = getattr(a, "erp_%s" % cle)
            constats[cle] = True if v == "ok" else (False if v == "casse" else None)
        au = audit_erp(constats)
        bloquants_casses = [c[0] for c in au["bloquants"]]
        bloquants_pas_vus = [c[0] for c in au["inconnues"] if c[2] == "BLOQUANT"]
        if bloquants_casses or bloquants_pas_vus:
            print(BARRE)
            print("REFUS : on ne passe pas la main avec un bloquant.")
            for c in bloquants_casses:
                print("  CASSE   : %s" % _ar_controle(c))
            for c in bloquants_pas_vus:
                print("  PAS VU  : %s" % _ar_controle(c))
            print("La porte du scaling ne regarde que les commandes. Elle ne")
            print("voit pas le back office. Si tu passes la main maintenant,")
            print("l'agent Scaling fera grandir une campagne cassee sans le")
            print("savoir. Repare d'abord, ou fais-toi dire que c'est normal.")
            print("Relance avec --erp-<le controle> ok quand c'est regle.")
            print(BARRE)
            return 3
        d["coach"] = {
            "date": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
            "porte": "ouverte",
            # D'OU VIENNENT CES CHIFFRES. Sans ce champ, l'agent Scaling lit
            # des taux dictes de memoire comme s'ils avaient ete mesures.
            "source_des_chiffres": a.source,
            "taux_reels": {"confirmation": round(t["taux_confirmation"], 4),
                           "livraison": round(t["taux_livraison"], 4),
                           "retour": round(t["taux_retour"], 4)},
            "mesures": {"commandes": a.commandes, "confirmees": a.confirmees,
                        "expediees": a.expediees, "livrees": a.livrees,
                        "retours": a.retours, "stock": a.stock},
            "be_par_livree_da": a.be_livree,
            "cout_par_livree_da": cout,
            "audit_erp": {
                "casse": [c[0] for c in au["cassees"]],
                "pas_vu": [c[0] for c in au["inconnues"]],
            },
        }
        if a.be_commande > 0:
            d["coach"]["be_par_commande_reel_da"] = a.be_commande
        ecrire_passage(d, chemin)
        print(BARRE)
        print("  LA MAIN EST PASSEE A L'AGENT SCALING")
        print(BARRE)
        print("  ecrit dans : %s" % chemin)
        print("  Les chiffres de l'agent Testing sont gardes tels quels ;")
        print("  les tiens sont ajoutes a cote, sous « coach ».")
        print("  L'agent Scaling lit le MEME fichier.")
        print("  source des chiffres : %s" % a.source)
        if au["cassees"] or au["inconnues"]:
            print("  ATTENTION, ce qui reste casse est ecrit dedans :")
            for c in au["cassees"]:
                print("    casse   %s" % c[0])
            for c in au["inconnues"]:
                print("    pas vu  %s" % c[0])
            print("  Dis-le au client en clair. La porte est ouverte sur les")
            print("  commandes, pas sur le back office.")
        print(BARRE)
        return 0

    if a.break_even:
        oublis = [n for n, v in (("--cout-produit", a.cout_produit),
                                 ("--emballage", a.emballage),
                                 ("--livraison", a.livraison),
                                 ("--frais-cod", a.frais_cod),
                                 ("--cout-retour", a.cout_retour)) if v is None]
        if oublis:
            print("REFUS : il manque %s — meme a zero." % ", ".join(oublis))
            print("Oublies, ils tombent a zero en silence et le break even sort")
            print("TROP HAUT — et un break even trop haut ouvre la porte et")
            print("autorise des hausses sur un produit qui perd.")
            return 2
        if a.declare_confirmation <= 0 or a.declare_livraison <= 0:
            print("REFUS : il faut --declare-confirmation et --declare-livraison,")
            print("les deux taux avec lesquels on calcule ce break even.")
            return 2
        try:
            garde_plancher("--prix", a.prix)
            r = break_even(a.prix, a.cout_produit, a.emballage, a.livraison,
                           a.frais_cod, a.cout_retour, a.declare_confirmation,
                           a.declare_livraison)
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
        L = [BARRE, "  البريك إيفن بهاذ الأرقام", BARRE, "",
             "  الثمن", ligne_nombre(a.prix), "",
             "  لي يبقى في كل كولي يوصل، قبل الإشهار",
             ligne_nombre(r["marge_livree"]), "", "",
             "  لي يبقى في كل طلبية، قبل الإشهار",
             ligne_nombre(r["par_commande"]), "",
             "  لي يبقى في كل وحدة تأكدت، قبل الإشهار",
             ligne_nombre(r["par_confirmee"]), "",
             "  لي يبقى في كل كولي وصل، قبل الإشهار",
             ligne_nombre(r["par_livree"]), "", "",
             "  هاذا ماشي الربح الصافي.",
             "  هاذا هو أكبر حاجة تقدر تخلّص في الإشهار.", ""]
        if not r["passe"]:
            L += ["  بهاذ الريتم، حتى كي الإشهار يكون بلاش،",
                  "  المنتج يخسر. ما يتسكّالاش.", ""]
        L += RIEN_NE_PART + [BARRE]
        montrer("\n".join(L))
        print("")
        print("A REPASSER TEL QUEL, sans arrondir :")
        print("  --be-commande %.2f" % r["par_commande"])
        print("  --be-confirmee %.2f" % r["par_confirmee"])
        print("  --be-livree %.2f" % r["par_livree"])
        sortie_json("break_even", r)
        return 0 if r["passe"] else 3

    if a.taux:
        if a.retours < 0:
            print("REFUS : il faut --retours, meme a zero.")
            print("Un retour non compte devient un colis « encore en route »,")
            print("et le taux de livraison sort trop beau.")
            return 2
        try:
            t = taux_reels(a.commandes, a.confirmees, a.expediees, a.livrees,
                           a.retours)
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
        montrer(vue_taux(t,
                         a.declare_confirmation or None,
                         a.declare_livraison or None))
        sortie_json("taux", t)
        print("")
        print("A REPASSER TEL QUEL, sans arrondir :")
        if t["taux_confirmation"] > 0:
            print("  --declare-confirmation %.4f" % t["taux_confirmation"])
        else:
            print("  --declare-confirmation  <garde celui du test>")
            print("Zero commande confirmee ne se calcule pas : un break even")
            print("sur zero n'existe pas. C'est le cas normal au premier jour.")
        if t["juge_livraison"] and t["taux_livraison"] > 0:
            print("  --declare-livraison %.4f" % t["taux_livraison_sur_confirmees"])
            print("")
            print("ATTENTION a ce deuxieme chiffre : c'est les livrees sur les")
            print("CONFIRMEES, pas sur les expediees. Le break even fait")
            print("livrees = confirmees x taux, donc les colis jamais partis")
            print("comptent dedans. La porte du scaling, elle, regarde les")
            print("livrees sur les EXPEDIEES — c'est une autre question, et")
            print("l'outil la calcule tout seul. Ne melange pas les deux.")
            print("  sur les expediees ... %.4f   (la porte)" % t["taux_livraison"])
            print("  sur les confirmees .. %.4f   (le break even)"
                  % t["taux_livraison_sur_confirmees"])
            print("Recalcule le break even avec celui des confirmees, et montre")
            print("au client l'ancien et le nouveau, cote a cote.")
        else:
            # ne JAMAIS imprimer un zero « a repasser » : l'outil le refuserait
            # a la commande suivante en accusant l'agent de l'avoir oublie.
            print("  --declare-livraison  <garde celui du test>")
            print("Le taux de livraison ne se juge pas encore : trop peu de")
            print("colis sont arrives au bout. Recalcule le break even avec le")
            print("VRAI taux de confirmation et l'ANCIEN taux de livraison, et")
            print("dis-le au client tel quel.")
        return 0

    if a.roas:
        if a.charges is None:
            print("REFUS : il faut --charges, meme a zero.")
            print("Le roas se calcule sur la depense PLUS toutes les charges.")
            print("Oubliees, elles tombent a zero et le roas sort trop beau.")
            return 2
        if a.en_route < 0:
            print("REFUS : il faut --en-route, meme a zero.")
            print("Les colis partis qui ne sont ni livres ni revenus. Leur")
            print("depense est partie, leur argent n'est pas rentre : on ne")
            print("peut pas faire comme s'ils n'existaient pas.")
            return 2
        if a.retours < 0:
            print("REFUS : il faut --retours, meme a zero.")
            print("Sans lui, « la part encore en route » se calcule sur un")
            print("denominateur different de celui de --taux, et le meme")
            print("client lit deux nombres pour la meme chose.")
            return 2
        try:
            dev = lire_devise(a.devise_depenses) if a.devise_depenses else "DZD"
            dep = convertir_en_dinars(a.depense, dev,
                                      a.taux_dinar if a.taux_dinar > 0 else None)
            garde_plancher("--charges", a.charges)
            r = roas_livre(a.prix, a.livrees, a.en_route, dep, a.charges,
                           a.retours, a.encaisse)
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
        montrer(vue_roas(r))
        return 0 if r["roas_prudent"] >= 1.0 else 3

    if a.lecture:
        if a.jour <= 0:
            print("REFUS : il faut --jour, le nombre de jours depuis le lancement.")
            return 2
        if a.be_commande <= 0 or a.be_confirmee <= 0:
            print("REFUS : il faut --be-commande et --be-confirmee.")
            print("Ils sortent de --break-even, avec les VRAIS taux.")
            return 2
        try:
            dev = lire_devise(a.devise_depenses) if a.devise_depenses else None
            if dev is None:
                print(AIDE_DEVISE)
                return 2
            dep = convertir_en_dinars(a.depense, dev,
                                      a.taux_dinar if a.taux_dinar > 0 else None)
            garde_plancher("--be-commande", a.be_commande)
            garde_plancher("--be-confirmee", a.be_confirmee)
            mode, dou = mode_du_test(a.mode, a.fichier or None)
            # LE DEFAUT DU 21/09/2026. La lecture bascule sur le LIVRE au
            # jour du verdict OU des vingt-cinq confirmees. Sans --livrees
            # elle lisait zero colis arrive et sortait DISJONCTEUR sur une
            # campagne qui gagne. Un zero se DIT, il ne se suppose pas.
            if ((a.jour >= JOUR_VERDICT_MODE[mode]
                 or a.confirmees >= CONFIRMEES_VERDICT)
                    and '--livrees' not in sys.argv):
                raise ValueError(
                    'a ce stade la lecture se prend sur les colis LIVRES, '
                    'et --livrees n a pas ete donne. Sans lui l outil lit '
                    'zero colis arrive et conseille de couper une campagne '
                    'qui gagne. Donne --livrees, et mets 0 seulement si '
                    'vraiment aucun colis n est arrive.')
            sur_livre = (a.jour >= JOUR_VERDICT_MODE[mode]
                         or a.confirmees >= CONFIRMEES_VERDICT)
            bt = None
            if sur_livre:
                # 10/10/2026 : la base de la lecture sur le livre est celle de
                # l'agent Testing (sa reponse « السلعة »), jamais les seules
                # livrees : un colis en route n'est jamais une perte
                if not a.base_test:
                    raise ValueError(
                        "a ce stade il faut --base-test test ou stock (la reponse "
                        "« السلعة » du client, dans le fichier de passage) : la "
                        "lecture prend la meme base que l'agent Testing")
                mt = charger_outil(["manita-testing.py", "_ref-testing.py"])
                if mt is None or not hasattr(mt, "base_du_test"):
                    raise ValueError("l'outil de l'agent Testing (manita-testing.py) "
                                     "est introuvable a cote : la base ne se calcule pas")
                tl = a.declare_livraison / 100.0 if a.declare_livraison > 1 else a.declare_livraison
                bt = mt.base_du_test(a.base_test, a.confirmees, a.livrees,
                                     a.expediees,
                                     a.en_route if a.en_route >= 0 else None,
                                     a.retours if a.retours >= 0 else None, tl)
            r = lecture(a.jour, dep, a.commandes, a.confirmees, a.livrees,
                        a.be_commande, a.be_confirmee,
                        a.be_livree if a.be_livree > 0 else None, mode, bt)
            r["mode_vient_de"] = dou
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
        montrer(vue_lecture(r))
        # LE RAPPEL SUR *TOUTE* PERTE, pas seulement les deux plus graves.
        # Sur une perte legere, l'ecran propose de mettre une crea en pause :
        # c'est deja toucher a sa campagne, et ca se demande.
        if r["decision"] in ("PERTE_LEGERE", "PERTE_LOURDE", "DISJONCTEUR"):
            print("")
            print("RAPPEL : tu ne coupes RIEN tout seul — ni la campagne, ni un")
            print("ad set, ni une seule annonce. Tu montres et tu attends son")
            print("mot. Meme ici. C'est son argent et sa campagne.")
        if r["decision"] == "DONNEES_INSUFFISANTES":
            return 4
        return 0 if r["decision"] == "RENTABLE" else 3

    if a.bon_de_commande:
        try:
            par = {}
            for morceau in [m for m in a.par_reference.split(",") if m.strip()]:
                nom, val = morceau.rsplit(":", 1)
                par[nom.strip()] = int(val)
            if not par:
                raise ValueError("il faut --par-reference \"nom:confirmees,...\"")
            pp = porte_production(par)
            b = bon_de_commande(a.total if a.total > 0 else pp["confirmees"], par,
                                a.minimum_atelier)
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
        montrer(vue_bon(b, pp), exempts=[r for r in par])
        sortie_json("bon_de_commande", {"bon": b, "porte_production": pp})
        print("")
        for l in b["lignes"]:
            print("--ref %s %d %.1f%%" % (l["reference"].replace(" ", "_"), l["pieces"], l["part"] * 100))
        print("--plate %s" % ("oui" if b["plate"] else "non"))
        print("--porte-production %s" % ("ouverte" if pp["ouverte"] else "fermee"))
        return 0 if pp["ouverte"] else 3

    if a.porte:
        try:
            dev = lire_devise(a.devise_depenses) if a.devise_depenses else None
            if dev is None:
                print(AIDE_DEVISE)
                return 2
            cout = None
            if a.cout_livree > 0:
                cout = convertir_en_dinars(a.cout_livree, dev,
                                           a.taux_dinar if a.taux_dinar > 0 else None)
                garde_plancher("--cout-livree", cout)
            garde_plancher("--be-livree", a.be_livree)
            # 21/09/2026. --retours vaut -1 quand il n a pas ete donne, et
            # max(0, -1) le transformait en zero SANS RIEN DIRE : tout colis
            # non livre devenait un colis "encore en route", compte a trois
            # sur dix, et la porte s ouvrait sur un modele qui livre un colis
            # sur sept. Un zero se DIT, il ne se suppose pas.
            if a.retours < 0 and a.expediees > a.livrees:
                raise ValueError(
                    "il faut --retours, meme a zero. Tu as %d colis partis et "
                    "%d arrives : sans savoir combien sont DEJA REVENUS, je "
                    "compterais les %d autres comme encore en route, et le taux "
                    "de livraison sortirait trop beau. Compte les retours dans "
                    "Tassyir, ou demande-les au client."
                    % (a.expediees, a.livrees, a.expediees - a.livrees))
            r = porte_scaling(a.confirmees, a.commandes, a.livrees, a.expediees,
                              a.stock, a.be_livree, cout, max(0, a.retours))
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
        montrer(vue_porte(r))
        sortie_json("porte", r)
        if r["ouverte"]:
            print("")
            print("Si le client est d'accord, passe la main avec --passer-la-main")
            print("et les memes chiffres. L'agent Scaling lira le meme fichier.")
        return 0 if r["ouverte"] else 3

    if a.audit:
        constats = {}
        for cle, _, _, _ in CONTROLES_ERP:
            v = getattr(a, "erp_%s" % cle)
            constats[cle] = True if v == "ok" else (False if v == "casse" else None)
        r = audit_erp(constats)
        montrer(vue_audit(r))
        if r["cassees"] or r["inconnues"]:
            print("")
            print("CE QU'IL FAUT REPARER, dans l'ordre :")
            for cle, quoi, grav, cout in r["cassees"]:
                print("  [%s] %s" % (grav, quoi))
                print("        ce que ca coute : %s" % cout)
            for cle, quoi, grav, cout in r["inconnues"]:
                print("  [PAS VU] %s" % quoi)
            print("")
            print("Montre cette liste au client. Pour tout ce qui s'ecrit dans")
            print("Tassyir, montre la ligne EXACTE et attends son oui.")
            print("")
            print("ET REPARER NE VEUT PAS DIRE COUPER. Aucune pause, aucun ad")
            print("set arrete, aucune annonce desactivee — meme pour « proteger »")
            print("pendant la reparation. Ca aussi, c'est son mot.")
        return 0 if r["propre"] else 3

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
            return 2
        blocs = ([("--observation", a.observation), ("--ou", a.ou),
                  ("--decision", a.decision), ("--prochaine", a.prochaine)]
                 + [("--choix (le %d)" % (i + 1), c) for i, c in enumerate(choix)])
        sans_arabe = [n for n, v in blocs if not ARABE.search(str(v))]
        if sans_arabe:
            print("REFUS : le client lit l'arabe. Ces blocs n'en ont pas un mot :")
            for nom in sans_arabe:
                print("   %s" % nom)
            return 1
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
            print("REFUS D'AFFICHAGE :")
            for i, quoi, ligne in f:
                print("   ligne %d — %s" % (i, quoi))
            return 1
        print(texte)
        return 0

    p.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
