# -*- coding: utf-8 -*-
"""
MANITA — LE CARNET DU BUSINESS
==============================
La memoire du marchand. Les agents ECRIVENT ce qu'ils ont MESURE ;
le coach LIT ; la boussole CALCULE dessus.

Un taux DECLARE est un souvenir. Un taux MESURE est un fait.
Le mesure ecrase toujours le declare, et on montre les deux cote a cote.

CE QUI N'ENTRE JAMAIS DANS LE CARNET : aucun mot de passe, aucune cle,
aucun jeton, aucun nom / numero / adresse de cliente. Le refus est
automatique, il n'est pas laisse a la bonne volonte de l'agent.

Tout reste sur la machine du client. Rien ne remonte nulle part.

LA MAISON — ou vit le carnet (meme regle que le courrier) :
  1. MANITA_MAISON, si la variable est posee (les bancs d'essai s'isolent avec)
  2. _maison-ecom-manita, A COTE du dossier ecom-manita, s'il existe deja
     (le manager qui tourne dans Cowork : son ~ n'est pas la maison du Mac)
  3. ~/.manita
Jamais DANS le dossier ecom-manita : ce dossier se copie et se vend.
"""

import argparse
import csv
import io
import json
import os
import re
import sys

VERSION = "1.2"
BARRE = "=" * 62
RACINE_PRODUIT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # ecom-manita
A_COTE = os.path.join(os.path.dirname(RACINE_PRODUIT), "_maison-ecom-manita")
VAR_MAISON = "MANITA_MAISON"


def maison(env=None, a_cote=None):
    """Voir l'en-tete : la variable, puis _maison-ecom-manita a cote, puis ~/.manita."""
    env = os.environ if env is None else env
    a_cote = a_cote or A_COTE
    m = (env.get(VAR_MAISON) or "").strip()
    if m:
        return os.path.expanduser(m)
    if os.path.isdir(a_cote):
        return a_cote
    return os.path.expanduser("~/.manita")


DOSSIER = os.path.join(maison(), "carnet")
MESURES = "mesures.csv"
PRODUITS = "produits"
DECISIONS = "decisions.md"

COLONNES = ["date", "produit", "depense_da", "commandes", "confirmees",
            "expediees", "livrees", "refusees", "en_route", "note"]

# ---------------------------------------------------------------------------
# PARTIE 1 — LE GARDIEN : ce qui n'entre jamais
# ---------------------------------------------------------------------------

INTERDIT = [
    (re.compile(r"(?i)\b(mot de passe|password|passwd|motdepasse)\b"), "un mot de passe"),
    (re.compile(r"(?i)\b(token|jeton|api[_ -]?key|secret|bearer)\b"), "une cle ou un jeton"),
    (re.compile(r"(?i)\b(EAA[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,})\b"), "une cle qui ressemble a un vrai jeton"),
    (re.compile(r"(?<!\d)(0[5-7]\d{8})(?!\d)"), "un numero de telephone algerien"),
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"), "une adresse mail"),
    (re.compile(r"(?<!\d)\d{16,}(?!\d)"), "un long numero (carte ou compte)"),
]


def gardien(texte):
    """Rend la liste des raisons de REFUS. Vide = le texte peut entrer."""
    fautes = []
    for motif, quoi in INTERDIT:
        if motif.search(str(texte)):
            fautes.append(quoi)
    return fautes


def verrou(champs):
    """Passe le gardien sur chaque champ. Leve une erreur au premier refus."""
    for nom, valeur in champs.items():
        fautes = gardien(valeur)
        if fautes:
            raise ValueError(
                "REFUS D'ECRITURE — le carnet ne garde jamais %s (champ : %s)"
                % (fautes[0], nom))
    return True


# ---------------------------------------------------------------------------
# PARTIE 2 — ECRIRE UNE LIGNE DE MESURE
# ---------------------------------------------------------------------------

def chemin(nom, dossier=None):
    return os.path.join(dossier or DOSSIER, nom)


def ouvrir_carnet(dossier=None):
    d = dossier or DOSSIER
    os.makedirs(os.path.join(d, PRODUITS), exist_ok=True)
    p = chemin(MESURES, d)
    if not os.path.exists(p):
        with io.open(p, "w", encoding="utf-8", newline="") as f:
            csv.writer(f).writerow(COLONNES)
    return d


