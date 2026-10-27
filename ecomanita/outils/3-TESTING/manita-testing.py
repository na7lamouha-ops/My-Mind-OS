#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ecom manita — AGENT 3 : TESTING PUBLICITAIRE
============================================
Cet outil CALCULE. Il ne touche jamais Meta ni Tassyir.
C'est le Claude du client qui a les mains ; cet outil a les regles.

AUCUNE INSTALLATION. Aucun mot de passe administrateur.
Il n'utilise que ce qui est deja dans Python : argparse, hashlib, json, os, re, sys.

DEUX LOIS D'AFFICHAGE, controlees automatiquement a chaque sortie :
  1. jamais un chiffre sur une ligne arabe — le nombre vit SEUL sur sa ligne
  2. jamais un mot francais dans ce que lit le client — les termes techniques
     s'ecrivent en lettres arabes, comme le client les prononce
Si une de ces deux lois casse, l'outil REFUSE d'afficher.
"""

import argparse
import hashlib
import json
import os
import re
import sys
import urllib.parse

VERSION = "3.0"

# ===========================================================================
# 1. LES CONSTANTES — les regles qui ne doivent jamais deriver
# ===========================================================================

BUDGET_UNE_OU_DEUX = 7.0      # dollars par ad set, 1 ou 2 videos
BUDGET_TROIS_ET_PLUS = 5.0    # dollars par ad set, 3 videos et plus
VIDEOS_MINI = 1
# AU PLUS QUATRE CREAS (videos, donc ad sets) par modele dans un test : decision du
# vendeur du 08/10/2026. Le client choisit de une a quatre (le bureau le demande une
# fois par lien) ; --budget et --noms REFUSENT cinq videos et plus.
VIDEOS_MAXI = 4

# --- LA PORTE DU SCALING — reprise de la version precedente de cet agent,
#     elle avait ete perdue. Cinq conditions, un seul « non » ferme la porte.
PORTE_CONFIRMATION = 0.50
PORTE_LIVRAISON = 0.40
PORTE_LIVREES = 20
CHANCE_EN_ROUTE = 0.30        # sa regle du PIRE CAS, permanente

# conversion de la regle (en dollars) vers la devise du compte : « الطالب 1.0 » — AUCUN cours code en dur.
# Le dollar (et l'euro) = le taux du CLIENT, donne par lui (--taux-dinar, --taux-euro). Sans lui, l'outil REFUSE.
MONNAIES = ("USD", "EUR", "DZD")
# plancher de Meta, en centimes de la devise du compte
PLANCHER_META = {"USD": 100, "EUR": 87}

# 0.4.2 (25/10/2026) : LA STRUCTURE SORT DU FICHIER que recoit le media buyer —
# le budget du jour ECRIT PAR LE CLIENT, le nombre de videos et le plus haut cout
# par lead de la porte. Regle validee par le vendeur sur la capture « من الملف للهيكل » :
#   part d'une video = budget / videos
#   pour juger UNE video seule = LEADS_POUR_JUGER x plus haut cout par lead / JOURS_TEST
#   part >= ce minimum            -> ABO, un ad set par video, chacun son budget
#   PLANCHER_CBO_USD <= part < min -> CBO, Meta repartit, chaque ad set au moins le plancher
#   part < PLANCHER_CBO_USD        -> on enleve des videos (jamais sous une)
PLANCHER_CBO_USD = 3.0     # en CBO : protection contre la faim, PAS un test
LEADS_POUR_JUGER = 15      # sous 15 leads, une video « ne s'est pas mesuree », elle n'a pas « perdu »
JOURS_TEST = 3             # la surveillance lit a 72 heures
# LE LIEN CACHE (0.4.2) : la meme ligne dans CHAQUE annonce. Meta remplace les
# accolades par les NUMEROS de la campagne et de l'annonce ; Tassyir relie la
# commande a l'annonce par ces numeros et va chercher le nom, la depense et
# l'image dans le compte publicitaire. Un texte ecrit a la main (nom du modele,
# ANGLE-A1) ne se relie a aucune depense.
LIGNE_SUIVI = ("utm_source=facebook&utm_medium=paid"
               "&utm_campaign={{campaign.id}}&utm_content={{ad.id}}")
# pour ramener une depense en dinars : vers_dinars(), au taux du client

COMMANDES_MINI_POUR_LIRE = 10   # en dessous, on ne lit rien : c'est du bruit
DISJONCTEUR_FOIS = 3.0          # coupe si depense > 3 x le break even, zero confirmee

# ===========================================================================
# LES DEUX MODES DE TEST — ce sont DEUX metiers, pas un reglage
# ===========================================================================
#
# SITE     la cliente remplit le formulaire de la page. La commande existe
#          tout de suite, avant le moindre appel. Meta la compte.
#          Le lien porte la marque de l'angle, donc on sait quel angle a
#          ramene quelle commande.
#
# MESSAGE  la cliente ECRIT — sur Messenger ou en direct sur Instagram.
#          Il n'y a pas de formulaire et il n'y a pas de lien. La fille de
#          la confirmation prend le nom, la wilaya et la taille dans la
#          discussion, et c'est ELLE qui cree la commande a la main.
#
# CE QUI CHANGE, ET POURQUOI :
#
#  1. LES SEUILS POUR PARLER. En mode site il faut assez de commandes
#     recues ; en mode message assez de discussions ET de confirmees.
#     LE DENOMINATEUR NE VIENT PLUS DU MODE (regle du vendeur, 08/10/2026) :
#     il vient de la reponse « السلعة » du client (--stock test|stock), voir
#     base_du_test plus bas. Sans stock on juge sur les CONFIRMEES (dans les
#     deux modes : les commandes recues ne sont plus le denominateur) ; avec
#     stock sur les LIVRAISONS ATTENDUES, contre le break even par livree.
#
#  2. LE JOUR DU VERDICT. Regle du vendeur (06/10/2026) : TROIS JOURS dans
#     les DEUX modes. Avant, le mode message attendait cinq jours, parce que
#     la cliente qui ecrit repond en retard (le soir, le lendemain). Le
#     vendeur juge au troisieme jour partout : le retard du mode message est
#     tenu par les seuils (assez de discussions ET de confirmees pour juger),
#     pas par deux jours de depense en plus.
#
#  3. L'ANGLE. Sans lien, aucune marque ne voyage. Ce que Meta sait donner,
#     c'est le nombre de DISCUSSIONS OUVERTES par annonce — donc l'angle
#     qui fait ecrire. Ce qu'elle ne sait pas donner, c'est quel angle a
#     donne la commande confirmee : ca, seule la fille de la confirmation
#     peut l'ecrire. L'outil le DIT au lieu de faire semblant.
#
# Les nombres ci-dessous sont les regles de la maison. Ils se changent ici,
# sur une ligne, et l'outil affiche toujours celui qu'il applique.

MODES_TEST = ("site", "message")

JOURS_LECTURE = {"site": 3, "message": 3}   # regle du vendeur, 06/10/2026
MINI_POUR_LIRE = {"site": 10, "message": 10}   # site : commandes · message : discussions
CONFIRMEES_MINI_MESSAGE = 5    # sans autant de confirmees, on ne juge pas
DISJONCTEUR_FOIS_MODE = {"site": 3.0, "message": 5.0}

OBJECTIF_META = {
    "site": "OUTCOME_SALES, conversion sur la page",
    "message": "OUTCOME_ENGAGEMENT, destination MESSENGER + INSTAGRAM_DIRECT",
}

# les placements du TEST — reels et story, jamais le feed
PLACEMENTS_TEST = {
    "instagram_positions": ["story", "reels"],
    "facebook_positions": ["story", "facebook_reels"],
}
PLACEMENTS_AVEC_FEED = {
    "instagram_positions": ["story", "reels", "stream"],
    "facebook_positions": ["story", "facebook_reels", "feed"],
}

# les 25 wilayas du nord, proposees. LE CLIENT CONFIRME OU CORRIGE — c'est SA livraison.
WILAYAS_NORD = [
    "Alger", "Oran", "Constantine", "Annaba", "Blida", "Batna", "Setif",
    "Tizi Ouzou", "Bejaia", "Tlemcen", "Boumerdes", "Tipaza",
    "Chlef", "Medea", "Bouira", "Bordj Bou Arreridj", "Jijel", "Skikda",
    "Guelma", "Souk Ahras", "Relizane", "Ain Defla", "Mila",
    "Oum El Bouaghi", "Tiaret",
]
# Les cles de region de Meta de ces 25 wilayas, LUES le 07/10/2026 dans les
# reponses brutes de ads_get_ad_entities (le targeting d'ad sets reels qui
# visaient exactement ces wilayas). Ce sont des identifiants de Meta, les
# memes pour tous les comptes. La meme table dans bureau/missions.mjs.
CLES_META_WILAYAS = {
    "Alger": "900", "Batna": "901", "Constantine": "902", "Medea": "903",
    "Oran": "905", "Setif": "907", "Tiaret": "908", "Tizi Ouzou": "909",
    "Tlemcen": "910", "Bejaia": "911", "Blida": "913", "Bouira": "914",
    "Guelma": "916", "Jijel": "917", "Oum El Bouaghi": "921", "Skikda": "923",
    "Ain Defla": "926", "Annaba": "928", "Bordj Bou Arreridj": "930",
    "Boumerdes": "931", "Chlef": "932", "Mila": "939", "Relizane": "942",
    "Souk Ahras": "943", "Tipaza": "946",
}

FICHIER_REGLAGE = "reglage-testing.json"
FICHIER_PASSAGE = "test-en-cours.json"
FICHIER_DECISIONS = "mes-decisions.txt"

# ===========================================================================
# 2. LES DEUX LOIS D'AFFICHAGE — le controle est DANS l'outil
# ===========================================================================

ARABE = re.compile(r'[؀-ۿ]')
# LES CHIFFRES ARABO-INDIENS SONT DES CHIFFRES. « ٧٤٠٠ » passait
# sous le controle, et la loi « jamais un chiffre sur une ligne arabe »
# ne servait plus a rien des que le texte etait tape au clavier arabe.
CHIFFRE = re.compile(r'[0-9\u0660-\u0669\u06F0-\u06F9]')
CHIFFRE_LATIN = re.compile(r'[0-9]')
# LE PRIX A LE DROIT D'ETRE LA, et lui seul. Le controle numero 3 du
# SKILL prescrit le prix SEUL sur sa ligne, suivi de sa monnaie :
# « 7400 دج ». L'outil le refusait alors que c'est le format qu'il
# demande. On tranche pour le format prescrit — mais rien d'autre ne
# passe : un chiffre glisse dans une phrase arabe reste une faute.
PRIX_SUR_SA_LIGNE = re.compile(
    r'^\s*[0-9\u0660-\u0669\u06F0-\u06F9][0-9\u0660-\u0669\u06F0-\u06F9\s.,]*'
    r'(?:دج|د\.ج|دينار)?\s*$')
FRANCAIS_INTERDIT = re.compile(
    r'\b(seuil|budget|campagne|d[eé]pense|livr[eé]e?s?|confirm[eé]e?s?|commande|'
    r'b[eé]n[eé]fice|perte|marge|retour|stock|annonce|vid[eé]o|prix|co[uû]t)\b', re.I)
# LE MOT INTERDIT NE S'ECRIT PAS QUE COLLE. « C O D », « c-o-d » et
# « cash on delivery » passaient tous les trois : on n'exige plus que
# les trois lettres se touchent, et on prend la formule en entier.
COD_INTERDIT = re.compile(
    r'\bc[\s.\-_]*o[\s.\-_]*d\b|\bcash[\s\-]+on[\s\-]+deliver', re.I)
MAROCAIN = ["تحوّس", "تحوس", "الكاس", "الصوردي", "تحوسي", "تحوّسي",
            "دابا", "واخا"]
# LA PROMESSE DE GAIN. Sa regle est absolue : on vend la methode, jamais le
# resultat. Ces mots-la, dans une pub, promettent un gain.
PROMESSE_GAIN = ["مضمون", "مضمونة", "تربح", "تربحي", "راك تربح", "راكي تربحي",
                 "ربح مضمون", "نضمنلك", "مليونير", "بلا خسارة",
                 "garanti", "garantie", "assure", "100%"]
# une ligne TECHNIQUE n'est pas lue par le client : c'est un lien, un nom de
# campagne ou un identifiant que l'agent colle dans Meta. Le slug d'une
# boutique peut tres bien contenir « prix » ou « cod » sans que ce soit une
# faute. On ne lui applique pas les lois du texte de vente.
TECHNIQUE = re.compile(r'https?://|utm_|^\s*[A-Z0-9_\-]{8,}\s*$')
# UNE SIMPLE BARRE NE FAIT PAS UN NOM DE CAMPAGNE. Toute ligne latine
# qui portait « | » sautait les quatre controles d'un coup :
# « ROBE | le prix est garanti 100% » passait comme si c'etait un nom
# d'ad set. Un vrai nom de campagne ou d'ad set, c'est au moins quatre
# champs separes par « | », pas une minuscule latine dedans, et un
# chiffre (la date, le prix, le budget). Le reste est du texte de vente.
MINUSCULE_LATINE = re.compile(r'[a-z]')
CHAMPS_DU_NOM = 4
# lignes permises : barres, nombres seuls, etiquettes de monnaie
LATIN_PERMIS = re.compile(
    r'^[\s=|\-·.:%+/]*$|^\s*[\d\s.,%|+\-]*(DA|USD|EUR|DZD|%)?[\s\d.,]*$')


def est_technique(ligne):
    """Une ligne TECHNIQUE n'est pas lue par la cliente : c'est un lien, un
    nom de campagne ou d'ad set, un identifiant que l'agent colle dans Meta.

    ELLE RESTE TECHNIQUE MEME AVEC DE L'ARABE DEDANS. Un nom de modele en
    arabe dans un nom de campagne faisait tomber l'exemption, le nom se
    faisait juger comme du texte de vente, et --noms plantait au lieu de
    sortir les noms. Un nom de campagne n'est pas du texte de vente : la
    cliente ne le verra jamais."""
    if TECHNIQUE.search(ligne):
        return True
    return (len(ligne.split(" | ")) >= CHAMPS_DU_NOM
            and not MINUSCULE_LATINE.search(ligne)
            and bool(CHIFFRE_LATIN.search(ligne)))


def controle_affichage(texte, verifier_latin=True):
    """Rend la liste des fautes. Vide = l'affichage est permis.
    On controle CHAQUE ligne, pas seulement celles qui portent de l'arabe :
    sinon il suffirait de mettre le francais sur sa propre ligne pour passer.
    Mais on saute les lignes TECHNIQUES : un lien ou un nom de campagne
    n'est pas du texte de vente."""
    fautes = []
    for i, ligne in enumerate(texte.split("\n"), 1):
        arabe = bool(ARABE.search(ligne))
        if est_technique(ligne):
            continue

        if (arabe and CHIFFRE.search(ligne)
                and not PRIX_SUR_SA_LIGNE.match(ligne)):
            fautes.append((i, "un chiffre sur une ligne arabe", ligne))
        if COD_INTERDIT.search(ligne):
            fautes.append((i, "le mot COD est interdit partout", ligne))
        for mot in MAROCAIN:
            if mot in ligne:
                fautes.append((i, "un mot marocain : %s" % mot, ligne))
                break
        for mot in PROMESSE_GAIN:
            if mot in ligne.lower():
                fautes.append((i, "une promesse de gain : %s" % mot, ligne))
                break
        if FRANCAIS_INTERDIT.search(ligne):
            if arabe:
                fautes.append((i, "un mot francais dans une phrase arabe", ligne))
            elif verifier_latin and not LATIN_PERMIS.match(ligne):
                fautes.append((i, "une phrase francaise que le client ne lit pas", ligne))
    return fautes


def structure_cli(a, videos, garder=False):
    """0.4.2 : --structure ABO / CBO, ou auto (la regle du fichier). Rend
    (structure ou None, nombre de videos). garder=True (--noms) : le nombre de
    videos est celui des ids, il ne se reduit pas ici (le bureau l'a deja fait)."""
    st = (getattr(a, "structure", "") or "").strip().upper()
    if not st:
        return None, videos
    if st == "AUTO":
        r = structure_du_test(videos, a.budget_jour_usd, a.lead_max_usd)
        if garder and r["videos"] != videos:
            raise ValueError("le budget ne tient que %d video(s) sur %d : enlever des "
                             "videos AVANT les noms" % (r["videos"], videos))
        return r["structure"], r["videos"]
    return st, videos


def montrer(texte):
    """Affiche SEULEMENT si les deux lois passent."""
    fautes = controle_affichage(texte)
    if fautes:
        print("REFUS D'AFFICHAGE — les lois de la langue ne passent pas :")
        for i, quoi, ligne in fautes:
            print("   ligne %d — %s" % (i, quoi))
            print("      %s" % ligne)
        sys.exit(1)
    print(texte)


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


DEVISE_COMPTE = "USD"   # posee une fois par la ligne de commande
TAUX_DINAR = None       # le taux REEL du client, donne par lui
TAUX_EURO = None        # le taux de l'euro du client (compte publicitaire en EUR)


class TauxManquant(ValueError):
    """Le taux du client manque : on ne convertit PAS avec un cours invente."""


def vers_dinars(devise):
    """Combien de dinars pour une unite de `devise`, au taux du CLIENT. DZD = 1."""
    d = (devise or "USD").upper()
    if d == "DZD":
        return 1.0
    if d == "USD":
        if TAUX_DINAR:
            return float(TAUX_DINAR)
        raise TauxManquant("REFUS : le taux du dollar du client manque (--taux-dinar). "
                           "Aucun cours code en dur : demande-lui son taux.")
    if d == "EUR":
        if TAUX_EURO:
            return float(TAUX_EURO)
        raise TauxManquant("REFUS : compte en EUR, le taux de l'euro du client manque (--taux-euro).")
    raise ValueError("monnaie inconnue : %s" % d)


def taux_devise(devise):
    """Combien d'unites de `devise` pour un dollar (la regle est en dollars). Un compte en dollars : 1, sans taux."""
    if (devise or "USD").upper() == "USD":
        return 1.0
    return vers_dinars("USD") / vers_dinars(devise)


