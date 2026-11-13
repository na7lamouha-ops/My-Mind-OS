#!/usr/bin/env python3
"""
spy_calc.py — moteur de la méthode spydz (étalement + trou + durée en ligne).

Entrée : un fichier JSON produit par l'agent après ses appels à la Ad Library :
{
  "pays": "DZ",
  "now": 1791808128,                # optionnel, sinon l'heure actuelle
  "pages": [
    {"page_id": "697649403431569", "page_name": "Kika collection", "niche": "abaya",
     "ads": [{"id": "1408556080877651", "created": 1791787905, "start": 1791793403,
              "title": "اطلبيها الآن"}, ...]}
  ]
}

Sortie : JSON (--json) et/ou messages Telegram prêts (--telegram) en HTML.
Le script se vérifie lui-même : il s'arrête (exit 2) si un contrôle échoue.
Aucune connexion réseau, aucun secret : il ne fait que calculer.
"""
import json, re, sys, time, datetime as dt

H, D = 3600, 86400
FENETRE_J = 30

PAYS = {
    "DZ": {"nom": "Algérie",  "drapeau": "🇩🇿", "monnaie": "DA",  "usd": 255,
           "prix": r"(\d[\d\s.,]{2,7})\s*(?:دج|د\.ج|DA|DZD|da)"},
    "MA": {"nom": "Maroc",    "drapeau": "🇲🇦", "monnaie": "MAD", "usd": 10,
           "prix": r"(\d[\d\s.,]{1,6})\s*(?:درهم|DH|MAD|dh)"},
    "EG": {"nom": "Égypte",   "drapeau": "🇪🇬", "monnaie": "EGP", "usd": 50,
           "prix": r"(\d[\d\s.,]{1,6})\s*(?:جنيه|ج\.م|EGP|LE)"},
    "IQ": {"nom": "Irak",     "drapeau": "🇮🇶", "monnaie": "IQD", "usd": 1310,
           "prix": r"(\d[\d\s.,]{2,8})\s*(?:دينار|د\.ع|IQD|الف|ألف)"},
    "TN": {"nom": "Tunisie",  "drapeau": "🇹🇳", "monnaie": "TND", "usd": 3.1,
           "prix": r"(\d[\d\s.,]{1,6})\s*(?:دينار|د\.ت|DT|TND|dt)"},
}
GROSSISTE = re.compile(r"جملة|بالجملة|بالسيري|الشوالة|\bgros\b|grossiste|wholesale", re.I)
LIEN = "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country={pays}&view_all_page_id={pid}"

class ControleEchoue(Exception):
    pass

def verif(cond, msg):
    if not cond:
        raise ControleEchoue(msg)

def jjmm(t):
    return dt.datetime.fromtimestamp(t, dt.timezone.utc).strftime("%d/%m")

def vagues(ts):
    """Deux méthodes différentes ; elles doivent donner le même découpage."""
    if not ts:
        return []
    v = []
    for t in ts:
        if v and t - v[-1][-1] <= H:
            v[-1].append(t)
        else:
            v.append([t])
    cuts = [0] + [i for i in range(1, len(ts)) if ts[i] - ts[i - 1] > H] + [len(ts)]
    v2 = [ts[a:b] for a, b in zip(cuts, cuts[1:])]
    verif(v == v2, "découpage des vagues : les deux méthodes ne concordent pas")
    return v

def distinctes(v):
    """Vagues dont le début est à 12 h ou plus de la précédente."""
    if not v:
        return 0
    n = 1
    for i in range(1, len(v)):
        if v[i][0] - v[i - 1][0] >= 12 * H:
            n += 1
    return n

def prix_dans(titres, pays):
    pat = re.compile(PAYS[pays]["prix"])
    out = []
    for t in titres:
        for m in pat.findall(t or ""):
            n = re.sub(r"[\s.,]", "", m)
            if n.isdigit() and int(n) > 0:
                out.append(int(n))
    return sorted(set(out))