def ecrire_mesure(date, produit, depense_da, commandes, confirmees,
                  expediees=0, livrees=0, refusees=0, en_route=0, note="",
                  dossier=None):
    """Une ligne par JOUR et par PRODUIT. Les taux ne se tapent pas :
    ils se calculent a partir de ces colonnes-la."""
    verrou({"produit": produit, "note": note, "date": date})
    d = ouvrir_carnet(dossier)
    ligne = [date, produit, "%.2f" % float(depense_da), int(commandes),
             int(confirmees), int(expediees), int(livrees), int(refusees),
             int(en_route), note]
    with io.open(chemin(MESURES, d), "a", encoding="utf-8", newline="") as f:
        csv.writer(f).writerow(ligne)
    return dict(zip(COLONNES, ligne))


def lire_mesures(produit=None, dossier=None):
    d = dossier or DOSSIER
    p = chemin(MESURES, d)
    if not os.path.exists(p):
        return []
    with io.open(p, encoding="utf-8", newline="") as f:
        lignes = list(csv.DictReader(f))
    if produit:
        lignes = [l for l in lignes if l["produit"] == produit]
    return lignes


# ---------------------------------------------------------------------------
# PARTIE 3 — LES TAUX MESURES. Personne ne les tape.
# ---------------------------------------------------------------------------

def taux_mesures(produit, dossier=None):
    lignes = lire_mesures(produit, dossier)
    if not lignes:
        return None
    s = {c: 0.0 for c in ("depense_da", "commandes", "confirmees",
                          "expediees", "livrees", "refusees")}
    for l in lignes:
        for c in s:
            s[c] += float(l[c] or 0)
    # « en_route » est un ETAT du jour, pas un flux : on prend la DERNIERE
    # ligne, jamais la somme (sinon le meme colis compte plusieurs fois).
    lignes_datees = sorted(lignes, key=lambda l: l["date"])
    s["en_route"] = float(lignes_datees[-1]["en_route"] or 0)
    conf = s["confirmees"] / s["commandes"] if s["commandes"] else None
    liv = s["livrees"] / s["expediees"] if s["expediees"] else None
    glob = s["livrees"] / s["commandes"] if s["commandes"] else None
    return {
        "produit": produit,
        "jours": len(lignes),
        "totaux": s,
        "confirmation": conf,
        "livraison": liv,
        "taux_global": glob,
        "cout_par_commande": s["depense_da"] / s["commandes"] if s["commandes"] else None,
        "cout_par_livree": s["depense_da"] / s["livrees"] if s["livrees"] else None,
        # sa loi permanente : un colis en route se compte a trois sur dix
        "livrees_prudentes": s["livrees"] + int(s["en_route"] * 0.30),
    }


def assez_de_data(t, mini_commandes=30):
    """Sous ce volume, le taux mesure est trop bruite pour ecraser le declare."""
    if not t:
        return False
    return t["totaux"]["commandes"] >= mini_commandes


# ---------------------------------------------------------------------------
# PARTIE 4 — LA FICHE DU PRODUIT : ses couts, et ses taux DECLARES
# ---------------------------------------------------------------------------

def ecrire_produit(produit, prix, gros, emballage, livraison, retour,
                   conf_declaree, liv_declaree, dossier=None):
    verrou({"produit": produit})
    d = ouvrir_carnet(dossier)
    fiche = {
        "produit": produit, "prix": float(prix), "gros": float(gros),
        "emballage": float(emballage), "livraison": float(livraison),
        "retour": float(retour),
        "confirmation_declaree": float(conf_declaree),
        "livraison_declaree": float(liv_declaree),
    }
    p = os.path.join(d, PRODUITS, "%s.json" % re.sub(r"[^\w-]", "_", produit))
    with io.open(p, "w", encoding="utf-8") as f:
        f.write(json.dumps(fiche, ensure_ascii=False, indent=2))
    return fiche


def lire_produit(produit, dossier=None):
    d = dossier or DOSSIER
    p = os.path.join(d, PRODUITS, "%s.json" % re.sub(r"[^\w-]", "_", produit))
    if not os.path.exists(p):
        return None
    with io.open(p, encoding="utf-8") as f:
        return json.loads(f.read())


# ---------------------------------------------------------------------------
# PARTIE 5 — LA BOUSSOLE, CALCULEE SUR LE CARNET
# ---------------------------------------------------------------------------

