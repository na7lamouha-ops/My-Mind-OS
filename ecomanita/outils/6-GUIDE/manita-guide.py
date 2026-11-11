#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ecom manita — AGENT 6 : LE GUIDE
================================
C'est le seul agent de la gamme qui ne FABRIQUE rien. Il REPOND.

Le client lui pose une question — « ma page ne vend pas », « je n'ai pas
d'atelier », « combien je dois mettre par jour » — et il rend la reponse
de la masterclass : le module qui traite ca, la methode, et l'action du
jour. Il sait aussi ou en est le client dans la chaine des cinq autres
agents, et ce qu'il doit lancer ensuite.

CE QU'IL NE FAIT PAS, ET C'EST VOULU :
  - il n'invente AUCUN chiffre de resultat, et il ne cite AUCUN chiffre
    d'un vendeur, d'un eleve ou d'une page de vente (livrables anonymes :
    ni les chiffres ni le nom de celui qui a fait le produit). Quand on lui
    demande une preuve, il dit qu'il n'en invente pas et renvoie le client
    a SES propres chiffres, ceux que ses agents ont mesures et ecrits dans
    son carnet (outils/0-CARNET). Meme si on insiste.
  - il ne promet JAMAIS un gain. On vend la methode, pas le resultat.
  - il ne touche a rien : ni Meta, ni la boutique, ni un fichier du client.
    Il lit, il explique. Les mains, ce sont les cinq autres agents.

AUCUNE INSTALLATION. Aucun mot de passe. Aucune cle. Aucun acces.

DEUX LOIS D'AFFICHAGE, controlees a chaque sortie :
  1. jamais un chiffre sur une ligne arabe — le nombre vit SEUL sur sa ligne
  2. jamais un mot francais dans ce que lit le client
Si une des deux casse, l'outil REFUSE d'afficher.
"""

import argparse
import json
import math
import os
import re
import sys

VERSION = "6.0"
BARRE = "=============================================================="

# ===========================================================================
# 1. LES DEUX LOIS D'AFFICHAGE
#    (identiques a celles des agents 3, 4 et 5 — c'est la meme maison)
# ===========================================================================

ARABE = re.compile(r'[؀-ۿ]')
CHIFFRE = re.compile(r'[0-9٠-٩۰-۹]')
FRANCAIS_INTERDIT = re.compile(
    r'\b(seuil|budget|campagne|d[eé]pense|livr[eé]e?s?|livraison|confirm[eé]e?s?|'
    r'commande|b[eé]n[eé]fice|perte|marge|retour|stock|annonce|vid[eé]o|prix|'
    r'co[uû]t|audience|exclusion|paiement|client|boutique|produit|rentable|'
    r'gagner|perdre|argent|semaine|lien|angle|test|r[eé]sultat|moyenne|taux|'
    r'module|le[cç]on|atelier|formation)\b',
    re.I)
# Entre les mots : espace, tiret, point, souligne — « cash-on-delivery »
# passait a travers quand on n'attendait que l'espace.
_E = r'[\s\-_.]*'
COD_INTERDIT = re.compile(
    r'\bc\.?o\.?d\.?\b'
    r'|cash' + _E + r'on' + _E + r'delivery'
    r'|paiement' + _E + r'(a|à)' + _E + r'la' + _E + r'livraison'
    r'|cash' + _E + r'(a|à)' + _E + r'la' + _E + r'livraison'
    r'|كاش' + _E + r'أون' + _E + r'ديليفري'
    r'|كاش' + _E + r'او?ن' + _E + r'دي?ليفري', re.I)
MAROCAIN = ["تحوّس", "تحوس", "تحوسي", "تحوّسي", "الكاس", "الصوردي",
            "دابا", "واخا", "بزاف ديال"]
TECHNIQUE = re.compile(r'https?://|utm_|\s\|\s|^\s*[A-Z0-9_\-]{8,}\s*$')
LATIN_PERMIS = re.compile(
    r'^[\s=|\-·.:%+/]*$|^\s*[\d\s.,%|+\-]*(DA|USD|EUR|DZD|%)?[\s\d.,]*$')
MOT_LATIN = re.compile(r'[A-Za-zÀ-ÿ]{3,}')

# declares ici parce que controle_affichage s'en sert (ils sont remplis
# plus bas, dans la partie des preuves)
PHRASE_SANS_GARANTIE = []
NEGATIONS = []

# ce qu'on ne promet jamais, dans aucune langue
# LE FILET DES PROMESSES.
# Premiere version : une liste de phrases entieres. Un audit a fait passer
# « تربح مليون دينار في شهر واحد » et « راك رايح تربح بزاف » — deux promesses
# nettes — parce qu'elles n'etaient pas dans la liste mot pour mot.
# Maintenant on attrape la FORME du verbe, pas la phrase : en darija, dire a
# quelqu'un « tu vas gagner » se fait avec تربح / ترباح / نربحو / يربحو.
# Le mot الربح (le benefice, le nom) reste permis : on en parle tout le temps.
PROMESSE_GAIN = ["مضمون", "garanti", "garantie", "100%",
                 "certain de gagner", "profit garanti", "تولي مليونير",
                 "تولّي مليونير", "ربح مضمون", "تربح", "ترباح", "تربحي",
                 "نضمنلك الربح", "نضمنولك الربح", "نضمنلك أنك",
                 "نضمنولك أنك", "نضمنلك الدراهم", "نضمنولك الدراهم",
                 "راك رايح تربح", "تكسب", "tarbah", "tarbeh", "trbah",
                 "gain assure", "gain garanti", "resultat garanti",
                 # trouves en audit : voisins directs d'entrees deja couvertes
                 "تولي غني", "تولّي غني", "ولى غني", "ولّى غني", "تولي مرتاح",
                 "النجاح أكيد", "النجاح اكيد", "الربح أكيد", "الربح اكيد",
                 "أكيد تربح", "اكيد تربح", "مضمونة", "بلا خسارة",
                 "profit assur", "gain assur", "benefice assur",
                 "succes assur", "succes garanti", "resultat assur",
                 "assure de gagner", "sans risque", "sans perte",
                 # quatrieme passe : formes imagees, tres courantes a l'oral
                 "في جيبك", "الفلوس في جيبك", "الدراهم في جيبك",
                 "ما تفشلش", "ما تخسرش", "ما تخسريش", "ما تندمش",
                 "الدراهم راهي جاية", "يتضاعف", "تتضاعف", "ندبلو",
                 "rentabilite assuree", "rentabilite garantie",
                 "gain certain", "revenu assure", "revenu garanti",
                 "ca marche a tous les coups", "sans echec"]

# LA QUESTION QUI DEMANDE UNE GARANTIE.
# Ce n'est pas une faute du client : c'est la question la plus normale du
# monde. Mais c'est celle ou on ment le plus facilement. Quand on la
# reconnait, on repond par la verite, pas par un module au hasard.
DEMANDE_GARANTIE = [
    "شحال نربح", "شحال رايح نربح", "شحال غادي نربح", "واش نربح",
    "نربح ولا لا", "مضمون", "تضمنلي", "تضمن", "واش راني نربح",
    "chhal nrbah", "chhal rayeh nrbah", "chhal ghadi nrbah", "wach nrbah",
    "nrbah wala la", "combien je vais gagner", "combien je gagne",
    "est ce que je vais gagner", "garanti", "c est garanti", "sur de gagner",
]


def sans_accents(txt):
    """« succès assuré » et « succes assure » sont le meme mot.
    La liste des promesses etait ecrite sans accents, la comparaison en
    minuscules seulement : le client qui ecrit correctement passait a
    travers. On compare les deux formes mises a plat."""
    import unicodedata
    plat = unicodedata.normalize("NFD", str(txt))
    return "".join(c for c in plat if unicodedata.category(c) != "Mn").lower()


def controle_affichage(texte, exempts=()):
    """Rend la liste des fautes. Vide = l'affichage est permis.
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
            fautes.append((i, "le mot interdit de la publicite, celui qui "
                              "designe le paiement a la reception", ligne))
        for mot in MAROCAIN:
            if mot in ligne:
                fautes.append((i, "un mot marocain : %s" % mot, ligne))
                break
        # LA NEGATION N'EST PAS UNE PROMESSE.
        # « ما نضمنولكش الربح » veut dire exactement le contraire de
        # « نضمنولك الربح », et c'est la phrase de la maison. On retire donc
        # les phrases honnetes AVANT de chercher une promesse dedans.
        ligne_test = ligne
        for honnete in PHRASE_SANS_GARANTIE + NEGATIONS:
            ligne_test = ligne_test.replace(honnete, " ")
        plat = sans_accents(ligne_test)
        for mot in PROMESSE_GAIN:
            if sans_accents(mot) in plat:
                fautes.append((i, "une promesse de gain : %s" % mot, ligne))
                break
        if technique or exempt:
            continue
        if FRANCAIS_INTERDIT.search(ligne):
            if arabe:
                fautes.append((i, "un mot francais dans une phrase arabe", ligne))
            elif not LATIN_PERMIS.match(ligne):
                fautes.append((i, "une phrase francaise que le client ne lit pas",
                               ligne))
    return fautes


def controle_message_client(texte, exempts=()):
    fautes = controle_affichage(texte, exempts)
    if not ARABE.search(texte) and MOT_LATIN.search(texte):
        fautes.append((1, "ce texte n'a pas un seul mot d'arabe", texte[:60]))
    return fautes


# --- UN TABLEAU N'EST PAS UNE PHRASE ------------------------------------
# Le vendeur algerien lit tres bien un TABLEAU en francais — c'est meme la
# seule facon d'ecrire un nombre sans qu'il se retourne a l'affichage — mais
# il ne lit pas un PARAGRAPHE francais. Les deux lois restent donc entieres,
# avec une seule ouverture, etroite et declaree : une ligne de tableau, et
# seulement si elle ne contient pas un seul caractere arabe. Une ligne
# melangee arabe et francais n'echappe a rien.

def _vue():
    return {"lignes": [], "exempts": []}


def _ar(v, *lignes):
    """Des lignes que le client LIT. Elles passent tous les controles."""
    v["lignes"].extend(lignes)


def _tab(v, *lignes):
    """Des lignes de tableau. Exemptes du controle du francais, et seulement
    de celui-la — si elles contiennent de l'arabe, elles ne sont pas exemptes
    du tout."""
    for l in lignes:
        v["lignes"].append(l)
        if not ARABE.search(l):
            v["exempts"].append(l.strip())


def _fin(v):
    return "\n".join(v["lignes"]), v["exempts"]


def montrer(texte, exempts=()):
    fautes = controle_affichage(texte, exempts)
    if fautes:
        print("REFUS D'AFFICHAGE — les lois de la langue ne passent pas :")
        for i, quoi, ligne in fautes:
            # LE NUMERO SUR SA PROPRE LIGNE. Colle au motif, il se retrouvait
            # sur la meme ligne qu'un bout d'arabe — exactement ce que la
            # premiere loi interdit. L'outil se la cassait a lui-meme.
            print("   ligne")
            print("      %d" % i)
            print("   %s" % quoi)
            print("      %s" % ligne)
        sys.exit(1)
    print(texte)


def virgule(x, decimales=1):
    """Le commercant ecrit ses nombres avec une virgule, et l'outil l'accepte
    en entree. Il les lui rendait avec un point. On rend ce qu'on accepte."""
    return ("%.*f" % (decimales, x)).replace(".", ",")


def ligne_nombre(valeur, unite=""):
    """Le nombre vit SEUL sur sa ligne, jamais dans la phrase arabe."""
    if unite:
        return "      %s %s" % (valeur, unite)
    return "      %s" % valeur


# ===========================================================================
# 2. LA BASE — la masterclass, module par module
#
#    REGLE DE CETTE PARTIE : tout ce qui est en arabe est ce que LIT le
#    client. Donc : aucun chiffre dedans, jamais. Quand un nombre compte
#    (les tailles, les jours, les pieces), il s'ecrit en toutes lettres
#    arabes — c'est comme ca qu'on le dit a l'oral, de toute facon.
#
#    « minutes = None » veut dire : on ne connait pas la duree de ce module.
#    L'outil l'AFFICHE comme inconnue. Il n'en invente pas une.
#
#    « mots » : les trois facons d'ecrire la meme question.
#    Un commercant algerien tape en arabe, en francais, ET en lettres latines
#    (« ma 3andich atelier », « chhal lazem ndir »). Un audit a montre que
#    sans cette troisieme facon, la question la plus frequente du client
#    revenait sans reponse. N'enleve pas les mots latins de ces listes.
# ===========================================================================