def ligne_nombre(valeur_da, taux=None):
    """Une ligne PURE LATINE : le nombre seul, en dinars ET dans la monnaie
    du compte du client. Montrer des dollars a quelqu'un dont le compte est
    en euros, c'est lui donner un chiffre qu'il ne retrouvera nulle part."""
    d = DEVISE_COMPTE if DEVISE_COMPTE in MONNAIES else "USD"
    if d == "DZD":
        return "      %d DA" % round(valeur_da)
    # LE TAUX DU CLIENT, pas un cours code en dur. Ce que sa banque lui
    # prend n'est pas ce qu'on trouve quelque part : compter deux cent
    # cinquante-cinq dinars quand il en paie, par exemple, deux cent
    # quatre-vingts fait rentrer sa depense dix pour cent trop bas, et
    # toujours dans le sens qui pousse a lancer.
    try:
        t = vers_dinars(d)
    except TauxManquant:
        return "      %d DA" % round(valeur_da)   # sans le taux du client : les dinars seuls, jamais un dollar invente
    return "      %d DA   =   %.2f %s" % (round(valeur_da), valeur_da / t, d)


# ===========================================================================
# 3. LE BREAK EVEN — avec le taux de confirmation
# ===========================================================================

def break_even(prix_vente, cout_produit, emballage, livraison, frais_cod,
               cout_retour, taux_confirmation, taux_livraison):
    """Sur 100 COMMANDES RECUES.

    confirmees = 100 x taux_confirmation
    livrees    = confirmees x taux_livraison
    retours    = confirmees - livrees

    Ce qui rentre : livrees x marge
    Ce qui sort   : retours x cout_retour
    Le reste, divise, donne les trois break even.

    POURQUOI le taux de confirmation compte :
      il ne change PAS le break even par commande confirmee (il s'annule
      dans la division) ; il change celui par COMMANDE RECUE. Et c'est
      celui-la que Meta affiche, parce que le pixel compte la commande
      des l'envoi du formulaire, avant le moindre appel.
    """
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
        "marge_livree": marge_livree,
        "confirmees": confirmees,
        "livrees": livrees,
        "retours": retours,
        "net_sur_100": net,
        "par_commande": net / 100.0,
        "par_confirmee": net / confirmees if confirmees else 0.0,
        "par_livree": net / livrees if livrees else 0.0,
        "passe": net > 0.0,
    }


def prix_minimum(cout_produit, emballage, livraison, frais_cod, cout_retour,
                 taux_livraison):
    """Le prix en dessous duquel le produit perd, quel que soit le budget.
    A l'equilibre : livrees x (P - charges) = retours x cout_retour
    Independant du taux de confirmation (il se simplifie)."""
    charges = cout_produit + emballage + livraison + frais_cod
    if taux_livraison <= 0:
        return None
    return charges + cout_retour * (1.0 - taux_livraison) / taux_livraison


def livraison_minimum(prix_vente, cout_produit, emballage, livraison, frais_cod,
                      cout_retour):
    """Le taux de livraison en dessous duquel le produit perd, a ce prix.
    t x marge = (1-t) x cout_retour  ->  t = retour / (marge + retour)"""
    marge = prix_vente - cout_produit - emballage - livraison - frais_cod
    if marge + cout_retour <= 0:
        return None
    return cout_retour / (marge + cout_retour)


# ===========================================================================
# 4. LA FOURCHETTE — au lieu du mot « marge d'erreur »
# ===========================================================================

def fourchette_taux(confirmees, commandes):
    """Un taux mesure sur peu de commandes n'est pas la verite.
    On rend le bas et le haut de ce qu'il peut valoir.
    Ecart-type d'une proportion : racine de p(1-p)/n."""
    if commandes <= 0:
        return None
    p = float(confirmees) / commandes
    ecart = (p * (1.0 - p) / commandes) ** 0.5
    return max(0.01, p - ecart), min(1.0, p + ecart)


def fourchette_break_even(commandes, confirmees, prix_vente, cout_produit,
                          emballage, livraison, frais_cod, cout_retour,
                          taux_livraison):
    """Le break even par commande, du bas au haut de la fourchette."""
    f = fourchette_taux(confirmees, commandes)
    if f is None:
        return None
    bas_t, haut_t = f
    bas = break_even(prix_vente, cout_produit, emballage, livraison, frais_cod,
                     cout_retour, bas_t, taux_livraison)["par_commande"]
    haut = break_even(prix_vente, cout_produit, emballage, livraison, frais_cod,
                      cout_retour, haut_t, taux_livraison)["par_commande"]
    return {"taux_bas": bas_t, "taux_haut": haut_t,
            "taux_mesure": float(confirmees) / commandes,
            "bas": bas, "haut": haut}


# ===========================================================================
# 5. LE BUDGET
# ===========================================================================

def plafond_en_dollars(plafond, plafond_devise):
    """LE PIEGE : le client dit « je peux mettre 3000 par jour » — en DINARS.
    Si on prend 3000 pour des dollars, le garde-fou ne bloque plus rien et
    affiche quand meme vert. Un plafond silencieusement desarme est PIRE
    que pas de plafond du tout. Donc on exige la monnaie, et on convertit."""
    if not plafond:
        return 0.0
    d = (plafond_devise or "USD").upper()
    if d not in MONNAIES:
        raise ValueError("monnaie du plafond inconnue : %s" % d)
    # « الطالب 1.0 » : au taux du client, dans les deux sens (avant : un cours de la table, et max(taux, 255) pour les dinars)
    en_dollars = plafond * vers_dinars(d) / vers_dinars("USD")
    # (10/10/2026 : au cours fixe, 3 900 DA a un taux de deux cent quatre-vingt-dix passaient pour 15,29 $ ;
    #  1.0 : plus aucun cours fixe, plus de plancher : SON taux, ou un refus.)
    if d in ("USD", "EUR") and plafond > 200:
        raise ValueError(
            "PLAFOND SUSPECT : %.0f %s par jour pour un test, c'est enorme. "
            "Si le client parlait en DINARS, passe --plafond-devise DZD."
            % (plafond, d))
    return en_dollars


def controle_plafond(plafond, plafond_devise):
    """LES DEUX VONT ENSEMBLE, dans les deux sens. Le chiffre sans la
    monnaie, on ne sait pas ce qu'il vaut ; la monnaie sans le chiffre, il
    n'y a PLUS DE PLAFOND DU TOUT et rien ne bloque — l'outil affichait
    quand meme vert. Un plafond silencieusement desarme est PIRE que pas de
    plafond. Rend les lignes du refus, vide si tout va bien."""
    if plafond and not plafond_devise:
        return ["REFUS : --plafond sans --plafond-devise.",
                "Dis dans quelle monnaie le client a parle : DZD, USD ou EUR.",
                "Un plafond sans monnaie ne protege rien : trois mille"
                " dinars pris",
                "pour trois mille dollars ne bloquent plus rien."]
    if plafond_devise and not plafond:
        return ["REFUS : --plafond-devise sans --plafond.",
                "La monnaie est la, le chiffre n'y est pas : le plafond est",
                "desarme et plus rien ne bloque, alors que tu croyais l'avoir",
                "pose. Un plafond silencieusement desarme est PIRE que pas de",
                "plafond du tout.",
                "Donne les deux, ou n'en donne aucun."]
    return []


def structure_du_test(videos, budget_jour_usd, lead_max_usd):
    """0.4.2 : la structure qui SORT DU FICHIER (voir PLANCHER_CBO_USD).
    Rend {videos, structure, part_usd, juge_min_usd, enlevees, raison}.
    lead_max_usd absent ou nul : on ne sait pas juger une video seule, donc
    jamais d'ABO a plusieurs ad sets (CBO des qu'il y a deux videos)."""
    if not (VIDEOS_MINI <= videos <= VIDEOS_MAXI):
        raise ValueError("le nombre de videos doit aller de %d a %d"
                         % (VIDEOS_MINI, VIDEOS_MAXI))
    if not budget_jour_usd or budget_jour_usd < PLANCHER_CBO_USD:
        raise ValueError("BUDGET TROP COURT : %.2f USD par jour, il faut au moins "
                         "%.2f USD pour une seule video." % (budget_jour_usd or 0, PLANCHER_CBO_USD))
    juge = (LEADS_POUR_JUGER * lead_max_usd / JOURS_TEST) if lead_max_usd and lead_max_usd > 0 else None
    n = videos
    while n > 1 and budget_jour_usd / n < PLANCHER_CBO_USD - 1e-9:
        n -= 1
    part = budget_jour_usd / n
    if n == 1:
        st, raison = "ABO", "une seule video : tout le budget sur elle"
    elif juge is not None and part >= juge - 1e-9:
        st, raison = "ABO", "chaque video a de quoi etre jugee seule"
    else:
        st, raison = "CBO", "Meta repartit, chaque video garde le plancher"
    return {"videos": n, "structure": st, "part_usd": part,
            "juge_min_usd": juge, "enlevees": videos - n, "raison": raison}


def budget(videos, devise, plafond_usd=0.0, un_seul_ad_set=False,
           structure=None, budget_jour_usd=0.0):
    """plafond_usd : ce que le client a declare pouvoir payer par jour,
    DEJA converti en dollars par plafond_en_dollars().
    S'il est donne et que la regle le depasse, on REFUSE — son plafond
    passe avant la regle. Sinon on collecte un chiffre pour rien.

    un_seul_ad_set : LE MONTAGE POUR UN PETIT PLAFOND.
    Un ad set par video demande sept dollars chacun. A trois mille dinars
    par jour — onze dollars et des poussieres — ca ne finance qu'UN ad set,
    donc un seul angle, alors que tout le reste de la gamme raisonne par
    angle. Le montage a un seul ad set met TOUTES les annonces dedans : un
    seul budget, une annonce par angle, chacune avec sa marque dans le lien.
    On garde la lecture par angle sans multiplier le budget.

    CE QU'IL FAUT DIRE AU CLIENT, parce que ce n'est pas gratuit : Meta
    repartit le budget de l'ad set entre les annonces comme elle veut, et
    elle favorise vite celles qui partent bien. Certains angles recevront
    peu. C'est un test qui designe un gagnant plus vite, mais qui juge moins
    bien les perdants."""
    if not (VIDEOS_MINI <= videos <= VIDEOS_MAXI):
        raise ValueError("le nombre de videos doit aller de %d a %d"
                         % (VIDEOS_MINI, VIDEOS_MAXI))
    devise = devise.upper()
    if devise not in MONNAIES:
        raise ValueError("devise inconnue : %s" % devise)

    # 0.4.2 : la structure DU FICHIER (ABO ou CBO) et le budget du jour ECRIT
    # par le client. Sans --structure, l'ancienne regle (7 / 5 USD par ad set).
    if structure:
        structure = str(structure).upper()
        if structure not in ("ABO", "CBO"):
            raise ValueError("structure inconnue : %s (ABO ou CBO)" % structure)
        if un_seul_ad_set:
            raise ValueError("--un-seul-ad-set et --structure ne vont pas ensemble")
        total_usd = float(budget_jour_usd or 0)
        if total_usd <= 0:
            raise ValueError("il manque --budget-jour-usd (le budget du jour ecrit par le client)")
        if plafond_usd and total_usd > plafond_usd + 0.005:
            raise ValueError("PLAFOND DEPASSE : %.2f USD par jour demandes, le client "
                             "a declare %.2f USD." % (total_usd, plafond_usd))
        if structure == "CBO" and videos < 2:
            raise ValueError("CBO demande au moins deux videos (une seule : ABO)")
        if total_usd < PLANCHER_CBO_USD * (videos if structure == "CBO" else 1) - 1e-9:
            raise ValueError("BUDGET TROP COURT : %.2f USD pour %d video(s), il faut au "
                             "moins %.2f USD par video." % (total_usd, videos, PLANCHER_CBO_USD))
        plancher = PLANCHER_META.get(devise, 100)
        par_usd = total_usd / videos
        if structure == "ABO":
            centimes = max(plancher, int(round(par_usd * taux_devise(devise) * 100)))
            return {"videos": videos, "ad_sets": videos, "un_seul_ad_set": False,
                    "annonces": videos, "structure": "ABO",
                    "par_ad_set_usd": par_usd, "total_usd": total_usd, "devise": devise,
                    "centimes_par_ad_set": centimes, "centimes_campagne": None,
                    "centimes_min_par_ad_set": None,
                    "total_devise": centimes * videos / 100.0}
        centimes_campagne = int(round(total_usd * taux_devise(devise) * 100))
        centimes_min = max(plancher, int(round(PLANCHER_CBO_USD * taux_devise(devise) * 100)))
        return {"videos": videos, "ad_sets": videos, "un_seul_ad_set": False,
                "annonces": videos, "structure": "CBO",
                "par_ad_set_usd": par_usd, "total_usd": total_usd, "devise": devise,
                "centimes_par_ad_set": None, "centimes_campagne": centimes_campagne,
                "centimes_min_par_ad_set": centimes_min,
                "total_devise": centimes_campagne / 100.0}

    if un_seul_ad_set:
        ad_sets = 1
        par_ad_set_usd = BUDGET_UNE_OU_DEUX
    else:
        ad_sets = videos
        par_ad_set_usd = BUDGET_UNE_OU_DEUX if videos <= 2 else BUDGET_TROIS_ET_PLUS
    total_usd = par_ad_set_usd * ad_sets

    if plafond_usd and total_usd > plafond_usd:
        raise ValueError(
            "PLAFOND DEPASSE : la regle demande %.2f USD par jour, "
            "le client a declare %.2f USD. Baisser le nombre de videos "
            "ou lui redemander son plafond.%s"
            % (total_usd, plafond_usd,
               "" if un_seul_ad_set else
               "\nOU mettre toutes les annonces dans UN SEUL ad set : "
               "--un-seul-ad-set.\nUn budget au lieu de %d, et on garde une "
               "annonce par angle." % videos))

    converti = par_ad_set_usd * taux_devise(devise)
    centimes = int(round(converti * 100))
    plancher = PLANCHER_META.get(devise, 100)
    if centimes < plancher:
        centimes = plancher

    return {
        "videos": videos, "ad_sets": ad_sets,
        "un_seul_ad_set": un_seul_ad_set, "structure": "ABO",
        "centimes_campagne": None, "centimes_min_par_ad_set": None,
        "annonces": videos,
        "par_ad_set_usd": par_ad_set_usd, "total_usd": total_usd,
        "devise": devise,
        "centimes_par_ad_set": centimes,
        "total_devise": centimes * ad_sets / 100.0,
    }


# ===========================================================================
# 6. LA CLE — pour ne jamais lancer deux fois le meme test
# ===========================================================================

def cle_du_test(boutique, modele, prix, date, videos_ids):
    """LA DATE N'ENTRE PAS DANS LA CLE — a dessein.
    Meme boutique, meme modele, meme prix, memes videos = MEME TEST,
    qu'on le relance aujourd'hui ou demain. Si la date entrait dans la cle,
    le client qui relance par erreur le lendemain aurait une cle differente,
    la recherche ne trouverait rien, et il paierait deux campagnes qui
    s'encherissent l'une contre l'autre. C'est exactement ce qu'on evite."""
    modele_propre = str(modele).strip().upper().replace("|", " ")
    boutique_propre = str(boutique).strip().upper().replace("|", " ")
    brut = "|".join([boutique_propre, modele_propre, str(int(prix)),
                     ",".join(sorted(str(v).strip() for v in videos_ids if str(v).strip()))])
    return hashlib.sha256(brut.encode("utf-8")).hexdigest()[:12].upper()


def noms(boutique, modele, prix, date, videos_ids, devise, total_usd):
    cle = cle_du_test(boutique, modele, prix, date, videos_ids)
    mod = str(modele).strip().upper().replace("|", " ")   # le | casserait le nom
    campagne = "%s | TESTING | %dDA | %s | %dUSD | %s" % (
        date, int(prix), mod, int(round(total_usd)), cle)
    ad_sets = []
    for i, _ in enumerate(videos_ids, 1):
        ad_sets.append("%s | TESTING | %s | V%02d | BROAD | %s" % (date, mod, i, cle))
    return {"cle": cle, "campagne": campagne, "ad_sets": ad_sets}


# ===========================================================================
# 7. LE LIEN MARQUE — l'attribution par angle
# ===========================================================================

def etiquette_campagne(cle, nom_modele="", code_modele=""):
    """23/10/2026 : le MODELE lisible dans le tracking. La vue UTM de Tassyir
    (get_utm_analytics, mesuree sur une vraie boutique) rend l'arbre
    source -> campaign -> content, SANS medium : le modele va donc DANS
    utm_campaign, devant la cle (qui garde l'anti-doublon et le lien avec la
    campagne Meta). Nom en minuscules latines sans accents (24 caracteres au
    plus) ; un nom sans lettre latine (arabe) -> le code du modele ; rien ->
    la cle seule (l'ancien comportement). utm_medium reste cpc, utm_content
    reste ANGLE-A<k>."""
    import unicodedata
    def lave(t):
        t = unicodedata.normalize("NFKD", str(t or "")).encode("ascii", "ignore").decode("ascii").lower()
        return re.sub(r"-{2,}", "-", re.sub(r"[^a-z0-9]+", "-", t)).strip("-")[:24].strip("-")
    tete = lave(nom_modele) or lave(code_modele)
    return "-".join([x for x in (tete, cle) if x])


def lien_page_encode(lien_page):
    """Le lien de la page tel qu'il part vers Meta : chaque caractere hors ASCII
    (le slug arabe) encode en UTF-8 (%XX), le reste garde tel quel."""
    if not lien_page:
        raise ValueError("le lien de la page manque")
    return re.sub(r"[^\x21-\x7e]",
                  lambda m: urllib.parse.quote(m.group(0), safe=""),
                  lien_page)


def lien_suivi(lien_page):
    """0.4.2 : LE LIEN CACHE. La page + la ligne de suivi, la MEME pour toutes
    les annonces du compte. Meta y met les numeros de la campagne et de
    l'annonce ; Tassyir relie la commande a la depense par ces numeros."""
    page = lien_page_encode(lien_page)
    sep = "&" if "?" in page else "?"
    return page + sep + LIGNE_SUIVI


def lien_marque(lien_page, cle, numero_angle):
    """PROUVE le 15/09/2026 sur une boutique Tassyir :
    Tassyir attrape la marque, la garde, et la rend jusqu'au niveau
    du CONTENU — c'est-a-dire l'angle. Sans cette marque, personne
    ne saura jamais quelle creative a vendu."""
    if not lien_page:
        raise ValueError("le lien de la page manque")
    # LE SLUG ARABE PART ENCODE (09/10/2026). Une page Tassyir a souvent un
    # slug en arabe (« /product/عباية-مثال-الانيقة ») : le lien qui part
    # vers Meta est en ASCII, chaque caractere hors ASCII encode en UTF-8
    # (%XX), le reste garde tel quel (jamais encode deux fois). Prouve par
    # un GET public le 09/10/2026 : la forme encodee rend la MEME page (200,
    # meme titre, meme produit). Au client, le lien reste lisible (arabe).
    lien_page = re.sub(r"[^\x21-\x7e]",
                       lambda m: urllib.parse.quote(m.group(0), safe=""),
                       lien_page)
    sep = "&" if "?" in lien_page else "?"
    return ("%s%sutm_source=facebook&utm_medium=cpc&utm_campaign=%s&utm_content=ANGLE-A%d"
            % (lien_page, sep, cle, numero_angle))


