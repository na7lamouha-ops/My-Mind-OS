#!/usr/bin/env python3
"""
fusion_navigateur.py — complète une page de entree.json avec ce que montre la page web de la Ad Library.

Pourquoi : le connecteur rend 50 pubs au plus par appel. La page web, elle, montre toutes les pubs
(bouton « Voir plus ») avec leur date de début et le début de leur texte.

Entrée : entree.json, le page_id, et le JSON rendu par lecture_navigateur.js :
  {"total": 68, "pubs": [["<id>", "AAAA-MM-JJ", <pubs groupées>, "<début du texte>"], ...]}
Effet :
  - chaque pub déjà connue reçoit son "texte" (pour remplir "produit" à la main) ;
  - chaque pub absente du connecteur est ajoutée, datée à midi UTC de son jour de début,
    avec "source": "navigateur" (le calcul écrira alors « dates au jour près ») ;
  - "total" de la page = le nombre de résultats annoncé par la page web.
Lecture seule sur le réseau : aucun appel, il ne fait que fusionner deux fichiers.
"""
import json, sys, datetime as dt

def midi(jour):
    return int(dt.datetime.strptime(jour, "%Y-%m-%d").replace(hour=12, tzinfo=dt.timezone.utc).timestamp())

def fusionner(entree, page_id, nav):
    page = next((p for p in entree["pages"] if p["page_id"] == page_id), None)
    if page is None:
        raise SystemExit(f"ÉCHEC · page {page_id} absente de l'entrée")
    connues = {a["id"]: a for a in page["ads"]}
    ajoutees = 0
    for pid, jour, _groupees, texte in nav["pubs"]:
        if pid in connues:
            connues[pid]["texte"] = texte
        elif jour:
            page["ads"].append({"id": pid, "created": midi(jour), "start": midi(jour),
                                "title": "", "texte": texte, "source": "navigateur"})
            ajoutees += 1
    page["total"] = max(int(nav.get("total") or 0), len(page["ads"]))
    return page, ajoutees

if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("usage : fusion_navigateur.py entree.json <page_id> navigateur.json")
    chemin, page_id, chemin_nav = sys.argv[1:]
    entree = json.load(open(chemin, encoding="utf-8"))
    page, ajoutees = fusionner(entree, page_id, json.load(open(chemin_nav, encoding="utf-8")))
    json.dump(entree, open(chemin, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"PASSE · {page['page_name']} · {ajoutees} pub(s) ajoutée(s) · {len(page['ads'])} sur {page['total']}")
