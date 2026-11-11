# Modèles par boutique + pubs actives + envoi boutique par boutique. Hors ligne : aucun appel réseau, aucun Chrome.
import sys, os, json, base64, subprocess, tempfile
ICI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ICI)
NOW = 1791808128
ok = True
def check(nom, f):
    global ok
    try:
        bon = bool(f())
    except Exception as e:
        bon = False; nom += f" ({type(e).__name__}: {str(e)[:60]})"
    ok &= bon
    print(("PASSE " if bon else "ÉCHEC ") + nom)

def page(pid, nom, produits, total=None):
    ads = [{"id": f"{pid}{i}", "created": NOW - 3600 * 30 * i, "start": NOW - 3600 * 30 * i + 5400,
            "title": "", "texte": "texte lu", "produit": p} for i, p in enumerate(produits)]
    p = {"page_id": pid, "page_name": nom, "niche": "abaya", "ads": ads}
    if total: p["total"] = total
    return p

A = page("100000000001", "Page A", ["abaya rose"] * 25 + ["robe velours"] * 10 + ["jupe"] * 5, total=67)
B = page("100000000002", "Page B", ["kimono"] * 3 + ["robe"] * 2 + ["jupe"] * 2 + ["pull"] * 5)
C = page("100000000003", "Page C", ["abaya noire"] * 4 + ["robe"] * 1)
Dp = page("100000000004", "Page D", [""] * 6)
E = {"pays": "DZ", "now": NOW, "pages": [A, B, C, Dp]}

def calc():
    import spy_calc as S
    return {r["page_id"]: r for r in S.analyser(E)["pages"]}
check("pubs actives : total annoncé 67, 40 lues", lambda: (calc()[A["page_id"]]["actives"], calc()[A["page_id"]]["actives_lues"]) == (67, 40))
check("pubs actives : liste complète, 12 = 12", lambda: (calc()[B["page_id"]]["actives"], calc()[B["page_id"]]["actives_lues"]) == (12, 12))
def msgs_identiques():
    import spy_calc as S
    return all("Pubs actives" not in m for m in S.telegram(S.analyser(E), "DZ"))
check("messages.txt inchangé (aucune ligne « Pubs actives » dans spy_calc.telegram)", msgs_identiques)

def dm(p):
    import modeles
    return modeles.deux_modeles(p)
check("les deux modèles qui ont le plus de pubs", lambda: [x["modele"] for x in dm(A)["modeles"]] == ["abaya rose", "robe velours"])
check("2e modèle seul à son rang : deux modèles, pas d'égalité", lambda: dm(B)["etat"] == "ok" and [x["modele"] for x in dm(B)["modeles"]] == ["pull", "kimono"])
B2 = page("100000000005", "Page B2", ["kimono"] * 5 + ["robe"] * 2 + ["jupe"] * 2)
check("égalité au 2e rang (robe = jupe) : les deux gardés", lambda: dm(B2)["etat"] == "egalite" and sorted(x["modele"] for x in dm(B2)["modeles"][1:]) == ["jupe", "robe"])
check("2e modèle avec une seule pub : pas montré", lambda: [x["modele"] for x in dm(C)["modeles"]] == ["abaya noire"])
check("aucun nom lu : « non nommés »", lambda: dm(Dp)["etat"] == "non nommés" and dm(Dp)["modeles"] == [])
check("5 pubs les plus récentes gardées pour la capture", lambda: len(dm(A)["modeles"][0]["pubs_capture"]) == 5)

with tempfile.TemporaryDirectory() as d:
    def chemin(n): return os.path.join(d, n)
    def ecrire_et_lancer():
        import spy_calc as S
        json.dump(E, open(chemin("entree.json"), "w", encoding="utf-8"), ensure_ascii=False)
        res = S.analyser(E)
        json.dump(res, open(chemin("resultat.json"), "w", encoding="utf-8"), ensure_ascii=False)
        open(chemin("messages.txt"), "w", encoding="utf-8").write("\n===\n".join(S.telegram(res, "DZ")))
        r = subprocess.run([sys.executable, "-B", "-I", os.path.join(ICI, "modeles.py"), chemin("entree.json"),
                            chemin("resultat.json"), chemin("modeles.json"), chemin("modeles.txt")], capture_output=True, text=True)
        return r.returncode == 0 and r.stdout.startswith("PASSE")
    check("modeles.py écrit PASSE", ecrire_et_lancer)

    def envoi():
        import spy_envoi
        mods = json.load(open(chemin("modeles.json"), encoding="utf-8"))
        jpg = b"\xff\xd8\xff\xe0" + b"0" * 3000
        for m in mods:
            if m["page_id"] == A["page_id"]:
                for i, x in enumerate(m["modeles"], 1):
                    open(chemin(f"cap-{i}.jpg"), "wb").write(jpg); x["capture"] = f"cap-{i}.jpg"
        json.dump(mods, open(chemin("modeles.json"), "w", encoding="utf-8"), ensure_ascii=False)
        open(chemin("conclusion.txt"), "w", encoding="utf-8").write("خلاصة")
        msgs, fin = spy_envoi.preparer(chemin("messages.txt"))
        photo = [m for m in msgs if isinstance(m, dict)]
        texte = "\n".join(m for m in msgs if isinstance(m, str))
        avant_photo = msgs[:msgs.index(photo[0])]
        return (len(photo) == 1 and len(photo[0]["photos"]) == 2
                and base64.b64decode(photo[0]["photos"][0]) == jpg
                and "Page A" in photo[0]["texte"] and "Pubs actives : 67 (40 lues)" in photo[0]["texte"]
                and "abaya rose" not in photo[0]["texte"]                       # pas de nom de modèle sous la photo
                and "Pubs actives : 12" in texte and "Page C" in texte
                and not any("Page A" in m for m in avant_photo)
                and fin == ["خلاصة"])
    check("envoi boutique par boutique : photo + ligne + « Pubs actives : 67 (40 lues) »", envoi)

    def repli():
        import spy_envoi
        msgs, fin = spy_envoi.preparer(chemin("messages.txt"))
        t = spy_envoi.sans_photos(msgs)
        tout = "\n".join(t)
        return (all(isinstance(x, str) and len(x) <= 4096 for x in t)
                and tout.index("Page A") < tout.index("Pubs actives : 67 (40 lues)") and "Pubs actives : 12" in tout)
    check("robot qui refuse les photos : même rapport en texte seul, même ordre", repli)

print("\nRÉSULTAT GLOBAL :", "PASSE" if ok else "ÉCHEC")
sys.exit(0 if ok else 1)