# ===========================================================================
# 8. LA LECTURE A 72 HEURES + LE DISJONCTEUR
# ===========================================================================

DECISIONS = {
    "DONNEES_INSUFFISANTES": "مازال ما كاينش بزاف طلبيات باش نحكمو",
    "RENTABLE": "الطلبية تكلّفك أقل من البريك إيفن. تقدر تحبس وتحضّر اللوط",
    "PERTE_LEGERE": "راك تخسر على كل طلبية. بدّل الكرياتيف ولا حبس",
    "PERTE_LOURDE": "حبس. راك تخسر بزاف على كل طلبية",
    "CORRIGER_UNE_CREA": "راه يصرف وما يجيبش — لازم تبدّل الكرياتيف",
    "DISJONCTEUR": "حبسنا وحدنا. راه صرف بزاف وما جاب حتى واحد",
    "TROP_TOT": "مازال بكري باش نحكمو. استنّى النهار لي مكتوب في الجدول",
}
# avec stock (regle du vendeur, 08/10/2026) on juge le COLIS attendu, pas la commande
DECISIONS_STOCK = {
    "DONNEES_INSUFFISANTES": "مازال ما كاينش بزاف كوليات باش نحكمو",
    "RENTABLE": "الكولي يكلّفك أقل من البريك إيفن. تقدر تحبس وتحضّر اللوط",
    "PERTE_LEGERE": "راك تخسر على كل كولي. بدّل الكرياتيف ولا حبس",
    "PERTE_LOURDE": "حبس. راك تخسر بزاف على كل كولي",
}
PERTE_LOURDE_FOIS = 1.5   # au-dela de 1,5 fois son break even, on dit STOP


def disjoncteur(spend_dinars, confirmees, break_even_par_commande, mode="site"):
    """Coupe tout seul, sans demander, quand la publicite depense
    sans rien confirmer. Le seuil n'est pas invente : c'est un multiple de
    SON PROPRE break even. Chaque client a donc le sien.

    En mode message le multiple est plus grand : les reponses arrivent en
    retard, et couper trop tot revient a juger un modele avant qu'il ait
    parle."""
    if mode not in MODES_TEST:
        raise ValueError("mode inconnu : %s" % mode)
    if confirmees > 0:
        return False, 0.0
    limite = DISJONCTEUR_FOIS_MODE[mode] * break_even_par_commande
    return (spend_dinars >= limite), limite


# ---------------------------------------------------------------------------
# LA BASE DE LA LECTURE — REGLE DU VENDEUR (08/10/2026), dans les DEUX modes.
# La reponse « السلعة » du parcours (demande.reponses.stock : « test » = تيست
# برك, « stock » = السلعة عندي) choisit la base du verdict du troisieme jour :
#   test   la base est les commandes CONFIRMEES, contre le break even par
#          confirmee (en mode site aussi : les commandes recues ne sont
#          plus le denominateur) ;
#   stock  la base est les LIVRAISONS ATTENDUES = les LIVREES + les colis EN
#          ROUTE a CHANCE_EN_ROUTE (trente pour cent, en nombre REEL, sans
#          arrondi : attente_en_route) + les confirmees PAS ENCORE EXPEDIEES
#          au taux de livraison DECLARE du client, contre le break even par
#          LIVREE. Un colis en route n'est JAMAIS compte livre.
# Une base attendue entre zero et une livraison ne dit RIEN : pas encore
# assez de donnees, jamais une perte. Une base EXACTEMENT nulle (tout est
# revenu, rien en route, rien a expedier) est un fait : elle reste une perte.
# livraison_prudente et porte_scaling ne bougent pas (la porte du scaling
# garde son pire cas a elle).
# ---------------------------------------------------------------------------
STOCK_CHOIX = ("test", "stock")
BASE_MINI_STOCK = 1.0     # sous une livraison attendue, on ne juge pas


def attente_en_route(en_cours):
    """Les colis encore en route, comptes a CHANCE_EN_ROUTE, en nombre REEL :
    sept colis valent 2,1 et trois valent 0,9 (livraison_prudente, elle,
    arrondit vers le bas pour la porte et ne change pas). L'arrondi a neuf
    decimales ne touche pas le nombre de colis : il efface seulement le
    bruit de la virgule flottante (0,9 + 0,1 doit faire 1, pas 0,999...)."""
    return round(en_cours * CHANCE_EN_ROUTE, 9)


def base_du_test(stock, confirmees, livrees=0, expediees=0, en_route=None,
                 retours=None, taux_livraison_declare=0.0):
    """Rend {stock, volume, detail} : la base sur laquelle on juge le test.
    Refuse (ValueError) les nombres qui ne tiennent pas debout."""
    if stock not in STOCK_CHOIX:
        raise ValueError("--stock doit valoir test ou stock, pas %r" % (stock,))
    if confirmees < 0:
        raise ValueError("un nombre negatif")
    if stock == "test":
        return {"stock": "test", "volume": float(confirmees),
                "detail": {"confirmees": confirmees}}
    for nom, v in (("livrees", livrees), ("expediees", expediees),
                   ("en route", en_route), ("retours", retours)):
        if v is not None and v < 0:
            raise ValueError("un nombre negatif : %s" % nom)
    if expediees > confirmees:
        raise ValueError("plus d'expediees que de confirmees : %s contre %s"
                         % (expediees, confirmees))
    if livrees > expediees:
        raise ValueError("plus de livrees que d'expediees : %s contre %s"
                         % (livrees, expediees))
    partis = expediees - livrees            # ni livres : en route ou revenus
    if en_route is None and retours is None:
        if partis > 0:
            raise ValueError(
                "il faut --en-route ou --retours (meme a zero) : %d colis partis "
                "ne sont pas livres, et on ne sait pas lesquels sont revenus"
                % partis)
        en_route = 0
    elif en_route is None:
        en_route = partis - retours
        if en_route < 0:
            raise ValueError("retours incoherents : %s livrees + %s retours sur "
                             "%s expediees" % (livrees, retours, expediees))
    elif en_route > partis:
        raise ValueError("colis en route incoherents : %s en route, %s partis "
                         "et pas livres" % (en_route, partis))
    elif retours is not None and retours != partis - en_route:
        raise ValueError("en route et retours ne collent pas : un colis parti "
                         "est livre, revenu ou en route (%s + %s + %s != %s)"
                         % (livrees, retours, en_route, expediees))
    non_exp = confirmees - expediees
    if non_exp > 0 and not (0.0 < taux_livraison_declare <= 1.0):
        raise ValueError("il faut le taux de livraison DECLARE du client "
                         "(--taux-livraison) pour les confirmees pas encore "
                         "expediees")
    attente = attente_en_route(en_route)
    a_venir = non_exp * taux_livraison_declare if non_exp > 0 else 0.0
    volume = round(livrees + attente + a_venir, 9)
    return {"stock": "stock", "volume": volume,
            "detail": {"livrees": livrees, "en_route": en_route,
                       "en_route_compte": attente,
                       "non_expediees": non_exp,
                       "non_expediees_compte": round(a_venir, 9),
                       "taux_livraison_declare": taux_livraison_declare,
                       "retours": partis - en_route}}


def lecture(spend_dinars, commandes, confirmees, be_par_commande,
            incident="", mode="site", messages=0, be_par_confirmee=None,
            jour=None, base_test=None, be_par_livree=None):
    """LA MEME LOI ; LES SEUILS DU MODE, LA BASE DE LA REPONSE « السلعة ».

    seuils   site : assez de commandes recues ; message : assez de
             discussions ET de confirmees
    base     test  : depense / confirmees           contre le break even par confirmee
             stock : depense / livraisons attendues contre le break even par livree

    base_test : ce que rend base_du_test ; absent = « test » (une mission
    d'avant la regle). En mode message on regarde AUSSI le prix d'une
    discussion ouverte, mais ce n'est PAS un verdict : c'est une jauge."""
    if mode not in MODES_TEST:
        raise ValueError("mode inconnu : %s" % mode)
    if base_test is None:
        base_test = base_du_test("test", confirmees)
    stock = base_test["stock"]
    if stock == "stock" and not be_par_livree:
        raise ValueError("avec stock il faut le break even par livree")

    base = {"mode": mode, "jour_du_verdict": JOURS_LECTURE[mode],
            "cout_par_discussion": None, "stock": stock,
            "base": base_test["volume"], "detail_base": base_test["detail"]}
    if mode == "message" and messages:
        base["cout_par_discussion"] = spend_dinars / float(messages)

    if incident:
        base.update({"decision": "DISJONCTEUR", "pourquoi": incident,
                     "cout_par_commande": None})
        return base

    coupe, limite = disjoncteur(spend_dinars, confirmees, be_par_commande, mode)
    if coupe:
        base.update({"decision": "DISJONCTEUR", "limite": limite,
                     "pourquoi": "depense sans aucune confirmee",
                     "cout_par_commande": None})
        return base

    # TROP TOT N'EST PAS UN VERDICT. Le jour se compare a la regle du mode.
    if jour is not None and jour < JOURS_LECTURE[mode]:
        base.update({"decision": "TROP_TOT", "cout_par_commande": None,
                     "jour": jour})
        return base

    # LES SEUILS POUR PARLER sont ceux du mode
    if mode == "site":
        assez = commandes >= MINI_POUR_LIRE["site"]
    else:
        # le volume qui autorise a parler, c'est les discussions ;
        # le volume qui autorise a JUGER, c'est les confirmees
        assez = (messages >= MINI_POUR_LIRE["message"]
                 and confirmees >= CONFIRMEES_MINI_MESSAGE)
    # LA BASE vient de la reponse « السلعة » (regle du vendeur, 08/10/2026)
    volume = base_test["volume"]
    if stock == "stock":
        repere = be_par_livree
    else:
        # l'ancien nom (lecture_72h) n'a pas le break even par confirmee :
        # il compare au break even par commande, plus bas, donc plus severe
        repere = be_par_confirmee if be_par_confirmee else be_par_commande
    base["repere"] = repere

    if not assez:
        base.update({"decision": "DONNEES_INSUFFISANTES",
                     "cout_par_commande": None})
        return base
    if confirmees == 0:
        base.update({"decision": "CORRIGER_UNE_CREA", "cout_par_commande": None,
                     "pourquoi": "aucune commande confirmee"})
        return base
    # LA VRAIE PROTECTION : sous une livraison attendue, on ne juge pas.
    # Jamais une perte sur un colis qui peut encore arriver.
    if stock == "stock" and 0 < volume < BASE_MINI_STOCK:
        base.update({"decision": "DONNEES_INSUFFISANTES",
                     "cout_par_commande": None,
                     "pourquoi": "base attendue sous une livraison"})
        return base
    if volume <= 0:
        # des confirmees et AUCUNE livraison attendue : tout est revenu
        base.update({"decision": "PERTE_LOURDE", "cout_par_commande": None,
                     "perte_par_commande": None,
                     "pourquoi": "aucune livraison attendue"})
        return base

    cout = spend_dinars / float(volume)
    if cout <= repere:
        base.update({"decision": "RENTABLE", "cout_par_commande": cout,
                     "perte_par_commande": 0.0})
        return base
    # AU-DESSUS DU BREAK EVEN = IL PERD. On ne lui dit JAMAIS « continue ».
    perte = cout - repere
    base.update({"decision": ("PERTE_LOURDE" if cout > PERTE_LOURDE_FOIS * repere
                              else "PERTE_LEGERE"),
                 "cout_par_commande": cout, "perte_par_commande": perte})
    return base


def lecture_72h(spend_dinars, commandes, confirmees, be_par_commande, incident=""):
    """L'ancien nom, garde pour ne rien casser. Il vaut le mode site, sans
    stock : la base est les confirmees (regle du vendeur, 08/10/2026)."""
    return lecture(spend_dinars, commandes, confirmees, be_par_commande,
                   incident, "site")


# ===========================================================================
# 9. LES AFFICHAGES — tout en arabe, les nombres seuls sur leur ligne
# ===========================================================================

BARRE = "=============================================================="


def vue_break_even(r, taux_conf, taux_liv, fourch=None, commandes=None, taux=None):
    L = [BARRE, "  البريك إيفن تاعك", BARRE, ""]
    if commandes is not None:
        L += ["  عدد الطلبيات لي حسبنا عليهم", "      %d" % commandes, ""]
        L += ["  الأرقام هاذو محسوبين، ماشي مقدّرين.", ""]
    else:
        L += ["  الأرقام هاذو مقدّرين على لي قلتلي انت،", "  ماشي محسوبين على الواقع.", ""]

    L += ["  نسبة التأكيد", "      %.0f %%" % (taux_conf * 100), ""]
    L += ["  نسبة التوصيل", "      %.0f %%" % (taux_liv * 100), ""]
    L += ["  الربح تاع الكولي لي يوصل", ligne_nombre(r["marge_livree"], taux), ""]

    if fourch:
        L += ["  البريك إيفن تاعك راه بين هاذو الزوج", "",
              "  الأسفل", ligne_nombre(fourch["bas"], taux), "",
              "  الأعلى", ligne_nombre(fourch["haut"], taux), "",
              "  ابقى تحت الأسفل.",
              "  العدد مازال قليل. كي يكبر، الفورشيت تضيق وحدها.", ""]
    else:
        L += ["  أكبر حاجة تقدر تخلّصها على طلبية واحدة",
              ligne_nombre(r["par_commande"], taux), "",
              "  هاذا هو الرقم لي يبان ليك في ميتا.",
              "  ميتا تحسب الطلبية كي يطلع الفورمي، قبل أي تليفون.", ""]

    if not r["passe"]:
        L += ["  وقف. هاذ الموديل يخسّر قبل ما تصرف حتى دورو.",
              "  الكوالي لي ترجع تكلفك كثر من لي توصل تربّحك.", ""]
    L += ["  هاذ الصفر ماشي صفر البيزنس تاعك.",
          "  ما فيهش وقتك، لا الكرا، لا خلاص لي يعيّطو.", BARRE]
    return "\n".join(L)


def vue_sortie(prix_mini, liv_mini, taux=None):
    L = [BARRE, "  ما نحبسش على الفارغ — هاذو الطرقان", BARRE, "",
         "  الطريق الأول، تطلّع الثمن. أقل ثمن يخدم", ligne_nombre(prix_mini, taux), "",
         "  الطريق الثاني، تطلّع التوصيل. أقل نسبة تخدم",
         "      %.0f %%" % (liv_mini * 100), "",
         "  الطريق الثالث، تنقّص واش يكلفك الموديل.",
         "  تهدر مع الأتولييه.", "",
         "  إذا حبيت تكمل رغم كل هاذا، اكتب : نكمّل",
         "  ونكتب جوابك والتاريخ في الفيشي.",
         "  من بعدها القرار تاعك نتا.", BARRE]
    return "\n".join(L)


def vue_budget(b):
    if b.get("structure") == "CBO":
        L = [BARRE, "  البودجي تاع التست", BARRE, "",
             "  الهيكل", "      1C | CBO | %d ADSET | %d AD" % (b["ad_sets"], b["annonces"]), "",
             "  ميتا تقسّم البودجي بين الفيديوهات، وكل فيديو",
             "  ياخذ على الأقل", "      %d DA   =   %.2f USD" % (round(PLANCHER_CBO_USD * vers_dinars("USD")), PLANCHER_CBO_USD), "",
             "  المجموع في النهار، على الحملة", "      %d DA   =   %.2f USD" % (round(b["total_usd"] * vers_dinars("USD")), b["total_usd"]), "",
             "  الحساب تاعك بالعملة", "      %s" % b["devise"], "",
             "  الرقم لي تبعث لميتا على الحملة",
             "      %d" % b["centimes_campagne"], "",
             "  والرقم الأدنى لكل أد ست",
             "      %d" % b["centimes_min_par_ad_set"], "",
             "  ميتا تحسب بالسنتيم، ماشي بالوحدة.", "",
             "  الحكم يكون على المؤكّدة من تسيير. الفيديو لي",
             "  ما جابش خمسطاش ليد، ما تقاسش. ماشي خاسر.", BARRE]
        return "\n".join(L)
    L = [BARRE, "  البودجي تاع التست", BARRE, "",
         "  عدد الفيديوهات", "      %d" % b["videos"], "",
         "  عدد الأد ست", "      %d" % b["ad_sets"], "",
         # les montants en DA ET en USD, au taux du client (1.0 : sans lui, l'outil refuse avant d'arriver ici)
         "  كل أد ست ياخذ", "      %d DA   =   %.2f USD" % (round(b["par_ad_set_usd"] * vers_dinars("USD")), b["par_ad_set_usd"]), "",
         "  المجموع في النهار", "      %d DA   =   %.2f USD" % (round(b["total_usd"] * vers_dinars("USD")), b["total_usd"]), "",
         "  الحساب تاعك بالعملة", "      %s" % b["devise"], "",
         "  الرقم لي تبعث لميتا في كل أد ست",
         "      %d" % b["centimes_par_ad_set"], "",
         "  المجموع الحقيقي في النهار",
         "      %.2f %s" % (b["total_devise"], b["devise"]), "",
         "  ميتا تحسب بالسنتيم، ماشي بالوحدة."]
    # 07/10/2026 : cette ligne n'est vraie QUE pour un compte qui n'est pas en
    # dollars (avant, elle sortait aussi pour un compte en USD, la devise par
    # defaut du bureau : « ton compte n'est pas en dollars » etait faux)
    if str(b.get("devise") or "").upper() != "USD":
        L.append("  وحسابك ماشي بالدولار — الرقم راه محوّل.")
    L.append("")
    if b.get("un_seul_ad_set"):
        L += ["  المونطاج : أد ست واحد، وفيه", "      %d" % b["annonces"], "",
              "  إعلان، كل واحد بالعلامة تاعو في الرابط.", "",
              "  هاكا تقدر تقرا كل أنقل بوحدو، بلا ما تضاعف البودجي.", "",
              "  بصح لازم تعرف حاجة : ميتا تقسّم البودجي بين",
              "  الإعلانات كيما تحب هي، وتحبّ بكري لي يبدا مليح.",
              "  كاين إعلانات يوصلهم شوية برك.",
              "  معناها : تلقى الرابح بسرعة، بصح ما تحكمش مليح",
              "  على الخاسرين.", ""]
    L.append(BARRE)
    return "\n".join(L)