def cpl_max(prix, gros, emballage, livraison, retour, conf, dele):
    """LA formule de la boussole. Le cout du retour EST dedans."""
    ppl = prix - gros - emballage - livraison
    return conf * dele * ppl - conf * (1 - dele) * retour


def declare_contre_mesure(produit, dossier=None, mini_commandes=30):
    """Les deux cote a cote. C'est le coeur du carnet."""
    fiche = lire_produit(produit, dossier)
    if not fiche:
        return None
    t = taux_mesures(produit, dossier)
    dec = cpl_max(fiche["prix"], fiche["gros"], fiche["emballage"],
                  fiche["livraison"], fiche["retour"],
                  fiche["confirmation_declaree"], fiche["livraison_declaree"])
    r = {"produit": produit, "fiche": fiche, "mesures": t,
         "cpl_max_declare": dec, "cpl_max_mesure": None,
         "assez": assez_de_data(t, mini_commandes), "ecart_points": None}
    if t and t["confirmation"] is not None and t["livraison"] is not None:
        r["cpl_max_mesure"] = cpl_max(
            fiche["prix"], fiche["gros"], fiche["emballage"],
            fiche["livraison"], fiche["retour"],
            t["confirmation"], t["livraison"])
        r["ecart_points"] = (
            round((t["confirmation"] - fiche["confirmation_declaree"]) * 100, 1),
            round((t["livraison"] - fiche["livraison_declaree"]) * 100, 1))
    return r


def taux_a_utiliser(produit, dossier=None, mini_commandes=30):
    """La regle : le MESURE ecrase le DECLARE, mais seulement quand il y a
    assez de commandes pour que le mesure veuille dire quelque chose."""
    r = declare_contre_mesure(produit, dossier, mini_commandes)
    if not r:
        return None
    if r["assez"] and r["cpl_max_mesure"] is not None:
        return {"source": "mesure",
                "confirmation": r["mesures"]["confirmation"],
                "livraison": r["mesures"]["livraison"],
                "cpl_max": r["cpl_max_mesure"]}
    return {"source": "declare",
            "confirmation": r["fiche"]["confirmation_declaree"],
            "livraison": r["fiche"]["livraison_declaree"],
            "cpl_max": r["cpl_max_declare"]}


# ---------------------------------------------------------------------------
# PARTIE 6 — LES DECISIONS : ce qu'il a decide, et ce qu'il savait
# ---------------------------------------------------------------------------

def ecrire_decision(date, produit, decision, ce_quil_savait, dossier=None):
    verrou({"produit": produit, "decision": decision,
            "ce_quil_savait": ce_quil_savait})
    d = ouvrir_carnet(dossier)
    p = chemin(DECISIONS, d)
    with io.open(p, "a", encoding="utf-8") as f:
        f.write("\n## %s — %s\n- DECIDE : %s\n- IL SAVAIT : %s\n"
                % (date, produit, decision, ce_quil_savait))
    return True


# ---------------------------------------------------------------------------
# PARTIE 7 — L'AFFICHAGE, aux lois de la langue
#            (jamais de chiffre sur une ligne arabe)
# ---------------------------------------------------------------------------

def _da_usd(v, taux):
    """« الطالب 1.0 » : les dinars, et les dollars au taux du CLIENT s'il l'a donné ; sinon les dinars seuls."""
    return "      %.0f DA / %.2f USD" % (v, v / taux) if taux else "      %.0f DA" % v