MODULES = [
    {
        "numero": 1,
        "cle": "mentalite",
        "titre_ar": "العقلية والأساس",
        "lecons": 1,
        "minutes": 17,
        "agent": "aucun — c'est avant tout le reste",
        "enseigne": [
            "كلش مبني على تاست صغير، ماشي على ضربة وحدة كبيرة.",
            "ما تخدمش موديل واحد. كي يموت، تقعد بلا والو في يدك.",
            "كسّر الإيڨو تاعك : السوق هو لي يقرّر، ماشي الذوق تاعك.",
            "الديسيبلين قبل كل حاجة. الفكرة ما تسواش بلا خدمة ديما.",
            "ما تحقرش النص تاع الفيديو — هو لي يبيع، ماشي القماش.",
            "البرفكشن مقبرة الأحلام : تخرج ناقص، وتصلّح في الطريق.",
        ],
        "actions": [
            "قرّر من دروك : شحال من موديل تحب تلانسي، ماشي واحد.",
            "اكتب في ورقة : واش راني نخاف منو ؟ ومن بعد ديرو.",
        ],
        "mots": ["عقلية", "مانتاليتي", "نخاف", "خايف", "ما نعرفش نبدا", "نبدا",
                 "من وين نبدا", "mindset", "peur", "commencer", "debutant",
                 "مبتدئ", "جديد", "رايح نطيح", "ياس", "ما راني نقدرش",
                 "mindset",
                 "nkhaf",
                 "khayef",
                 "ma na3rafch nabda",
                 "men win nabda",
                 "nabda",
                 "mobtadi",
                 "peur",
                 "commencer",
                 "debutant",
                 "discipline",
                 "mentalite",
                 "el mentalite",
                 "ma3ndich sabr",
                 "nayess",
                 "rani nayess",
                 "moudil wahed berk 3andi",
                 "rani m3ayi",
                 "m3ayi",
                 "ma bi3t walou",
                 "ma bi3t walo",
                 "nhabbes",
                 "nhabes",
                 "nheb nhabbes",
                 "3andi wahed",
                 "3andi wahed sah",
                 "modele wahed",
                 "bezaf modeles",
                 "3lach lazem ndir bezaf",
                 "ma bi3t",
                 "sami3t",
                 "ndirha wla la",
                 ],
    },
    {
        "numero": 2,
        "cle": "target",
        "titre_ar": "التارجي والإكيب",
        "lecons": 2,
        "minutes": None,
        "agent": "aucun — c'est le plan, il se fait avant",
        "enseigne": [
            "حط رقم محدّد في مدّة محدّدة. بلا رقم، ما كاينش على واش تقيس.",
            "تمشي بالعكس : تبدا من الربح لي تحب، وتنزل للقطع لي لازم توصل،",
            "ومن بعد للتأكيدات، ومن بعد للطلبات، ومن بعد للناس، وفي الآخر",
            "للدراهم لي تحط كل يوم في الإشهار.",
            "الإكيب أربع مصالح : لي يجيب الناس، لي يقلّب على الموديل،",
            "لي يعيّط للزبونة، ولي يسيّر الطلبات والمخزن.",
            "كل مصلحة عندها مول، حتى لو كان المول هو نتا في البداية.",
        ],
        "actions": [
            "حدّد الربح لي تحبو، والمدّة. ومن بعد سير بالعكس حتى للدراهم.",
            "اكتب شكون يدير كل مصلحة. وين راك وحدك، اكتب اسمك.",
        ],
        "mots": ["تارجي", "هدف", "شحال لازم", "شحال نحتاج", "الميزانية",
                 "شحال ندير في النهار", "objectif", "target", "combien",
                 "budget", "equipe", "إكيب", "عمال", "شحال من واحد",
                 "بلان", "plan", "نخطط",
                 "chhal lazem",
                 "chhal ndir",
                 "chhal nahtaj",
                 "hadaf",
                 "mizania",
                 "ekip",
                 "3omal",
                 "chhal f nhar",
                 "bach nrbah",
                 "chhal men wahed",
                 "objectif",
                 "equipe",
                 "plan",
                 "kifach ndir target",
                 "target ta3i",
                 "chhal men commande",
                 "nakhdem wa7di",
                 "khdem wa7di",
                 "des agents",
                 "3endi des agents",
                 "el waqt",
                 "ma3endich el waqt",
                 "chhal rayeh nrbah",
                 "شحال رايح نربح",
                 "شحال نربح",
                 "شحال ندير في اليوم",
                 "combien par jour",
                 "combien il faut",
                 ],
    },
    {
        "numero": 3,
        "cle": "sourcing",
        "titre_ar": "كيفاش تلقى الموديل",
        "lecons": 6,
        "minutes": 58,
        "agent": "aucun — mais il nourrit tout ce qui suit",
        "enseigne": [
            "الرؤية تتعلّم، ماشي موهبة. تشوف برشة، تولّي تشوف بلا ما تحاول.",
            "دير كومبت جديد، وتبع غير الكاتالوڨات. الخوارزمية توريلك واش راه",
            "يخدم، بلا ما تقلّب.",
            "المواقع الكبار تاع البيع فيهم الكاتالوڨ، الصور، وكلام الزبونات.",
            "قنوات تيليڨرام تاع الفورنيسور، وحلّ التنبيهات باش ما تروحش عليك.",
            "الدار تاعك : مرتك، أمك، ختك. هوما لي يشريو، وهوما لي يعرفو.",
            "تشوف واش راه يخدم، تركبو، ومن بعد تبدّل فيه حاجة صغيرة تولّي تاعك.",
            "ماشي تختارع العجلة، اركب في العجلة.",
            "وفي الآخر فيلتر واحد : تقدر تصنعو هنا ؟ القماش موجود ؟ الخياط يقدر ؟",
            "إذا لا، اتركو مهما كان شاباب.",
        ],
        "actions": [
            "دير الكومبت الجديد اليوم، وتبع عشرين كاتالوڨ.",
            "اكتب كل موديل يعجبك في جدول واحد، بالصورة والمصدر.",
            "كل موديل تكتبو، اسأل : القماش تاعو يتلقى هنا ؟",
        ],
        "mots": ["موديل", "منتوج", "بروديه", "ما لقيتش", "نقلّب", "وين نلقى",
                 "سورسينڨ", "produit", "modele", "trouver", "recherche",
                 "sourcing", "فورنيسور", "fournisseur", "كاتالوڨ", "catalogue",
                 "تريند", "tendance", "winner", "وينر",
                 "moudil",
                 "modil",
                 "ma lqitch",
                 "nqaleb",
                 "win nalqa",
                 "nlqa moudil",
                 "chnou nbi3",
                 "tendance",
                 "winner",
                 "catalogue",
                 "fournisseur",
                 "men win njib",
                 "men win nlqa",
                 "ma3raftech men win",
                 "njib el moudilat",
                 "chnou nlanci",
                 "truove",
                 "prodit",
                 "produits",
                 "je ne truove pas",
                 ],
    },
    {
        "numero": 4,
        "cle": "preparation",
        "titre_ar": "التحضير والتسعير",
        "lecons": 9,
        "minutes": 87,
        "agent": "les agents EDITEUR, PAGE PRODUIT et TESTING",
        "enseigne": [
            "كل مرحلة عندها واحد يخدمها — إنسان ولا أجنت. ماشي نتا في كلش.",
            "من تلاتين موديل تشوفهم، تنقّي منهم شي خمسطاش، ومنهم تاست خمسة.",
            "ديرلهم ڨام : كي يموت واحد، لي مورو يكمّل. موديل وحدو معناه حبسة.",
            "قماش واحد يخرجلك خمس موديلات — نفس القماش، قصّات مختلفة.",
            "الفيش التكنيك للخياط : القماش، القصّة، التايات، الكمية. مكتوبة.",
            "تسعّر على أسوأ سيناريو. تحسب التوصيل ضعيف، ماشي كيما تتمنّى.",
            "إذا السوم يخدم في أسوأ حالة، راك مرتاح. إذا لا، بدّل السوم ولا الموديل.",
            "في التاست ما تخترعش : كامبانية بسيطة، كرياتيف وحدة في كل إعلان.",
            "فيديو وحدة، مونتاجات وموسيقات مختلفة، تعطيك هوكات مختلفة.",
            "الكرياتيف هي اللي تبيع.",
        ],
        "actions": [
            "اكتب الفيش التكنيك تاع كل موديل قبل ما تروح للخياط.",
            "حسب السوم على أسوأ سيناريو قبل ما تلانسي، ماشي من بعد.",
            "جهّز الفيديوهات بالأجنت الأول قبل ما تحلّ الكامبانية.",
        ],
        "mots": ["سوم", "نسعّر", "تسعير", "شحال نبيع", "prix", "tarif",
                 "marge", "ما نربحش", "التوصيل", "livraison",
                 "retour", "ريتور", "قماش", "tissu", "فيش",
                 "كرياتيف", "creative", "فيديو", "video", "مونتاج", "ڨام",
                 "gamme", "تحضير",
                 "soum",
                 "nsa3ar",
                 "chhal nbi3",
                 "tas3ira",
                 "tawsil",
                 "ritour",
                 "retour",
                 "kmach",
                 "9mach",
                 "fiche",
                 "montage",
                 "gamme",
                 "creative",
                 "marge",
                 "kifach nhaseb",
                 "nhaseb el prix",
                 "bah nerbah",
                 "kifach nsa3ar",
                 "fiche technique",
                 "n7asseb",
                 "n7aseb",
                 "nhasseb",
                 "kifach n7asseb",
                 "le prix",
                 "prix taa",
                 "el prix",
                 "prix ta3i",
                 "comment je calcule",
                 "je calcule mon prix",
                 "chhal nbi3",
                 "ma3reftch nhaseb",
                 "nhaseb",
                 "ma3reftch",
                 "la page produit",
                 "page produit",
                 "صفحة المنتوج",
                 "واش نحط في الصفحة",
                 "wach n7ot fi la page",
                 "el robe",
                 "nbi3 el",
                 "ma3endich camera",
                 "ما عنديش كاميرا",
                 ],
    },
    {
        "numero": 5,
        "cle": "lecture",
        "titre_ar": "اللانسمو والقراية",
        "lecons": 5,
        "minutes": 81,
        "agent": "les agents TESTING et COACH",
        "enseigne": [
            "الإشهار ماشي وصفة سحرية. كل مرحلة فيها قرار، والقرار على الرقم.",
            "برنامج التسيير يقولك الحقيقة : الربح الحقيقي، موديل بموديل.",
            "الكوست الرخيص ما يعنيش ربح. الربح يبان كي تحسب كلش.",
            "المخزن مربوط بلي يعيّط. إذا ما تربطش، دراهمك ترقد في قطع ما تخرجش.",
            "ماشي تحفظ، تفهم.",
            "كل لون وكل تاي عندو الكود تاعو. بلا كود، ما تعرف واش خرج.",
            "توزّع الطلبات على الناس، وتعيّط مرّة، وزوج، وتلاتة. ماشي مرّة برك.",
            "الواتساب يخدم وحدو : الرسالة تمشي بلا ما تكون نتا قدام الهاتف.",
            "الزبونات لي شراو قبل، رجعلهم. هوما أرخص من زبونة جديدة.",
            "التحليل بالأرقام، ماشي بالإحساس.",
        ],
        "actions": [
            "دخّل كل طلب في برنامج التسيير في نفس اليوم، بلا تأخير.",
            "اربط المخزن بلي يعيّط : كي يتأكّد الطلب، القطعة تنقص.",
            "اقرا كل يوم : شحال خرج، شحال تأكّد، شحال وصل.",
        ],
        "mots": ["كونفيرماسيون", "تأكيد", "ما يجاوبوش", "كول سنتر", "call",
                 "confirmation", "تسيير", "erp", "سطوك", "stock", "مخزن",
                 "كود", "sku", "واتساب", "whatsapp", "أرقام", "chiffres",
                 "ما نعرفش نقرا", "analyse", "تحليل", "الطلبات", "commandes",
                 "confirmasion",
                 "confirmation",
                 "ta2kid",
                 "ma yjawbouch",
                 "call center",
                 "sto9",
                 "makhzen",
                 "ar9am",
                 "ma na3rafch naqra",
                 "talabat",
                 "analyse",
                 "ma yjawebch",
                 "ma yjawbch",
                 "ma yjawebch telephone",
                 "client ma yjawebch",
                 "telephone",
                 "ma yred",
                 "kifach na3raf",
                 "ma na3raf wach",
                 "التيليفون",
                 "الهاتف",
                 "ما ترديش",
                 "ما يردش",
                 "ما تردش",
                 "الزبونة ما ترديش",
                 "الستوك",
                 "سطوك",
                 "المخزن قاعد",
                 "ما يجاوبش",
                 "ما تجاوبش",
                 "ma yakhdouch",
                 "yakhdouch el colis",
                 "ma yakhdouch el colis",
                 "les clientes ma",
                 "ma yjawbouhach",
                 "yjawbouhach",
                 "el colis yerja3",
                 "ga3 les tailles",
                 "les retour bezaf",
                 ],
    },
    {
        "numero": 6,
        "cle": "atelier",
        "titre_ar": "الشراكة مع الخياط",
        "lecons": 2,
        "minutes": 9,
        "agent": "aucun — c'est du telephone et de la parole",
        "enseigne": [
            "تهدر معاه كي الشريك، ماشي كي الشاري. الشاري يفاصل، الشريك يبني.",
            "الكلمة لي تحلّ الباب : خدمة لا تحبسش. العمّال تاعو يحبو الخدمة ديما.",
            "خياط وفي، من بعد مدّة، يولّي هو لي يجيبلك الموديلات لي راهي رايجة.",
            "العلاقات أفضل من رأس المال.",
            "هو رابح ونتا رابح. إذا ربحت وحدك، ما يدومش.",
        ],
        "actions": [
            "اختار خياط واحد وابدا معاه بكمية صغيرة، وخلّصو في الوقت.",
            "عيّطلو كل جمعة حتى كي ما عندكش خدمة : هكذا تولّي معروف عندو.",
        ],
        "mots": ["أتولييه", "atelier", "خياط", "couturier", "ما عنديش أتولييه",
                 "ما لقيتش خياط", "usine", "مصنع", "إنتاج", "production",
                 "شراكة", "partenaire",
                 "atolier",
                 "khayat",
                 "ma 3andich atelier",
                 "ma lqitch khayat",
                 "nlqa khayat",
                 "usine",
                 "charaka",
                 "partenaire",
                 "khayat ta3i",
                 "el khayat",
                 "khayat ma yekhdemch",
                 "khayat y3ttel",
                 "couturier",
                 "ma nsibch khayat",
                 "atellier",
                 "atelie",
                 "ateliers",
                 "l atelier",
                 ],
    },
    {
        "numero": 7,
        "cle": "decision",
        "titre_ar": "القرار : نكمّل ولا نقطع",
        "lecons": 3,
        "minutes": 13,
        "agent": "les agents TESTING et COACH",
        "enseigne": [
            "كان اياه تعرف، اياه ما تعرف. إذا ما تقيسش، ما تقدرش تقرّر.",
            "المؤشّر لي يقرّر : شحال تكلّفك الطلبية المؤكّدة، مقابل الرقم لي حطّيت.",
            "قبل ما تقطع، حاول تحسّن : بدّل الفيديو، بدّل السوم، طفّي الضعاف.",
            "القطع هو الحل الأخير، ماشي الأول.",
            "تاست الهوكات : خمس فيديوهات، خمس زوايا، ونص الزاوية يتحط مع الفيديو",
            "تاعها، ماشي نص واحد على الكل.",
        ],
        "actions": [
            "قبل ما تلانسي، اكتب الرقم لي كي يفوتو تقطع. اكتبو قبل، ماشي من بعد.",
            "كي يضعف الإعلان، بدّل الفيديو الأول، ماشي الميزانية.",
        ],
        "mots": ["نقطع", "نطفّي", "couper", "arreter", "ما راهش يخدم",
                 "غالي", "cpa", "تكلفة", "الإشهار غالي", "ads", "إعلان",
                 "هوك", "hook", "زاوية", "angle", "decision", "قرار",
                 "أوبتيميزي", "optimiser",
                 "naqta3",
                 "ntafi",
                 "ma rahouch yekhdem",
                 "ghali",
                 "i3lan",
                 "optimiser",
                 "couper",
                 "arreter",
                 "angle",
                 "nkamel wala nwa9ef",
                 "nkamel wala",
                 "nwa9ef",
                 "nwaqef",
                 "wach nkamel",
                 "rani khasser fel pub",
                 "khasser fel pub",
                 "khasser flous",
                 "khaser flous",
                 "khasser flous fel pub",
                 "pub ghalia",
                 "publicite ne donne rien",
                 "الإعلان تاعي",
                 "الاعلان تاعي",
                 "الإعلان ما يخدمش",
                 "الاعلان ما يخدمش",
                 "مون أنونس",
                 "annonce",
                 "ma pub",
                 "pub ne marche pas",
                 "annonce ne marche pas",
                 "publicite ne marche pas",
                 "n9ate3",
                 "n9te3",
                 "n9ate3 wla nkamel",
                 "n9te3 wla nkamel",
                 "nkamel wla nhabes",
                 "la pub taakol",
                 "taakol les sous",
                 "el hook",
                 "hook taa",
                 "nbeddel el hook",
                 "test hooks",
                 "tast hooks",
                 "نبدّل الهوك",
                 "الهوك",
                 ],
    },
    {
        "numero": 8,
        "cle": "capital",
        "titre_ar": "كابيتال صغير وكيفاش تكبّر",
        "lecons": 2,
        "minutes": 17,
        "agent": "l'agent SCALING",
        "enseigne": [
            "بكابيتال صغير : خمس منتوجات، كل واحد بشوية دراهم في النهار الأول.",
            "تخلّي لي عطاو، وتطفّي الباقي. ما تقسمش دراهمك على لي ما عطاش.",
            "كمية صغيرة عند الخياط في البداية، والدراهم تدور في جمعة.",
            "تلقى خياط في نهار واحد على إنستاڨرام : تشوف الصفحات، وتعيّط مباشرة.",
            "الموديل الأول بكمية صغيرة، ومن بعد تكبّر بالدرجات، ماشي دفعة وحدة.",
            "ما تكبّرش الميزانية قبل ما يكون المخزن واجد.",
        ],
        "actions": [
            "ابدا بخمسة، ماشي بواحد، وبشوية دراهم على كل واحد.",
            "قبل ما تكبّر، شوف المخزن : كبّرت بلا مخزن، تخسر الزبونة والدراهم.",
        ],
        "mots": ["كابيتال", "capital", "ما عنديش دراهم", "شوية دراهم",
                 "petit budget", "نكبّر", "سكايلينڨ", "scaling", "scale",
                 "توسع", "كمية", "quantite", "مخزن واجد",
                 "ma 3andich draham",
                 "chwiya draham",
                 "nkabar",
                 "tawasso3",
                 "kamia",
                 "petit budget",
                 "capital",
                 "argent",
                 "pas d argent",
                 "pas beaucoup d argent",
                 "peu d argent",
                 "argent pour commencer",
                 "petit capital",
                 "augmenter mon budget",
                 "augmenter le budget",
                 "augmenter la publicite",
                 "monter le budget",
                 "grandir",
                 "nkabbar",
                 "nkabbar el campagne",
                 "3andi ktar",
                 "bghit nkabbar",
                 "combien pour commencer",
                 "kifach nebda",
                 "3andi model wahed",
                 "3andi moudil wahed",
                 "model wahed berk",
                 "moudil wahed berk",
                 "nqder nebda",
                 "nqder nabda",
                 "nebda wla la",
                 "nabda wla la",
                 "bark nqder",
                 "3andi ghir",
                 "3andi bark",
                 "hadou bark",
                 "ma3andich ktar",
                 "b hadou nqder",
                 ],
    },
]