def vue_noms(n, lien_base=None, mode="site"):
    L = [BARRE, "  الأسماء والمفتاح", BARRE, "",
         "  اسم الكامباين", "", "  " + n["campagne"], "",
         "  أسماء الأد ست", ""]
    for a in n["ad_sets"]:
        L.append("  " + a)
    L += ["", "  المفتاح تاع هاذ التست", "", "  " + n["cle"], "",
          "  قبل ما تخلق حتى حاجة، قلّب على هاذ المفتاح",
          "  في الكامباينات تاع الحساب. إذا لقيتو، الكامباين",
          # regle du vendeur (06/10/2026) : la campagne qui porte la cle est
          # REPRISE et COMPLETEE (un essai coupe en route), jamais doublee
          "  راهي موجودة — ما تخلقش وحدة أخرى.",
          "  إذا ناقصها حاجة، كمّلها هي برك.",
          "  كي تطلق نفس التست مرتين، تخلّص مرتين",
          "  وتنافس روحك بيدك في الأونشير تاع ميتا.", ""]
    if mode == "message":
        # PAS DE LIEN DANS CE MODE. En fabriquer un serait un mensonge :
        # l'annonce ouvre une discussion, elle n'envoie nulle part.
        L += ["  في موود الميساج ما كاينش رابط، ماعندناش واش نعلّمو.",
              "  الإعلان يحلّ دردشة، ما يوديش لصفحة.", "",
              "  الأنقل لي يخلّي الناس يكتبو، ميتا تقولهولك : عدد",
              "  الدردشات لي تحلّت على كل إعلان.", "",
              "  الأنقل لي جاب المؤكّدة، لازم البنت تاع التأكيد",
              "  تكتبها في خانة الملاحظة. بلاها ما نعرفوهاش.", ""]
    elif lien_base:
        L += ["  الرابط المخفي — نفسو في كل إعلان", "",
              "  " + lien_suivi(lien_base), "",
              "  ميتا تبدّل الكلمات لي بين القوسين برقم الحملة",
              "  ورقم الإعلان. تسيير يربط الطلبية بالإعلان وبالصرف.",
              "  ما تبدّل والو في هاذ السطر، وما تكتبش اسم بيدك.", ""]
    L.append(BARRE)
    return "\n".join(L)


def vue_mode(mode):
    """CE QU'ON CREE DANS META, selon le mode. Deux metiers, deux montages."""
    if mode not in MODES_TEST:
        raise ValueError("mode inconnu : %s" % mode)
    L = [BARRE, "  الموود تاع التست", BARRE, ""]
    if mode == "site":
        L += ["  الموود : السيت", "",
              "  الزبونة تعمّر الفورمي في الصفحة. الطلبية تدخل وحدها،",
              "  قبل ما يعيّطلها حتى واحد. ميتا تشوفها وتحسبها.", "",
              "  واش تخلق في ميتا :", ""]
        L += ["  %s" % OBJECTIF_META["site"], "",
              "  placements : story et reels, jamais le feed", ""]
        L += ["  كل أنقل عندو الرابط تاعو معلّم. العلامة هي لي تخلّي",
              "  تسيير يعرف منين جات الطلبية. بلاها، حتى واحد ما يعرف.", "",
              "  الموود يبدّل غير شحال لازم باش نحكمو.",
              "  على واش نحكمو، تقولها السلعة :",
              "  تيست برك، نحكمو على الطلبيات المأكدة.",
              "  السلعة عندك، على الكوليات لي نستناو يوصلو.", ""]
    else:
        L += ["  الموود : الميساج", "",
              "  الزبونة تكتب — في الماسنجر ولا في الديريكت تاع",
              "  إنستاڨرام. ما كاينش فورمي وما كاينش رابط.", "",
              "  البنت تاع التأكيد هي لي تاخذ الاسم والولاية والتاي من",
              "  الدردشة، وهي لي تخلق الطلبية بيدها.", "",
              "  واش تخلق في ميتا :", ""]
        L += ["  %s" % OBJECTIF_META["message"], "",
              "  placements : story et reels, jamais le feed", ""]
        L += ["  وثلاث حوايج لازم تعرفهم في هاذ الموود :", "",
              "  الأولى : ما كاينش رابط، ماعنداش علامة تمشي. لي تعطيك",
              "  ميتا هو شحال من دردشة تحلّت على كل إعلان — يعني",
              "  الأنقل لي يخلّي الناس يكتبو. ما تعطيكش شكون منهم",
              "  تأكّدت. هاذيك البنت وحدها تقدر تكتبها.", "",
              "  الثانية : الدردشة ماشي طلبية. كاين موديل يخلّي الناس",
              "  يكتبو برشة وما يشري حتى واحد. لهاذا نقيسو على",
              "  المؤكّدات، ماشي على الدردشات.", "",
              "  الثالثة : الردّ يجي متأخّر. الزبونة تردّ في الليل، ولا",
              "  غدوة. نحكمو في نفس النهار تاع السيت، بصح ما نحكموش",
              "  حتى يكونو بزاف دردشات و بزاف مؤكّدات.", ""]
    L += ["  النهار تاع الحكم", "      %d" % JOURS_LECTURE[mode], "",
          "  وقبل هاذ النهار، ما نحكمو على والو.", "", BARRE]
    return "\n".join(L)


def _n(v):
    """Un nombre de colis : entier sans virgule, sinon une ou deux decimales."""
    v = float(v)
    if abs(v - round(v)) < 1e-9:
        return "%d" % round(v)
    return ("%.2f" % v).rstrip("0").rstrip(".")


def vue_base(lec):
    """LA BASE DE LA LECTURE, dite au client : darija, les nombres seuls
    sur leurs lignes latines."""
    d = lec.get("detail_base") or {}
    if lec.get("stock") != "stock":
        return ["  تيست برك، السلعة ماشي عندك.",
                "  نحكمو على الكوموندات المأكدة.",
                "  الكوموندات المأكدة", "      %s" % _n(lec.get("base") or 0), ""]
    return ["  السلعة عندك. نحكمو على الكوليات لي نستناو يوصلو.", "",
            "  الكولي لي وصلو", "      %s" % _n(d.get("livrees", 0)), "",
            "  الكولي لي راهم في الطريق", "      %s" % _n(d.get("en_route", 0)),
            "  نحسبوهم ثلاثة على عشرة برك", "      %s" % _n(d.get("en_route_compte", 0)), "",
            "  المأكدين لي مازال ما خرجوش", "      %s" % _n(d.get("non_expediees", 0)),
            "  نحسبوهم بنسبة التوصيل لي قلتلي", "      %s" % _n(d.get("non_expediees_compte", 0)), "",
            "  المجموع لي نستناو يوصل", "      %s" % _n(lec.get("base") or 0), "",
            "  الكولي لي راه في الطريق ما نحسبوهش واصل.", ""]


def vue_lecture(lec, taux=None):
    mode = lec.get("mode", "site")
    L = [BARRE, "  القراية", BARRE, ""]
    L += ["  الموود", "      %s" % mode, "",
          "  النهار تاع الحكم", "      %d" % lec.get("jour_du_verdict",
                                                     JOURS_LECTURE[mode]), ""]
    if lec.get("decision") == "TROP_TOT":
        L += ["  " + DECISIONS["TROP_TOT"], "",
              "  ما نحكمو على والو قبل هاذ النهار. الردّ في الميساج",
              "  يجي متأخّر، ولو قطعنا دروك نقطعو موديل مازال ما هدرش.",
              "", "  والقرار الأخير تاعك نتا، ماشي تاعي.", BARRE]
        return "\n".join(L)
    if lec.get("cout_par_discussion") is not None:
        L += ["  واش كلفتك الدردشة الوحدة",
              ligne_nombre(lec["cout_par_discussion"], taux), "",
              "  هاذي إشارة برك، ماشي حكم. الدردشة ماشي طلبية.", ""]
    avec_stock = lec.get("stock") == "stock"
    if lec.get("decision") != "DISJONCTEUR":
        L += vue_base(lec)
    if lec.get("cout_par_commande") is not None:
        if avec_stock:
            L += ["  واش كلفك الكولي لي نستناو يوصل",
                  ligne_nombre(lec["cout_par_commande"], taux), ""]
            if lec.get("repere"):
                L += ["  والبريك إيفن تاع الكولي لي يوصل",
                      ligne_nombre(lec["repere"], taux), ""]
        else:
            L += ["  واش كلفتك الطلبية المؤكّدة الوحدة",
                  ligne_nombre(lec["cout_par_commande"], taux), ""]
            if lec.get("repere"):
                L += ["  والبريك إيفن تاع الطلبية المؤكّدة",
                      ligne_nombre(lec["repere"], taux), ""]
    elif avec_stock and lec.get("decision") == "PERTE_LOURDE":
        L += ["  وما كاين حتى كولي نستناوه يوصل.",
              "  كلّش رجع، والبوب راهي تصرف.", ""]
        if lec.get("repere"):
            L += ["  البريك إيفن تاع الكولي لي يوصل",
                  ligne_nombre(lec["repere"], taux), ""]
    p = lec.get("perte_par_commande") or 0.0
    if p > 0:
        unite = "كولي" if avec_stock else "طلبية"
        L += ["  واش راك تخسر في كل %s" % unite, ligne_nombre(p, taux), "",
              "  وفي كل مية %s" % unite, ligne_nombre(p * 100, taux), ""]
    phrase = DECISIONS[lec["decision"]]
    if avec_stock:
        phrase = DECISIONS_STOCK.get(lec["decision"], phrase)
    L += ["  القرار", "", "  " + phrase, ""]
    if lec.get("pourquoi") == "base attendue sous une livraison":
        L += ["  الكوليات لي نستناو أقل من كولي واحد.",
              "  مازال ما نحكموش. ما نحكموش بالخسارة على هاذ الشي.",
              "  نستناو حتى يوصلو كوليات أخرين.", ""]
    if lec["decision"] in ("PERTE_LEGERE", "PERTE_LOURDE", "CORRIGER_UNE_CREA"):
        L += ["  ما نقولّكش كمّل. كي تكمل وانت فوق البريك إيفن،",
              "  الخسارة تكبر، ما تصغرش.", ""]
    if lec["decision"] == "DISJONCTEUR":
        L += ["  حبسنا وحدنا وما سقسيناكش.", ""]
    if not avec_stock:
        L += ["  ما نقراوش التوصيل هنا. السلعة ماشي عندك،",
              "  نحكمو على التأكيد برك.", ""]
    if mode == "message":
        L += ["  وباش تعرف أنهي أنقل جاب المؤكّدة، لازم البنت",
              "  تكتبها. ميتا ما تعرفهاش : هي تعرف برك شكون خلّى",
              "  الناس يكتبو.", ""]
    L += ["  والقرار الأخير تاعك نتا، ماشي تاعي.", BARRE]
    return "\n".join(L)


def vue_question_format():
    return "\n".join([
        BARRE, "  سؤال لازم — وين تحب الإعلان يبان", BARRE, "",
        "  الاختيار الأول",
        "  الستوري والريلز برك. الفيديو ياخذ الشاشة كاملة.",
        "  هنا وين نديرو التست، وهنا وين الناس تشوف.", "",
        "  الاختيار الثاني",
        "  الستوري والريلز، وزيد الفيد.",
        "  الأوديونس تكبر، بصح النتيجة تتخلّط",
        "  وما تعرفش منين جات.", "",
        "  اكتب : الأول   ولا   الثاني", "",
        "  هاذ السؤال يتعاود قبل كل تست.",
        "  ما نقرّرش أنا بلاصتك.", BARRE])


def vue_wilayas():
    L = [BARRE, "  الولايات — تأكيد لازم", BARRE, "",
         "  هاذي الولايات لي نقترحو، وهي ولايات الشمال",
         "  وين التوصيل يمشي مليح عادة :", ""]
    for i in range(0, len(WILAYAS_NORD), 3):
        L.append("      " + " · ".join(WILAYAS_NORD[i:i + 3]))
    L += ["", "  شوفهم مليح. إذا التوصيل تاعك يقول حاجة أخرى،",
          "  بدّلهم — هي الولايات تاعك نتا، ماشي تاعي.", "",
          "  الكودات تاع ميتا تاع هاذ الولايات راهم واجدين",
          "  في الأداة : ما تكتب والو.", "",
          "  Cles de region Meta (targeting.geo_locations.regions) :"]
    for i in range(0, len(WILAYAS_NORD), 3):
        L.append("      " + " · ".join("%s %s" % (w, CLES_META_WILAYAS[w])
                                      for w in WILAYAS_NORD[i:i + 3]))
    L += ["  geo_locations = {\"regions\": [{\"key\": \"<cle>\"}, ...]}, les 25,",
          "  et rien d'autre (jamais countries DZ).", BARRE]
    return "\n".join(L)


# ===========================================================================
# 10. LE FICHIER DE PASSAGE ET LES DECISIONS ECRITES
# ===========================================================================

def ecrire_passage(dossier, donnees):
    chemin = os.path.join(dossier, FICHIER_PASSAGE)
    with open(chemin, "w", encoding="utf-8") as f:
        json.dump(donnees, f, ensure_ascii=False, indent=2)
    return chemin


def ecrire_decision(dossier, texte_avertissement, reponse, date):
    """Quand l'outil dit « tu vas perdre » et que le client repond
    « je continue », on ECRIT. La trace protege les deux cotes."""
    chemin = os.path.join(dossier, FICHIER_DECISIONS)
    with open(chemin, "a", encoding="utf-8") as f:
        f.write("\n" + BARRE + "\n")
        f.write("DATE : %s\n" % date)
        f.write("CE QUE L'OUTIL A DIT :\n%s\n" % texte_avertissement)
        f.write("CE QUE LE CLIENT A REPONDU : %s\n" % reponse)
        f.write(BARRE + "\n")
    return chemin


# ===========================================================================
# 11. LES CONTROLES — l'outil se verifie lui-meme
# ===========================================================================

def _essai(nom, condition, detail=""):
    print("  [%s] %s" % ("OK  " if condition else "RATE", nom))
    if not condition and detail:
        print("       %s" % detail)
    return bool(condition)


def livraison_prudente(en_cours, livrees_deja):
    """Sa regle du PIRE CAS : un colis encore en route se compte a trente
    pour cent de chance d'arriver. Sa publicite est deja payee, son argent
    n'est pas rentre. On ne compte JAMAIS un colis en route comme livre."""
    return livrees_deja + int(en_cours * CHANCE_EN_ROUTE)


def porte_scaling(confirmees, commandes, livrees, expediees, stock_restant,
                  cpa_livree, seuil_cpa_livree, retours=0):
    """Deuxieme lecture. La porte est ouverte SEULEMENT si TOUT passe.

    Cinq conditions, pas quatre : un seul « non » ferme la porte. On ne
    fait pas de moyenne entre elles, et on ne « compense » pas une
    livraison faible par une bonne confirmation.

    C'EST LA PORTE DU COACH, recopiee sur la sienne le 21/09/2026 parce que
    la sienne etait juste et celle-ci ne l'etait pas. Trois differences, et
    chacune coutait de l'argent :

      1. ELLE VALIDE LES NOMBRES AVANT DE CALCULER. « 95 confirmees sur 20
         commandes » n'est pas un taux de 475 % : c'est une faute de saisie,
         et un taux invente ouvre une porte qui devrait rester fermee.

      2. LE PIRE CAS NE SE COMPTE QU'UNE SEULE FOIS, ici. Celui qui appelle
         passe les colis VRAIMENT livres et les RETOURS ; il ne passe jamais
         un nombre deja gonfle par la regle des trois sur dix. Un colis
         revenu n'est pas « encore en route » : sans les retours, il se
         compte a trois sur dix de chance d'arriver et le taux de livraison
         sort trop beau.

      3. ON COMPARE AVEC >=, comme le Coach et comme le Scaling. A cinquante
         pour cent pile, les trois agents doivent dire LA MEME chose : le
         client qui lit deux verdicts differents sur le meme chiffre ne
         croit plus aucun des deux.
    """
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
    if seuil_cpa_livree is None:
        raise ValueError(
            "il manque le seuil du cout par livree : sans lui la porte ne "
            "peut pas juger la rentabilite, et une porte qui saute un "
            "controle n'est plus une porte")
    taux_conf = confirmees / float(commandes)
    # sa loi : un colis ENCORE EN ROUTE se compte a trois sur dix, pas a zero.
    # Un colis revenu, lui, sort du calcul : il n'arrivera pas.
    en_route = expediees - livrees - retours
    taux_liv = (livrees + en_route * CHANCE_EN_ROUTE) / float(expediees)

    controles = [
        ("confirmation", taux_conf >= PORTE_CONFIRMATION,
         "%.1f %% contre %.0f %% demandes" % (taux_conf * 100, PORTE_CONFIRMATION * 100)),
        ("livraison", taux_liv >= PORTE_LIVRAISON,
         "%.1f %% contre %.0f %% demandes" % (taux_liv * 100, PORTE_LIVRAISON * 100)),
        ("colis livres", livrees >= PORTE_LIVREES,
         "%d livres contre %d demandes" % (livrees, PORTE_LIVREES)),
        ("rentabilite", cpa_livree is not None
         and cpa_livree <= seuil_cpa_livree,
         ("%.0f DA par livree contre %.0f DA de seuil"
          % (cpa_livree, seuil_cpa_livree)) if cpa_livree is not None
         else "cout par livree inconnu"),
        ("stock", stock_restant > 0, "%d pieces restantes" % stock_restant),
    ]
    rates = [c for c in controles if not c[1]]
    return {
        "ouverte": not rates,
        "controles": controles,
        "bloquants": [c[0] for c in rates],
        "taux_confirmation": round(taux_conf, 4),
        "taux_livraison": round(taux_liv, 4),
        # le taux BRUT, sans la regle du pire cas, garde a cote pour qu'on
        # voie ce qui est vraiment arrive
        "taux_livraison_brut": round(livrees / float(expediees), 4),
        "en_route": en_route,
        "retours": retours,
    }


NOM_ARABE = {
    "confirmation": "التأكيد",
    "livraison": "التوصيل",
    "colis livres": "الكولي لي وصلو",
    "rentabilite": "الربح على كل وحدة موصّلة",
    "stock": "السطوك لي باقي",
}

VALEUR_PORTE = {
    "confirmation": lambda r: "%.1f %% / %.0f %%" % (
        r["taux_confirmation"] * 100, PORTE_CONFIRMATION * 100),
    "livraison": lambda r: "%.1f %% / %.0f %%" % (
        r["taux_livraison"] * 100, PORTE_LIVRAISON * 100),
}


def lire_par_reference(texte):
    """« noir standard:37,rouge standard:23 » -> {"noir standard": 37, ...}"""
    par = {}
    for morceau in [m for m in str(texte).split(",") if m.strip()]:
        nom, val = morceau.rsplit(":", 1)
        par[nom.strip()] = float(val)
    return par