def vue_carnet(r, taux=None):  # 1.0 : plus de 255 par défaut (avant 260, puis 255) : --taux-dinar, le sien, ou les dinars seuls
    L = [BARRE, "  الكارني — واش قالو الكولي بالصحّ", BARRE, "",
         "  المنتوج", "      %s" % r["produit"], ""]
    t = r["mesures"]
    if not t or not t["totaux"]["commandes"]:
        L += ["  مازال ما عندنا حتى قياس على هاذ المنتوج.",
              "  نخدمو بالأرقام لي قلتهم نتا.", ""]
    else:
        L += ["  أيام مقيسة", "      %d" % t["jours"], "",
              "  الكوموند لي دخلو", "      %d" % t["totaux"]["commandes"], "",
              "  لي تأكّدو", "      %d" % t["totaux"]["confirmees"], "",
              "  لي وصلو", "      %d" % t["totaux"]["livrees"], ""]
        if t["confirmation"] is not None:
            L += ["  التأكيد — قلت / الحقيقة",
                  "      %.0f %% / %.1f %%" % (
                      r["fiche"]["confirmation_declaree"] * 100,
                      t["confirmation"] * 100), ""]
        if t["livraison"] is not None:
            L += ["  التوصيل — قلت / الحقيقة",
                  "      %.0f %% / %.1f %%" % (
                      r["fiche"]["livraison_declaree"] * 100,
                      t["livraison"] * 100), ""]
        if t["cout_par_commande"]:
            L += ["  واش تكلّفك كوموند وحدة",
                  _da_usd(t["cout_par_commande"], taux), ""]
    L += ["  أقصى ثمن تقدر تدفع في كوموند — على كلامك",
          _da_usd(r["cpl_max_declare"], taux), ""]
    if r["cpl_max_mesure"] is not None:
        L += ["  وعلى الحقيقة",
              _da_usd(r["cpl_max_mesure"], taux), ""]
        if r["assez"]:
            L += ["  نخدمو بالحقيقة، ماشي بالكلام.", ""]
        else:
            L += ["  مازال الكوموند قليل. نخدمو بكلامك حتى يكثرو.", ""]
    L.append(BARRE)
    return "\n".join(L)


# ---------------------------------------------------------------------------
# PARTIE 8 — L'AUTO-TEST
# ---------------------------------------------------------------------------

def _essai(nom, cond, detail=""):
    print("  [%s] %s%s" % ("OK  " if cond else "FAUX", nom,
                           ("  — " + detail) if detail and not cond else ""))
    return bool(cond)