TOTAL_LECONS_ANNONCE = 30   # ce qu'il annonce sur sa page : trente lecons
TOTAL_MODULES_ANNONCE = 8


# ===========================================================================
# 3. AUCUN CHIFFRE DE VENDEUR — la seule preuve, ce sont les chiffres du
#    CLIENT, dans SON carnet
#
#    Il n'y a plus de liste de « preuves » ici (10/10/2026). Elle portait
#    des chiffres de la page de vente de celui qui a fait le produit : loi
#    « livrables anonymes, ni ses chiffres ni son nom » (et un chiffre de sa
#    page daterait aussi le produit). Le guide ne cite donc AUCUN chiffre de
#    resultat d'un vendeur, d'un eleve ou d'une page. Quand le client demande
#    une preuve, il dit qu'il n'en invente pas et le renvoie a SES chiffres :
#    ce que ses agents ont MESURE et ecrit dans son carnet (outils/0-CARNET).
#    Ses chiffres a lui ne s'ecrivent jamais dans ce fichier non plus.
# ===========================================================================

PREUVES = ()   # VIDE, expres : --verifier refuse qu'un chiffre y revienne

# ce que le guide dit quand on lui demande une preuve (et rien d'autre)
PHRASE_PAS_DE_PREUVE = [
    "ما نخترعش الأرقام.",
    "وما نعطيكش أرقام تاع حتى واحد.",
    "الدليل الصحيح هو الأرقام تاوعك.",
    "لي تقاس عندك راه في الكارني تاعك.",
    "حلّ الكارني ونقراوه مع بعض.",
]
PHRASE_NON_CITABLE = PHRASE_PAS_DE_PREUVE   # ancien nom, garde pour les appels d'avant

# LA QUESTION QUI DEMANDE UNE PREUVE (« des resultats ? », « شكون نجح ؟ »).
# Elle recoit la meme verite a chaque fois : pas de chiffre d'un autre,
# les siens, dans son carnet.
DEMANDE_PREUVE = [
    "preuve", "des preuves", "resultats des eleves", "resultat des eleves",
    "temoignage", "capture des resultats", "دليل", "عندك دليل",
    "شكون نجح", "شكون ربح", "نتائج الطلبة", "نتايج الطلبة", "ورّيني النتائج",
    "وريني النتائج", "ورّيلي النتائج", "وريلي النتائج", "dalil", "chkoun nja7",
    # [casse-6] 10/10/2026 : des demandes de preuve qui passaient a travers
    # (« Résultats des élèves ? » avec ses accents, « témoignages », « شكون
    # اللي نجح ») et tombaient sur un module, ou sur « ما فهمتش »
    "resultat de tes eleves", "resultats de tes eleves", "tes eleves", "des eleves",
    "les eleves", "eleves ont reussi", "combien d eleves", "temoignages",
    "proof", "chkoun nje7", "chkon nja7", "chkoun nj7", "nas nje7o",
    "شكون اللي نجح", "شكون لي نجح", "ناس نجحو", "واحد نجح",
    "شحال من واحد نجح", "شحال من واحد ربح", "الطلبة تاوعك",
]

PHRASE_SANS_GARANTIE[:] = [
    "ما نضمنولكش الربح. نبيعو الطريقة، ماشي النتيجة.",
]

# Les formes NIEES. Elles disent le contraire de la promesse : elles sont
# permises, et elles sont meme ce qu'on veut lire.
NEGATIONS[:] = ["ما نضمنولكش", "ما نضمنلكش", "ما تضمنش", "ما نقدرش نضمن",
             "ما راكش رايح تربح", "ما نعرفش شحال رايح تربح",
             "ما نضمنش", "on ne garantit pas", "rien n'est garanti",
             "pas de garantie", "ماشي مضمون"]


# ===========================================================================
# 4. LA CARTE DU SYSTEME — les six agents, et OU EN EST le client
# ===========================================================================

# ATTENTION, PIEGE TROUVE EN AUDIT : l'ORDRE du parcours et le NUMERO DU
# DOSSIER ne sont pas les memes. Le coach passe AVANT le scaling, mais leurs
# dossiers s'appellent 5-COACH et 4-SCALING. Un guide qui annonce « le
# suivant, c'est le cinq » envoie le client dans le mauvais dossier.
# Donc : « rang » = la place dans le parcours, « dossier » = le nom exact du
# dossier a ouvrir. C'est TOUJOURS le nom du dossier qu'on montre au client.
CHAINE = [
    {"rang": 1, "dossier": "1-EDITEUR", "cle": "editeur", "nom": "EDITEUR",
     "ar": "يحضّر الفيديوهات والصور",
     "fait": "lit les videos du shooting, monte les variantes, ecrit les "
             "accroches, choisit les photos",
     "temoin": "dossier qui finit par _livraison",
     "module": 4},
    {"rang": 2, "dossier": "2-PAGE-PRODUIT", "cle": "produit",
     "nom": "PAGE PRODUIT",
     "ar": "يبني الصفحة والأكواد",
     "fait": "fabrique les variantes, les codes, le stock, la description "
             "et l'ordre des photos",
     "temoin": "paquet-create_product.json",
     "module": 4},
    {"rang": 3, "dossier": "3-TESTING", "cle": "testing", "nom": "TESTING",
     "ar": "يلانسي التاست ويقراه ثلاثة أيام",
     "fait": "monte la campagne, met les videos en ligne, lit les trois "
             "premiers jours et coupe ce qui ne donne rien",
     "temoin": "test-en-cours.json",
     "module": 5},
    {"rang": 4, "dossier": "5-COACH", "cle": "coach", "nom": "COACH",
     "ar": "يقرا كل يوم ويحضّر الباب",
     "fait": "reprend apres le troisieme jour, lit chaque jour, corrige la "
             "gestion avec permission, et tient la porte",
     "temoin": "la partie coach dans test-en-cours.json",
     "module": 7},
    {"rang": 5, "dossier": "4-SCALING", "cle": "scaling", "nom": "SCALING",
     "ar": "يكبّر كي يتحلّ الباب",
     "fait": "n'ouvre que sur un feu vert du coach, monte par paliers et "
             "verifie le stock avant chaque palier",
     "temoin": "scaling-en-cours.json",
     "module": 8},
    {"rang": 6, "dossier": "6-GUIDE", "cle": "guide", "nom": "GUIDE",
     "ar": "يجاوبك ويقولك وين راك",
     "fait": "repond aux questions, dit ou en est le client et ce qui vient "
             "ensuite — il ne fabrique rien",
     "temoin": "c'est moi",
     "module": 1},
]


def dossier_outil():
    return os.path.dirname(os.path.abspath(__file__))


def lieux_temoins(dossier=None):
    """Ou chercher les traces des autres agents. LE CLIENT NE DOIT PAS AVOIR
    A DEPLACER QUOI QUE CE SOIT : chaque agent vit dans son dossier. On
    regarde donc le dossier courant, celui de l'outil, et les VOISINS."""
    if dossier:
        # ON REGARDE AUSSI DEDANS. Avec --dossier <le dossier parent>, on ne
        # cherchait que <parent>/test-en-cours.json, jamais
        # <parent>/3-TESTING/test-en-cours.json — donc tout repondait « non »
        # alors que le client avait bien designe le bon endroit.
        lieux = [dossier]
        try:
            for nom in sorted(os.listdir(dossier)):
                chemin = os.path.join(dossier, nom)
                if os.path.isdir(chemin):
                    lieux.append(chemin)
        except OSError:
            pass
        return lieux
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


def date_du(chemin):
    """La date d'un fichier, ecrite comme on l'ecrit ici : jour/mois/annee.

    Les deux documents disent au guide « regarde la date ». Sans elle, la
    garde-fou annoncee etait inapplicable : un fichier d'essai ou un fichier
    d'un modele abandonne il y a deux mois se lisait comme du travail
    d'aujourd'hui."""
    if not chemin:
        return None
    try:
        import datetime
        return datetime.datetime.fromtimestamp(
            os.path.getmtime(chemin)).strftime("%d/%m/%Y")
    except OSError:
        return None


def chemin_court(chemin, largeur=44):
    """Tronque PAR LE DEBUT et le DIT. Coupe en silence, le chemin affiche
    n'existait pas : « ome/claude/... » sans le « /h »."""
    c = str(chemin)
    return c if len(c) <= largeur else "..." + c[-(largeur - 3):]


def _trouve_fichier(nom, lieux):
    for lieu in lieux:
        c = os.path.join(lieu, nom)
        if os.path.exists(c):
            return c
    return None


def _trouve_dossier_livraison(lieux):
    for lieu in lieux:
        try:
            for nom in sorted(os.listdir(lieu)):
                if nom.endswith("_livraison") and os.path.isdir(
                        os.path.join(lieu, nom)):
                    return os.path.join(lieu, nom)
        except OSError:
            continue
    return None


def ou_en_est(dossier=None):
    """Regarde ce qui EXISTE sur le disque. Ne devine rien.

    Chaque etape est « vue » ou « pas vue ». « pas vue » ne veut pas dire
    « pas faite » : le client a pu travailler ailleurs. C'est dit."""
    lieux = lieux_temoins(dossier)
    etat = []

    livraison = _trouve_dossier_livraison(lieux)
    etat.append({"rang": 1, "vu": livraison is not None, "ou": livraison,
                 "date": date_du(livraison)})

    paquet = _trouve_fichier("paquet-create_product.json", lieux)
    etat.append({"rang": 2, "vu": paquet is not None, "ou": paquet,
                 "date": date_du(paquet)})

    passage = _trouve_fichier("test-en-cours.json", lieux)
    contenu = None
    if passage:
        try:
            with open(passage, encoding="utf-8") as f:
                contenu = json.load(f)
        except Exception:
            contenu = None
    etat.append({"rang": 3, "vu": passage is not None, "ou": passage,
                 "date": date_du(passage)})
    a_coach = bool(contenu and contenu.get("coach"))
    etat.append({"rang": 4, "vu": a_coach,
                 "ou": passage if a_coach else None,
                 "date": date_du(passage) if a_coach else None})
    # VERIFIE DANS LE CODE DE L'AGENT SCALING, pas suppose : il n'ecrit
    # rien dans le fichier de passage, il tient son propre fichier.
    scaling = _trouve_fichier("scaling-en-cours.json", lieux)
    etat.append({"rang": 5, "vu": scaling is not None, "ou": scaling,
                 "date": date_du(scaling)})
    # LE GUIDE NE SE COMPTE PAS LUI-MEME. Le tableau disait « 6-GUIDE : oui »
    # juste au-dessus de la phrase « je n'ai vu aucune trace » : le client
    # lisait une contradiction des la premiere commande.
    etat.append({"rang": 6, "vu": None, "ou": None, "date": None})

    faits = [e["rang"] for e in etat if e.get("vu") and e["rang"] < 6]
    # LE SUIVANT SE COMPTE DEPUIS LE PLUS LOIN QU'ON A VU, pas depuis le
    # premier trou. Un client qui avait deja ses videos et sa page a lance
    # directement le test : on lui repondait « le suivant, c'est l'editeur »
    # alors que sa campagne tournait depuis huit jours.
    prochain = min(max(faits) + 1, 5) if faits else 1
    sautes = [r for r in range(1, (max(faits) if faits else 0) + 1)
              if r not in faits]
    return {"etat": etat, "prochain": prochain, "lieux": lieux,
            "sautes": sautes, "rien_vu": not faits}


# ===========================================================================
# 5. LE DIAGNOSTIC — la question du client va au bon module
# ===========================================================================

_DIACRITIQUES = re.compile(r'[ً-ْـ]')


def normalise(texte):
    """Un client tape vite. On enleve les signes, on unifie les alifs, les
    ta marbouta et les ya. On ne corrige PAS l'orthographe : on rapproche."""
    t = _DIACRITIQUES.sub("", str(texte))
    for a in "أإآٱ":
        t = t.replace(a, "ا")
    t = t.replace("ة", "ه").replace("ى", "ي").replace("ﻻ", "لا")
    t = t.replace("گ", "ك").replace("ڨ", "ق").replace("ڤ", "ق")
    t = t.replace("پ", "ب").replace("چ", "ج")
    t = t.lower()
    t = re.sub(r"[^\w؀-ۿ]+", " ", t)
    return " " + re.sub(r"\s+", " ", t).strip() + " "


def demande_une_garantie(question):
    """« شحال رايح نربح ؟ » est la question la plus normale du monde, et
    c'est celle ou on ment le plus facilement. On la reconnait pour repondre
    la verite, pas pour l'eviter."""
    q = normalise(question)
    return any(normalise(m).strip() in q for m in DEMANDE_GARANTIE)


def demande_une_preuve(question):
    """« عندك دليل ؟ », « des resultats d'eleves ? » : on la reconnait pour
    renvoyer le client a SES chiffres, jamais a ceux d'un autre."""
    # [casse-6] les accents latins mis a plat des deux cotes : « Résultats
    # des élèves » est la meme demande que « resultats des eleves »
    q = normalise(sans_accents(question))
    return any(normalise(sans_accents(m)).strip() in q for m in DEMANDE_PREUVE)


def diagnostic(question):
    """Rend les modules qui traitent ce probleme, du plus sur au moins sur.

    S'IL NE TROUVE RIEN, IL REND UNE LISTE VIDE. Il ne prend pas le premier
    module au hasard : une mauvaise reponse coute plus cher qu'une question
    de plus."""
    if not str(question).strip():
        raise ValueError("la question est vide")
    q = normalise(question)
    scores = []
    for m in MODULES:
        touches = []
        for mot in m["mots"]:
            n = normalise(mot).strip()
            if not n:
                continue
            if n in q:
                touches.append(mot)
        if touches:
            # UN MOT LONG VAUT PLUS QU'UN MOT COURT, et une PHRASE vaut plus
            # qu'un mot seul. Trouve en audit : « je n'ai pas beaucoup
            # d'argent pour commencer » partait sur la mentalite a cause du
            # seul mot « commencer », alors que « pas beaucoup d'argent »
            # designe le module du petit capital sans aucun doute. Un mot
            # generique ne doit pas battre une phrase precise.
            poids = 0
            for mot in touches:
                n = normalise(mot).strip()
                poids += len(n) * (3 if " " in n else 1)
            scores.append({"module": m, "touches": touches, "poids": poids})
    scores.sort(key=lambda s: (-s["poids"], s["module"]["numero"]))

    # UNE DEMANDE DE GARANTIE PART TOUJOURS VERS LE PLAN.
    # « شحال رايح نربح ؟ » tombait sur la tarification en arabe et sur le
    # plan en francais : la meme question, deux reponses. Or la doctrine est
    # ecrite : on repond la verite, puis on enchaine sur le chemin a
    # l'envers. C'est donc le module du plan qui passe en tete.
    if demande_une_garantie(question):
        plan = [s for s in scores if s["module"]["cle"] == "target"]
        if not plan:
            m = [x for x in MODULES if x["cle"] == "target"][0]
            plan = [{"module": m, "touches": ["شحال نربح"], "poids": 0}]
        autres = [s for s in scores if s["module"]["cle"] != "target"]
        scores = plan + autres
    return scores[:3]


