# « liste coupée » (12/10/2026) : écrit tout seul quand la Ad Library n'a pas tout rendu.
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import spy_calc as S
NOW = 1791808128
def page(pid, n, total=None):
    p = {"page_id": pid, "page_name": "Page " + pid[-2:], "niche": "robe",
         "ads": [{"id": f"{pid}{i}", "created": NOW - 3600 * 30 * i, "start": NOW - 3600 * 30 * i + 5400, "title": ""} for i in range(n)]}
    if total: p["total"] = total
    return p
cas = [("50 pubs rendues", page("100000000050", 50), True),
       ("total annoncé 67 pour 40 rendues", page("100000000067", 40, 67), True),
       ("12 pubs, total 12", page("100000000012", 12, 12), False)]
ok = True
for nom, p, attendu in cas:
    res = S.analyser({"pays": "DZ", "now": NOW, "pages": [p]})
    r = res["pages"][0]
    msg = "\n".join(S.telegram(res, "DZ"))
    bon = r["liste_coupee"] == attendu and (("liste coupée" in msg) == attendu or r["rang"] >= 8)
    ok &= bon
    print(("PASSE " if bon else "ÉCHEC ") + f"{nom} : liste_coupee={r['liste_coupee']}")
print("\nRÉSULTAT GLOBAL :", "PASSE" if ok else "ÉCHEC")
sys.exit(0 if ok else 1)