def verifier():
    import shutil
    import tempfile
    print(BARRE)
    print("  CONTROLES DU CARNET — version %s" % VERSION)
    print(BARRE)
    ok = True
    d = tempfile.mkdtemp(prefix="carnet-essai-")
    try:
        # --- LA MAISON
        ok &= _essai("la maison suit MANITA_MAISON quand elle est posee",
                     maison(env={VAR_MAISON: os.path.join(d, "m")}, a_cote=d)
                     == os.path.join(d, "m"))
        ok &= _essai("sans variable ni _maison-ecom-manita : la maison est ~/.manita",
                     maison(env={}, a_cote=os.path.join(d, "n-existe-pas"))
                     == os.path.expanduser("~/.manita"))
        prive = os.path.join(d, "a-cote", "_maison-ecom-manita")
        os.makedirs(prive)
        ok &= _essai("avec _maison-ecom-manita a cote : c'est lui la maison",
                     maison(env={}, a_cote=prive) == prive)
        ok &= _essai("_maison-ecom-manita vit A COTE du dossier vendu, jamais dedans",
                     os.path.dirname(A_COTE) == os.path.dirname(RACINE_PRODUIT)
                     and os.path.basename(A_COTE) == "_maison-ecom-manita"
                     and not os.path.isdir(os.path.join(RACINE_PRODUIT, "_maison-ecom-manita")))
        ok &= _essai("le carnet vit dans la maison, sous carnet/",
                     DOSSIER == os.path.join(maison(), "carnet"))

        # --- LE GARDIEN
        ok &= _essai("un mot de passe est refuse",
                     bool(gardien("le mot de passe est Nahla")))
        ok &= _essai("une cle d'API est refusee", bool(gardien("api_key=abc")))
        ok &= _essai("un numero de telephone algerien est refuse",
                     bool(gardien("0" + "550123456")))
        ok &= _essai("une adresse mail est refusee",
                     bool(gardien("cliente" + "@" + "mail.com")))
        ok &= _essai("un long numero de carte est refuse",
                     bool(gardien("4111" + "1111" + "1111" + "1111")))
        ok &= _essai("un texte normal passe",
                     not gardien("robe satin noir, taille standard"))
        refus = False
        try:
            ecrire_mesure("2026-09-19", "ROBE", 1000, 10, 6,
                          note="le tel de la cliente " + "0" + "550123456", dossier=d)
        except ValueError:
            refus = True
        ok &= _essai("le carnet REFUSE vraiment d'ecrire un numero", refus)

        # --- LES TAUX SE CALCULENT, ils ne se tapent pas
        ecrire_produit("ROBE", 5900, 1500, 100, 0, 600, 0.65, 0.45, dossier=d)
        ecrire_mesure("2026-09-19", "ROBE", 1300, 20, 12, 12, 0, 0, 12, dossier=d)
        ecrire_mesure("2026-09-22", "ROBE", 1300, 22, 13, 13, 8, 2, 3, dossier=d)
        ecrire_mesure("2026-09-25", "ROBE", 1300, 18, 10, 10, 6, 1, 3, dossier=d)
        t = taux_mesures("ROBE", dossier=d)
        ok &= _essai("les trois jours sont comptes", t["jours"] == 3, str(t["jours"]))
        ok &= _essai("la confirmation se calcule, elle ne se tape pas",
                     abs(t["confirmation"] - 35 / 60.0) < 1e-9,
                     str(t["confirmation"]))
        ok &= _essai("la livraison se calcule sur les EXPEDIEES",
                     abs(t["livraison"] - 14 / 35.0) < 1e-9, str(t["livraison"]))
        ok &= _essai("le cout par commande se calcule",
                     abs(t["cout_par_commande"] - 3900 / 60.0) < 1e-6)
        ok &= _essai("un colis en route compte a trois sur dix",
                     t["livrees_prudentes"] == 14 + int(3 * 0.30),
                     str(t["livrees_prudentes"]))
        ok &= _essai("les colis en route sont un ETAT : la derniere ligne, pas la somme",
                     t["totaux"]["en_route"] == 3, str(t["totaux"]["en_route"]))
        # les lignes ecrites dans le desordre donnent quand meme le dernier jour
        ecrire_mesure("2026-09-20", "ROBE", 0, 0, 0, 0, 0, 0, 40, dossier=d)
        t2 = taux_mesures("ROBE", dossier=d)
        ok &= _essai("une ligne ajoutee en retard ne remplace pas le dernier jour",
                     t2["totaux"]["en_route"] == 3, str(t2["totaux"]["en_route"]))

        # --- DECLARE CONTRE MESURE
        r = declare_contre_mesure("ROBE", dossier=d)
        ok &= _essai("le carnet donne les deux sommets du lead",
                     r["cpl_max_declare"] > 0 and r["cpl_max_mesure"] is not None)
        ok &= _essai("le sommet mesure est PLUS BAS que le declare ici",
                     r["cpl_max_mesure"] < r["cpl_max_declare"],
                     "%.2f contre %.2f" % (r["cpl_max_mesure"], r["cpl_max_declare"]))
        ok &= _essai("l'ecart est donne en POINTS", r["ecart_points"] is not None)

        # --- LA REGLE : le mesure n'ecrase le declare qu'avec assez de data
        u = taux_a_utiliser("ROBE", dossier=d, mini_commandes=30)
        ok &= _essai("a soixante commandes, on prend le MESURE",
                     u["source"] == "mesure", u["source"])
        u2 = taux_a_utiliser("ROBE", dossier=d, mini_commandes=200)
        ok &= _essai("sous le seuil, on garde le DECLARE et on le dit",
                     u2["source"] == "declare", u2["source"])

        # --- LA BOUSSOLE : identique a l'outil du coach
        a = cpl_max(5900, 1500, 100, 0, 600, 0.65, 0.45)
        ok &= _essai("la boussole du carnet donne le meme break even",
                     abs(a - 1043.25) < 0.01, "%.2f" % a)
        ok &= _essai("le cout du retour est bien dans la formule",
                     abs(cpl_max(5900, 1500, 100, 0, 0, 0.65, 0.45) - a) > 200)

        # --- LA DECISION SE GARDE AVEC CE QU'IL SAVAIT
        ecrire_decision("2026-09-25", "ROBE", "je continue",
                        "le cout par commande depasse le sommet", dossier=d)
        txt = io.open(chemin(DECISIONS, d), encoding="utf-8").read()
        ok &= _essai("la decision est gardee avec ce qu'il savait",
                     "je continue" in txt and "IL SAVAIT" in txt)

        # --- L'AFFICHAGE
        vue = vue_carnet(r, 255.0)  # 1.0 : un taux du client d'EXEMPLE, passé ici (le code n'en suppose aucun)
        ok &= _essai("sans le taux du client : les dinars seuls, aucun dollar inventé",
                     "USD" not in vue_carnet(r) and "DA" in vue_carnet(r))
        arabe = re.compile(r"[؀-ۿ]")
        chiffre = re.compile(r"\d")
        fautes = [l for l in vue.split("\n")
                  if arabe.search(l) and chiffre.search(l)]
        ok &= _essai("aucun chiffre sur une ligne arabe", not fautes,
                     str(fautes[:1]))
        ok &= _essai("chaque montant est donne en dinars ET en dollars",
                     vue.count("USD") >= 1 and vue.count("DA") >= 1)
    finally:
        shutil.rmtree(d, ignore_errors=True)

    print(BARRE)
    print("  TOUT EST BON." if ok else "  IL Y A UNE FAUTE — on ne livre pas.")
    print(BARRE)
    return 0 if ok else 1