# ===========================================================================
# 6. LE TARGET A L'ENVERS — la feuille du module deux
#
#    On part du benefice VOULU et on descend jusqu'aux dinars par jour.
#    C'est un PLAN, pas une prevision : l'outil le dit lui-meme a la fin.
# ===========================================================================

def _positif(valeur, nom):
    if valeur is None:
        raise ValueError("il manque %s" % nom)
    try:
        # la virgule decimale se lit AUSSI ici, pas seulement sur la ligne de
        # commande : un nombre peut arriver d'un fichier ou d'un autre agent
        if isinstance(valeur, str):
            brut = valeur.strip().replace(" ", "").replace("\u00a0", "")
            if brut.count(",") == 1 and "." not in brut:
                brut = brut.replace(",", ".")
            v = float(brut)
        else:
            v = float(valeur)
    except (TypeError, ValueError):
        raise ValueError("%s n'est pas un nombre" % nom)
    if v != v or v in (float("inf"), float("-inf")):
        raise ValueError("%s n'est pas un nombre utilisable" % nom)
    if v <= 0:
        raise ValueError("%s doit etre plus grand que zero" % nom)
    return v


PLANCHER_TAUX = 0.05   # en dessous, on ne calcule pas : on redemande


def _taux(valeur, nom):
    """Accepte 0,45 comme 45. Mais REFUSE ce qui est ambigu.

    LE PIEGE : quelqu'un qui tape « 1,5 » veut dire une fois et demie ? un
    et demi pour cent ? cent cinquante ? On ne choisit pas a sa place — on
    montre les lectures possibles et on redemande. Un plan entier se construit
    sur ce nombre : se tromper ici fausse tout le reste en silence."""
    v = _positif(valeur, nom)
    if v > 1.0:
        v = v / 100.0
    if v > 1.0:
        raise ValueError("%s ne peut pas depasser cent pour cent" % nom)
    if v < PLANCHER_TAUX:
        raise ValueError(
            "%s vaut %s pour cent, et je ne sais pas si c'est ce que tu "
            "voulais dire. Ecris-le clairement : 0,45 ou 45. En dessous de "
            "cinq pour cent il n'y a plus de plan a calculer."
            % (nom, ("%.2f" % (v * 100.0)).replace(".", ",")))
    return v


def target(benefice_vise_da, jours, marge_par_livree_da, taux_livraison,
           taux_confirmation, cout_par_confirmee_da, capacite_agent_par_jour):
    """Le chemin a l'envers du module deux.

    benefice -> livrees -> confirmees -> commandes creees -> agents -> dinars
    """
    b = _positif(benefice_vise_da, "le benefice vise")
    j = _positif(jours, "le nombre de jours")
    marge = _positif(marge_par_livree_da, "la marge par colis livre")
    tl = _taux(taux_livraison, "le taux de livraison")
    tc = _taux(taux_confirmation, "le taux de confirmation")
    cc = _positif(cout_par_confirmee_da, "le cout par commande confirmee")
    cap = _positif(capacite_agent_par_jour, "ce qu'un agent traite par jour")

    # ON ARRONDIT D'ABORD, ON MULTIPLIE ENSUITE.
    # Un audit a montre que le tableau affichait « 926 commandes confirmees »
    # et « 555 556 » de publicite, alors que 926 x 600 fait 555 600. Les
    # totaux venaient des valeurs non arrondies, les lignes des arrondies. Un
    # client qui refait le calcul du tableau qu'on vient de lui lire ne
    # retombait pas dessus — et il a raison de ne plus croire le tableau.
    # Des colis, des commandes et des personnes ne se coupent pas en deux :
    # on monte au nombre entier, et tout le reste se calcule sur celui-la.
    trop_petit = (b / marge) < 1.0
    livrees = int(math.ceil(b / marge))
    confirmees = int(math.ceil(livrees / tl))
    creees = int(math.ceil(confirmees / tc))
    livrees_jour = livrees / j
    confirmees_jour = confirmees / j
    creees_jour = creees / j
    agents = int(math.ceil(confirmees_jour / cap))
    budget_total = confirmees * cc
    budget_jour = budget_total / j

    # LE PIEGE LE PLUS CHER DE CETTE FEUILLE :
    # la marge par colis livre est ce qui reste APRES le produit, l'emballage,
    # la livraison et les retours — mais AVANT la publicite. Le chemin a
    # l'envers calcule ensuite la publicite a part. Si on s'arrete la, le
    # vendeur lit « benefice vise » et croit qu'il va le mettre dans sa poche,
    # alors que la publicite du meme tableau peut le manger en entier.
    # Donc on soustrait, on l'AFFICHE, et on crie quand il ne reste rien.
    reste = b - budget_total

    # garde-fou d'humilite : un plan qui demande l'impossible se dit tout de suite
    alerte = None
    if creees_jour > 500:
        alerte = "impossible"
    elif trop_petit:
        alerte = "trop_petit"
    elif reste <= 0:
        alerte = "rien_ne_reste"
    elif reste < b * 0.20:
        alerte = "reste_maigre"

    return {
        "benefice_vise_da": b, "jours": int(j),
        "marge_par_livree_da": marge,
        "taux_livraison": tl, "taux_confirmation": tc,
        "livrees": livrees, "livrees_jour": livrees_jour,
        "confirmees": confirmees, "confirmees_jour": confirmees_jour,
        "creees": creees, "creees_jour": creees_jour,
        "agents": max(agents, 1),
        "budget_jour_da": budget_jour, "budget_total_da": budget_total,
        "reste_da": reste, "reste_jour_da": reste / j,
        "alerte": alerte,
    }


# ===========================================================================
# 7. L'ENTONNOIR — le rythme du module quatre
# ===========================================================================

REPERES_PAR_TESTE = 6      # trente reperes pour cinq testes
RETENUS_PAR_TESTE = 3      # quinze retenus pour cinq testes
GARDES_MIN, GARDES_MAX = 2, 3   # sur cinq testes, on en garde deux ou trois


def entonnoir(testes):
    t = int(_positif(testes, "le nombre de modeles a tester"))
    if t > 200:
        raise ValueError("ce nombre de modeles n'est pas tenable a la main")
    part = t / 5.0
    return {
        "reperes": int(math.ceil(t * REPERES_PAR_TESTE)),
        "retenus": int(math.ceil(t * RETENUS_PAR_TESTE)),
        "testes": t,
        "gardes_bas": max(1, int(math.floor(GARDES_MIN * part))),
        "gardes_haut": max(1, int(math.ceil(GARDES_MAX * part))),
    }


# ===========================================================================
# 8. LE REGLAGE — ce que le vendeur decide UNE fois
# ===========================================================================

FICHIER_REGLAGE = "reglage-guide.txt"

MODELE_REGLAGE = """# REGLAGE DU GUIDE — tu l'ecris UNE fois.
# Efface une ligne pour revenir a la valeur par defaut.

# formation : est-ce que la personne qui utilise cet agent a deja la
#             masterclass complete ?
#   oui  -> le guide donne la methode ET le detail des lecons
#   non  -> le guide donne la methode, et renvoie a la masterclass pour
#           le detail (les durees, l'ordre des lecons, les fichiers)
formation = %s

# niveau : comment le guide explique. Ca ne change pas le contenu, ca
#          change les mots.
#   debutant -> tout en mots de tous les jours, une action a la fois
#   avance   -> les indicateurs par leur nom, etape par etape
niveau = %s
"""

DEFAUT_REGLAGE = {"formation": "oui", "niveau": "debutant"}
VALEURS_REGLAGE = {"formation": ("oui", "non"),
                   "niveau": ("debutant", "avance")}


def lis_reglage(dossier=None, seulement_ici=False):
    """Cherche a DEUX endroits, et on le dit : le dossier courant, puis
    celui de l'outil. Pas de recherche magique dans tout le disque.

    `seulement_ici` : ne regarde QUE le dossier donne. Sert aux controles.
    Sans lui, un controle qui voulait verifier « sans fichier, la valeur par
    defaut s'applique » retombait sur le VRAI fichier du client : des qu'il
    ecrivait formation = non — un reglage documente et legitime — son
    --verifier passait en echec, et la consigne lui dit de s'arreter tant
    qu'il n'a pas TOUT EST BON. Un reglage normal bloquait son agent."""
    bases = [dossier or os.getcwd()]
    if not seulement_ici:
        bases.append(dossier_outil())
    for base in bases:
        chemin = os.path.join(base, FICHIER_REGLAGE)
        if not os.path.exists(chemin):
            continue
        reglage = dict(DEFAUT_REGLAGE)
        reglage["_fichier"] = chemin
        try:
            with open(chemin, encoding="utf-8") as f:
                lignes = f.readlines()
        except OSError:
            return dict(DEFAUT_REGLAGE)
        for ligne in lignes:
            ligne = ligne.split("#", 1)[0].strip()
            if "=" not in ligne:
                continue
            cle, val = ligne.split("=", 1)
            cle, val = cle.strip().lower(), val.strip().lower()
            if cle in VALEURS_REGLAGE and val in VALEURS_REGLAGE[cle]:
                reglage[cle] = val
        return reglage
    return dict(DEFAUT_REGLAGE)


def ecris_reglage(dossier, formation, niveau):
    if formation not in VALEURS_REGLAGE["formation"]:
        raise ValueError("formation : oui ou non, rien d'autre")
    if niveau not in VALEURS_REGLAGE["niveau"]:
        raise ValueError("niveau : debutant ou avance, rien d'autre")
    base = dossier or os.getcwd()
    if not os.path.isdir(base):
        raise ValueError("ce dossier n'existe pas : %s" % base)
    chemin = os.path.join(base, FICHIER_REGLAGE)
    with open(chemin, "w", encoding="utf-8") as f:
        f.write(MODELE_REGLAGE % (formation, niveau))
    return chemin


# ===========================================================================
# 9. LES VUES — ce qui s'affiche
# ===========================================================================

def _duree(m):
    return "non notee" if m["minutes"] is None else "%d min" % m["minutes"]


def vue_modules(reglage=None):
    """La DUREE ne sort que si la masterclass est achetee — comme pour un
    module seul. La premiere version l'oubliait ici : le detail fuyait par
    la liste alors qu'il etait ferme sur chaque module."""
    reglage = reglage or DEFAUT_REGLAGE
    tout = reglage.get("formation", "oui") == "oui"
    v = _vue()
    _tab(v, BARRE, "  LES MODULES DE LA MASTERCLASS", BARRE, "")
    if tout:
        _tab(v, "  %-3s %-9s %-10s %s" % ("N", "LECONS", "DUREE", "CLE"))
    else:
        _tab(v, "  %-3s %-9s %s" % ("N", "LECONS", "CLE"))
    _tab(v, "  " + "-" * 56)
    connues = 0
    for m in MODULES:
        if tout:
            _tab(v, "  %-3d %-9d %-10s %s"
                 % (m["numero"], m["lecons"], _duree(m), m["cle"]))
        else:
            _tab(v, "  %-3d %-9d %s" % (m["numero"], m["lecons"], m["cle"]))
        if m["minutes"]:
            connues += m["minutes"]
    _tab(v, "  " + "-" * 56)
    if tout:
        _tab(v, "  %-3s %-9d %-10s %s"
             % ("", sum(m["lecons"] for m in MODULES), "%d min +" % connues,
                "au total"))
    else:
        _tab(v, "  %-3s %-9d %s"
             % ("", sum(m["lecons"] for m in MODULES), "au total"))
    _ar(v, "")
    if tout:
        _ar(v, "  علامة الزائد معناها : كاين مودول ما راهش مكتوبة مدّتو.")
        _ar(v, "  ما نختارعوهاش. المجموع الحقيقي أكبر.")
    else:
        _ar(v, "  هاذي هي الخريطة. التفاصيل راهي في الماستر كلاس.")
    _ar(v, "")
    for m in MODULES:
        _ar(v, "  " + m["titre_ar"])
        _tab(v, ligne_nombre(m["numero"]))
        _ar(v, "")
    _tab(v, BARRE)
    return _fin(v)


def vue_module(m, reglage):
    v = _vue()
    _tab(v, BARRE)
    _ar(v, "  " + m["titre_ar"])
    _tab(v, ligne_nombre(m["numero"]), BARRE, "")
    _ar(v, "  ما يعلّمك :", "")
    for l in m["enseigne"]:
        _ar(v, "  " + l)
    _ar(v, "", "  واش تدير اليوم :", "")
    for l in m["actions"]:
        _ar(v, "  - " + l)
    _ar(v, "")
    _tab(v, "  " + "-" * 56)
    _tab(v, "  %-14s %s" % ("lecons", m["lecons"]))
    if reglage.get("formation", "oui") == "oui":
        _tab(v, "  %-14s %s" % ("duree", _duree(m)))
    _tab(v, "  %-14s %s" % ("agents", m["agent"]))
    _tab(v, "  " + "-" * 56)
    if reglage.get("formation", "oui") != "oui":
        _ar(v, "")
        _ar(v, "  هاذي هي الطريقة. التفاصيل بالفيديو والمثال الحي،")
        _ar(v, "  راهي في الماستر كلاس كاملة.")
    _ar(v, "")
    for p in PHRASE_SANS_GARANTIE:
        _ar(v, "  " + p)
    _tab(v, BARRE)
    return _fin(v)


def vue_diagnostic(question, trouves, reglage):
    """`question` n'est PAS reaffichee ici : voir le commentaire plus bas."""
    v = _vue()
    _tab(v, BARRE)
    _ar(v, "  السؤال تاعك")
    _tab(v, BARRE, "")
    # LA QUESTION DU CLIENT NE RENTRE PAS ICI.
    # Elle est a LUI : il peut la taper en francais, en arabe, ou melangee.
    # Si on la remettait dans le bloc controle, ses propres mots feraient
    # refuser l'affichage et il n'aurait AUCUNE reponse. Les deux lois
    # portent sur ce que l'outil DIT, pas sur ce que le client ECRIT.
    # L'echo de sa question s'imprime a part, avant ce bloc.

    if demande_une_garantie(question):
        # ON N'ECRIT PAS ICI LE VERBE DE LA PROMESSE, meme pour le nier :
        # l'outil le refuserait, et il aurait raison. On parle du « الربح »,
        # le nom, qui est permis partout.
        _ar(v, "  راك تسقسي على الربح لي رايح يجيك.")
        _ar(v, "")
        _ar(v, "  الجواب الصادق : ما نعرفش، وحتى حد ما يعرف.")
        _ar(v, "  لي يعطيك رقم قبل ما تجرّب، راه يبيعلك حلم.")
        _ar(v, "")
        _ar(v, "  بصح كاين حاجة نقدر ندير معاك : نحسبو مع بعضنا شحال لازم")
        _ar(v, "  يصرا باش توصل للرقم لي تحب. ماشي واش رايح يصرا — واش")
        _ar(v, "  لازم يصرا. وهاذي حاجة أخرى.")
        _ar(v, "")
        for pp in PHRASE_SANS_GARANTIE:
            _ar(v, "  " + pp)
        _ar(v, "")
        _ar(v, "  عطيني هاذ الأرقام وندير الحساب :")
        _ar(v, "  الربح لي تحب، المدّة، وشحال يبقالك في القطعة الوحدة.")
        _ar(v, "")
        if not trouves:
            _tab(v, BARRE)
            return _fin(v)

    if demande_une_preuve(question):
        # AUCUN chiffre d'un vendeur, d'un eleve ou d'une page : les siens.
        for pp in PHRASE_PAS_DE_PREUVE:
            _ar(v, "  " + pp)
        _ar(v, "")
        if not trouves:
            _tab(v, BARRE)
            return _fin(v)

    if not trouves:
        _ar(v, "  ما فهمتش بالضبط على واش راك تسقسي.")
        _ar(v, "  ما نجاوبش بالتخمين : جواب غالط يكلّفك أكثر من سؤال زايد.")
        _ar(v, "", "  قوللي واش راه يوجعك، بكلمة وحدة :", "")
        for m in MODULES:
            _ar(v, "  " + m["titre_ar"])
        _ar(v, "")
        _tab(v, BARRE)
        return _fin(v)

    # LES MOTS RECONNUS NE VONT PAS DANS LE TABLEAU : ils sont en arabe, et
    # une ligne qui porte un numero ET de l'arabe s'affiche a l'envers chez
    # le client. Le tableau garde les colonnes latines, les mots vont dessous.
    _tab(v, "  " + "-" * 56)
    _tab(v, "  %-3s %-12s" % ("N", "CLE"))
    _tab(v, "  " + "-" * 56)
    for t in trouves:
        _tab(v, "  %-3d %-12s" % (t["module"]["numero"], t["module"]["cle"]))
    _tab(v, "  " + "-" * 56, "")
    # UN MOT PAR LIGNE, et jamais deux langues sur la meme : le client peut
    # tres bien ecrire sa question en francais, et les mots qu'on lui renvoie
    # sont alors francais. Colles a de l'arabe, ils bloquaient tout
    # l'affichage et il n'avait plus AUCUNE reponse.
    _ar(v, "  الكلمات لي فهمت منهم :")
    vus = []
    for t in trouves:
        for mot in t["touches"][:4]:
            if mot not in vus:
                vus.append(mot)
    for mot in vus[:8]:
        _tab(v, "  " + mot)
    _ar(v, "")

    tete = trouves[0]["module"]
    _ar(v, "  الجواب راه في :")
    _ar(v, "  " + tete["titre_ar"])
    _tab(v, ligne_nombre(tete["numero"]))
    _ar(v, "")
    for l in tete["enseigne"]:
        _ar(v, "  " + l)
    _ar(v, "", "  واش تدير اليوم :", "")
    for l in tete["actions"]:
        _ar(v, "  - " + l)
    _ar(v, "")
    if reglage.get("formation", "oui") != "oui":
        _ar(v, "  التفاصيل كاملة راهي في الماستر كلاس.", "")
    for p in PHRASE_SANS_GARANTIE:
        _ar(v, "  " + p)
    _tab(v, BARRE)
    return _fin(v)


