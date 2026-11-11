# Règle du même produit (12/10/2026) : un trou n'est une production que si le produit revient.
import sys, os, copy
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import spy_calc as S

NOW = 1791808128
def ads(pid, lots):
    out, n = [], 0
    for produit, temps in lots:
        for c in temps:
            out.append({"id": f"{pid}{n}", "created": c, "start": c + 5400, "title": "", "produit": produit}); n += 1
    return out

base = [1791098022], [1791787893, 1791787896, 1791787900, 1791787904, 1791787905]
cas = {
    "autre produit après le trou": ([("abaya rose", base[0]), ("robe velours", base[1])], "NOUVEAU MODÈLE", True),
    "même produit après le trou":  ([("abaya rose", base[0]), ("abaya rose", base[1])], "SCALING PRODUCTION", True),
    "produit non lu":              ([("", base[0]), ("", base[1])], "SCALING PRODUCTION", False),
}
ok = True
for nom, (lots, verdict, verifie) in cas.items():
    d = {"pays": "DZ", "now": NOW, "pages": [{"page_id": "100000000001", "page_name": "Page essai", "niche": "abaya", "ads": ads("100000000001", lots)}]}
    r = S.analyser(d)["pages"][0]
    attendu_v = verifie if verdict == "SCALING PRODUCTION" else None
    bon = r["verdict"] == verdict and r["produit_verifie"] == attendu_v
    ok &= bon
    print(("PASSE " if bon else "ÉCHEC ") + f"{nom} : {r['verdict']} · produit_verifie={r['produit_verifie']}")
    S.telegram(S.analyser(d), "DZ")
print("\nRÉSULTAT GLOBAL :", "PASSE" if ok else "ÉCHEC")
sys.exit(0 if ok else 1)