# ---------------------------------------------------------------------------
# PARTIE 9 — LA LIGNE DE COMMANDE
# ---------------------------------------------------------------------------

def main():
    p = argparse.ArgumentParser(description="Le carnet du business")
    p.add_argument("--verifier", action="store_true")
    p.add_argument("--ou", action="store_true", help="ou vit le carnet")
    p.add_argument("--produit")
    p.add_argument("--fiche", action="store_true", help="poser la fiche d'un produit")
    p.add_argument("--prix", type=float)
    p.add_argument("--gros", type=float)
    p.add_argument("--emballage", type=float, default=50.0)
    p.add_argument("--livraison-a-ta-charge", type=float, default=200.0)
    p.add_argument("--retour", type=float, default=150.0)
    p.add_argument("--conf-declaree", type=float)
    p.add_argument("--liv-declaree", type=float)
    p.add_argument("--mesure", action="store_true", help="ecrire une journee")
    p.add_argument("--date")
    p.add_argument("--depense", type=float, default=0.0)
    p.add_argument("--commandes", type=int, default=0)
    p.add_argument("--confirmees", type=int, default=0)
    p.add_argument("--expediees", type=int, default=0)
    p.add_argument("--livrees", type=int, default=0)
    p.add_argument("--refusees", type=int, default=0)
    p.add_argument("--en-route", type=int, default=0)
    p.add_argument("--note", default="")
    p.add_argument("--lire", action="store_true", help="declare contre mesure")
    p.add_argument("--noter", action="store_true",
                   help="noter ce que le client a decide, et ce qu'il savait")
    p.add_argument("--decision", default="")
    p.add_argument("--il-savait", default="")
    p.add_argument("--json", action="store_true")
    p.add_argument("--taux-dinar", type=float, default=0.0,
                   help="combien de dinars pour un dollar (le taux du client ; sans lui, les dinars seuls)")
    a = p.parse_args()

    if a.verifier:
        return verifier()

    if a.ou:
        ouvrir_carnet()
        print("maison  %s" % maison())
        print("carnet  %s" % DOSSIER)
        return 0

    if a.fiche:
        f = ecrire_produit(a.produit, a.prix, a.gros, a.emballage,
                           a.livraison_a_ta_charge, a.retour,
                           a.conf_declaree, a.liv_declaree)
        print(json.dumps(f, ensure_ascii=False, indent=2))
        return 0

    if a.mesure:
        l = ecrire_mesure(a.date, a.produit, a.depense, a.commandes,
                          a.confirmees, a.expediees, a.livrees, a.refusees,
                          a.en_route, a.note)
        print(json.dumps(l, ensure_ascii=False))
        return 0

    if a.noter:
        if not (a.produit and a.date and a.decision):
            print("Il faut --produit, --date et --decision.")
            return 1
        ecrire_decision(a.date, a.produit, a.decision, a.il_savait)
        print("note.")
        return 0

    if a.lire:
        r = declare_contre_mesure(a.produit)
        if not r:
            # 21/09/2026 : quand on demande du JSON, on rend du JSON MEME
            # pour refuser. Sinon celui qui appelle recoit du texte brut,
            # son json.loads casse, et il affiche une erreur de lecture au
            # lieu de la vraie raison.
            msg = "aucune fiche pour ce produit : commence par --fiche"
            if a.json:
                print(json.dumps({"erreur": msg,
                                  "produit": a.produit,
                                  "quoi_faire": "--fiche --produit <nom>"},
                                 ensure_ascii=False))
            else:
                print("Aucune fiche pour ce produit. Commence par --fiche.")
            return 1
        if a.json:
            print(json.dumps(r, ensure_ascii=False, indent=2, default=str))
        else:
            print(vue_carnet(r, a.taux_dinar if a.taux_dinar and a.taux_dinar > 0 else None))
        return 0

    p.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