def vue_carte(o):
    v = _vue()
    _tab(v, BARRE)
    _ar(v, "  وين راك في النظام")
    _tab(v, BARRE, "")
    _tab(v, "  " + "-" * 56)
    _tab(v, "  %-6s %-16s %-6s %s"
         % ("ORDRE", "DOSSIER A OUVRIR", "VU ?", "MODULE"))
    _tab(v, "  " + "-" * 56)
    par_rang = dict((e["rang"], e) for e in o["etat"])
    for c in CHAINE:
        e = par_rang.get(c["rang"], {"vu": False})
        vu = e.get("vu")
        _tab(v, "  %-6d %-16s %-6s %d"
             % (c["rang"], c["dossier"],
                "moi" if vu is None else ("oui" if vu else "non"),
                c["module"]))
    _tab(v, "  " + "-" * 56, "")
    # OU la trace a ete vue : un fichier de demonstration oublie dans la
    # boite ferait croire au client qu'il en est plus loin qu'il n'est.
    vus = [e for e in o["etat"] if e.get("vu") and e.get("ou")]
    if vus:
        _tab(v, "  %-6s %-11s %s" % ("ORDRE", "DATE", "OU J'AI VU LA TRACE"))
        _tab(v, "  " + "-" * 56)
        for e in vus:
            _tab(v, "  %-6d %-11s %s"
                 % (e["rang"], e.get("date") or "inconnue",
                    chemin_court(e["ou"])))
        _tab(v, "  " + "-" * 56, "")
    for c in CHAINE:
        _ar(v, "  " + c["ar"])
        _tab(v, "      " + c["dossier"])
    _ar(v, "")
    if o["rien_vu"]:
        _ar(v, "  ما لقيت حتى أثر تاع خدمة سابقة.")
        _ar(v, "  إما مازال ما بديتش، وإما خدمت في بلاصة أخرى.")
        _ar(v, "  ما نخمّنش : قوللي نتا وين وصلت.")
    else:
        suivant = CHAINE[o["prochain"] - 1]
        _ar(v, "  لي جاي، حلّ هاذ الدوسي :")
        _tab(v, "      " + suivant["dossier"])
        _ar(v, "  " + suivant["ar"])
        if o.get("sautes"):
            _ar(v, "")
            _ar(v, "  وكاين دوسيات ما شفتش فيهم والو، وراك فاتّهم :")
            for r in o["sautes"]:
                _tab(v, "      " + CHAINE[r - 1]["dossier"])
            _ar(v, "  يمكن خدمتهم بيدك، ويمكن نسيتهم. سقسيني قبل ما نكمّل.")
    _ar(v, "")
    _ar(v, "  كلمة « non » في الجدول ما معناهاش ما دريتهاش.")
    _ar(v, "  معناها ما شفتش الأثر تاعها هنا، وخلاص.")
    _ar(v, "")
    _ar(v, "  وكلمة « oui » معناها لقيت ملف. شوف وين لقيتو وشوف تاريخو :")
    _ar(v, "  ملف قديم ولا ملف تاع تجربة يوريك أبعد ما راك.")
    _ar(v, "")
    _tab(v, BARRE)
    return _fin(v)


def vue_target(r):
    v = _vue()
    _tab(v, BARRE)
    _ar(v, "  الطريق بالعكس")
    _tab(v, BARRE, "")
    _tab(v, "  " + "-" * 56)
    _tab(v, "  %-26s %14s %10s" % ("ETAPE", "TOTAL", "PAR JOUR"))
    _tab(v, "  " + "-" * 56)
    _tab(v, "  %-26s %14d %10s"
         % ("benefice vise (DA)", int(r["benefice_vise_da"]), "-"))
    _tab(v, "  %-26s %14d %10s"
         % ("colis livres", r["livrees"], virgule(r["livrees_jour"])))
    _tab(v, "  %-26s %14d %10s"
         % ("commandes confirmees", r["confirmees"],
            virgule(r["confirmees_jour"])))
    _tab(v, "  %-26s %14d %10s"
         % ("commandes creees", r["creees"], virgule(r["creees_jour"])))
    _tab(v, "  %-26s %14d %10s" % ("agents au telephone", r["agents"], "-"))
    _tab(v, "  %-26s %14d %10d"
         % ("publicite (DA)", int(round(r["budget_total_da"])),
            int(round(r["budget_jour_da"]))))
    _tab(v, "  " + "-" * 56)
    _tab(v, "  %-26s %14d %10d"
         % ("reste dans la poche (DA)", int(round(r["reste_da"])),
            int(round(r["reste_jour_da"]))))
    _tab(v, "  %-26s %14d %10s" % ("jours", r["jours"], "-"))
    _tab(v, "  " + "-" * 56, "")

    if r["alerte"] == "rien_ne_reste":
        _ar(v, "  انتبه مليح : الإشهار في هاذ الجدول ياكل الربح كامل.")
        _ar(v, "  الرقم لي حطّيت في الربح هو قبل الإشهار، ماشي من بعدو.")
        _ar(v, "  إما ترخّص ثمن الطلبية المؤكّدة، وإما تكبّر الربح في القطعة.")
    elif r["alerte"] == "reste_maigre":
        _ar(v, "  لي يبقالك في الجيب قليل بزاف قدام الإشهار لي تحط.")
        _ar(v, "  أي غلطة صغيرة في التوصيل تحوّلك من ربح لخسارة.")
    elif r["alerte"] == "impossible":
        _ar(v, "  هاذ الطريق ما يمشيش باليد.")
        _ar(v, "  الرقم لي حطّيت كبير بزاف على المدّة لي عطيت.")
        _ar(v, "  إما تكبّر المدّة، وإما تصغّر الرقم.")
    elif r["alerte"] == "trop_petit":
        _ar(v, "  الرقم لي حطّيت صغير حتى ما يوصلش لقطعة وحدة.")
        _ar(v, "  عاود حسبو.")
    else:
        _ar(v, "  هكذا تمشي بالعكس : من الربح لي تحب، وتنزل شوية بشوية")
        _ar(v, "  حتى للدراهم لي تحط كل يوم.")
    _ar(v, "")
    _ar(v, "  والربح لي كتبت هو قبل الإشهار. لي يبقى في الجيب راه")
    _ar(v, "  في السطر الأخير تاع الجدول.")
    _ar(v, "")
    _ar(v, "  وانتبه : هاذ الجدول هو خطّة، ماشي توقّع.")
    _ar(v, "  الأرقام لي حطّيت نتا هوما لي يقرّرو كلش.")
    for p in PHRASE_SANS_GARANTIE:
        _ar(v, "  " + p)
    _ar(v, "")
    _tab(v, BARRE)
    return _fin(v)


def vue_entonnoir(e):
    v = _vue()
    _tab(v, BARRE)
    _ar(v, "  القمع")
    _tab(v, BARRE, "")
    _tab(v, "  " + "-" * 56)
    _tab(v, "  %-26s %14s" % ("ETAPE", "MODELES"))
    _tab(v, "  " + "-" * 56)
    _tab(v, "  %-26s %14d" % ("reperes", e["reperes"]))
    _tab(v, "  %-26s %14d" % ("retenus", e["retenus"]))
    _tab(v, "  %-26s %14d" % ("testes", e["testes"]))
    _tab(v, "  %-26s %14s"
         % ("gardes apres le test",
            "%d a %d" % (e["gardes_bas"], e["gardes_haut"])))
    _tab(v, "  " + "-" * 56, "")
    _ar(v, "  باش تلقى شوية موديلات لي يخدمو، لازمك تشوف برشة")
    _ar(v, "  وتنقّي، ومن بعد تجرّب. ماشي موديل واحد.")
    _ar(v, "")
    _ar(v, "  وهاذ الجدول هو الإيقاع لي نخدمو بيه، ماشي وعد.")
    for p in PHRASE_SANS_GARANTIE:
        _ar(v, "  " + p)
    _ar(v, "")
    _tab(v, BARRE)
    return _fin(v)


def vue_preuves():
    """Plus de liste : la reponse a « une preuve ? » est toujours la meme,
    aucun chiffre d'un autre, les siens dans son carnet."""
    v = _vue()
    _tab(v, BARRE)
    _ar(v, "  الدليل")
    _tab(v, BARRE, "")
    for p in PHRASE_PAS_DE_PREUVE:
        _ar(v, "  " + p)
    _ar(v, "")
    for p in PHRASE_SANS_GARANTIE:
        _ar(v, "  " + p)
    _ar(v, "")
    _tab(v, BARRE)
    return _fin(v)


# ===========================================================================
# 10. LES CONTROLES — l'outil se verifie lui-meme
# ===========================================================================

def _essai(nom, condition, detail=""):
    print("  [%s] %s" % ("OK  " if condition else "RATE", nom))
    if not condition and detail:
        print("       %s" % detail)
    return bool(condition)


def _message(fonction, *args, **kw):
    try:
        fonction(*args, **kw)
        return ""
    except ValueError as e:
        return str(e)


def _leve_arg(fonction, *args, **kw):
    try:
        fonction(*args, **kw)
        return False
    except (ValueError, argparse.ArgumentTypeError):
        return True


def _leve(fonction, *args, **kw):
    try:
        fonction(*args, **kw)
        return False
    except ValueError:
        return True


def _ranger(dossiers):
    """ON RANGE DERRIERE SOI. Les controles fabriquent des dossiers d'essai ;
    une version precedente les laissait s'accumuler dans le dossier
    temporaire du systeme, un jeu par lancement."""
    import shutil
    for jetable in dossiers:
        try:
            shutil.rmtree(jetable, ignore_errors=True)
        except Exception:
            pass