def budget_creux(lot, demande, en_attente, jours, cout_commande, taux_conf,
                 budget_test, plancher=5.0):
    """LE BUDGET DU CREUX — entre le test et l'arrivee du lot.
    On ne coupe JAMAIS (couper fait repayer l'apprentissage de Meta), mais
    on ne remplit pas une file que le stock ne servira pas (mesure sur trois
    scenarios : avec deux references, vingt dollars par jour perdaient de
    l'argent). LE STOCK DONNE LE BUDGET :
      utilisable = ce que le lot peut servir, reference par reference, face a la demande
      place      = utilisable - confirmees qui attendent deja
      budget     = place / jours, en commandes -> en confirmees -> en dollars
    borne entre le plancher (jamais zero) et le budget du test."""
    if jours <= 0 or taux_conf <= 0 or cout_commande <= 0:
        raise ValueError("jours, confirmation et cout par commande doivent etre positifs")
    if not lot:
        raise ValueError("il faut le lot decoupe par reference")
    total_lot = float(sum(lot.values()))
    if demande and sum(demande.values()) > 0:
        tot_dem = float(sum(demande.values()))
        utilisable = sum(min(lot.get(r, 0.0), total_lot * (demande[r] / tot_dem)) for r in demande)
    else:
        utilisable = total_lot
    place = max(0.0, utilisable - float(en_attente))
    conf_par_jour = place / float(jours)
    cmd_par_jour = conf_par_jour / float(taux_conf)
    brut = cmd_par_jour * float(cout_commande)
    budget = max(float(plancher), min(float(budget_test), brut))
    return {"utilisable": utilisable, "place": place, "commandes_par_jour": cmd_par_jour,
            "budget_brut": brut, "budget": budget, "au_plancher": brut < plancher,
            "au_plafond": brut > budget_test, "jours": jours}


def vue_creux(b):
    L = [BARRE, "  البودجي تاع الكرو — بين التست واللوط", BARRE, "",
         "  القطع لي اللوط يقدر يخدمها بالصحّ", "      %.0f" % b["utilisable"], "",
         "  الكوموند لي مازالهم يستنّاو", "      %.0f" % (b["utilisable"] - b["place"]), "",
         "  البلاصة لي باقية", "      %.0f" % b["place"], "",
         "  البودجي في النهار، حتى يوصل اللوط", "      %.2f USD" % b["budget"], ""]
    if b["au_plancher"]:
        L += ["  السطوك ما يسمحش بأكثر. نبقاو في الحد الأدنى باش ما نخسروش",
              "  التعلّم تاع ميتا — ما نقطعوش أبداً.", ""]
    elif b["au_plafond"]:
        L += ["  اللوط يقدر يستوعب أكثر من البودجي تاع التست. نبقاو على بودجي التست.", ""]
    else:
        L += ["  ننزلو للبودجي هاذا، ما نقطعوش. السطوك هو لي يعطي البودجي.", ""]
    L.append(BARRE)
    return "\n".join(L)


def vue_porte(r, valeurs=None):
    """La porte du scaling, ecrite pour le client : une ligne arabe pour le
    nom, une ligne de chiffres en dessous. Jamais de chiffre sur une ligne
    arabe, jamais une phrase francaise."""
    valeurs = valeurs or {}
    L = [BARRE, "  باب السكالينغ — خمس شروط", BARRE, ""]
    for nom, passe, _detail in r["controles"]:
        etat = "واجد" if passe else "ماشي واجد"
        L.append("  %s · %s" % (NOM_ARABE.get(nom, nom), etat))
        if nom in VALEUR_PORTE:
            L.append("      %s" % VALEUR_PORTE[nom](r))
        elif nom in valeurs:
            L.append("      %s" % valeurs[nom])
        L.append("")
    if r["ouverte"]:
        L += ["  الباب محلول. تقدر تسكالي.", ""]
    else:
        L.append("  الباب مسدود. هاذو لي حبسوه :")
        for nom in r["bloquants"]:
            L.append("  %s" % NOM_ARABE.get(nom, nom))
        L.append("")
        L.append("  شرط واحد ماشي واجد يسدّ الباب. ما نعاوضوش واحد بواحد.")
        L.append("")
    L.append(BARRE)
    return "\n".join(L)


