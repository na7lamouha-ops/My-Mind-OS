"""Essais du spy engagement avec des réponses Meta SIMULÉES : aucun appel réseau réel.
Profils, jetons et chiffres INVENTÉS.

    python3 -B -I tests/test_engagement.py      (Windows : py -B -I tests\\test_engagement.py)
"""
import io
import json
import re
import shutil
import sys
import tempfile
import urllib.parse
from contextlib import redirect_stdout
from datetime import datetime, timedelta, timezone
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI.parent))
import spy_engagement as s  # noqa: E402
import signes_vente as sv  # noqa: E402

NOW = datetime(2030, 3, 15, 12, 0, tzinfo=timezone.utc)
JETON = "JETON-INVENTE-zz99-NE-DOIT-JAMAIS-SORTIR"
CLE = {"ig": "1000000000000001", "jeton": JETON, "version": "v21.0"}
JPEG = b"\xff\xd8\xff" + b"0" * 100
OK = True
SORTIE = []


def verif(nom, condition, detail=""):
    global OK
    OK &= bool(condition)
    print(("PASSE " if condition else "ÉCHEC ") + nom + ("" if condition else f"  -> {detail}"))


def ts(jours):
    return (NOW - timedelta(days=jours)).strftime("%Y-%m-%dT%H:%M:%S+0000")


_n = [9000]


def media(vues, jours, typ="REELS", **extra):
    _n[0] += 1
    m = {"id": str(_n[0]), "media_type": "VIDEO" if typ in ("REELS", "VIDEO") else "IMAGE",
         "media_product_type": typ if typ != "VIDEO" else "FEED", "timestamp": ts(jours),
         "permalink": f"https://www.instagram.com/reel/Ab{_n[0]}/", "like_count": 1000, "comments_count": 50,
         "thumbnail_url": f"https://exemple.invalid/couv/{_n[0]}.jpg"}
    if vues is not ...:
        m["view_count"] = vues
    m.update(extra)
    return m


def page(nom, medias, apres=None, bio=""):
    p = {"data": medias}
    if apres:
        p["paging"] = {"cursors": {"after": apres}}
    return {"business_discovery": {"username": nom, "followers_count": 12345, "media_count": 300,
                                   "biography": bio, "website": "", "media": p}, "id": CLE["ig"]}


def erreur(code, http=400, msg="Erreur simulée"):
    return ("ERR", http, {"error": {"message": msg, "type": "OAuthException", "code": code}})


class FauxMeta:
    """Remplace s.ouvrir : répond selon le nom lu dans l'URL ; compte les appels ; en-têtes au choix."""

    def __init__(self, reponses, entetes=None):
        self.reponses, self.entetes, self.appels = reponses, entetes or {}, []

    def __call__(self, url):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
        assert q["access_token"] == [JETON]
        champs = q["fields"][0]
        nom_m = re.search(r"username\(([^)]+)\)", champs)
        nom = nom_m.group(1) if nom_m else "__cle__"
        apres = re.search(r"after\(([^)]+)\)", champs)
        self.appels.append(nom)
        r = self.reponses[nom]
        if callable(r):
            r = r(apres.group(1) if apres else None)
        elif isinstance(r, dict) and apres:
            r = r[apres.group(1)]
        elif isinstance(r, dict) and "__premiere__" in r:
            r = r["__premiere__"]
        ent = self.entetes.get(nom, {})
        if isinstance(r, tuple):
            return r[1], ent, json.dumps(r[2]).encode()
        return 200, ent, json.dumps(r).encode()


DORMI = []


def installer(reponses, entetes=None):
    faux = FauxMeta(reponses, entetes)
    s.ouvrir = faux
    s.telecharger = lambda url: JPEG
    s.dormir = lambda sec: DORMI.append(sec)
    s.horloge = lambda: NOW
    s.dire = lambda t: SORTIE.append(str(t))
    s.USAGE["pct"] = 0
    DORMI.clear()
    return faux


def ecrire_profils(dossier, noms):
    f = Path(dossier) / "profils.txt"
    f.write_text("\n".join(noms) + "\n", encoding="utf-8")
    return f