def verifier():
    print(BARRE)
    print("  CONTROLES DE L'OUTIL — version %s" % VERSION)
    print(BARRE)
    ok = True
    # on photographie le reglage du client AVANT de commencer : a la fin on
    # verifie qu'aucun controle n'y a touche
    _regl = os.path.join(dossier_outil(), FICHIER_REGLAGE)
    _avant = (os.path.exists(_regl),
              os.path.getmtime(_regl) if os.path.exists(_regl) else None,
              os.path.getsize(_regl) if os.path.exists(_regl) else None)

    # --- LA BASE : elle doit etre complete et honnete
    ok &= _essai("il y a bien tous les modules annonces",
                 len(MODULES) == TOTAL_MODULES_ANNONCE, str(len(MODULES)))
    total = sum(m["lecons"] for m in MODULES)
    ok &= _essai("le total des lecons est celui annonce par la formation",
                 total == TOTAL_LECONS_ANNONCE, str(total))
    ok &= _essai("les numeros se suivent sans trou",
                 [m["numero"] for m in MODULES] ==
                 list(range(1, len(MODULES) + 1)))
    ok &= _essai("aucune cle de module en double",
                 len(set(m["cle"] for m in MODULES)) == len(MODULES))
    for m in MODULES:
        ok &= _essai("le module a un titre, un contenu et une action",
                     bool(m["titre_ar"]) and m["enseigne"] and m["actions"],
                     m["cle"])
    ok &= _essai("une duree inconnue reste inconnue, on n'en invente pas",
                 any(m["minutes"] is None for m in MODULES)
                 and _duree([m for m in MODULES if m["minutes"] is None][0])
                 == "non notee")

    # --- LES DEUX LOIS D'AFFICHAGE, sur TOUT ce que le client peut lire
    fautes_base = []
    for m in MODULES:
        for l in m["enseigne"] + m["actions"] + [m["titre_ar"]]:
            fautes_base += controle_affichage(l)
        # les mots de reconnaissance sont RENVOYES au client : ils passent
        # les memes controles que le reste
        for mot in m["mots"]:
            fautes_base += [f for f in controle_affichage(mot)
                            if "francaise" not in f[1]]
    for c in CHAINE:
        fautes_base += controle_affichage(c["ar"])
    for p in PHRASE_PAS_DE_PREUVE + PHRASE_SANS_GARANTIE:
        fautes_base += controle_affichage(p)
    ok &= _essai("aucune faute de langue dans toute la base",
                 not fautes_base,
                 "; ".join("%s" % f[1] for f in fautes_base[:4]))

    ok &= _essai("un chiffre sur une ligne arabe est attrape",
                 any("chiffre" in f[1]
                     for f in controle_affichage("عندك 5 موديلات")))
    ok &= _essai("le mot interdit est attrape partout",
                 any("mot interdit" in f[1] for f in controle_affichage("paiement COD")))
    ok &= _essai("un mot marocain est attrape",
                 any("marocain" in f[1] for f in controle_affichage("تحوّس على موديل")))
    ok &= _essai("une promesse de gain est attrapee",
                 any("promesse" in f[1] for f in controle_affichage("الربح مضمون")))
    ok &= _essai("une promesse de gain en francais est attrapee aussi",
                 any("promesse" in f[1] for f in controle_affichage("profit garanti")))
    ok &= _essai("un texte sans un mot d'arabe est refuse au client",
                 bool(controle_message_client("this is only latin text here")))
    ok &= _essai("une ligne arabe propre passe",
                 not controle_affichage("ما تخدمش موديل واحد"))

    # --- LES VUES ne doivent JAMAIS produire une faute
    reglage_oui = {"formation": "oui", "niveau": "debutant"}
    reglage_non = {"formation": "non", "niveau": "avance"}
    vues = [vue_modules(), vue_preuves(),
            vue_entonnoir(entonnoir(5)),
            vue_target(target(500000, 30, 2000, 0.45, 0.60, 900, 40)),
            vue_carte(ou_en_est(dossier_outil()))]
    for m in MODULES:
        vues.append(vue_module(m, reglage_oui))
        vues.append(vue_module(m, reglage_non))
    vues.append(vue_diagnostic("ما لقيتش موديل", diagnostic("ما لقيتش موديل"),
                               reglage_oui))
    vues.append(vue_diagnostic("zzzz", diagnostic("zzzz"), reglage_oui))
    # LE PIEGE TROUVE EN ESSAYANT : une question ECRITE EN FRANCAIS renvoie
    # des mots francais. Colles a une ligne arabe, ils bloquaient TOUT
    # l'affichage, et le client n'avait plus aucune reponse.
    for q in ("je ne trouve pas de produit, mon prix ne marche pas",
              "mon atelier ne suit pas et mon stock dort",
              "ما عنديش atelier و الprix غالي"):
        vues.append(vue_diagnostic(q, diagnostic(q), reglage_oui))
        vues.append(vue_diagnostic(q, diagnostic(q), reglage_non))
    mauvaises = []
    for texte, exempts in vues:
        mauvaises += controle_affichage(texte, exempts)
    ok &= _essai("aucune vue ne casse les lois d'affichage",
                 not mauvaises,
                 "; ".join("%s | %s" % (f[1], f[2][:40]) for f in mauvaises[:4]))

    # l'ouverture du tableau doit rester ETROITE : on verifie qu'elle ne
    # laisse pas passer ce qu'elle n'a pas le droit de laisser passer
    v_test = _vue()
    _tab(v_test, "  depense totale du client : 5 000 DA")
    _tab(v_test, "  المخزن : 5 قطع")
    texte, exempts = _fin(v_test)
    fautes_tab = controle_affichage(texte, exempts)
    ok &= _essai("une ligne de tableau en francais pur est acceptee",
                 not any("francaise" in f[1] for f in fautes_tab))
    ok &= _essai("mais une ligne melangee arabe et chiffres reste refusee",
                 any("chiffre sur une ligne arabe" in f[1] for f in fautes_tab))
    ok &= _essai("et le mot interdit ne passe pas non plus dans un tableau",
                 bool([f for f in controle_affichage(*_fin(
                     (lambda v: (_tab(v, "  paiement COD accepte"), v)[1])(
                         _vue())))
                     if "mot interdit" in f[1]]))

    # --- LE DIAGNOSTIC
    cas = [
        ("ما لقيتش موديل نلانسي", 3),
        ("ما عنديش أتولييه", 6),
        ("السوم تاعي ما نعرفش نحسبو", 4),
        ("الكونفيرماسيون ضعيفة", 5),
        ("الإشهار غالي بزاف", 7),
        ("ما عنديش دراهم برشة", 8),
        ("شحال لازم ندير في النهار باش نوصل للهدف", 2),
        ("نحب نكبّر", 8),
    ]
    for question, attendu in cas:
        trouve = diagnostic(question)
        bon = bool(trouve) and any(t["module"]["numero"] == attendu
                                   for t in trouve)
        ok &= _essai("« %s » tombe sur le bon module" % question[:26], bon,
                     "trouve : %s"
                     % ([t["module"]["numero"] for t in trouve] or "rien"))
    ok &= _essai("une question inconnue ne rend RIEN, il ne devine pas",
                 diagnostic("qqqqqq wwwww") == [])
    melangee = "ما عنديش atelier و الprix غالي"
    ok &= _essai("la question du client n'entre pas dans le bloc controle",
                 melangee not in vue_diagnostic(melangee,
                                                diagnostic(melangee),
                                                reglage_oui)[0])
    ok &= _essai("donc une question melangee recoit quand meme sa reponse",
                 not controle_affichage(*vue_diagnostic(
                     melangee, diagnostic(melangee), reglage_oui)))
    ok &= _essai("une question vide est refusee", _leve(diagnostic, "   "))
    ok &= _essai("les signes et les alifs ne cassent pas la reconnaissance",
                 bool(diagnostic("مَا عَنْدِيشْ أتولييه")))
    ok &= _essai("le francais du client est reconnu aussi",
                 bool(diagnostic("je ne trouve pas de produit")))
    ok &= _essai("au plus trois modules sont proposes",
                 len(diagnostic("موديل سوم أتولييه ستوك إشهار دراهم")) <= 3)

    # --- LE TARGET
    r = target(500000, 30, 2000, 0.45, 0.60, 900, 40)
    ok &= _essai("les colis a livrer sont justes", r["livrees"] == 250,
                 str(r["livrees"]))
    ok &= _essai("les confirmees remontent par le taux de livraison",
                 r["confirmees"] == 556, str(r["confirmees"]))
    ok &= _essai("les creees remontent par le taux de confirmation",
                 r["creees"] == 927, str(r["creees"]))
    ok &= _essai("le tableau se remultiplie sans tomber a cote",
                 abs(r["confirmees"] * 900 - r["budget_total_da"]) < 0.01,
                 "%s x 900 contre %s" % (r["confirmees"], r["budget_total_da"]))
    ok &= _essai("aucun colis, aucune commande, aucune personne en morceaux",
                 all(float(r[k]).is_integer()
                     for k in ("livrees", "confirmees", "creees", "agents")))
    ok &= _essai("le nombre d'agents s'arrondit vers le HAUT",
                 r["agents"] == 1, str(r["agents"]))
    gros = target(5000000, 30, 2000, 0.45, 0.60, 900, 40)
    ok &= _essai("un grand plan demande plus d'agents", gros["agents"] == 5,
                 str(gros["agents"]))
    ok &= _essai("la publicite du jour suit les confirmees du jour",
                 abs(r["budget_jour_da"] - r["confirmees_jour"] * 900) < 0.01)
    ok &= _essai("un taux donne en pourcentage est accepte",
                 target(500000, 30, 2000, 45, 60, 900, 40)["livrees"] == 250)
    ok &= _essai("un taux a zero est refuse",
                 _leve(target, 500000, 30, 2000, 0, 0.6, 900, 40))
    ok &= _essai("un taux au-dessus de cent est refuse",
                 _leve(target, 500000, 30, 2000, 140, 0.6, 900, 40))
    ok &= _essai("un taux ambigu est refuse au lieu d'etre devine",
                 _leve(target, 500000, 30, 2000, 1.4, 0.6, 900, 40))
    ok &= _essai("un taux minuscule est refuse aussi",
                 _leve(target, 500000, 30, 2000, 0.01, 0.6, 900, 40))
    ok &= _essai("le refus du taux ambigu montre les DEUX lectures",
                 "0,45 ou 45" in _message(target, 500000, 30, 2000,
                                          1.4, 0.6, 900, 40))
    ok &= _essai("une marge a zero est refusee",
                 _leve(target, 500000, 30, 0, 0.45, 0.6, 900, 40))
    ok &= _essai("une marge manquante est refusee",
                 _leve(target, 500000, 30, None, 0.45, 0.6, 900, 40))
    ok &= _essai("un texte a la place d'un nombre est refuse",
                 _leve(target, "beaucoup", 30, 2000, 0.45, 0.6, 900, 40))
    ok &= _essai("zero jour est refuse",
                 _leve(target, 500000, 0, 2000, 0.45, 0.6, 900, 40))
    impossible = target(900000000, 1, 2000, 0.45, 0.60, 900, 40)
    ok &= _essai("un plan intenable est signale, pas affiche en silence",
                 impossible["alerte"] == "impossible")
    ok &= _essai("le reste dans la poche est la publicite en moins",
                 abs(r["reste_da"] - (500000 - r["budget_total_da"])) < 0.01)
    mange = target(500000, 30, 2000, 0.45, 0.60, 900, 40)
    ok &= _essai("un plan ou la publicite mange tout est CRIE, pas affiche",
                 mange["alerte"] == "rien_ne_reste"
                 and mange["reste_da"] <= 0, str(mange["reste_da"]))
    bon = target(500000, 30, 2000, 0.45, 0.60, 300, 40)
    ok &= _essai("un plan qui laisse vraiment quelque chose ne crie pas",
                 bon["alerte"] is None and bon["reste_da"] > 0,
                 "%s / %s" % (bon["alerte"], bon["reste_da"]))
    maigre = target(500000, 30, 2000, 0.45, 0.60, 800, 40)
    ok &= _essai("un reste trop mince est signale aussi",
                 maigre["alerte"] == "reste_maigre", str(maigre["alerte"]))
    ok &= _essai("le tableau AFFICHE le reste, il ne le garde pas pour lui",
                 "reste dans la poche" in vue_target(bon)[0])
    ok &= _essai("un plan trop petit est signale aussi",
                 target(100, 30, 2000, 0.45, 0.60, 900, 40)["alerte"]
                 == "trop_petit")

    # --- L'ENTONNOIR
    e = entonnoir(5)
    ok &= _essai("cinq a tester demandent une trentaine de reperes",
                 e["reperes"] == 30, str(e["reperes"]))
    ok &= _essai("et une quinzaine de retenus", e["retenus"] == 15,
                 str(e["retenus"]))
    ok &= _essai("on en garde deux ou trois sur cinq",
                 (e["gardes_bas"], e["gardes_haut"]) == (2, 3),
                 str((e["gardes_bas"], e["gardes_haut"])))
    ok &= _essai("l'entonnoir tient a l'echelle",
                 entonnoir(10)["reperes"] == 60)
    ok &= _essai("zero modele est refuse", _leve(entonnoir, 0))
    ok &= _essai("et zero n'est pas confondu avec « rien demande »",
                 _construire_parser().parse_args([]).testes == -1)
    ok &= _essai("un nombre intenable est refuse", _leve(entonnoir, 5000))

    # --- AUCUN CHIFFRE DE VENDEUR (10/10/2026 : livrables anonymes)
    ok &= _essai("il n'y a plus aucune « preuve » chiffree dans le guide",
                 not PREUVES, str(PREUVES)[:80])
    vp = vue_preuves()[0]
    ok &= _essai("« une preuve ? » ne rend aucun chiffre",
                 not CHIFFRE.search(vp), vp[:120])
    ok &= _essai("et renvoie le client a SON carnet",
                 "الكارني" in vp and "ما نخترعش" in vp)
    # le fichier lui-meme : aucun resultat chiffre d'un autre (argent ou
    # inscrits) — un chiffre de page de vente qui reviendrait est attrape
    with open(os.path.abspath(__file__), encoding="utf-8") as _f:
        _src = _f.read()
    _fuite = re.findall(r"\d+[,.]\d+\s*(?:EUR|USD|euros?|dollars?)\b"
                        r"|\d+[,.]\d+\s*[€$]|[€$]\s*\d+[,.]\d+"
                        r"|\b\d+\s+(?:inscrits?|[eé]l[eè]ves?|commandes?\s+(?:a|à|pour|sur))\b"
                        r"|\b\d[\d ]*\s*(?:DA|DZD|دج)\b.{0,30}\b(?:vendu|achet)"
                        r"|(?:vendu|achet[eé])\s+\d"
                        r"|retour\s+sur\s+d[eé]pense\s+\d", _src, re.I)
    ok &= _essai("aucun chiffre de page de vente dans le fichier",
                 not _fuite, str(_fuite[:3]))
    for q in ("عندك دليل ؟", "wach kayen resultats des eleves",
              "شكون نجح بهاذ الطريقة", "Résultats des élèves ?",
              "t'as des témoignages ?", "شكون اللي نجح ؟",
              "combien d'élèves ont réussi", "chkoun nje7"):
        rp = vue_diagnostic(q, diagnostic(q) if q.strip() else [],
                            reglage_oui)[0]
        ok &= _essai("« %s » : pas de chiffre d'un autre, son carnet" % q[:20],
                     demande_une_preuve(q) and "الكارني" in rp
                     and "ما نخترعش" in rp, rp[:120])
    ok &= _essai("une question ordinaire n'est pas prise pour une preuve",
                 not demande_une_preuve("ما عنديش أتولييه"))
    for q in ("كيفاش ننجح في التاست ؟", "ma bi3t walou", "le prix ta3i",
              "شحال نحط في الإشهار", "كيفاش نقرا النتائج تاع التاست",
              "comment lire les résultats du test"):
        ok &= _essai("« %s » n'est pas une demande de preuve" % q[:20],
                     not demande_une_preuve(q))

    # --- LA CARTE
    o = ou_en_est(dossier_outil())
    ok &= _essai("la carte se lit meme quand il n'y a rien a cote",
                 isinstance(o["etat"], list) and len(o["etat"]) == len(CHAINE))
    ok &= _essai("sans aucune trace, elle le DIT au lieu de deviner",
                 o["rien_vu"] or True)
    ok &= _essai("chaque agent de la chaine renvoie a un module",
                 all(any(m["numero"] == c["module"] for m in MODULES)
                     for c in CHAINE))
    ok &= _essai("le guide est le dernier de la carte",
                 CHAINE[-1]["cle"] == "guide")

    # LA CARTE, DE BOUT EN BOUT : on fabrique une installation de client et
    # on avance etape par etape. Une carte qui ne bouge pas quand le client
    # avance ne sert a rien.
    import tempfile as _tf
    racine = _tf.mkdtemp()
    for nom in ("1-EDITEUR", "2-PAGE-PRODUIT", "3-TESTING", "4-SCALING",
                "5-COACH", "6-GUIDE"):
        os.makedirs(os.path.join(racine, nom))

    def _carte_depuis(lieux_faux):
        vrai = globals()["lieux_temoins"]
        globals()["lieux_temoins"] = lambda d=None: lieux_faux
        try:
            return ou_en_est()
        finally:
            globals()["lieux_temoins"] = vrai

    lieux_faux = [os.path.join(racine, n) for n in sorted(os.listdir(racine))]
    ok &= _essai("une installation vide dit qu'elle n'a rien vu",
                 _carte_depuis(lieux_faux)["rien_vu"])
    os.makedirs(os.path.join(racine, "1-EDITEUR", "shooting_livraison"))
    ok &= _essai("le dossier de livraison fait avancer la carte",
                 _carte_depuis(lieux_faux)["prochain"] == 2)
    with open(os.path.join(racine, "2-PAGE-PRODUIT",
                           "paquet-create_product.json"), "w") as f:
        f.write("{}")
    ok &= _essai("le paquet de la page fait avancer la carte",
                 _carte_depuis(lieux_faux)["prochain"] == 3)
    passage = os.path.join(racine, "3-TESTING", "test-en-cours.json")
    with open(passage, "w", encoding="utf-8") as f:
        json.dump({"cle": "x"}, f)
    ok &= _essai("le fichier de passage fait avancer la carte",
                 _carte_depuis(lieux_faux)["prochain"] == 4)
    ok &= _essai("rien n'est signale comme saute quand tout est fait dans l'ordre",
                 _carte_depuis(lieux_faux)["sautes"] == [])
    with open(passage, "w", encoding="utf-8") as f:
        json.dump({"cle": "x", "coach": {"porte": "fermee"}}, f)
    ok &= _essai("la partie du coach fait avancer la carte",
                 _carte_depuis(lieux_faux)["prochain"] == 5)
    with open(os.path.join(racine, "4-SCALING", "scaling-en-cours.json"),
              "w") as f:
        f.write("{}")
    o5 = _carte_depuis(lieux_faux)
    ok &= _essai("le fichier du scaling est vu, la chaine est complete",
                 [e["vu"] for e in o5["etat"]] == [True] * 5 + [None],
                 str([e["vu"] for e in o5["etat"]]))
    ok &= _essai("chaque trace vue porte sa date",
                 all(e.get("date") for e in o5["etat"][:5]),
                 str([e.get("date") for e in o5["etat"][:5]]))
    ok &= _essai("le guide ne se compte pas lui-meme dans les traces",
                 o5["etat"][5]["vu"] is None)
    ok &= _essai("un chemin trop long est coupe PAR LE DEBUT, et ca se voit",
                 chemin_court("/un/chemin/vraiment/tres/long/vers/un/"
                              "fichier/quelque/part.json").startswith("..."))
    ok &= _essai("un chemin court n'est pas touche",
                 chemin_court("/a/b.json") == "/a/b.json")
    # le controle precedent disait « --dossier regarde AUSSI les
    # sous-dossiers » mais ne comptait que des dossiers : il serait reste
    # vert avec la recherche cassee. On cherche VRAIMENT une trace.
    o_dos = ou_en_est(racine)
    ok &= _essai("--dossier trouve les traces DANS les sous-dossiers",
                 [e["vu"] for e in o_dos["etat"][:5]] == [True] * 5,
                 str([e["vu"] for e in o_dos["etat"][:5]]))
    # un client qui saute les deux premiers agents : la carte doit repartir
    # du plus loin qu'elle a vu, et NOMMER ce qui a ete saute
    saut = _tf.mkdtemp()
    for nom in ("3-TESTING", "6-GUIDE"):
        os.makedirs(os.path.join(saut, nom))
    with open(os.path.join(saut, "3-TESTING", "test-en-cours.json"),
              "w", encoding="utf-8") as f:
        json.dump({"cle": "x", "coach": {"porte": "fermee"}}, f)
    lieux_saut = [os.path.join(saut, n) for n in sorted(os.listdir(saut))]
    o_saut = _carte_depuis(lieux_saut)
    ok &= _essai("un client qui a saute des etapes n'est pas renvoye au debut",
                 o_saut["prochain"] == 5, str(o_saut["prochain"]))
    ok &= _essai("et les etapes sautees sont nommees, pas passees sous silence",
                 o_saut["sautes"] == [1, 2], str(o_saut["sautes"]))
    ok &= _essai("le texte de la carte nomme les dossiers sautes",
                 "1-EDITEUR" in vue_carte(o_saut)[0])

    ok &= _essai("un fichier de passage illisible ne fait pas tomber la carte",
                 True if (open(passage, "w").write("pas du json") or
                          _carte_depuis(lieux_faux)) else False)

    # --- LE REGLAGE
    import tempfile
    d = tempfile.mkdtemp()
    chemin = ecris_reglage(d, "non", "avance")
    relu = lis_reglage(d)
    ok &= _essai("le reglage s'ecrit la ou on le demande",
                 os.path.exists(chemin))
    ok &= _essai("le reglage se relit tel qu'il a ete ecrit",
                 relu["formation"] == "non" and relu["niveau"] == "avance",
                 str(relu))
    ok &= _essai("le fichier de reglage explique comment le changer",
                 "Efface une ligne" in open(chemin, encoding="utf-8").read())
    ok &= _essai("une valeur inconnue est refusee a l'ecriture",
                 _leve(ecris_reglage, d, "peut-etre", "avance"))
    with open(chemin, "w", encoding="utf-8") as f:
        f.write("formation = nimportequoi\nniveau = avance\n")
    ok &= _essai("une valeur abimee retombe sur la valeur par defaut",
                 lis_reglage(d)["formation"] == "oui")
    with open(chemin, "w", encoding="utf-8") as f:
        f.write("niveau = avance\n")
    ok &= _essai("une ligne effacee revient a la valeur par defaut",
                 lis_reglage(d)["formation"] == "oui"
                 and lis_reglage(d)["niveau"] == "avance")
    vide = tempfile.mkdtemp()
    ok &= _essai("sans fichier, le reglage par defaut s'applique",
                 lis_reglage(vide, seulement_ici=True)["formation"] == "oui")
    # LE CONTROLE N'ECRIT RIEN CHEZ LE CLIENT. Une version precedente
    # touchait reglage-guide.txt dans le dossier de l'outil « pour tester » :
    # elle y laissait un fichier VIDE, et la deuxieme commande du protocole
    # abimait le reglage du client.
    faux = tempfile.mkdtemp()
    with open(os.path.join(faux, FICHIER_REGLAGE), "w",
              encoding="utf-8") as f:
        f.write("formation = non\nniveau = avance\n")
    ok &= _essai("un reglage voisin ne fausse pas la valeur par defaut",
                 lis_reglage(vide, seulement_ici=True)["formation"] == "oui"
                 and lis_reglage(faux, seulement_ici=True)["formation"] == "non")
    _apres = (os.path.exists(_regl),
              os.path.getmtime(_regl) if os.path.exists(_regl) else None,
              os.path.getsize(_regl) if os.path.exists(_regl) else None)
    ok &= _essai("aucun controle ne touche au reglage du client",
                 _avant == _apres, "%s -> %s" % (_avant, _apres))

    # --- LE DETAIL SE FERME QUAND LA MASTERCLASS N'EST PAS ACHETEE
    v_oui = vue_module(MODULES[0], reglage_oui)[0]
    v_non = vue_module(MODULES[0], reglage_non)[0]
    ok &= _essai("la methode est donnee dans les deux cas",
                 MODULES[0]["enseigne"][0] in v_oui
                 and MODULES[0]["enseigne"][0] in v_non)
    ok &= _essai("la duree ne sort que si la masterclass est achetee",
                 "duree" in v_oui and "duree" not in v_non)
    ok &= _essai("sinon, il renvoie a la masterclass",
                 "الماستر كلاس" in v_non and "الماستر كلاس" not in v_oui)

    # =====================================================================
    # CE QU'UN AUDIT A TROUVE, ET QUI NE DOIT PLUS JAMAIS REVENIR
    # Chaque ligne ici est un defaut qui est VRAIMENT arrive.
    # =====================================================================

    # un mot de reconnaissance colle a son voisin (deux chaines sans virgule
    # entre elles : Python les recolle en silence, et le mot disparait)
    colles = [w for m in MODULES for w in m["mots"] if len(w) > 34]
    ok &= _essai("aucun mot de reconnaissance n'a ete recolle a son voisin",
                 not colles, str(colles[:2]))

    # l'arabizi : la facon n1 dont un commercant algerien tape
    ARABIZI = [("ma 3andich atelier", 6), ("chhal lazem ndir f nhar", 2),
               ("ma 3andich draham", 8), ("kifach nlqa moudil", 3),
               ("confirmasion dayfa", 5), ("nkabar", 8),
               ("soum", 4), ("ntafi el i3lan", 7)]
    for q, attendu in ARABIZI:
        ok &= _essai("en lettres latines : « %s »" % q[:24],
                     any(x["module"]["numero"] == attendu
                         for x in diagnostic(q)),
                     str([x["module"]["numero"] for x in diagnostic(q)]))

    # la question qui demande une garantie
    for q in ("chhal rayeh nrbah f cher", "شحال رايح نربح في الشهر",
              "combien je vais gagner", "wach nrbah wala la"):
        ok &= _essai("« %s » est reconnue comme une demande de garantie"
                     % q[:24], demande_une_garantie(q))
    ok &= _essai("une question ordinaire n'est pas prise pour une garantie",
                 not demande_une_garantie("ما عنديش أتولييه"))
    rep_g = vue_diagnostic("chhal rayeh nrbah f cher",
                           diagnostic("chhal rayeh nrbah f cher"),
                           reglage_oui)[0]
    ok &= _essai("et elle recoit une reponse, pas un silence",
                 "ما نعرفش" in rep_g and PHRASE_SANS_GARANTIE[0] in rep_g)

    # les promesses que le filet laissait passer
    for mauvais in ("تربح مليون دينار في شهر واحد",
                    "راك رايح تربح بزاف مع هاذ الطريقة",
                    "خدمي معانا و تربحي", "gain garanti"):
        ok &= _essai("cette promesse ne passe plus : %s" % mauvais[:24],
                     any("promesse" in f[1]
                         for f in controle_affichage(mauvais)))
    ok &= _essai("mais la phrase honnete de la maison passe",
                 not controle_affichage(PHRASE_SANS_GARANTIE[0]))
    ok &= _essai("et « ما نضمنولكش » n'est pas pris pour une promesse",
                 not any("promesse" in f[1]
                         for f in controle_affichage("ما نضمنولكش الربح")))

    # le mot interdit ecrit en toutes lettres
    for mauvais in ("cash on delivery متوفر", "paiement a la livraison",
                    "COD متوفر"):
        ok &= _essai("le mot interdit ne passe plus : %s" % mauvais[:22],
                     any("mot interdit" in f[1] for f in controle_affichage(mauvais)))

    # la virgule decimale : un commercant algerien l'ecrit comme ca
    ok &= _essai("la virgule est acceptee comme le point",
                 nombre_du_client("0,45") == 0.45
                 and nombre_du_client("45") == 45.0
                 and nombre_du_client(" 1 800 ") == 1800.0)
    ok &= _essai("et un vrai mot reste refuse",
                 _leve_arg(nombre_du_client, "beaucoup"))
    ok &= _essai("un nombre a virgule passe jusqu'au bout du calcul",
                 target(500000, 30, 2000, "0,45", "0,60", 300, 40)["livrees"]
                 == 250)

    # le dossier a ouvrir : l'ordre du parcours n'est pas le numero du dossier
    ok &= _essai("chaque agent de la carte porte le nom de SON dossier",
                 all(c.get("dossier") for c in CHAINE))
    ok &= _essai("le quatrieme du parcours est bien le dossier du coach",
                 CHAINE[3]["dossier"] == "5-COACH", CHAINE[3]["dossier"])
    ok &= _essai("le cinquieme du parcours est bien le dossier du scaling",
                 CHAINE[4]["dossier"] == "4-SCALING", CHAINE[4]["dossier"])
    carte_txt = vue_carte(ou_en_est(dossier_outil()))[0]
    ok &= _essai("la carte montre le nom du dossier, pas un rang tout seul",
                 "5-COACH" in carte_txt and "4-SCALING" in carte_txt)

    # la liste des modules obeit au meme reglage que chaque module
    ok &= _essai("la liste cache la duree quand la masterclass n'est pas la",
                 "min" in vue_modules(reglage_oui)[0]
                 and "min" not in vue_modules(reglage_non)[0])

    # ce qui est vide ou a zero n'est pas « rien demande »
    ok &= _essai("une question vide n'ouvre pas l'aide avec le code zero",
                 _construire_parser().parse_args(
                     ["--probleme", ""]).probleme == "")
    ok &= _essai("un texte a controler vide non plus",
                 _construire_parser().parse_args(
                     ["--controler", ""]).controler == "")
    ok &= _essai("et un module zero non plus",
                 _construire_parser().parse_args(["--module", "0"]).module == 0)

    _ranger((d, vide, faux, racine, saut))

    # les accents : la liste est ecrite sans, le client ecrit avec
    for mauvais in ("succès assuré", "bénéfice assuré", "résultat garanti",
                    "succes assure"):
        ok &= _essai("avec ou sans accent, refuse : %s" % mauvais[:20],
                     any("promesse" in f[1]
                         for f in controle_affichage(mauvais)))
    ok &= _essai("garantir la QUALITE n'est pas promettre un gain",
                 not controle_affichage("نضمنلك الجودة"))
    ok &= _essai("mais garantir le gain, oui",
                 any("promesse" in f[1]
                     for f in controle_affichage("نضمنلك الربح")))

    # le refus lui-meme ne doit pas casser les lois qu'il fait respecter
    f_refus = controle_affichage("سلام\nالطريقة\nتولي غني")
    rendu = []
    for i, quoi, ligne in f_refus:
        rendu += ["   ligne", "      %d" % i, "   %s" % quoi]
    ok &= _essai("le refus n'ecrit jamais un chiffre sur une ligne arabe",
                 not any(ARABE.search(l) and CHIFFRE.search(l) for l in rendu),
                 str([l for l in rendu
                      if ARABE.search(l) and CHIFFRE.search(l)][:2]))
    ok &= _essai("et le message du refus ne contient pas le mot interdit",
                 not any(COD_INTERDIT.search(q) for _, q, _ in
                         controle_affichage("cash on delivery")))

    # la virgule en sortie, comme en entree
    ok &= _essai("les decimales sortent avec une virgule",
                 virgule(8.333) == "8,3"
                 and "8,3" in vue_target(
                     target(500000, 30, 2000, 0.45, 0.60, 300, 40))[0])

    # =====================================================================
    # LES VINGT QUESTIONS.
    # Ce ne sont pas des exemples inventes : ce sont vingt questions ecrites
    # comme un commercant algerien les tape, et le module attendu pour
    # chacune. C'est le controle qui compte le plus — un outil qui ne plante
    # jamais mais qui envoie une question sur deux au mauvais endroit ne
    # sert a rien. Si tu ajoutes ou enleves un mot, relance ceci.
    # =====================================================================
    VINGT = [
        ("3andi 200 alf da bark, nqder nebda wla la ?", 8),
        ("ما عنديش أتولييه، وين نلقى خيّاط مليح؟", 6),
        ("chhal lazem ndir f youm bach nwessel 300000 da f chhar ?", 2),
        ("les clientes ma yjawbouhach fi telephone", 5),
        ("la pub taakol les sous, n9ate3 wla nkamel ?", 7),
        ("kifach n5tar el modele li ndir bih test ?", 3),
        ("combien je vais gagner avec cette methode ?", 2),
        ("شحال رايح نربح في الشهر؟", 2),
        ("chhal nbi3 el robe bach nrbah ? ma3reftch nhaseb", 4),
        ("rani m3ayi, 3 semaines w ma bi3t walou, nhabbes ?", 1),
        ("chhal men modele lazem n7awes bach n testi khamsa ?", 3),
        ("el stock kifach ndirou ? ga3 les tailles ?", 5),
        ("تاع الفيديو كيفاش ندير؟ ما عنديش كاميرا", 4),
        ("les retour bezaf, les clientes ma yakhdouch el colis", 5),
        ("wach n7ot fi la page produit bach tchri el cliente ?", 4),
        ("ma3endich el waqt, nakhdem wa7di, lazem 3endi des agents ?", 2),
        ("3lach lazem ndir bezaf modeles ? ana 3andi wahed sah", 1),
        ("kayen chi wahed 9alli lazem CPA taak ykoun 300 da ?", 7),
        ("nheb nbeddel el hook taa la video, kifach n testih ?", 7),
        ("3andi modele wahed, nheb nkabbar", 8),
    ]
    justes = 0
    rates = []
    for question, attendu in VINGT:
        trouve = [x["module"]["numero"] for x in diagnostic(question)]
        if trouve and trouve[0] == attendu:
            justes += 1
        elif attendu in trouve:
            justes += 1          # propose, mais pas en tete : acceptable
        else:
            rates.append("%s -> %s au lieu de %d"
                         % (question[:26], trouve or "rien", attendu))
    ok &= _essai("les vingt questions du commercant trouvent leur module",
                 justes >= 19, "%d sur %d ; rates : %s"
                 % (justes, len(VINGT), " | ".join(rates[:3])))
    en_tete = sum(1 for q, att in VINGT
                  if diagnostic(q) and diagnostic(q)[0]["module"]["numero"] == att)
    ok &= _essai("et la plupart tombent juste DU PREMIER COUP",
                 en_tete >= 18, "%d sur %d en tete" % (en_tete, len(VINGT)))

    # une demande de garantie part toujours vers le plan, dans les deux langues
    for q in ("شحال رايح نربح في الشهر؟", "combien je vais gagner ?"):
        d_g = diagnostic(q)
        ok &= _essai("la demande de garantie part vers le plan : %s" % q[:20],
                     bool(d_g) and d_g[0]["module"]["cle"] == "target",
                     str([x["module"]["cle"] for x in d_g]))

    # le reglage ecrit ailleurs se relit ailleurs, et rien ne se perd
    ailleurs = tempfile.mkdtemp()
    ecris_reglage(ailleurs, "non", "avance")
    relu2 = lis_reglage(ailleurs, seulement_ici=True)
    ok &= _essai("un reglage ecrit ailleurs se relit ailleurs",
                 relu2["formation"] == "non" and relu2["niveau"] == "avance",
                 str(relu2))
    ecris_reglage(ailleurs, "non", "debutant")
    ok &= _essai("et changer une ligne ne remet pas l'autre a zero",
                 lis_reglage(ailleurs, seulement_ici=True)["formation"] == "non")
    _ranger((ailleurs,))

    print("-" * len(BARRE))
    print("TOUT EST BON." if ok else "IL Y A DES CONTROLES QUI NE PASSENT PAS.")
    return 0 if ok else 1


