#!/usr/bin/env python3
"""
modeles.py — EN PLUS du rapport spy : pour chaque boutique, les deux modèles qui ont le plus de pubs.

Le modèle d'une pub = son champ « produit », rempli par l'agent en lisant le TEXTE de la pub
(le titre seulement si le texte est vide), jamais deviné. Ce script ne fait que compter.
Il ne modifie ni entree.json ni resultat.json ni messages.txt.

Règles :
  - un 2e modèle n'est montré que s'il a au moins 2 pubs ;
  - égalité au 2e rang : tous les modèles à égalité sont gardés, aucun n'est choisi ;
  - pour chaque modèle gardé : ses 5 pubs les plus récentes (la capture prend la 1re qui a une photo).

usage : modeles.py entree.json resultat.json modeles.json modeles.txt
Il écrit PASSE, ou ÉCHEC (exit 2) si un contrôle échoue.
"""
import json, re, sys
from collections import Counter

MIN_2E = 2

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def deux_modeles(page):
    ads = page["ads"]
    nommees = [a for a in ads if (a.get("produit") or "").strip()]
    lues = any(a.get("texte") or a.get("title") for a in ads)
    c = Counter(a["produit"].strip().lower() for a in nommees)
    if not c:
        return {"etat": "non nommés" if lues else "textes non lus", "modeles": [], "nommees": 0, "total": len(ads)}
    rangs = sorted(c.items(), key=lambda kv: (-kv[1], kv[0]))
    garde = [rangs[0]]
    if len(rangs) > 1 and rangs[1][1] >= MIN_2E:
        garde += [kv for kv in rangs[1:] if kv[1] == rangs[1][1]]
    out = []
    for nom, n in garde:
        siennes = [a for a in nommees if a["produit"].strip().lower() == nom]
        if len(siennes) != n:
            raise SystemExit(f"ÉCHEC · {page['page_name']} : compte de « {nom} » incohérent")
        recentes = sorted(siennes, key=lambda a: -a["created"])[:5]   # la capture essaie dans cet ordre
        out.append({"modele": nom, "pubs": n, "pub_capture": recentes[0]["id"], "pubs_capture": [a["id"] for a in recentes]})
    return {"etat": "egalite" if len(garde) > 2 else "ok", "modeles": out,
            "nommees": len(nommees), "total": len(ads)}

def bloc(res):
    lignes = ["<b>Modèles</b> — les deux qui ont le plus de pubs"]
    for m in res:
        if m["modeles"]:
            t = " · ".join(f"{esc(x['modele'])} ({x['pubs']})" for x in m["modeles"])
            lignes.append(f"{esc(m['page'])} : {t}" + (" · égalité" if m["etat"] == "egalite" else "")
                          + f" · {m['nommees']}/{m['total']} pubs nommées")
        else:
            lignes.append(f"{esc(m['page'])} : {m['etat']}")
    msgs, cur = [], ""
    for l in lignes:
        if len(cur) + len(l) + 1 > 3800:
            msgs.append(cur); cur = ""
        cur += ("\n" if cur else "") + l
    msgs.append(cur)
    for msg in msgs:                       # même contrôle que spy_calc : aucun chiffre dans une ligne arabe
        for l in msg.split("\n"):
            if re.search(r"[؀-ۿ]", re.sub(r"^[^:]*:", "", l)) and re.search(r"[0-9]", re.sub(r"\(\d+\)|\d+/\d+", "", l)):
                raise SystemExit(f"ÉCHEC · chiffre dans une ligne arabe : {l[:60]}")
    return msgs

if __name__ == "__main__":
    if len(sys.argv) != 5:
        raise SystemExit("usage : modeles.py entree.json resultat.json modeles.json modeles.txt")
    E = json.load(open(sys.argv[1], encoding="utf-8")); R = json.load(open(sys.argv[2], encoding="utf-8"))
    pages = {p["page_id"]: p for p in E["pages"]}
    res = []
    for r in R["pages"]:                   # même ordre que le rapport ; grossistes et dormantes écartés
        if r["rang"] >= 8:
            continue
        m = deux_modeles(pages[r["page_id"]]); m["page"] = r["page"]; m["page_id"] = r["page_id"]; res.append(m)
    if len(res) != sum(1 for r in R["pages"] if r["rang"] < 8):
        raise SystemExit("ÉCHEC · boutique perdue en route")
    msgs = bloc(res)
    json.dump(res, open(sys.argv[3], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    open(sys.argv[4], "w", encoding="utf-8").write("\n===\n".join(msgs))
    n = sum(1 for m in res if m["modeles"])
    print(f"PASSE · {n}/{len(res)} boutiques avec modèles · {sum(len(m['modeles']) for m in res)} captures à faire")