TMP = Path(tempfile.mkdtemp(prefix="essai-engagement-"))
try:
    # ---------- 1. tri > 200 000 sur 30 jours ----------
    bruts = [
        {"username": "atelier.alpha", "medias": [
            media(250_000, 3), media(200_000, 4), media(199_999, 5), media(900_000, 40),
            media(500_000, 2, typ="IMAGE"), media(1_200_000, 29, typ="VIDEO"), media(310_000, 1)]},
        {"username": "maison.beta", "medias": [media(205_000, 10)]},
        {"username": "gamma.mode", "medias": [media(150_000, 2)]},
        {"username": "perso.delta", "erreur": "HTTP 400 (#110) compte non pro", "definitive": True},
    ]
    res = s.trier(bruts, NOW)
    noms = [c["username"] for c in res["comptes"]]
    vues_alpha = [v["vues"] for v in res["comptes"][0]["liste"]]
    verif("tri : seules les vidéos > 200 000 des 30 jours", vues_alpha == [1_200_000, 310_000, 250_000], vues_alpha)
    verif("tri : 200 000 pile, 199 999, image et vidéo de 40 j écartées", res["comptes"][0]["videos"] == 3)
    verif("tri : classement par nombre de vidéos puis vues", noms == ["atelier.alpha", "maison.beta"], noms)
    verif("tri : rang écrit", [c["rang"] for c in res["comptes"]] == [1, 2])
    verif("tri : profil en erreur listé à part", [e["username"] for e in res["erreurs"]] == ["perso.delta"])
    verif("tri : fenêtre de 30 jours", res["du"] == "2030-02-13" and res["au"] == "2030-03-15", (res["du"], res["au"]))

    # ---------- 2. vues absentes jamais comptées ----------
    bruts2 = [{"username": "epsilon.shop", "medias": [
        media(..., 2), media(None, 3), media("900000", 4), media(True, 5), media(450_000.0, 6), media(260_000, 7)]}]
    res2 = s.trier(bruts2, NOW)
    verif("vues absentes / texte / booléen / décimal jamais comptés",
          res2["comptes"][0]["videos"] == 1 and res2["comptes"][0]["vues_total"] == 260_000, res2["comptes"])
    verif("vues absentes signalées", res2["vues_non_lues"] == [{"username": "epsilon.shop", "videos_sans_vues": 5}],
          res2["vues_non_lues"])
    seul_absent = s.trier([{"username": "zeta.sans", "medias": [media(..., 1), media(..., 2)]}], NOW)
    verif("profil sans aucune vue lue : absent du classement", seul_absent["comptes"] == [])

    # ---------- 3. MIN_VIDEOS = 1 ----------
    verif("MIN_VIDEOS vaut 1 par défaut", s.MIN_VIDEOS == 1)
    verif("une seule vidéo > 200k suffit", "maison.beta" in noms)
    res_min2 = s.trier(bruts, NOW, min_videos=2)
    verif("--min-videos 2 écarte le profil à une vidéo",
          [c["username"] for c in res_min2["comptes"]] == ["atelier.alpha"])

    # ---------- 4. pause X-App-Usage ----------
    def usage(pct):
        return {"X-App-Usage": json.dumps({"call_count": pct, "total_cputime": 5, "total_time": 5})}

    run4 = TMP / "run4"
    faux = installer({
        "alpha.un": page("alpha.un", [media(300_000, 2)]),
        "beta.deux": page("beta.deux", [media(100_000, 2)]),
        "gamma.trois": page("gamma.trois", [media(100_000, 2)]),
        "delta.quatre": page("delta.quatre", [media(100_000, 2)]),
    }, {"alpha.un": usage(80), "beta.deux": usage(75), "gamma.trois": {
        "x-business-use-case-usage": json.dumps({"1000000000000001": [
            {"type": "instagram", "call_count": 12, "total_cputime": 91, "total_time": 30,
             "estimated_time_to_regain_access": 0}]})}})
    code = s.lire(ecrire_profils(TMP, ["alpha.un", "beta.deux", "gamma.trois", "delta.quatre"]), run4, CLE)
    longues = [d for d in DORMI if d == s.PAUSE_USAGE]
    courtes = [d for d in DORMI if d != s.PAUSE_USAGE]
    verif("lecture finie malgré les pauses", code == 0 and len(faux.appels) == 4, (code, faux.appels))
    verif("X-App-Usage 80 % -> pause de 15 min puis reprise", DORMI[0] == s.PAUSE_USAGE, DORMI)
    verif("75 % pile -> pas de pause longue (il faut dépasser)", len(longues) == 2, DORMI)
    verif("X-Business-Use-Case-Usage 91 % -> pause longue aussi", DORMI.count(s.PAUSE_USAGE) == 2, DORMI)
    verif("10 à 15 s entre deux profils", courtes and all(10 <= d <= 15 for d in courtes), courtes)
    verif("pas de pause après le dernier profil", len(DORMI) == 3, DORMI)
    verif("compteur noté depuis l'en-tête", any("compteur Meta à 80 %" in t for t in SORTIE), SORTIE[-6:])
    s.USAGE["pct"] = 0
    s.noter_usage({"x-app-usage": "pas du json"})
    verif("en-tête illisible : rien ne casse", s.USAGE["pct"] == 0)

    # ---------- 5. arrêt propre sur #4 / #17 / #32 / #613 ----------
    for num in (4, 17, 32, 613):
        run5 = TMP / f"run5-{num}"
        faux = installer({"un.ok": page("un.ok", [media(300_000, 2)]), "deux.bloque": erreur(num, 400),
                          "trois.jamais": page("trois.jamais", [media(300_000, 2)])})
        SORTIE.clear()
        code = s.lire(ecrire_profils(TMP, ["un.ok", "deux.bloque", "trois.jamais"]), run5, CLE)
        bruts5 = sorted(p.name for p in (run5 / "brut").glob("*.json"))
        verif(f"#{num} : arrêt propre code 3", code == 3, code)
        verif(f"#{num} : {s.ESSAIS_LIMITE} attentes puis arrêt",
              faux.appels.count("deux.bloque") == s.ESSAIS_LIMITE + 1 and DORMI.count(s.PAUSE_LIMITE) == s.ESSAIS_LIMITE,
              (faux.appels, DORMI))
        verif(f"#{num} : profil suivant pas appelé, brut du bloqué pas écrit",
              "trois.jamais" not in faux.appels and bruts5 == ["ig_un.ok.json"], (faux.appels, bruts5))
        verif(f"#{num} : message dit de relancer", any("relancer la même commande" in t for t in SORTIE))
    faux = installer({"un.ok": erreur(190, 400, "Error validating access token")})
    verif("#190 jeton refusé : arrêt tout de suite (code 2)",
          s.lire(ecrire_profils(TMP, ["un.ok"]), TMP / "run190", CLE) == 2 and DORMI == [], DORMI)

    # ---------- 6. reprise sans relire ----------
    run6 = TMP / "run6"
    liste6 = ecrire_profils(TMP, ["p.un", "p.deux", "p.trois", "perso.quatre"])
    faux = installer({"p.un": page("p.un", [media(300_000, 2)]), "p.deux": erreur(4, 403),
                      "p.trois": page("p.trois", [media(400_000, 2)]), "perso.quatre": erreur(110, 400)})
    verif("reprise : 1er passage arrêté par la limite", s.lire(liste6, run6, CLE) == 3)
    faux = installer({"p.un": page("p.un", [media(300_000, 2)]), "p.deux": page("p.deux", [media(500_000, 2)]),
                      "p.trois": page("p.trois", [media(400_000, 2)]), "perso.quatre": erreur(110, 400)})
    code = s.lire(liste6, run6, CLE)
    verif("reprise : 2e passage fini", code == 0, code)
    verif("reprise : le profil déjà lu n'est pas relu", faux.appels == ["p.deux", "p.trois", "perso.quatre"], faux.appels)
    faux = installer({})
    verif("reprise : 3e passage = zéro appel (erreur définitive pas relue)",
          s.lire(liste6, run6, CLE) == 0 and faux.appels == [], faux.appels)
    faux = installer({"perso.quatre": erreur(110, 400)})
    s.lire(liste6, run6, CLE, relire_erreurs=True)
    verif("--relire-erreurs relit seulement le profil en erreur", faux.appels == ["perso.quatre"], faux.appels)
    vieux = json.loads((run6 / "brut" / "ig_p.un.json").read_text(encoding="utf-8"))
    vieux["lu_le"] = (NOW - timedelta(days=s.FRAIS_JOURS + 1)).isoformat()
    (run6 / "brut" / "ig_p.un.json").write_text(json.dumps(vieux), encoding="utf-8")
    faux = installer({"p.un": page("p.un", [media(300_000, 2)])})
    s.lire(liste6, run6, CLE)
    verif("un brut de plus de 3 jours est relu (mois suivant)", faux.appels == ["p.un"], faux.appels)
    faux = installer({"p.un": ("ERR", 500, {})})
    b_avant = (run6 / "brut" / "ig_p.un.json").read_text(encoding="utf-8")
    s.ecrire_brut(run6 / "brut" / "ig_p.un.json", {"username": "p.un", "erreur": "réseau"})
    verif("une erreur n'écrase jamais un brut bon",
          (run6 / "brut" / "ig_p.un.json").read_text(encoding="utf-8") == b_avant)

    # ---------- 7. pagination ----------
    faux = installer({"long.profil": {"__premiere__": page("long.profil", [media(300_000, 1)] * 2, apres="CUR1"),
                                      "CUR1": page("long.profil", [media(320_000, 20), media(100, 35)], apres="CUR2"),
                                      "CUR2": page("long.profil", [media(999_999, 60)])}})
    b = s.lire_compte("long.profil", CLE, NOW, 30)
    verif("pagination : s'arrête à la page qui dépasse 30 jours", faux.appels == ["long.profil"] * 2 and len(b["medias"]) == 4,
          (faux.appels, len(b.get("medias", []))))

    faux = installer({"long.profil": {"__premiere__": page("long.profil", [media(300_000, 1)], apres="CUR1"),
                                      "CUR1": page("long.profil", [media(320_000, 40)])}},
                     {"long.profil": usage(92)})
    s.lire_compte("long.profil", CLE, NOW, 30)
    verif("pagination : compteur à 92 % -> pause longue avant la page suivante",
          DORMI == [s.PAUSE_USAGE] and faux.appels == ["long.profil"] * 2, (DORMI, faux.appels))

    # ---------- 8. le jeton ne sort jamais ----------
    run8 = TMP / "run8"
    SORTIE.clear()
    installer({"fuite.test": erreur(100, 400, f"Bad request access_token={JETON} {JETON}"),
               "x.y": page("x.y", [media(300_000, 2)])})
    s.lire(ecrire_profils(TMP, ["fuite.test", "x.y"]), run8, CLE)
    tout = "\n".join(SORTIE) + "".join(p.read_text(encoding="utf-8") for p in run8.rglob("*.json"))
    verif("jeton absent de l'écran et des fichiers, même si Meta le renvoie", JETON not in tout and "***" in tout)
    verif("erreur Meta gardée lisible", "(#100)" in tout)

    # ---------- 9. livraison + vérification à deux méthodes ----------
    SORTIE.clear()
    installer({})
    s.livrer(run6)
    txt = (run6 / "videos-200k.txt").read_text(encoding="utf-8")
    page_html = (run6 / "modeles.html").read_text(encoding="utf-8")
    verif("livraison : .txt « vues · date · lien »", "500 000 · 2030-03-13 · https://www.instagram.com/reel/" in txt, txt)
    verif("livraison : page HTML cliquable vers Instagram",
          page_html.count("<a class=\"video\" href=\"https://www.instagram.com/reel/") == 3, page_html[:300])
    verif("livraison : images locales dans la page", "src=\"images/" in page_html)
    verif("livraison : ordre du classement (plus de vues d'abord à égalité)",
          txt.index("@p.deux") < txt.index("@p.trois") < txt.index("@p.un"))
    verif("vérification à deux méthodes : PASSE", s.verifier(run6) == 0, SORTIE[-6:])
    (run6 / "videos-200k.txt").write_text(txt.replace(txt.splitlines()[-1], ""), encoding="utf-8")
    SORTIE.clear()
    verif("vérification : un .txt amputé -> ÉCHEC", s.verifier(run6) == 1, SORTIE)
    s.livrer(run6)
    r6 = json.loads((run6 / "resultat.json").read_text(encoding="utf-8"))
    r6["comptes"][0]["liste"].pop()
    (run6 / "resultat.json").write_text(json.dumps(r6), encoding="utf-8")
    verif("vérification : un tri faux -> ÉCHEC", s.verifier(run6) == 1)
    s.livrer(run6)

    # ---------- 10. liste de profils, préparation, clé ----------
    f = TMP / "liste.txt"
    f.write_text("﻿# commentaire\n@Mode.Alpha\nhttps://www.instagram.com/mode.beta/\nmode.alpha\n\nnom avec espace\n",
                 encoding="utf-8")
    noms10, refus = s.lire_profils(f)
    verif("profils : @nom, lien, doublon, commentaire, ligne fausse", noms10 == ["mode.alpha", "mode.beta"]
          and refus == ["nom avec espace"], (noms10, refus))
    trav = TMP / "travail"
    SORTIE.clear()
    s.preparer(trav)
    modele = json.loads((trav / "ig-spy.json").read_text(encoding="utf-8"))
    verif("preparer : ig-spy.json et profils.txt créés", modele["jeton"] == s.JETON_VIDE and (trav / "profils.txt").exists())
    try:
        s.config(trav)
        refuse = False
    except SystemExit as e:
        refuse = e.code == 2
    verif("clé pas remplie : refus clair (code 2)", refuse, SORTIE[-1:])
    (trav / "ig-spy.json").write_text(json.dumps({"ig_user_id": CLE["ig"], "jeton": JETON}), encoding="utf-8")
    s.preparer(trav)
    verif("preparer n'écrase jamais une clé remplie",
          json.loads((trav / "ig-spy.json").read_text(encoding="utf-8"))["jeton"] == JETON)
    verif("clé remplie lue", s.config(trav) == CLE)
    SORTIE.clear()
    installer({"__cle__": {"username": "client.test", "followers_count": 10, "id": CLE["ig"]}})
    verif("cle : appel simulé PASSE sans afficher le jeton",
          s.tester_cle(CLE) == 0 and "client.test" in SORTIE[-1] and JETON not in SORTIE[-1], SORTIE)

    # ---------- 11. commande « tout » de bout en bout (simulée) ----------
    ecrire_profils(trav, ["final.un", "final.deux"])
    installer({"final.un": page("final.un", [media(700_000, 3), media(260_000, 8)], bio="Livraison 58 wilaya +213"),
               "final.deux": page("final.deux", [media(90_000, 3)])})
    SORTIE.clear()
    code = s.main(["tout", "--travail", str(trav)])
    verif("tout : lire + livrer + vérifier = PASSE", code == 0 and any("vérification à deux méthodes" in t and
          t.startswith("PASSE") for t in SORTIE), SORTIE[-4:])
    rtout = json.loads((trav / "run-mois" / "resultat.json").read_text(encoding="utf-8"))
    verif("pays ÉCRIT dans la bio repris avec sa preuve",
          rtout["comptes"][0]["pays_lu"] == "DZ" and "dans la bio" in rtout["comptes"][0]["pays_signe"])

    # ---------- 12. signes de vente (sans réseau) ----------
    sig = sv.analyser(s.charger_bruts(trav / "run-mois"), NOW)
    verif("signes_vente : régularité calculée", sig["profils"][0]["username"] == "final.un"
          and sig["profils"][0]["regularite"] == 1.0, sig)

    # ---------- 13. portabilité Windows / Mac (lecture du code) ----------
    code_src = "".join((ICI.parent / n).read_text(encoding="utf-8") for n in ("spy_engagement.py", "signes_vente.py"))
    interdits = ["/Users/", "/home/", "os.system", "subprocess", "expanduser(\"~/", "/tmp"]
    verif("aucun chemin Mac/Linux en dur ni commande Unix", not [i for i in interdits if i in code_src],
          [i for i in interdits if i in code_src])
    imports = set(re.findall(r"^import (\w+)|^from (\w+)", code_src, re.M))
    tiers = {a or b for a, b in imports} - {"html", "json", "os", "random", "re", "ssl", "sys", "time", "urllib",
                                            "datetime", "pathlib", "statistics", "spy_engagement"}
    verif("bibliothèque standard seulement", not tiers, tiers)
finally:
    shutil.rmtree(TMP, ignore_errors=True)

print("\nRÉSULTAT GLOBAL :", "PASSE" if OK else "ÉCHEC")
sys.exit(0 if OK else 1)