def verifier():
    # « الطالب 1.0 » : les essais tournent avec un taux d'EXEMPLE, posé ici (le code, lui, n'en suppose aucun)
    global TAUX_DINAR, TAUX_EURO
    if not TAUX_DINAR:
        TAUX_DINAR = 255.0
    if not TAUX_EURO:
        TAUX_EURO = 280.0
    print(BARRE)
    print("  CONTROLES DE L'OUTIL — version %s" % VERSION)
    print(BARRE)
    ok = True

    # --- le break even
    r = break_even(5900, 1500, 100, 0, 0, 600, 0.50, 0.45)
    ok &= _essai("la marge du colis livre est juste", r["marge_livree"] == 4300)
    ok &= _essai("le break even par commande est juste",
                 abs(r["par_commande"] - 802.5) < 0.5, str(r["par_commande"]))
    ok &= _essai("le break even par confirmee est juste",
                 abs(r["par_confirmee"] - 1605.0) < 1.0)

    # --- LE POINT QUI COMPTE : la confirmation ne bouge PAS le par-confirmee
    a = break_even(5900, 1500, 100, 0, 0, 600, 0.40, 0.45)["par_confirmee"]
    b = break_even(5900, 1500, 100, 0, 0, 600, 0.70, 0.45)["par_confirmee"]
    ok &= _essai("la confirmation ne change pas le break even par confirmee",
                 abs(a - b) < 1.0, "%s contre %s" % (a, b))
    a2 = break_even(5900, 1500, 100, 0, 0, 600, 0.40, 0.45)["par_commande"]
    b2 = break_even(5900, 1500, 100, 0, 0, 600, 0.70, 0.45)["par_commande"]
    ok &= _essai("la confirmation change bien le break even par commande",
                 b2 > a2 + 100, "%s contre %s" % (a2, b2))

    # --- LE BUDGET DU CREUX : le stock donne le budget, on ne coupe jamais
    A = budget_creux({"noir standard": 37, "rouge standard": 23}, {"noir standard": 48, "rouge standard": 21},
                     33, 2, 0.70, 0.699, 28.0)
    # utilisable = min(37, 60 x 48/69) + min(23, 60 x 21/69) = 37 + 18,26 = 55,26 ; place = 22,26
    # -> 11,13 confirmees/jour -> 15,92 commandes -> x 0,70 = 11,15 USD
    # mesure sur le scenario A : 345 289 DA, mieux que couper (341 040) et que vingt dollars (338 150)
    ok &= _essai("A : lot 37/23, 33 en attente -> 11,15 USD par jour",
                 abs(A["budget"] - 11.15) < 0.01, "%.2f" % A["budget"])
    ok &= _essai("A : la reference noire est la contrainte, pas le total",
                 abs(A["utilisable"] - (37 + 60 * 21 / 69.0)) < 1e-9, "%.2f" % A["utilisable"])
    plein = budget_creux({"noir standard": 37, "rouge standard": 23}, {}, 60, 2, 0.70, 0.699, 28.0)
    ok &= _essai("aucune place : on tombe au PLANCHER, jamais a zero", plein["budget"] == 5.0 and plein["au_plancher"])
    large = budget_creux({"noir standard": 100, "rouge standard": 100}, {}, 0, 2, 0.70, 0.699, 28.0)
    ok &= _essai("trop de place : on reste au budget du test", large["budget"] == 28.0 and large["au_plafond"])
    plat = budget_creux({"noir M": 10, "vert S": 10}, {"noir M": 22, "vert S": 3}, 0, 2, 0.70, 0.699, 28.0)
    ok &= _essai("un lot PLAT compte seulement ce que la demande absorbera",
                 plat["utilisable"] < 20 and abs(plat["utilisable"] - (10 + 20 * 3 / 25.0)) < 1e-9, "%.2f" % plat["utilisable"])
    ok &= _essai("la vue du creux passe les lois de la langue", not controle_affichage(vue_creux(A)), str(controle_affichage(vue_creux(A))[:1]))

    # --- LE PIRE CAS des colis en route (sa loi permanente)
    ok &= _essai("un colis en route se compte a trois sur dix",
                 livraison_prudente(300, 0) == 90, str(livraison_prudente(300, 0)))
    ok &= _essai("un colis en route n'est jamais compte comme livre",
                 livraison_prudente(10, 5) < 15)

    # --- LA PORTE DU SCALING : cinq conditions, un seul non la ferme
    bonne = porte_scaling(60, 100, 25, 50, 30, 900.0, 1200.0)
    ok &= _essai("la porte s'ouvre quand tout passe", bonne["ouverte"] is True,
                 str(bonne["bloquants"]))
    sans_stock = porte_scaling(60, 100, 25, 50, 0, 900.0, 1200.0)
    ok &= _essai("stock a zero ferme la porte", sans_stock["ouverte"] is False)
    peu_livres = porte_scaling(60, 100, 19, 50, 30, 900.0, 1200.0)
    ok &= _essai("moins de vingt colis livres ferme la porte",
                 peu_livres["ouverte"] is False)
    trop_cher = porte_scaling(60, 100, 25, 50, 30, 1500.0, 1200.0)
    ok &= _essai("un cout par livree au-dessus du seuil ferme la porte",
                 trop_cher["ouverte"] is False)
    ok &= _essai("la vue de la porte ouverte passe les lois de la langue",
                 not controle_affichage(vue_porte(bonne)),
                 str(controle_affichage(vue_porte(bonne))[:1]))
    ok &= _essai("la vue de la porte fermee passe les lois de la langue",
                 not controle_affichage(vue_porte(sans_stock)),
                 str(controle_affichage(vue_porte(sans_stock))[:1]))

    # --- un produit qui ne passe pas
    mauvais = break_even(3000, 2500, 100, 0, 0, 600, 0.50, 0.40)
    ok &= _essai("un produit qui perd est detecte", not mauvais["passe"])
    ok &= _essai("le prix minimum est juste",
                 abs(prix_minimum(2500, 100, 0, 0, 600, 0.40) - 3500) < 1.0)
    ok &= _essai("le taux de livraison minimum est juste",
                 abs(livraison_minimum(3000, 2500, 100, 0, 0, 600) - 0.60) < 0.01)

    # --- refus des valeurs impossibles
    for mauvaise in ((5900, 1500, 100, 0, 0, 600, 1.5, 0.45),
                     (5900, -10, 100, 0, 0, 600, 0.5, 0.45),
                     (5900, 1500, 100, 0, 0, 600, 0.5, 0.0)):
        try:
            break_even(*mauvaise)
            ok &= _essai("une valeur impossible est refusee", False, str(mauvaise))
        except ValueError:
            pass
    ok &= _essai("les valeurs impossibles sont toutes refusees", True)

    # --- la fourchette
    f = fourchette_break_even(23, 12, 5900, 1500, 100, 0, 0, 600, 0.45)
    ok &= _essai("la fourchette encadre bien le mesure", f["bas"] < f["haut"])
    f100 = fourchette_break_even(100, 52, 5900, 1500, 100, 0, 0, 600, 0.45)
    ok &= _essai("plus de commandes = fourchette plus serree",
                 (f100["haut"] - f100["bas"]) < (f["haut"] - f["bas"]))

    # --- le budget
    b1 = budget(2, "USD")
    ok &= _essai("deux videos font quatorze dollars", b1["total_usd"] == 14.0)
    ok &= _essai("en dollars le nombre envoye est sept cents",
                 b1["centimes_par_ad_set"] == 700)
    b2 = budget(2, "EUR")
    ok &= _essai("en euros le nombre est converti, pas recopie",
                 b2["centimes_par_ad_set"] != 700 and b2["centimes_par_ad_set"] >= 87,
                 str(b2["centimes_par_ad_set"]))
    b3 = budget(3, "USD")
    ok &= _essai("trois videos passent a cinq dollars par ad set",
                 b3["par_ad_set_usd"] == 5.0)
    for mauvais_n in (0, 5, 6, 7):
        try:
            budget(mauvais_n, "USD")
            ok &= _essai("un nombre de videos hors regle est refuse (%d)" % mauvais_n, False)
        except ValueError:
            pass
    ok &= _essai("les nombres de videos hors regle sont refuses (0, 5, 6, 7)", True)
    # AU PLUS QUATRE CREAS (08/10/2026) : une a quatre passent, la regle du budget ne change pas
    ok &= _essai("quatre creas au plus : VIDEOS_MAXI vaut 4", VIDEOS_MAXI == 4, str(VIDEOS_MAXI))
    b_un = budget(1, "USD")
    b_quatre = budget(4, "USD")
    ok &= _essai("une crea : un ad set a sept dollars",
                 b_un["ad_sets"] == 1 and b_un["centimes_par_ad_set"] == 700, str(b_un))
    ok &= _essai("quatre creas : quatre ad sets a cinq dollars",
                 b_quatre["ad_sets"] == 4 and b_quatre["centimes_par_ad_set"] == 500, str(b_quatre))

    # --- la cle
    c1 = cle_du_test("SHOP", "ROBE", 5900, "2026-09-15", ["a", "b"])
    c2 = cle_du_test("SHOP", "ROBE", 5900, "2026-09-15", ["b", "a"])
    c3 = cle_du_test("SHOP", "ROBE", 5901, "2026-09-15", ["a", "b"])
    c4 = cle_du_test("SHOP", "ROBE", 5900, "2026-09-16", ["a", "b"])
    ok &= _essai("l'ordre des videos ne change pas la cle", c1 == c2)
    ok &= _essai("un prix different donne une cle differente", c1 != c3)
    # LE DOUBLON DU LENDEMAIN : c'est le cas qui coute deux campagnes
    ok &= _essai("LE LENDEMAIN, le meme test garde la MEME cle", c1 == c4,
                 "%s contre %s" % (c1, c4))
    ok &= _essai("la cle fait douze caracteres", len(c1) == 12)
    n_pipe = noms("SHOP", "ROBE | NOIR", 5900, "2026-09-15", ["a"], "USD", 7)
    ok &= _essai("un modele avec une barre ne casse pas le nom",
                 n_pipe["campagne"].count("|") == 5, n_pipe["campagne"])

    # --- le lien marque
    l1 = lien_marque("https://x.tassyir.io/product/y", "ABC123", 1)
    ok &= _essai("le lien porte la source", "utm_source=facebook" in l1)
    ok &= _essai("le lien porte la cle", "utm_campaign=ABC123" in l1)
    ok &= _essai("le lien porte l'angle", "utm_content=ANGLE-A1" in l1)
    # --- 0.4.2 : LE LIEN CACHE (numeros de Meta) et LA STRUCTURE DU FICHIER
    lc = lien_suivi("https://x.tassyir.io/product/عباية")
    ok &= _essai("le lien cache porte les numeros de Meta, pas un nom",
                 lc.endswith("?utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}")
                 and "%D8" in lc and "ANGLE" not in lc, lc)
    ok &= _essai("le lien cache garde un ? deja la",
                 lien_suivi("https://x.tassyir.io/p?a=1").startswith("https://x.tassyir.io/p?a=1&utm_source="))
    s15 = structure_du_test(3, 15.0, 3.42)
    ok &= _essai("15 USD, 3 videos, lead max 3.42 : CBO a 3 ad sets (5 < 17.1)",
                 s15["structure"] == "CBO" and s15["videos"] == 3 and abs(s15["juge_min_usd"] - 17.1) < 0.01, str(s15))
    s60 = structure_du_test(3, 60.0, 3.42)
    ok &= _essai("60 USD, 3 videos : ABO (20 par video >= 17.1)",
                 s60["structure"] == "ABO" and s60["videos"] == 3, str(s60))
    s6 = structure_du_test(3, 6.0, 3.42)
    ok &= _essai("6 USD, 3 videos : on enleve une video, CBO a 2 (3 USD chacune)",
                 s6["structure"] == "CBO" and s6["videos"] == 2 and s6["enlevees"] == 1, str(s6))
    s4 = structure_du_test(4, 4.0, 3.42)
    ok &= _essai("4 USD : une seule video, ABO", s4["structure"] == "ABO" and s4["videos"] == 1, str(s4))
    try:
        structure_du_test(2, 2.0, 3.42); trop = False
    except ValueError:
        trop = True
    ok &= _essai("sous 3 USD : refus (jamais une campagne qui ne mesure rien)", trop)
    ok &= _essai("sans cout par lead : jamais d'ABO a plusieurs ad sets",
                 structure_du_test(3, 90.0, 0)["structure"] == "CBO")
    bc = budget(3, "USD", 0, False, "CBO", 15.0)
    ok &= _essai("CBO : 1500 centimes sur la campagne, 300 au moins par ad set, aucun budget d'ad set",
                 bc["centimes_campagne"] == 1500 and bc["centimes_min_par_ad_set"] == 300
                 and bc["centimes_par_ad_set"] is None and bc["structure"] == "CBO", str(bc))
    ba = budget(3, "USD", 0, False, "ABO", 60.0)
    ok &= _essai("ABO du fichier : 2000 centimes par ad set",
                 ba["centimes_par_ad_set"] == 2000 and ba["total_usd"] == 60.0, str(ba))
    try:
        budget(3, "USD", 10.0, False, "CBO", 15.0); depasse = False
    except ValueError:
        depasse = True
    ok &= _essai("le budget du fichier ne depasse jamais le plafond du client", depasse)
    ok &= _essai("la vue CBO passe les lois de la langue", not controle_affichage(vue_budget(bc)),
                 str(controle_affichage(vue_budget(bc))))
    # 23/10/2026 : le nom du modele lisible dans utm_campaign, la cle derriere
    ok &= _essai("le nom latin du modele va devant la cle",
                 etiquette_campagne("ABC123", "Abaya Mocha", "MOCHA") == "abaya-mocha-ABC123",
                 etiquette_campagne("ABC123", "Abaya Mocha", "MOCHA"))
    ok &= _essai("les accents tombent, 24 caracteres au plus",
                 etiquette_campagne("ABC123", "Robe Évasée Très Très Longue Nom", "") == "robe-evasee-tres-tres-lo-ABC123",
                 etiquette_campagne("ABC123", "Robe Évasée Très Très Longue Nom", ""))
    ok &= _essai("un nom arabe donne le code du modele",
                 etiquette_campagne("ABC123", "عباية موكا", "M01") == "m01-ABC123",
                 etiquette_campagne("ABC123", "عباية موكا", "M01"))
    ok &= _essai("sans nom ni code, la cle seule",
                 etiquette_campagne("ABC123", "", "") == "ABC123")
    l5 = lien_marque("https://x.tassyir.io/product/y", etiquette_campagne("ABC123", "Abaya Mocha"), 4)
    ok &= _essai("le lien porte le modele et la cle, medium cpc, angle inchange",
                 "utm_medium=cpc&utm_campaign=abaya-mocha-ABC123&utm_content=ANGLE-A4" in l5, l5)
    l2 = lien_marque("https://x.tassyir.io/p?a=1", "ABC123", 2)
    ok &= _essai("un lien qui a deja un point d'interrogation est bien colle",
                 "?a=1&utm_source" in l2, l2)
    l3 = lien_marque("https://boutique-exemple.tassyir.io/product/عبايه-exemple-2", "ABC123", 3)
    ok &= _essai("un slug arabe part encode en ASCII vers Meta",
                 l3.startswith("https://boutique-exemple.tassyir.io/product/"
                               "%D8%B9%D8%A8%D8%A7%D9%8A%D9%87-exemple-2?utm_source=")
                 and all(ord(c) < 128 for c in l3), l3)
    l4 = lien_marque(l3.split("?")[0], "ABC123", 3)
    ok &= _essai("un lien deja encode n'est pas encode deux fois", l4 == l3, l4)

    # --- le disjoncteur
    coupe, limite = disjoncteur(spend_dinars=3000, confirmees=0,
                                break_even_par_commande=802.5)
    ok &= _essai("le disjoncteur coupe quand ca depense sans confirmer", coupe)
    ok &= _essai("la limite du disjoncteur sort de SON break even",
                 abs(limite - 3 * 802.5) < 1.0)
    coupe2, _ = disjoncteur(spend_dinars=3000, confirmees=1,
                            break_even_par_commande=802.5)
    ok &= _essai("une seule confirmee suffit a ne pas couper", not coupe2)

    # --- la lecture
    l = lecture_72h(7840, 30, 18, 802.5)
    ok &= _essai("cout sous le break even : c'est rentable",
                 l["decision"] == "RENTABLE", l["decision"])
    # LE POINT LE PLUS IMPORTANT DE TOUT L'OUTIL :
    # on ne dit JAMAIS « continue » a quelqu'un qui perd de l'argent.
    # regle du vendeur (08/10/2026) : sans stock la base est les CONFIRMEES
    l2b = lecture_72h(18000, 30, 18, 802.5)      # 1000 DA la confirmee
    ok &= _essai("cout un peu au-dessus : on dit qu'il PERD",
                 l2b["decision"] == "PERTE_LEGERE", l2b["decision"])
    l2c = lecture_72h(51000, 30, 18, 802.5)      # 1700 DA la commande
    ok &= _essai("cout tres au-dessus : on dit STOP",
                 l2c["decision"] == "PERTE_LOURDE", l2c["decision"])
    ok &= _essai("aucune decision ne dit « continue » quand il perd",
                 "CONTINUER" not in DECISIONS and "CONTINUER" not in DECISIONS_STOCK)
    ok &= _essai("la perte par commande est chiffree",
                 abs(l2b["perte_par_commande"] - (1000.0 - 802.5)) < 1.0,
                 str(l2b["perte_par_commande"]))
    l3 = lecture_72h(1000, 5, 2, 802.5)
    ok &= _essai("moins de dix commandes : on ne lit rien",
                 l3["decision"] == "DONNEES_INSUFFISANTES")
    l4 = lecture_72h(1500, 12, 0, 802.5)
    ok &= _essai("douze commandes et zero confirmee : corriger la crea",
                 l4["decision"] == "CORRIGER_UNE_CREA", l4["decision"])
    l5 = lecture_72h(0, 30, 18, 802.5, incident="page hors ligne")
    ok &= _essai("un incident passe AVANT tout le reste",
                 l5["decision"] == "DISJONCTEUR")

    # --- LES DEUX LOIS DE LA LANGUE
    r2 = break_even(5900, 1500, 100, 0, 0, 600, 0.52, 0.45)
    f2 = fourchette_break_even(23, 12, 5900, 1500, 100, 0, 0, 600, 0.45)
    vues = [vue_break_even(r2, 0.52, 0.45, f2, 23),
            vue_break_even(r2, 0.52, 0.45),
            vue_sortie(3500, 0.60),
            vue_budget(budget(2, "EUR")),
            vue_noms(noms("SHOP", "ROBE", 5900, "2026-09-15", ["a", "b"], "USD", 14),
                     "https://x.tassyir.io/product/y"),
            vue_lecture(lecture_72h(7840, 30, 18, 802.5)),
            vue_lecture(lecture_72h(3000, 30, 0, 802.5)),
            vue_question_format(),
            vue_wilayas()]
    fautes_totales = []
    for v in vues:
        fautes_totales += controle_affichage(v)
    ok &= _essai("aucun chiffre sur une ligne arabe, dans TOUS les affichages",
                 not any(f[1].startswith("un chiffre") for f in fautes_totales),
                 str(fautes_totales[:2]))
    ok &= _essai("aucun mot francais dans ce que lit le client",
                 not any(f[1].startswith("un mot") for f in fautes_totales),
                 str(fautes_totales[:2]))

    # --- 07/10/2026 : « ton compte n'est pas en dollars » ne sort QUE si c'est vrai
    v_usd, v_eur = vue_budget(budget(2, "USD")), vue_budget(budget(2, "EUR"))
    ok &= _essai("compte en USD : l'ecran ne dit pas « ton compte n'est pas en dollars » ; "
                 "compte en EUR : il le dit",
                 "ماشي بالدولار" not in v_usd and "ماشي بالدولار" in v_eur
                 and "ماشي بالدولار" not in vue_budget(budget(2, "usd")))

    # --- le controle sait-il attraper une vraie faute ?
    ok &= _essai("le controle attrape un chiffre glisse dans une phrase arabe",
                 len(controle_affichage("  عندك 23 طلبية")) >= 1)
    ok &= _essai("le controle attrape un mot francais dans une phrase arabe",
                 len(controle_affichage("  شوف le budget تاعك")) >= 1)
    # LA FAILLE TROUVEE A L'AUDIT : le francais sur sa PROPRE ligne passait
    ok &= _essai("le controle attrape une phrase francaise SANS arabe",
                 len(controle_affichage("  Ton budget est en pause")) >= 1,
                 str(controle_affichage("  Ton budget est en pause")))
    ok &= _essai("le controle attrape le mot COD, meme en arabe",
                 len(controle_affichage("  الدفع COD عند الاستلام")) >= 1)
    ok &= _essai("le controle attrape un mot marocain",
                 len(controle_affichage("  تقدري تحوّس في الموديلات")) >= 1)
    ok &= _essai("une ligne de nombres seuls passe",
                 controle_affichage("      674 DA   =   2.64 USD") == [])
    ok &= _essai("une barre passe", controle_affichage(BARRE) == [])

    # --- le plafond du client
    try:
        budget(4, "USD", plafond_usd=15.0)
        ok &= _essai("le plafond du client est respecte", False,
                     "20 dollars sont passes malgre un plafond de 15")
    except ValueError:
        ok &= _essai("le plafond du client est respecte", True)
    ok &= _essai("sans plafond declare, rien ne bloque",
                 budget(4, "USD")["total_usd"] == 20.0)

    # LE PIEGE DU PLAFOND EN DINARS — un garde-fou desarme en silence
    ok &= _essai("un plafond en dinars est converti au taux du client, pas pris pour des dollars",
                 abs(plafond_en_dollars(3000, "DZD") - 3000 / float(TAUX_DINAR)) < 0.01)
    try:
        budget(4, "USD", plafond_usd=plafond_en_dollars(3000, "DZD"))
        ok &= _essai("trois mille dinars bloquent bien vingt dollars", False,
                     "le plafond en dinars n'a rien bloque")
    except ValueError:
        ok &= _essai("trois mille dinars bloquent bien vingt dollars", True)
    try:
        plafond_en_dollars(3000, "USD")
        ok &= _essai("un plafond absurde en dollars est signale", False)
    except ValueError:
        ok &= _essai("un plafond absurde en dollars est signale", True)

    # --- les lignes techniques ne sont pas jugees comme du texte de vente
    ok &= _essai("un lien avec « prix » dans le slug n'est pas refuse",
                 controle_affichage(
                     "  https://boutique.tassyir.io/product/veste-prix-choc?utm_source=facebook") == [],
                 str(controle_affichage("  https://boutique.tassyir.io/product/veste-prix-choc?utm_source=facebook")))
    ok &= _essai("un nom de campagne avec « commande » n'est pas refuse",
                 controle_affichage(
                     "  2026-09-15 | TESTING | 5900DA | ROBE COMMANDE | 14USD | ABC123") == [])
    ok &= _essai("le mot cod en minuscules est quand meme attrape",
                 len(controle_affichage("  الدفع cod عند الاستلام")) >= 1)
    ok &= _essai("le mot C.O.D pointe est aussi attrape",
                 len(controle_affichage("  خلّص C.O.D")) >= 1)

    # --- les placements
    ok &= _essai("le test ne contient PAS le feed",
                 "feed" not in PLACEMENTS_TEST["facebook_positions"]
                 and "stream" not in PLACEMENTS_TEST["instagram_positions"])
    ok &= _essai("le test contient bien les reels et les stories",
                 "reels" in PLACEMENTS_TEST["instagram_positions"]
                 and "story" in PLACEMENTS_TEST["instagram_positions"])
    ok &= _essai("il y a bien vingt-cinq wilayas", len(WILAYAS_NORD) == 25)
    ok &= _essai("chaque wilaya a sa cle de region Meta (en chiffres, toutes differentes)",
                 sorted(CLES_META_WILAYAS) == sorted(WILAYAS_NORD)
                 and all(CLES_META_WILAYAS[w].isdigit() for w in WILAYAS_NORD)
                 and len(set(CLES_META_WILAYAS.values())) == 25)

    # =====================================================================
    # LES DEUX MODES DE TEST
    # Le mode change les SEUILS pour juger et le JOUR ; la base (le
    # denominateur) vient de --stock (regle du vendeur, 08/10/2026). Se
    # tromper de mode fait mentir le verdict — c'est le controle qui protege
    # le plus d'argent dans ce fichier.
    # =====================================================================
    def _leve_ici(fonction, *args, **kw):
        try:
            fonction(*args, **kw)
            return False
        except ValueError:
            return True

    rbe = break_even(5900, 1500, 100, 0, 0, 600, 0.50, 0.45)
    bc, bconf = rbe["par_commande"], rbe["par_confirmee"]
    ok &= _essai("les deux modes existent, et seulement eux",
                 MODES_TEST == ("site", "message"))
    ok &= _essai("le break even par confirmee vaut le double a cinquante pour cent",
                 abs(bconf - bc * 2) < 0.01, "%s / %s" % (bconf, bc))

    site = lecture(9000, 15, 7, bc, mode="site")
    msg = lecture(9000, 0, 7, bc, mode="message", messages=40,
                  be_par_confirmee=bconf, jour=3)
    ok &= _essai("en mode site, sans stock, on divise par les CONFIRMEES "
                 "(regle du vendeur, 08/10/2026)",
                 abs(site["cout_par_commande"] - 9000 / 7.0) < 0.01,
                 str(site["cout_par_commande"]))
    ok &= _essai("en mode message on divise par les confirmees",
                 abs(msg["cout_par_commande"] - 9000 / 7.0) < 0.01,
                 str(msg["cout_par_commande"]))
    ok &= _essai("et on le compare au break even par confirmee",
                 abs(msg["repere"] - bconf) < 0.01, str(msg.get("repere")))
    ok &= _essai("le prix d'une discussion est donne, mais a part",
                 abs(msg["cout_par_discussion"] - 9000 / 40.0) < 0.01)

    # REGLE DU VENDEUR (06/10/2026) : trois jours dans les DEUX modes
    ok &= _essai("les deux modes jugent au troisieme jour (regle du vendeur)",
                 JOURS_LECTURE == {"site": 3, "message": 3}, str(JOURS_LECTURE))
    tot = lecture(9000, 0, 7, bc, mode="message", messages=40,
                  be_par_confirmee=bconf, jour=2)
    ok &= _essai("juger un test message au deuxieme jour est REFUSE",
                 tot["decision"] == "TROP_TOT", tot["decision"])
    ok &= _essai("au troisieme jour, le mode message juge", msg["decision"] == "RENTABLE",
                 msg["decision"])
    tot_s = lecture(9000, 15, 7, bc, mode="site", jour=2)
    ok &= _essai("et le mode site aussi : TROP TOT au deuxieme jour",
                 tot_s["decision"] == "TROP_TOT", tot_s["decision"])
    ok &= _essai("le mode voyage avec la decision",
                 msg["mode"] == "message" and site["mode"] == "site")

    peu = lecture(9000, 0, 2, bc, mode="message", messages=40,
                  be_par_confirmee=bconf, jour=3)
    ok &= _essai("trop peu de confirmees : on ne juge pas en mode message",
                 peu["decision"] == "DONNEES_INSUFFISANTES", peu["decision"])
    muet = lecture(9000, 0, 6, bc, mode="message", messages=3,
                   be_par_confirmee=bconf, jour=3)
    ok &= _essai("trop peu de discussions non plus",
                 muet["decision"] == "DONNEES_INSUFFISANTES", muet["decision"])

    ok &= _essai("le disjoncteur du mode message est plus patient",
                 DISJONCTEUR_FOIS_MODE["message"] > DISJONCTEUR_FOIS_MODE["site"])
    _, lim_s = disjoncteur(10 ** 9, 0, bc, "site")
    _, lim_m = disjoncteur(10 ** 9, 0, bc, "message")
    ok &= _essai("et sa limite est plus haute, sur le meme produit",
                 lim_m > lim_s, "%s contre %s" % (lim_m, lim_s))
    ok &= _essai("un mode inconnu est refuse",
                 _leve_ici(lecture, 9000, 10, 5, bc, "", "messenger"))

    ok &= _essai("l'ancien nom de la lecture vaut toujours le mode site",
                 lecture_72h(9000, 15, 7, bc)["cout_par_commande"]
                 == site["cout_par_commande"])

    for m in MODES_TEST:
        ok &= _essai("la vue du mode %s passe les lois de la langue" % m,
                     not controle_affichage(vue_mode(m)))
    for vu in (site, msg, tot, peu):
        ok &= _essai("la lecture en mode %s passe les lois" % vu["mode"],
                     not controle_affichage(vue_lecture(vu)))

    n_ex = noms("SHOP", "M05", 5900, "2026-09-16", ["a", "b"], "USD", 14.0)
    vue_msg = vue_noms(n_ex, "https://exemple.dz/p", "message")
    vue_site = vue_noms(n_ex, "https://exemple.dz/p", "site")
    ok &= _essai("en mode message, aucun lien marque n'est fabrique",
                 "utm_" not in vue_msg, "un lien est sorti quand meme")
    ok &= _essai("en mode site, le lien cache est bien la (numeros de Meta)",
                 "utm_" in vue_site and "{{ad.id}}" in vue_site and "ANGLE-A" not in vue_site)
    # REGLE DU VENDEUR (06/10/2026) : la campagne qui porte la cle est
    # reprise et COMPLETEE, jamais doublee — la vue ne dit plus « montre-la »
    ok &= _essai("la vue des noms dit de COMPLETER la campagne de la cle, pas "
                 "seulement de la montrer (et elle passe les lois)",
                 "كمّلها" in vue_site and "ورّيها" not in vue_site
                 and not controle_affichage(vue_site), vue_site[-300:])

    # =====================================================================
    # LES REPARATIONS DU 21/09/2026 — chaque faute reparee a son controle,
    # pour qu'elle ne puisse pas revenir en silence.
    # =====================================================================

    # --- LE PIRE CAS NE SE COMPTE QU'UNE FOIS (le plancher a trente pour cent)
    rien = porte_scaling(100, 100, 0, 100, 5, 100.0, 900.0, retours=100)
    ok &= _essai("zero colis arrive et tout revenu : la livraison tombe a ZERO",
                 rien["taux_livraison"] == 0.0 and not rien["ouverte"],
                 "%.4f" % rien["taux_livraison"])
    route = porte_scaling(60, 100, 5, 50, 30, 900.0, 1200.0, retours=15)
    ok &= _essai("5 livres, 15 revenus, 30 en route : 28 %, pas 49,6 %",
                 abs(route["taux_livraison"] - 0.28) < 1e-9,
                 "%.4f" % route["taux_livraison"])
    ok &= _essai("et le taux brut est garde a cote",
                 abs(route["taux_livraison_brut"] - 5 / 50.0) < 1e-9)

    # --- LES NOMBRES IMPOSSIBLES SONT REFUSES AVANT DE SORTIR UN TAUX
    for impossible in ((95, 20, 25, 50, 30, 900.0, 1200.0),
                       (60, 100, 25, 100, 30, 900.0, 1200.0),
                       (60, 100, 60, 50, 30, 900.0, 1200.0),
                       (60, 100, 0, 0, 30, 900.0, 1200.0),
                       (60, 100, 25, 50, 30, 900.0, None)):
        ok &= _essai("des chiffres impossibles ferment le calcul",
                     _leve_ici(porte_scaling, *impossible), str(impossible))
    ok &= _essai("95 confirmees sur 20 commandes ne font PAS un taux de 475 %",
                 _leve_ici(porte_scaling, 95, 20, 25, 50, 30, 900.0, 1200.0))

    # --- A CINQUANTE POUR CENT PILE, LA PORTE S'OUVRE (le meme >= que le
    #     Coach et que le Scaling : trois agents, un seul verdict)
    pile_conf = porte_scaling(43, 86, 25, 42, 30, 900.0, 1200.0)
    ok &= _essai("50,0 % de confirmation PILE : la porte s'ouvre",
                 pile_conf["ouverte"], str(pile_conf["bloquants"]))
    pile_liv = porte_scaling(140, 200, 20, 140, 10, 900.0, 1200.0)
    ok &= _essai("40,0 % de livraison PILE : la porte s'ouvre",
                 pile_liv["ouverte"], str(pile_liv["bloquants"]))
    ok &= _essai("et vingt colis livres PILE passent aussi",
                 pile_liv["taux_livraison"] == 0.40)

    # --- LE JOUR ZERO N'EST PAS « PAS DE JOUR »
    z = lecture(30000, 30, 18, 802.5, mode="site", jour=0)
    ok &= _essai("le jour zero est TROP TOT, pas un verdict de perte",
                 z["decision"] == "TROP_TOT", z["decision"])

    # --- « الطالب 1.0 » : AUCUN cours code en dur. Sans le taux du client, l'outil REFUSE (avant : 255 / 280 en silence).
    _t, _e = TAUX_DINAR, TAUX_EURO
    TAUX_DINAR, TAUX_EURO = None, None
    try:
        vers_dinars("USD"); _refus = False
    except TauxManquant:
        _refus = True
    try:
        vers_dinars("EUR"); _refus_e = False
    except TauxManquant:
        _refus_e = True
    TAUX_DINAR, TAUX_EURO = _t, _e
    ok &= _essai("sans le taux du client : refus (dollar et euro), jamais 255 ni 280",
                 _refus and _refus_e and vers_dinars("DZD") == 1.0)
    ok &= _essai("avec SON taux : la conversion suit son taux",
                 taux_devise("DZD") == float(TAUX_DINAR) and abs(taux_devise("EUR") - TAUX_DINAR / TAUX_EURO) < 1e-9)

    # --- UN SEUL AD SET : le montage tient le plafond
    un = budget(4, "USD", plafond_usd=11.76, un_seul_ad_set=True)
    ok &= _essai("quatre videos dans UN ad set tiennent sous onze dollars",
                 un["total_usd"] == 7.0 and un["ad_sets"] == 1
                 and un["annonces"] == 4, str(un["total_usd"]))
    ok &= _essai("le nom de la campagne annonce le VRAI budget",
                 "7USD" in noms("SHOP", "ROBE", 5900, "2026-09-21",
                                ["a", "b", "c", "d"], "USD",
                                un["total_usd"])["campagne"])

    # --- LES QUATRE TROUS DES LOIS DE LA LANGUE
    ok &= _essai("un chiffre arabo-indien est un chiffre",
                 len(controle_affichage(u"  \u0639\u0646\u062f\u0643 \u0667\u0664\u0660\u0660 \u062f\u064a\u0646\u0627\u0631")) >= 1)
    ok &= _essai("« cash on delivery » est attrape",
                 len(controle_affichage("  paiement cash on delivery")) >= 1)
    ok &= _essai("« C O D » espace est attrape",
                 len(controle_affichage("  C O D")) >= 1)
    ok &= _essai("une barre ne fait pas une ligne technique",
                 len(controle_affichage("  ROBE | le prix est garanti 100%")) >= 1,
                 str(controle_affichage("  ROBE | le prix est garanti 100%")))

    # --- UN NOM DE CAMPAGNE RESTE TECHNIQUE, MEME EN ARABE
    n_ar = noms("SHOP", u"\u0641\u0633\u062a\u0627\u0646", 5900, "2026-09-21",
                ["a", "b"], "USD", 14.0)
    ok &= _essai("un nom de modele en arabe ne fait plus planter les noms",
                 not controle_affichage(vue_noms(n_ar, "https://x.dz/p", "site")),
                 str(controle_affichage(vue_noms(n_ar, "https://x.dz/p", "site"))[:1]))

    # --- LE PRIX AU FORMAT PRESCRIT PAR LE CONTROLE NUMERO 3
    ok &= _essai("un prix suivi de sa monnaie, seul sur sa ligne, passe",
                 controle_affichage(u"7400 \u062f\u062c") == [],
                 str(controle_affichage(u"7400 \u062f\u062c")))
    ok &= _essai("mais un chiffre dans une PHRASE arabe reste une faute",
                 len(controle_affichage(u"  \u0627\u0644\u062b\u0645\u0646 7400 \u062f\u062c \u0628\u0631\u0643")) >= 1)

    # --- LE PLAFOND : les deux drapeaux vont ENSEMBLE, dans les deux sens
    ok &= _essai("un plafond sans sa monnaie est refuse",
                 len(controle_plafond(3000, "")) > 0)
    ok &= _essai("une monnaie sans plafond est refusee aussi",
                 len(controle_plafond(0, "DZD")) > 0)
    ok &= _essai("les deux ensemble passent", controle_plafond(3000, "DZD") == [])


    # =====================================================================
    # LA BASE DE LA LECTURE — REGLE DU VENDEUR (08/10/2026)
    # « السلعة » choisit la base : test = confirmees, stock = livraisons
    # attendues (livrees + en route a 30 % en nombre reel + non expediees au
    # taux declare) contre le break even par livree. Sous une livraison
    # attendue : pas encore assez de donnees, jamais une perte.
    # =====================================================================
    rb = break_even(6900, 2300, 100, 0, 0, 400, 0.60, 0.70)
    bpc, bpconf, bpl = rb["par_commande"], rb["par_confirmee"], rb["par_livree"]
    ok &= _essai("le break even par livree est juste (4328,57)",
                 abs(bpl - 4328.571) < 0.01, str(bpl))
    t_site = lecture(15300, 30, 20, bpc, mode="site", be_par_confirmee=bpconf,
                     jour=3, base_test=base_du_test("test", 20))
    t_msg = lecture(15300, 0, 20, bpc, mode="message", messages=40,
                    be_par_confirmee=bpconf, jour=3,
                    base_test=base_du_test("test", 20))
    ok &= _essai("sans stock, site ET message : 15300 / 20 confirmees = 765 "
                 "contre le break even par confirmee",
                 all(abs(x["cout_par_commande"] - 765.0) < 0.01
                     and abs(x["repere"] - bpconf) < 0.01
                     and x["stock"] == "test" for x in (t_site, t_msg)),
                 "%s / %s" % (t_site.get("cout_par_commande"), t_msg.get("cout_par_commande")))
    ok &= _essai("une mission d'avant, sans reponse stock, vaut « test »",
                 lecture(15300, 30, 20, bpc, mode="site", be_par_confirmee=bpconf,
                         jour=3)["stock"] == "test")
    bs = base_du_test("stock", 20, livrees=4, expediees=14, en_route=7,
                      taux_livraison_declare=0.70)
    ok &= _essai("avec stock : 4 livrees + 7 en route x 0,3 = 2,1 + 6 non "
                 "expediees x 0,7 = 4,2 -> 10,3",
                 abs(bs["volume"] - 10.3) < 1e-9, str(bs["volume"]))
    ok &= _essai("les retours seuls donnent la meme base que les colis en route",
                 base_du_test("stock", 20, 4, 14, None, 3, 0.70)["volume"]
                 == bs["volume"])
    ok &= _essai("sept colis en route comptent 2,1 (et non 2)",
                 attente_en_route(7) == 2.1, str(attente_en_route(7)))
    s_site = lecture(15300, 30, 20, bpc, mode="site", be_par_confirmee=bpconf,
                     jour=3, base_test=bs, be_par_livree=bpl)
    s_msg = lecture(15300, 0, 20, bpc, mode="message", messages=40,
                    be_par_confirmee=bpconf, jour=3, base_test=bs,
                    be_par_livree=bpl)
    ok &= _essai("avec stock, site ET message : 15300 / 10,3 contre le break "
                 "even par LIVREE",
                 all(abs(x["cout_par_commande"] - 15300 / 10.3) < 0.01
                     and abs(x["repere"] - bpl) < 0.01 for x in (s_site, s_msg)),
                 "%s" % s_site.get("cout_par_commande"))
    tout_route = base_du_test("stock", 14, 0, 14, 14, None, 0.70)
    ok &= _essai("14 colis en route sur 14 valent 4,2, jamais 14 : un colis en "
                 "route n'est jamais compte livre",
                 abs(tout_route["volume"] - 4.2) < 1e-9, str(tout_route["volume"]))
    b09 = base_du_test("stock", 3, 0, 3, 3, None, 0.70)
    l09 = lecture(9000, 12, 3, bpc, mode="site", be_par_confirmee=bpconf,
                  jour=3, base_test=b09, be_par_livree=bpl)
    ok &= _essai("3 en route, rien livre, tout expedie : base 0,9 -> PAS "
                 "ENCORE ASSEZ DE DONNEES, jamais une perte",
                 b09["volume"] == 0.9 and l09["decision"] == "DONNEES_INSUFFISANTES"
                 and l09["cout_par_commande"] is None,
                 "%s %s" % (b09["volume"], l09["decision"]))
    b10 = base_du_test("stock", 4, 0, 3, 3, None, 0.10)
    l10 = lecture(9000, 12, 4, bpc, mode="site", be_par_confirmee=bpconf,
                  jour=3, base_test=b10, be_par_livree=bpl)
    ok &= _essai("0,9 en route + 0,1 a expedier = UNE livraison : on juge "
                 "(9000 DA), pas « pas assez »",
                 b10["volume"] == 1.0 and l10["cout_par_commande"] == 9000.0,
                 "%r %s" % (b10["volume"], l10["decision"]))
    b0 = base_du_test("stock", 10, 0, 10, None, 10, 0.70)
    l0 = lecture(9000, 12, 10, bpc, mode="site", be_par_confirmee=bpconf,
                 jour=3, base_test=b0, be_par_livree=bpl)
    ok &= _essai("base EXACTEMENT nulle (tout revenu) : reste une PERTE",
                 b0["volume"] == 0 and l0["decision"] == "PERTE_LOURDE",
                 l0["decision"])
    ok &= _essai("au deuxieme jour, avec stock aussi : TROP TOT",
                 lecture(15300, 30, 20, bpc, mode="site", jour=2, base_test=bs,
                         be_par_livree=bpl)["decision"] == "TROP_TOT")
    for nom, args in (("plus d'expediees que de confirmees", ("stock", 5, 0, 6, 0, None, 0.7)),
                      ("plus de livrees que d'expediees", ("stock", 10, 7, 6, 0, None, 0.7)),
                      ("plus de colis en route que de partis", ("stock", 10, 2, 6, 5, None, 0.7)),
                      ("en route et retours qui ne collent pas", ("stock", 10, 2, 6, 2, 1, 0.7)),
                      ("ni en route ni retours", ("stock", 10, 2, 6, None, None, 0.7)),
                      ("non expediees sans taux declare", ("stock", 10, 2, 6, 4, None, 0.0)),
                      ("une reponse inconnue", ("oui", 10))):
        ok &= _essai("refuse : %s" % nom, _leve_ici(base_du_test, *args))
    ok &= _essai("avec stock, sans break even par livree : refuse",
                 _leve_ici(lecture, 9000, 12, 10, bpc, "", "site", 0, bpconf, 3, bs, None))
    for vu in (t_site, t_msg, s_site, s_msg, l09, l0, l10):
        ok &= _essai("la lecture (%s, %s) passe les lois" % (vu["stock"], vu["decision"]),
                     not controle_affichage(vue_lecture(vu)),
                     str(controle_affichage(vue_lecture(vu))[:1]))
    v09 = vue_lecture(l09)
    ok &= _essai("l'ecran de la base 0,9 dit qu'on ne juge pas a la perte",
                 "ما نحكموش بالخسارة" in v09 and "تخسر" not in v09.replace("بالخسارة", ""))
    ok &= _essai("livraison_prudente ne bouge pas : 7 en route + 4 = 6, 3 + 0 = 0",
                 livraison_prudente(7, 4) == 6 and livraison_prudente(3, 0) == 0)
    ps = porte_scaling(20, 30, 4, 14, 30, 900.0, 1200.0, retours=3)
    ok &= _essai("la porte du scaling ne bouge pas : 43,57 %, seul bloquant les colis livres",
                 abs(ps["taux_livraison"] - 0.4357) < 1e-9 and ps["bloquants"] == ["colis livres"],
                 "%s %s" % (ps["taux_livraison"], ps["bloquants"]))

    print(BARRE)
    print("  TOUT EST BON." if ok else "  QUELQUE CHOSE NE VA PAS. NE PAS UTILISER.")
    print(BARRE)
    return 0 if ok else 1