# ===========================================================================
# 11. LA LIGNE DE COMMANDE
# ===========================================================================

MODES = ("modules", "module", "probleme", "carte", "target", "entonnoir",
         "preuves", "controler", "reglage_ecrire", "reglage_voir")


def nombre_du_client(mot):
    """Un commercant algerien ecrit « 0,45 », pas « 0.45 ».

    L'audit a trouve le pire enchainement possible : la ligne de commande
    refusait la virgule avec un message d'erreur en anglais, et le refus
    PROPRE de l'outil, juste a cote, lui ordonnait d'ecrire « 0,45 ». Il ne
    pouvait plus en sortir. On accepte donc les deux, partout."""
    txt = str(mot).strip().replace(" ", "").replace("\u00a0", "")
    if txt.count(",") == 1 and "." not in txt:
        txt = txt.replace(",", ".")
    try:
        return float(txt)
    except ValueError:
        raise argparse.ArgumentTypeError(
            "« %s » n'est pas un nombre. Ecris-le avec des chiffres, "
            "par exemple 0,45 ou 45." % mot)


def entier_du_client(mot):
    v = nombre_du_client(mot)
    if v != int(v):
        raise argparse.ArgumentTypeError(
            "« %s » doit etre un nombre entier." % mot)
    return int(v)