def analyser_page(p, pays, now):
    debut = now - FENETRE_J * D
    ads = p["ads"]
    verif(len({a["id"] for a in ads}) == len(ads), f"{p['page_name']} : annonce en double")
    titres = [a.get("title", "") for a in ads]
    if any(GROSSISTE.search(t or "") for t in titres) or GROSSISTE.search(p["page_name"]):
        return {"page": p["page_name"], "page_id": p["page_id"], "verdict": "GROSSISTE",
                "rang": 9}
    toutes = sorted(a["created"] for a in ads)
    cur = [t for t in toutes if t >= debut]
    hors = len(toutes) - len(cur)
    v = vagues(cur)
    S = [0, 0, 0, 0]
    for t in cur:
        S[min(3, int((t - debut) // (7.5 * D)))] += 1
    verif(sum(S) == len(cur) == sum(map(len, v)), f"{p['page_name']} : sommes incohérentes")

    produit_ok = None
    textes_trou = None
    trous = [round((v[i][0] - v[i - 1][-1]) / D, 1) for i in range(1, len(v))]
    starts = [a["start"] for a in ads if a.get("start")]
    en_ligne = round((now - min(starts)) / D, 1) if starts else None
    retard_max = max(((a["start"] - a["created"]) / H for a in ads
                      if a.get("start") and a["created"] >= debut), default=0)

    if not cur:
        verdict, pattern, rang = "DORMANTE", "-", 8
    elif len(v) == 1:
        verdict, pattern, rang = "TEST", "-", 6
    else:
        gros = [i for i, g in enumerate(trous) if g >= 3]
        if not gros:
            pattern = "AVEC STOCK"
            d = distinctes(v)
            verdict = "WINNER" if d >= 3 else ("SCALING" if d == 2 else "TEST")
            rang = {"WINNER": 2, "SCALING": 3, "TEST": 6}[verdict]
        else:
            i = gros[-1]
            g = trous[i]
            apres = sum(len(w) for w in v[i + 1:])
            avant = len(v[i])
            if g > 15:
                pattern, verdict, rang = "-", "REPRISE APRÈS ABANDON", 7
            else:
                pattern = "SANS STOCK"
                if apres > avant:
                    verdict, rang = "SCALING PRODUCTION", 1
                else:
                    verdict, rang = "RE-TEST", 5
                if g > 10:
                    verdict += " (trou long)"
            if distinctes(v[i + 1:]) >= 3:
                verdict += " + WINNER depuis la reprise"
            # 12/10/2026 : un trou ne vaut production que si c'est le MÊME produit avant et après.
            # Champ « produit » de chaque pub (lu dans le texte de la pub, étape 3). Sans lui : « produit ? ».
            if rang == 1:
                def prods(ws):
                    return {a["produit"].strip().lower() for a in ads if a.get("produit")
                            and any(w[0] <= a["created"] <= w[-1] for w in ws)}
                pa, pb = prods([v[i]]), prods(v[i + 1:])
                produit_ok = False
                # textes lus par fusion_navigateur.py : ce qu'il faut regarder pour remplir « produit »
                def textes(ws):
                    return sorted({(a.get("texte") or a.get("title") or "")[:30].strip() for a in ads
                                   if any(w[0] <= a["created"] <= w[-1] for w in ws)} - {""})
                textes_trou = {"avant": textes([v[i]]), "apres": textes(v[i + 1:])}
                if pa and pb:
                    produit_ok = True
                    if not (pa & pb):
                        pattern, verdict, rang = "-", "NOUVEAU MODÈLE", 4

    return {
        "page": p["page_name"], "page_id": p["page_id"], "niche": p.get("niche", ""),
        "pubs_30j": len(cur), "hors_fenetre": hors,
        "vagues": [{"date": jjmm(w[0]), "pubs": len(w)} for w in v],
        "trous_j": trous, "etalement_j": round((cur[-1] - cur[0]) / D, 1) if cur else 0,
        "semaines": S, "en_ligne_j": en_ligne, "retard_max_h": round(retard_max, 1),
        "prix": prix_dans(titres, pays), "pattern": pattern, "verdict": verdict,
        "rang": rang, "lien": LIEN.format(pays=pays, pid=p["page_id"]),
        "produit_verifie": produit_ok if rang == 1 else None,
        # 12/10/2026 : la Ad Library rend 50 pubs au plus par appel ; au-delà, le verdict est lu sur une liste incomplète.
        "liste_coupee": len(ads) >= 50 and not p.get("total") or int(p.get("total") or 0) > len(ads),
        "dates_au_jour": any(a.get("source") == "navigateur" for a in ads),
        "textes_trou": textes_trou if rang == 1 else None,
        # 21/10/2026 : pubs actives de la page = total annoncé par la Ad Library (ou pubs lues si plus grand) ;
        # « actives_lues » = celles réellement lues ; elles diffèrent quand la liste est coupée.
        "actives": max(int(p.get("total") or 0), len(ads)), "actives_lues": len(ads),
    }

GROUPES = [
    (1, "SANS STOCK — scaling après production", "حبس، خلص الإنتاج، ورجع بالقوة"),
    (2, "AVEC STOCK — winner", "السلعة عندو ويرجع ديما"),
    (3, "AVEC STOCK — scaling", "رجع مرة ثانية بعد ما شاف النتيجة"),
    (4, "NOUVEAU MODÈLE — pas une production", "بدّل الموديل، ماشي نفس السلعة"),
    (5, "SANS STOCK — re-test", "رجع بصح ما زادش"),
    (6, "TEST — rien de prouvé", "لانسا كلش في نهار واحد، ما تقلدوش"),
    (7, "Repris après abandon", "حبس بزاف ورجع، يمكن موديل آخر"),
]

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def ligne(r, pays):
    m = PAYS[pays]
    vg = " → ".join(str(w["pubs"]) for w in r["vagues"])
    tr = (" · ".join(f"{t:.1f}".replace(".", ",") for t in r["trous_j"]) + " j") if r["trous_j"] else "aucun"
    if r["prix"]:
        px = " / ".join(f"{p:,}".replace(",", " ") + f" {m['monnaie']}" for p in r["prix"])
        px += " (" + " / ".join(f"{p / m['usd']:.2f}".replace(".", ",") for p in r["prix"]) + " USD)"
    else:
        px = "prix ?"
    el = f"{r['en_ligne_j']:.1f}".replace(".", ",") + " j" if r["en_ligne_j"] is not None else "?"
    return (f'<a href="{r["lien"]}">{esc(r["page"])}</a> · {esc(r["niche"])}\n'
            f"Vagues {vg} · Trous {tr} · En ligne {el} · {px}"
            + (" · produit ?" if r.get("produit_verifie") is False else "")
            + (" · liste coupée" if r.get("liste_coupee") else "")
            + (" · dates au jour près" if r.get("dates_au_jour") else ""))

def telegram(res, pays):
    """Découpe en messages de moins de 3 800 caractères (limite Telegram 4 096)."""
    m = PAYS[pays]
    blocs = [f"{m['drapeau']} <b>SPY {pays}</b>\nهاذا هو التحليل تاع الشهر\n"
             f"Fenêtre : {res['fenetre']} · {res['nb_pages']} pages"]
    for rang, titre_fr, phrase_ar in GROUPES:
        rows = [r for r in res["pages"] if r["rang"] == rang]
        if not rows:
            continue
        blocs.append(f"<b>{titre_fr}</b> — {len(rows)}\n{phrase_ar}")
        for r in rows:
            blocs.append(ligne(r, pays))
    jet = [r for r in res["pages"] if r["rang"] >= 8]
    if jet:
        blocs.append(f"<b>Écartées</b> — {len(jet)}\nغير بائعين بالجملة ولا صفحات واقفة\n"
                     + ", ".join(esc(r["page"]) for r in jet))
    msgs, cur = [], ""
    for b in blocs:
        if len(cur) + len(b) + 2 > 3800:
            msgs.append(cur)
            cur = ""
        cur += ("\n\n" if cur else "") + b
    if cur:
        msgs.append(cur)
    # contrôle : aucune ligne arabe ne contient de chiffre (lisibilité chez le client)
    for msg in msgs:
        for l in msg.split("\n"):
            if re.search(r"[؀-ۿ]", l) and re.search(r"[0-9٠-٩]", l) \
               and "<a href" not in l:
                raise ControleEchoue(f"chiffre dans une ligne arabe : {l[:60]}")
    verif(all(len(x) <= 4096 for x in msgs), "message Telegram trop long")
    return msgs

def analyser(data):
    pays = data["pays"].upper()
    verif(pays in PAYS, f"pays inconnu : {pays}")
    now = int(data.get("now") or time.time())
    ids = [p["page_id"] for p in data["pages"]]
    verif(len(ids) == len(set(ids)), "page en double dans l'entrée")
    verif(all(re.fullmatch(r"\d{6,20}", i) for i in ids), "page_id non numérique")
    pages = sorted((analyser_page(p, pays, now) for p in data["pages"]),
                   key=lambda r: (r["rang"], -r.get("pubs_30j", 0)))
    verif(len(pages) == len(data["pages"]), "page perdue en route")
    return {"pays": pays, "now": now,
            "fenetre": f"{jjmm(now - FENETRE_J * D)} → {jjmm(now)}",
            "nb_pages": len(pages), "pages": pages}

if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("entree")
    ap.add_argument("--json", help="fichier de sortie JSON")
    ap.add_argument("--telegram", help="fichier de sortie : messages séparés par ===")
    a = ap.parse_args()
    try:
        res = analyser(json.load(open(a.entree, encoding="utf-8")))
        if a.json:
            json.dump(res, open(a.json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        msgs = telegram(res, res["pays"])
        if a.telegram:
            open(a.telegram, "w", encoding="utf-8").write("\n===\n".join(msgs))
        print(f"PASSE · {res['nb_pages']} pages · {len(msgs)} message(s)")
    except ControleEchoue as e:
        print(f"ÉCHEC · {e}")
        sys.exit(2)