# ===========================================================================
# 12. LA LIGNE DE COMMANDE
# ===========================================================================

def main():
    p = argparse.ArgumentParser(add_help=True,
                                description="ecom manita — agent testing")
    p.add_argument("--installer", action="store_true")
    p.add_argument("--verifier", action="store_true")
    p.add_argument("--budget-creux", action="store_true",
                   help="le budget entre le test et le lot : le stock donne le budget")
    p.add_argument("--lot", default="", help='le lot decoupe : "noir standard:37,rouge standard:23"')
    p.add_argument("--demande", default="", help='les confirmees par reference : "noir standard:48,rouge standard:21"')
    p.add_argument("--en-attente", type=int, default=0, help="confirmees qui attendent deja le lot")
    p.add_argument("--jours-creux", type=int, default=2)
    p.add_argument("--cout-commande", type=float, default=0.0, help="en USD, ce qu'a coute une commande au test")
    p.add_argument("--budget-test", type=float, default=0.0, help="en USD par jour, le budget du test")
    p.add_argument("--plancher", type=float, default=5.0)
    p.add_argument("--porte", action="store_true",
                   help="la porte du scaling : cinq conditions")
    p.add_argument("--livrees", type=int, default=0)
    p.add_argument("--expediees", type=int, default=0)
    p.add_argument("--en-route", type=int, default=None,
                   help="les colis partis qui ne sont ni livres ni revenus")
    p.add_argument("--retours", type=int, default=-1,
                   help="les colis partis et REVENUS. Sans eux ils se "
                        "comptent comme encore en route, a trois sur dix de "
                        "chance d'arriver, et le taux de livraison sort trop beau")
    p.add_argument("--stock", default="",
                   help="--porte : le nombre de pieces restantes. --lecture : "
                        "test (تيست برك) ou stock (السلعة عندي), la reponse "
                        "« السلعة » du client : elle choisit la base du verdict")
    p.add_argument("--cpa-livree", type=float, default=None)
    p.add_argument("--seuil-livree", type=float, default=None)

    p.add_argument("--break-even", action="store_true")
    p.add_argument("--prix", type=float, default=0.0)
    p.add_argument("--cout-produit", type=float, default=0.0)
    p.add_argument("--emballage", type=float, default=0.0)
    p.add_argument("--livraison", type=float, default=0.0)
    p.add_argument("--frais-cod", type=float, default=0.0)
    p.add_argument("--cout-retour", type=float, default=0.0)
    p.add_argument("--taux-confirmation", type=float, default=0.0)
    p.add_argument("--taux-livraison", type=float, default=0.0)
    p.add_argument("--commandes", type=int, default=0)
    p.add_argument("--confirmees", type=int, default=0)

    p.add_argument("--budget", action="store_true")
    p.add_argument("--videos", type=int, default=0)
    p.add_argument("--devise", default="USD")
    p.add_argument("--passage-ecrire", action="store_true",
                   help="ecrit test-en-cours.json pour les agents suivants")
    p.add_argument("--json", default="",
                   help="le contenu du fichier de passage, en JSON")
    p.add_argument("--structure", default="",
                   help="0.4.2 : ABO, CBO ou auto (auto = la regle du fichier : "
                        "--budget-jour-usd et --lead-max-usd)")
    p.add_argument("--budget-jour-usd", type=float, default=0.0,
                   help="0.4.2 : le budget du jour ECRIT par le client, en USD")
    p.add_argument("--lead-max-usd", type=float, default=0.0,
                   help="0.4.2 : le plus haut cout par lead de la porte, en USD")
    p.add_argument("--un-seul-ad-set", action="store_true",
                   help="toutes les annonces dans UN ad set : un seul budget, "
                        "une annonce par angle")
    p.add_argument("--taux-euro", type=float, default=0.0, help="le taux de l'euro du client (compte publicitaire en EUR)")
    p.add_argument("--taux-dinar", type=float, default=0.0,
                   help="combien de dinars pour une unite de la devise du "
                        "compte — le taux REEL du client, pas un cours")
    p.add_argument("--plafond", type=float, default=0.0,
                   help="ce que le client a declare pouvoir payer par jour")
    p.add_argument("--plafond-devise", default="",
                   help="la monnaie de --plafond : DZD, USD ou EUR. OBLIGATOIRE avec --plafond")
    p.add_argument("--controler", default="",
                   help="fait passer un texte dans les lois de la langue")

    p.add_argument("--noms", action="store_true")
    p.add_argument("--boutique", default="")
    p.add_argument("--modele", default="")
    p.add_argument("--date", default="")
    p.add_argument("--videos-ids", default="")
    p.add_argument("--lien", default="")
    p.add_argument("--nom-modele", default="",
                   help="23/10/2026 : le nom du modele, mis dans utm_campaign devant la cle")

    p.add_argument("--lecture", action="store_true")
    p.add_argument("--spend", type=float, default=0.0)
    p.add_argument("--incident", default="")
    p.add_argument("--mode", default="",
                   help="site ou message. site : la cliente remplit le "
                        "formulaire de la page. message : elle ecrit sur "
                        "Messenger ou en direct sur Instagram, et c'est la "
                        "fille de la confirmation qui cree la commande.")
    p.add_argument("--messages", type=int, default=0,
                   help="mode message : le nombre de discussions ouvertes, "
                        "celui que Meta affiche")
    p.add_argument("--jour", type=int, default=0,
                   help="le nombre de jours depuis le lancement. Sert a "
                        "refuser de juger trop tot.")
    p.add_argument("--voir-mode", action="store_true", dest="voir_mode",
                   help="ce qu'il faut creer dans Meta pour ce mode")

    p.add_argument("--question-format", action="store_true")
    p.add_argument("--wilayas", action="store_true")

    a = p.parse_args()

    global DEVISE_COMPTE, TAUX_DINAR, TAUX_EURO
    if a.devise and a.devise.upper() in MONNAIES:
        DEVISE_COMPTE = a.devise.upper()
    # « الطالب 1.0 » : le taux du client sert AUSSI aux comptes en dinars (le budget en dollars se convertit à SON taux)
    if a.taux_euro and a.taux_euro > 0:
        TAUX_EURO = a.taux_euro
    if a.taux_dinar and a.taux_dinar > 0:
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

    if a.budget_creux:
        try:
            b = budget_creux(lire_par_reference(a.lot), lire_par_reference(a.demande), a.en_attente,
                             a.jours_creux, a.cout_commande, a.taux_confirmation, a.budget_test, a.plancher)
        except (ValueError, KeyError) as e:
            print("REFUS : %s" % e)
            return 2
        montrer(vue_creux(b))
        print("")
        print("--budget-creux-usd %.2f" % b["budget"])
        return 0

    if a.porte:
        # --stock garde ici son sens de toujours : les pieces restantes
        try:
            a.stock = int(a.stock or 0)
        except ValueError:
            print("REFUS : avec --porte, --stock est le nombre de pieces")
            print("restantes, pas %r." % a.stock)
            return 2
        if a.seuil_livree is None:
            print("REFUS : il manque --seuil-livree.")
            print("C'est le cout MAXIMUM que supporte un colis livre, en")
            print("dinars : le break even par livree. Il sort de")
            print("--break-even, ou du Coach avec les VRAIS taux.")
            print("Sans lui la porte ne peut pas juger la rentabilite, et")
            print("une porte qui saute un controle n'est plus une porte.")
            print("Exemple :")
            print("   python3 %s --porte --commandes 100 --confirmees 60 \\"
                  % os.path.basename(__file__))
            print("      --expediees 50 --livrees 25 --retours 5 --stock 30 \\")
            print("      --cpa-livree 900 --seuil-livree 1200")
            return 2
        # LE DOUBLE COMPTE, REPARE LE 21/09/2026. On gonflait les livrees
        # avec la regle des trois sur dix, et la porte la rappliquait une
        # seconde fois sur le nombre deja gonfle : le taux de livraison ne
        # pouvait plus descendre sous trente pour cent, meme avec ZERO colis
        # arrive. Le pire cas se compte UNE fois, dans porte_scaling.
        # --en-route et --retours disent la meme chose autrement : un colis
        # parti est soit livre, soit revenu, soit encore en route.
        retours = a.retours
        # 21/09/2026 : sans --retours ni --en-route, tout colis parti et non
        # arrive etait compte comme "encore en route" et credite a trois sur
        # dix. La porte s ouvrait sur un modele qui livre un colis sur sept.
        # Comme chez le Coach et chez Scaling : un zero se DIT.
        if a.retours < 0 and not a.en_route and a.expediees > a.livrees:
            print("REFUS : il faut --retours, meme a zero.")
            print("Tu as %d colis partis et %d arrives. Sans savoir combien"
                  % (a.expediees, a.livrees))
            print("sont DEJA REVENUS, je compterais les %d autres comme"
                  % (a.expediees - a.livrees))
            print("encore en route, et le taux de livraison sortirait trop")
            print("beau. Compte les retours dans Tassyir, ou demande-les au")
            print("client. Tu peux aussi donner --en-route a la place.")
            return 2
        if a.en_route:
            deduit = a.expediees - a.livrees - a.en_route
            if deduit < 0:
                print("REFUS : --en-route ne tient pas debout.")
                print("Tu donnes %d colis en route, et il n'y a que %d colis"
                      % (a.en_route, a.expediees - a.livrees))
                print("partis qui ne sont pas encore arrives. Un colis en")
                print("route est un colis parti, ni livre ni revenu.")
                return 2
            if a.retours > 0 and a.retours != deduit:
                print("REFUS : --en-route et --retours ne collent pas avec")
                print("--expediees et --livrees. Un colis parti est soit")
                print("livre, soit revenu, soit encore en route.")
                print("Avec %d expediees, %d livrees et %d en route, les"
                      % (a.expediees, a.livrees, a.en_route))
                print("retours font %d, pas %d." % (deduit, a.retours))
                return 2
            retours = deduit
        try:
            r = porte_scaling(a.confirmees, a.commandes, a.livrees, a.expediees,
                              a.stock, a.cpa_livree, a.seuil_livree,
                              max(0, retours))
        except ValueError as e:
            print("REFUS : %s" % e)
            print("Les chiffres ne tiennent pas debout. On ne calcule pas un")
            print("taux sur des nombres impossibles : il ouvrirait une porte")
            print("qui doit rester fermee.")
            return 2
        valeurs = {
            "colis livres": "%d / %d" % (a.livrees, PORTE_LIVREES),
            "stock": "%d" % a.stock,
        }
        if a.cpa_livree is not None and a.seuil_livree is not None:
            valeurs["rentabilite"] = "%.0f / %.0f" % (a.cpa_livree, a.seuil_livree)
        montrer(vue_porte(r, valeurs))
        # 21/09/2026 : l ecran disait bien PORTE FERMEE et le code de sortie
        # rendait zero. Un agent qui lit le code au lieu de la ligne faisait
        # produire un lot sur une porte fermee. Le code dit la meme chose
        # que l ecran, comme chez le Coach et chez Scaling.
        return 0 if r["ouverte"] else 3

    if a.question_format:
        montrer(vue_question_format())
        return 0

    if a.wilayas:
        montrer(vue_wilayas())
        return 0

    if a.break_even:
        tc = a.taux_confirmation
        fourch = None
        commandes = None
        if (a.commandes >= COMMANDES_MINI_POUR_LIRE and a.confirmees > 0):
            # on ne remplace le taux declare que s'il y a VRAIMENT une mesure
            tc = float(a.confirmees) / a.commandes
            commandes = a.commandes
            try:
                fourch = fourchette_break_even(a.commandes, a.confirmees, a.prix,
                                               a.cout_produit, a.emballage, a.livraison,
                                               a.frais_cod, a.cout_retour, a.taux_livraison)
            except ValueError as e:
                print("REFUS : %s" % e)
                return 2
        elif a.commandes >= COMMANDES_MINI_POUR_LIRE and a.confirmees == 0:
            montrer("\n".join([
                BARRE,
                "  حتى طلبية ما تأكّدت", BARRE, "",
                "  عدد الطلبيات", "      %d" % a.commandes, "",
                "  عدد لي تأكّدو", "      0", "",
                "  ما كاين والو نقيسو. النسبة تولّي زيرو.",
                "  المشكل ماشي في الحساب — المشكل في الكرياتيف،",
                "  ولا في الصفحة، ولا في الثمن. صلّح قبل.", BARRE]))
            if tc <= 0:
                return 2
        if tc <= 0:
            print("Il manque le taux de confirmation (--taux-confirmation),")
            print("ou bien --commandes et --confirmees pour le mesurer.")
            return 2
        try:
            r = break_even(a.prix, a.cout_produit, a.emballage, a.livraison,
                           a.frais_cod, a.cout_retour, tc, a.taux_livraison)
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
        montrer(vue_break_even(r, tc, a.taux_livraison, fourch, commandes))
        mini = {}
        if not r["passe"]:
            pm = prix_minimum(a.cout_produit, a.emballage, a.livraison,
                              a.frais_cod, a.cout_retour, a.taux_livraison)
            lm = livraison_minimum(a.prix, a.cout_produit, a.emballage,
                                   a.livraison, a.frais_cod, a.cout_retour)
            if pm and lm:
                montrer(vue_sortie(pm, lm))
            mini = {"prix": pm, "livraison": lm}
        sortie_json("break_even", dict(r, taux_confirmation=tc,
                                       taux_livraison=a.taux_livraison,
                                       minimums=mini))
        return 0

    if a.passage_ecrire:
        if not a.json:
            print("REFUS : il faut --json avec le contenu du fichier.")
            print("Sept champs obligatoires, sinon les agents suivants")
            print("refuseront de travailler :")
            for c in ("cle", "date_lancement", "ad_account_id", "product_id",
                      "devise", "couts", "break_even_par_commande_da",
                      "mode"):
                print("   %s" % c)
            return 2
        try:
            d = json.loads(a.json)
        except ValueError as e:
            print("REFUS : ce n'est pas du JSON valide : %s" % e)
            return 2
        if not isinstance(d, dict):
            print("REFUS : le contenu doit etre un objet JSON.")
            return 2
        manque = [c for c in ("cle", "date_lancement", "ad_account_id",
                              "product_id", "devise", "couts",
                              "break_even_par_commande_da", "mode")
                  if not d.get(c)]
        if manque:
            print("REFUS : il manque %s." % ", ".join(manque))
            print("Les agents suivants refusent le fichier sans eux.")
            if "mode" in manque:
                print("mode : site ou message. Le Coach et le Scaling lisent")
                print("les jours autrement selon le mode ; sans lui ils")
                print("appliqueraient la regle du site a un test message.")
            print("ad_account_id : le client le choisit, tu ne le devines pas.")
            print("product_id : il est dans produit-tassyir.json, ecrit par")
            print("l'agent page produit.")
            return 2
        couts = d.get("couts")
        if d.get("mode") not in MODES_TEST:
            print("REFUS : mode inconnu : %s" % d.get("mode"))
            print("Les deux modes sont : %s." % " et ".join(MODES_TEST))
            return 2
        if not isinstance(couts, dict):
            print("REFUS : « couts » doit etre un objet avec les cinq couts.")
            return 2
        manque_c = [c for c in ("prix", "cout_produit", "emballage",
                                "livraison", "frais_cod", "cout_retour")
                    if couts.get(c) is None]
        if manque_c:
            print("REFUS : il manque dans « couts » : %s." % ", ".join(manque_c))
            print("Meme a zero. Oublies, ils tombent a zero en silence chez")
            print("l'agent suivant et son break even sort trop haut.")
            return 2
        chemin = ecrire_passage(os.getcwd(), d)
        print(BARRE)
        print("  FICHIER DE PASSAGE ECRIT")
        print(BARRE)
        print("  %s" % chemin)
        print("  Les agents Coach et Scaling le cherchent tout seuls, ici et")
        print("  dans les dossiers voisins. Le client n'a rien a deplacer.")
        print(BARRE)
        return 0

    if a.voir_mode:
        mode = (a.mode or "").strip().lower()
        if mode not in MODES_TEST:
            print("REFUS : il faut --mode site ou --mode message.")
            return 2
        montrer(vue_mode(mode))
        return 0

    if a.controler:
        fautes = controle_affichage(a.controler)
        if fautes:
            print("REFUS — ce texte ne passe pas :")
            for i, quoi, ligne in fautes:
                print("   ligne %d — %s" % (i, quoi))
                print("      %s" % ligne)
            return 1
        print("[OK] ce texte passe les lois de la langue.")
        print("     Attention : ceci ne controle QUE la langue.")
        print("     Les neuf controles du texte de vente restent a faire.")
        return 0

    if a.budget:
        refus = controle_plafond(a.plafond, a.plafond_devise)
        if refus:
            for ligne in refus:
                print(ligne)
            return 2
        try:
            pl = plafond_en_dollars(a.plafond, a.plafond_devise)
            st, videos = structure_cli(a, a.videos)
            b = budget(videos, a.devise, pl, a.un_seul_ad_set,
                       st, a.budget_jour_usd)
            montrer(vue_budget(b))
            sortie_json("budget", b)
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
        return 0

    if a.noms:
        ids = [v for v in a.videos_ids.split(",") if v.strip()]
        if not ids:
            print("Il manque --videos-ids")
            return 2
        refus = controle_plafond(a.plafond, a.plafond_devise)
        if refus:
            for ligne in refus:
                print(ligne)
            return 2
        # SANS LE PRIX, LA CLE EST FAUSSE. Elle se fabrique SUR le prix : a
        # zero, deux tests du meme modele a deux prix differents portent la
        # MEME cle, le garde-fou anti-doublon ne voit rien, et le client
        # paie deux campagnes qui s'encherissent l'une contre l'autre. Le
        # nom de la campagne annoncerait « 0DA » par-dessus le marche.
        if a.prix <= 0:
            print("REFUS : il manque --prix.")
            print("La cle anti-doublon se fabrique SUR le prix. A zero, deux")
            print("tests du meme modele a deux prix differents portent la")
            print("MEME cle : le doublon passe, et il paie deux campagnes qui")
            print("s'encherissent l'une contre l'autre dans l'enchere de Meta.")
            print("Et le nom de la campagne annoncerait « 0DA ».")
            return 2
        # ON NE DEVINE PAS LE MODE ICI NON PLUS. --lecture refuse sans lui ;
        # --noms doit refuser pareil, et pour une raison de plus : en mode
        # message il n'y a PAS de lien, donc les cinq liens marques
        # n'existent pas. Les fabriquer, c'est montrer au client cinq liens
        # qui ne meneront nulle part.
        mode = (a.mode or "").strip().lower()
        if not mode:
            print("REFUS : il manque --mode.")
            print("   site      la cliente remplit le formulaire de la page")
            print("   message   elle ecrit sur Messenger ou en direct sur")
            print("             Instagram, et la fille de la confirmation")
            print("             cree la commande a la main")
            print("En mode message il n'y a PAS de lien : les cinq liens")
            print("marques n'existent pas. Les montrer serait mentir.")
            print("Demande-lui lequel il lance. Ne le devine pas.")
            return 2
        if mode not in MODES_TEST:
            print("REFUS : mode inconnu : %s" % mode)
            print("Les deux modes sont : %s." % " et ".join(MODES_TEST))
            return 2
        try:
            # le plafond s'applique ICI AUSSI : sinon --budget refuse et
            # --noms accepte, et c'est --noms qu'on montre au client.
            # ET --un-seul-ad-set voyage avec lui : sans ce quatrieme
            # argument, --noms refusait en conseillant le drapeau qu'on
            # venait de lui passer, et le nom de la campagne annoncait
            # vingt dollars pour sept dollars reellement depenses.
            st, _ = structure_cli(a, len(ids), garder=True)
            b = budget(len(ids), a.devise,
                       plafond_en_dollars(a.plafond, a.plafond_devise),
                       a.un_seul_ad_set, st, a.budget_jour_usd)
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
        n = noms(a.boutique, a.modele, a.prix, a.date, ids, a.devise, b["total_usd"])
        # 23/10/2026 : utm_campaign = <nom du modele>-<CLE> (la cle reste la cle)
        n["etiquette_campagne"] = etiquette_campagne(n["cle"], a.nom_modele, a.modele)
        montrer(vue_noms(n, a.lien or None, mode))
        # 0.4.2 : LE LIEN CACHE, le meme pour les cinq angles (liens[i % 5]
        # reste lu par le bureau) ; la cle reste dans le NOM de la campagne
        lc = lien_suivi(a.lien) if (mode == "site" and a.lien) else ""
        sortie_json("noms", dict(n, mode=mode, budget=b, lien_suivi=lc,
                                 ligne_suivi=LIGNE_SUIVI if lc else "",
                                 liens=([lc] * 5 if lc else [])))
        if b["un_seul_ad_set"]:
            print("")
            print("UN SEUL AD SET : tu ne crees QU'UN ad set — celui de la")
            print("premiere ligne — et tu mets les %d annonces DEDANS, une"
                  % b["annonces"])
            print("par angle. Les autres lignes servent a nommer les")
            print("ANNONCES, pas a creer d'autres ad sets.")
            print("Budget du jour : %.2f USD au total, pas %.2f."
                  % (b["total_usd"], BUDGET_TROIS_ET_PLUS * len(ids)
                     if len(ids) > 2 else BUDGET_UNE_OU_DEUX * len(ids)))
        return 0

    if a.lecture:
        mode = (a.mode or "").strip().lower()
        if not mode:
            # ON NE DEVINE PAS LE MODE. Il porte les seuils pour juger ;
            # la base (le denominateur) vient de --stock.
            print("REFUS : il manque --mode.")
            print("Deux modes, et ils ne se lisent pas pareil :")
            print("   site      la cliente remplit le formulaire de la page")
            print("   message   elle ecrit sur Messenger ou en direct sur")
            print("             Instagram, et la fille de la confirmation")
            print("             cree la commande a la main")
            print("Demande-lui lequel il a lance. Ne le devine pas : le mode")
            print("change les seuils pour juger (la base vient de --stock).")
            print("Pour voir ce que chacun demande :")
            print("   python3 %s --voir-mode --mode site"
                  % os.path.basename(__file__))
            return 2
        if mode not in MODES_TEST:
            print("REFUS : mode inconnu : %s" % mode)
            print("Les deux modes sont : %s." % " et ".join(MODES_TEST))
            return 2
        # ON NE DEVINE PAS LE JOUR NON PLUS. Sans lui — ou a zero — le
        # garde-fou « trop tot » sautait en silence et l'outil rendait un
        # verdict de perte des le premier jour, sur une cohorte qui n'avait
        # pas fini de parler. Le jour commence a UN.
        if a.jour <= 0:
            print("REFUS : il manque --jour.")
            print("C'est le nombre de jours depuis le lancement, et il")
            print("commence a UN, pas a zero.")
            print("Sans lui, le garde-fou « trop tot » saute et l'outil")
            print("rend un verdict de perte sur une cohorte qui n'a pas")
            print("fini de parler. En mode site on juge au jour %d, en mode"
                  % JOURS_LECTURE["site"])
            print("message au jour %d." % JOURS_LECTURE["message"])
            print("Demande-lui quel jour on est. Ne le devine pas.")
            return 2
        if mode == "message" and not a.messages and not a.incident:
            print("REFUS : en mode message il faut --messages.")
            print("C'est le nombre de discussions ouvertes, celui que Meta")
            print("affiche. Sans lui on ne sait pas si le modele fait ecrire")
            print("ou s'il ne touche personne, et les deux se corrigent")
            print("autrement.")
            return 2
        # LA BASE, REGLE DU VENDEUR (08/10/2026) : la reponse « السلعة ».
        stock = (a.stock or "").strip().lower()
        if stock not in STOCK_CHOIX:
            print("REFUS : il faut --stock test ou --stock stock.")
            print("C'est la reponse « السلعة » du client :")
            print("   test    تيست برك      on juge sur les confirmees")
            print("   stock   السلعة عندي   on juge sur les livraisons attendues")
            print("           (--livrees, --expediees, --en-route ou --retours)")
            print("Une mission d'avant, sans reponse, vaut test. Ne devine pas.")
            return 2
        try:
            bt = base_du_test(stock, a.confirmees, a.livrees, a.expediees,
                              a.en_route, a.retours if a.retours >= 0 else None,
                              a.taux_livraison)
        except ValueError as e:
            print("REFUS : %s" % e)
            print("Les chiffres ne tiennent pas debout : on ne juge pas un")
            print("test sur des nombres impossibles.")
            return 2
        tc = a.taux_confirmation or (float(a.confirmees) / a.commandes if a.commandes else 0)
        if tc <= 0 and not a.incident:
            print("Il manque --commandes et --confirmees")
            print("En mode message, --commandes vaut les confirmees : la")
            print("commande n'existe qu'une fois prise dans la discussion.")
            return 2
        try:
            r = break_even(a.prix, a.cout_produit, a.emballage, a.livraison,
                           a.frais_cod, a.cout_retour, max(tc, 0.01), a.taux_livraison)
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
        # LE TAUX DU CLIENT SERT AU CALCUL, pas seulement a l'affichage.
        # REPARE LE 21/09/2026 : on convertissait la depense avec le cours
        # de la table pendant qu'on AFFICHAIT le sien. A un taux reel de,
        # par exemple, deux cent quatre-vingts dinars, une depense comptee a
        # deux cent cinquante-cinq rentre dix pour cent trop bas, et le verdict sort PERTE_LEGERE
        # la ou c'est PERTE_LOURDE. Le taux qu'il donne est celui que sa
        # banque lui prend : c'est le seul vrai.
        devise_spend = (a.devise or "USD").upper()
        taux_spend = vers_dinars(devise_spend)
        spend_da = a.spend * taux_spend
        if stock == "stock" and not r["par_livree"]:
            print("REFUS : le break even par livree est nul : il faut un vrai")
            print("--taux-livraison (la livraison declaree du client).")
            return 2
        lec = lecture(spend_da, a.commandes, a.confirmees, r["par_commande"],
                      a.incident, mode, a.messages, r["par_confirmee"],
                      a.jour, bt, r["par_livree"])
        montrer(vue_lecture(lec))
        sortie_json("lecture", dict(lec, spend_da=spend_da,
                                    be_par_commande=r["par_commande"],
                                    be_par_confirmee=r["par_confirmee"],
                                    be_par_livree=r["par_livree"]))
        return 0

    p.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