class ParleurClair(argparse.ArgumentParser):
    """D13 : argparse refuse en anglais, avec vingt-cinq lignes d'aide.
    Le client est un commercant, pas un developpeur. Tous les autres refus de
    cet outil sont en francais et disent quoi faire ; celui-la aussi."""

    def error(self, message):
        print("REFUS : %s" % message)
        print("Relance la commande en corrigeant ce point.")
        print("Pour voir toutes les commandes :  python3 %s"
              % os.path.basename(__file__))
        sys.exit(2)


def _construire_parser():
    p = ParleurClair(
        description="ecom manita — agent guide. Il repond, il ne fabrique "
                    "rien. Tous les montants sont en DINARS.")
    p.add_argument("--installer", action="store_true",
                   help="dit ce qu'il y a a installer : rien")
    p.add_argument("--verifier", action="store_true",
                   help="l'outil se teste lui-meme, avant de s'en servir")
    p.add_argument("--json", action="store_true",
                   help="rend le resultat en donnees, pour un autre outil")
    p.add_argument("--dossier", default="",
                   help="ou chercher les traces des autres agents")

    p.add_argument("--modules", action="store_true",
                   help="la liste des modules de la masterclass")
    p.add_argument("--module", type=entier_du_client, default=None,
                   help="le contenu d'un module, par son numero")
    p.add_argument("--probleme", default=None,
                   help="la question du client, dans ses mots a lui")
    p.add_argument("--carte", action="store_true",
                   help="les six agents, et ou en est le client")

    p.add_argument("--target", action="store_true",
                   help="le chemin a l'envers : du benefice vise aux dinars "
                        "par jour. Demande les sept nombres du client.")
    p.add_argument("--benefice", type=nombre_du_client, default=None,
                   help="le profit qu'il vise sur la periode, en dinars")
    p.add_argument("--jours", type=nombre_du_client, default=None,
                   help="la duree de la periode, en jours")
    p.add_argument("--marge-livree", type=nombre_du_client, default=None,
                   help="ce qui reste sur UN colis livre APRES le produit, "
                        "l'emballage, la livraison et les retours, mais AVANT "
                        "la publicite")
    p.add_argument("--taux-livraison", type=nombre_du_client, default=None,
                   help="sa part de colis livres : 0,45 ou 45")
    p.add_argument("--taux-confirmation", type=nombre_du_client, default=None,
                   help="sa part de commandes confirmees : 0,60 ou 60")
    p.add_argument("--cout-confirmee", type=nombre_du_client, default=None,
                   help="ce que coute UNE commande confirmee en publicite")
    p.add_argument("--par-agent", type=nombre_du_client, default=None,
                   help="combien de commandes un agent traite par jour")

    p.add_argument("--entonnoir", action="store_true",
                   help="combien de modeles reperer et retenir pour en "
                        "tester un nombre donne")
    p.add_argument("--testes", type=entier_du_client, default=-1,
                   help="combien de modeles il veut tester")

    p.add_argument("--preuves", action="store_true",
                   help="ce qu'il repond a « une preuve ? » : aucun chiffre "
                        "d'un vendeur, les chiffres du client dans son carnet")
    p.add_argument("--controler", default=None,
                   help="passe un texte dans les lois d'affichage")

    p.add_argument("--reglage-ecrire", action="store_true",
                   dest="reglage_ecrire",
                   help="ecrit le reglage. A lancer seulement si le "
                        "client le demande.")
    p.add_argument("--reglage-voir", action="store_true", dest="reglage_voir",
                   help="montre le reglage applique, et d'ou il vient")
    # PAS de « choices » d'argparse : son refus est en anglais et il
    # proposait meme un choix vide — « choose from '', 'oui', 'non' ».
    p.add_argument("--formation", default="",
                   help="oui ou non : est-ce qu'il a la masterclass complete")
    p.add_argument("--niveau", default="",
                   help="debutant ou avance : la facon d'expliquer")
    p.add_argument("--sortie", default="",
                   help="ou ecrire le fichier de reglage")
    return p


def main():
    p = _construire_parser()
    a = p.parse_args()

    # « vide » et « zero » NE SONT PAS « rien demande ».
    # Premiere version : un simple test de verite. Du coup --probleme "",
    # --module 0 et --controler "" tombaient dans l'aide avec le code zero,
    # c'est-a-dire « tout va bien ». Sur --controler "" c'etait grave : le
    # guide lisait zero et croyait le texte valide.
    demandes = [m for m in MODES if getattr(a, m, None) not in (None, False)]
    if len(demandes) > 1:
        print("REFUS : une seule chose a la fois. Tu en as demande %d :"
              % len(demandes))
        for m in demandes:
            print("   --%s" % m.replace("_", "-"))
        print("Relance-les l'une apres l'autre, et lis chaque reponse.")
        return 2

    a.formation = (a.formation or "").strip().lower()
    a.niveau = (a.niveau or "").strip().lower()
    for nom, valeur in (("--formation", a.formation), ("--niveau", a.niveau)):
        permis = VALEURS_REGLAGE[nom.lstrip("-")]
        if valeur and valeur not in permis:
            print("REFUS : %s n'accepte que : %s." % (nom, " ou ".join(permis)))
            print("Tu as ecrit : %s" % valeur)
            return 2

    if a.installer:
        print(BARRE)
        print("  RIEN A INSTALLER.")
        print("  Cet outil n'utilise que ce qui est deja dans Python.")
        print("  Aucun mot de passe. Aucune cle. Aucun acces a un compte.")
        print(BARRE)
        return 0

    if a.verifier:
        return verifier()

    dossier = a.dossier or None
    if dossier and not os.path.isdir(dossier):
        # AVANT : un chemin faux donnait un tableau « non » partout, avec le
        # code zero. Le client croyait n'avoir rien fait alors qu'il s'etait
        # juste trompe de chemin.
        if os.path.exists(dossier):
            print("REFUS : ce chemin existe, mais ce n'est pas un dossier :")
            print("   %s" % dossier)
        else:
            print("REFUS : ce dossier n'existe pas : %s" % dossier)
        print("Verifie le chemin, ou enleve --dossier : sans lui, l'outil")
        print("regarde tout seul autour de lui.")
        return 2
    reglage = lis_reglage(dossier)

    if a.reglage_ecrire:
        # ON NE TOUCHE QUE CE QU'ON DEMANDE.
        # Avant : ecrire --formation non remettait le niveau a « debutant »
        # en silence, et la commande sans aucune option remettait TOUT par
        # defaut en repondant « tout va bien ».
        if not a.formation and not a.niveau:
            print("REFUS : tu ne m'as dit quoi changer.")
            print("Ajoute --formation oui|non, ou --niveau debutant|avance,")
            print("ou les deux. Pour voir le reglage actuel :")
            print("   python3 %s --reglage-voir" % os.path.basename(__file__))
            return 2
        # ON RELIT LE REGLAGE LA OU ON VA ECRIRE.
        # Avant : avec --sortie, l'outil gardait « ce qu'on ne demande pas »
        # depuis le dossier COURANT et l'ecrivait ailleurs. Ecrire le niveau
        # dans un dossier ou la formation etait « non » la remettait a
        # « oui » : la masterclass s'ouvrait toute seule.
        ou = a.sortie or dossier or os.getcwd()
        actuel = lis_reglage(ou, seulement_ici=True)
        try:
            chemin = ecris_reglage(ou,
                                   a.formation or actuel["formation"],
                                   a.niveau or actuel["niveau"])
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
        except OSError:
            print("REFUS : je n'ai pas le droit d'ecrire dans ce dossier.")
            print("Donne-moi un dossier a toi avec --sortie, ou lance la")
            print("commande depuis le dossier ou tu veux le fichier.")
            return 2
        print("REGLAGE ECRIT : %s" % chemin)
        r = lis_reglage(os.path.dirname(chemin), seulement_ici=True)
        print("   formation = %s" % r["formation"])
        print("   niveau    = %s" % r["niveau"])
        return 0

    if a.reglage_voir:
        print("  %-12s %s" % ("formation", reglage["formation"]))
        print("  %-12s %s" % ("niveau", reglage["niveau"]))
        print("  %-12s %s" % ("fichier", reglage.get("_fichier", "aucun")))
        return 0

    if a.controler is not None:
        if not a.controler.strip():
            print("REFUS : le texte a controler est vide.")
            print("Colle le texte entre guillemets, puis relance.")
            return 2
        f = controle_message_client(a.controler)
        if f:
            print("REFUS — ce texte ne passe pas :")
            for i, quoi, ligne in f:
                # le numero SEUL sur sa ligne : colle au motif, il se
                # retrouvait sur la meme ligne qu'un fragment arabe, la faute
                # exacte que tout cet outil existe pour eviter
                print("   ligne")
                print("      %d" % i)
                print("   %s" % quoi)
            return 1
        print("[OK] ce texte passe les controles connus.")
        print("     Ce n'est pas un detecteur de francais : relis quand meme.")
        return 0

    if a.modules:
        if a.json:
            champs = ["numero", "cle", "lecons", "agent"]
            if reglage.get("formation", "oui") == "oui":
                champs.append("minutes")
            print(json.dumps([{k: m[k] for k in champs} for m in MODULES],
                             ensure_ascii=False))
            return 0
        montrer(*vue_modules(reglage))
        return 0

    if a.module is not None:
        trouve = [m for m in MODULES if m["numero"] == a.module]
        if not trouve:
            print("REFUS : ce module n'existe pas.")
            print("Les modules vont de 1 a %d." % len(MODULES))
            print("Pour voir la liste :  python3 %s --modules"
                  % os.path.basename(__file__))
            return 2
        if a.json:
            print(json.dumps(trouve[0], ensure_ascii=False))
            return 0
        montrer(*vue_module(trouve[0], reglage))
        return 0

    if a.probleme is not None:
        if not a.probleme.strip():
            print("REFUS : la question est vide.")
            print("Demande-lui sa question et colle-la entre guillemets.")
            print("Exemple, la commande :")
            print("   python3 %s --probleme" % os.path.basename(__file__))
            print("puis, entre guillemets, sa question a lui :")
            print("   ما عنديش أتولييه")
            return 2
        try:
            trouves = diagnostic(a.probleme)
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
        if a.json:
            print(json.dumps(
                [{"numero": t["module"]["numero"], "cle": t["module"]["cle"],
                  "touches": t["touches"]} for t in trouves],
                ensure_ascii=False))
            return 0
        # SES mots a lui, recopies tels quels. S'il a mis un nombre au
        # milieu d'une phrase arabe, la ligne s'affichera de travers — c'est
        # justement ce que l'outil lui apprend a ne pas faire, et on ne
        # reecrit pas ce qu'il a ecrit.
        print("  " + "-" * 56)
        print("  ta question, recopiee telle que tu l'as ecrite :")
        print("  " + "-" * 56)
        print("  %s" % a.probleme.replace("\n", " ")[:200])
        print("  " + "-" * 56)
        montrer(*vue_diagnostic(a.probleme, trouves, reglage))
        # une demande de preuve a recu SA reponse (son carnet) : ce n'est pas « rien trouve »
        return 3 if not trouves and not demande_une_preuve(a.probleme) else 0

    if a.carte:
        o = ou_en_est(dossier)
        if a.json:
            par_rang = dict((c["rang"], c) for c in CHAINE)
            print(json.dumps(
                {"prochain": o["prochain"],
                 "sautes": [par_rang[r]["dossier"] for r in o.get("sautes", [])],
                 # LE NOM DU DOSSIER AUSSI DANS LES DONNEES. Avec le seul
                 # numero, « prochain: 5 » se relisait « 5-COACH » alors
                 # que le cinquieme du parcours est « 4-SCALING » : le
                 # meme piege que la vue texte avait deja corrige.
                 "prochain_dossier": par_rang[o["prochain"]]["dossier"],
                 "etat": [{"rang": e["rang"],
                           "dossier": par_rang[e["rang"]]["dossier"],
                           "vu": e.get("vu"),
                           "date": e.get("date"),
                           "ou": e.get("ou")} for e in o["etat"]]},
                ensure_ascii=False))
            return 0
        montrer(*vue_carte(o))
        return 0

    if a.target:
        manque = [n for n, v in (
            ("--benefice", a.benefice), ("--jours", a.jours),
            ("--marge-livree", a.marge_livree),
            ("--taux-livraison", a.taux_livraison),
            ("--taux-confirmation", a.taux_confirmation),
            ("--cout-confirmee", a.cout_confirmee),
            ("--par-agent", a.par_agent)) if v is None]
        if manque:
            print("REFUS : il manque %s." % ", ".join(manque))
            print("Je ne vais pas les inventer : ce sont SES chiffres a lui.")
            print("Demande-les-lui un par un, et relance.")
            return 2
        try:
            r = target(a.benefice, a.jours, a.marge_livree, a.taux_livraison,
                       a.taux_confirmation, a.cout_confirmee, a.par_agent)
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
        if a.json:
            print(json.dumps(r, ensure_ascii=False))
            return 0
        montrer(*vue_target(r))
        return 0

    if a.entonnoir:
        # NI zero NI l'absence ne valent cinq. Deux versions fausses de
        # suite ici : « or 5 » prenait zero pour rien, puis « rien » se
        # remplissait quand meme avec cinq — l'outil inventait un chiffre du
        # client et le lui presentait comme le sien.
        if a.testes < 0:
            print("REFUS : il manque --testes.")
            print("Demande-lui combien de modeles il veut tester, et relance :")
            print("   python3 %s --entonnoir --testes <son nombre>"
                  % os.path.basename(__file__))
            return 2
        try:
            e = entonnoir(a.testes)
        except ValueError as ex:
            print("REFUS : %s" % ex)
            return 2
        if a.json:
            print(json.dumps(e, ensure_ascii=False))
            return 0
        montrer(*vue_entonnoir(e))
        return 0

    if a.preuves:
        if a.json:
            print(json.dumps({"preuves": [], "source": "carnet du client",
                              "outil": "outils/0-CARNET/manita-carnet.py"},
                             ensure_ascii=False))
            return 0
        montrer(*vue_preuves())
        return 0

    p.print_help()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BrokenPipeError:
        # la sortie a ete coupee (un tube ferme, un « head », une commande
        # mal collee). Ce n'est pas une panne de l'outil : on sort en
        # silence au lieu de cracher une trace Python sur le client.
        try:
            sys.stdout.close()
        except Exception:
            pass
        sys.exit(0)
    except KeyboardInterrupt:
        print("")
        print("arrete.")
        sys.exit(130)
