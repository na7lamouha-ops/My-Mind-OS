# fusion_navigateur.py (12/10/2026) : la page web complète le connecteur, sans doublon.
import sys, os, copy
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import fusion_navigateur as F, spy_calc as S
NOW = 1791808128
entree = {"pays": "DZ", "now": NOW, "pages": [{"page_id": "100000000001", "page_name": "Page essai", "niche": "robe",
          "ads": [{"id": "111111111111", "created": NOW - 3600, "start": NOW - 1800, "title": ""}]}]}
nav = {"total": 3, "pubs": [["111111111111", "2026-10-12", 1, "texte A"],
                            ["222222222222", "2026-10-05", 1, "texte B"],
                            ["333333333333", None, 1, "sans date"]]}
ok = True
e = copy.deepcopy(entree)
page, ajoutees = F.fusionner(e, "100000000001", nav)
checks = [
    ("pub connue : texte ajouté, pas de doublon", page["ads"][0]["texte"] == "texte A" and sum(a["id"] == "111111111111" for a in page["ads"]) == 1),
    ("pub absente ajoutée, marquée navigateur", ajoutees == 1 and page["ads"][1]["source"] == "navigateur"),
    ("pub sans date jamais inventée", all(a["id"] != "333333333333" for a in page["ads"])),
    ("total repris de la page web", page["total"] == 3),
]
r = S.analyser(e)["pages"][0]
checks.append(("calcul : dates au jour près + liste coupée (2 sur 3)", r["dates_au_jour"] and r["liste_coupee"]))
try:
    F.fusionner(copy.deepcopy(entree), "999999999999", nav); checks.append(("PIÈGE page inconnue refusée", False))
except SystemExit:
    checks.append(("PIÈGE page inconnue refusée", True))
for n, c in checks:
    ok &= c
    print(("PASSE " if c else "ÉCHEC ") + n)
print("\nRÉSULTAT GLOBAL :", "PASSE" if ok else "ÉCHEC")
sys.exit(0 if ok else 1)
