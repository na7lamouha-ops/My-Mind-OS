import json, sys, os, copy
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import spy_calc as S

NOW = 1791808128
def page(pid, name, niche, created, start_delay=5400, title=""):
    return {"page_id": pid, "page_name": name, "niche": niche,
            "ads": [{"id": f"{pid}{i}", "created": c, "start": c + start_delay, "title": title}
                    for i, c in enumerate(created)]}

DATA = {"pays": "DZ", "now": NOW, "pages": [
    page("697649403431569", "Kika collection", "abaya",
         [1791787905,1791787904,1791787900,1791787896,1791787893,1791320103,1791098022]),
    page("559730067231709", "Malikat el Anaka", "robe",
         [1791672285,1791672284,1791672284,1791672284,1791672284,1791672283,1791491586,1791491585,
          1791491578,1791491574,1791491573,1791491572,1791067485,1791067483,1791067473,1791067473,
          1791067472,1791067471,1790203842,1790203831,1790203830]),
    page("1268772929645179", "Al Zahraa Brand", "abaya",
         [1791748196,1791748195,1791748195,1791748194,1791748193,1791748193]),
    page("469031479635737", "Signature pure", "robe",
         [1791602044,1791602043,1791602031,1791505751,1791251321,1791251211,1791071432,1791071435]),
    page("102533027894149", "Dar el afrah", "khimar",
         [1791761802,1791761794,1791761793,1790113150,1790111762,1790111763,1789225596,1787049516]),
    page("1097917236747809", "La REINA", "caftan", [1791796395,1791796149,1791486432],
         title="💰 السعر: 9000 دج"),
    page("102773981969159", "قندورة الدار و المناسبات - بومعطي", "qandoura",
         [1791706528,1791620298], title="⛔ جملة فقط بالسيري فيها 12 حبة"),
    page("111111111111111", "Page morte", "robe", [1780000000, 1781000000]),
]}
ATTENDU = {
    "Kika collection": "SCALING PRODUCTION",
    "Malikat el Anaka": "SCALING PRODUCTION",
    "Al Zahraa Brand": "TEST",
    "Signature pure": "WINNER",
    "Dar el afrah": "REPRISE APRÈS ABANDON",
    "La REINA": "SCALING PRODUCTION",
    "قندورة الدار و المناسبات - بومعطي": "GROSSISTE",
    "Page morte": "DORMANTE",
}
ok = True
res = S.analyser(copy.deepcopy(DATA))
got = {r["page"]: r["verdict"] for r in res["pages"]}
for k, v in ATTENDU.items():
    good = got.get(k) == v
    ok &= good
    print(("PASSE " if good else "ÉCHEC ") + f"{k}: attendu {v}, obtenu {got.get(k)}")

r = {x["page"]: x for x in res["pages"]}
checks = [
    ("trous Malikat = 10,0 · 4,9 · 2,1", r["Malikat el Anaka"]["trous_j"] == [10.0, 4.9, 2.1]),
    ("prix La REINA lu = 9000", r["La REINA"]["prix"] == [9000]),
    ("en ligne Al Zahraa ~ 0,7 j", r["Al Zahraa Brand"]["en_ligne_j"] == 0.6),
    ("lien Kika correct", r["Kika collection"]["lien"].endswith("country=DZ&view_all_page_id=697649403431569")),
    ("vagues Kika 1-1-5", [w["pubs"] for w in r["Kika collection"]["vagues"]] == [1, 1, 5]),
]
for n, c in checks:
    ok &= c
    print(("PASSE " if c else "ÉCHEC ") + n + ("" if c else f" -> {r}"))

# PIÈGES : le moteur DOIT refuser
pieges = []
d = copy.deepcopy(DATA); d["pages"].append(copy.deepcopy(d["pages"][0])); pieges.append(("page en double", d))
d = copy.deepcopy(DATA); d["pages"][0]["page_id"] = "abc"; pieges.append(("page_id non numérique", d))
d = copy.deepcopy(DATA); d["pays"] = "FR"; pieges.append(("pays inconnu", d))
for n, d in pieges:
    try:
        S.analyser(d); print("ÉCHEC piège non attrapé : " + n); ok = False
    except S.ControleEchoue:
        print("PASSE piège attrapé : " + n)

# PIÈGE Telegram : chiffre dans une ligne arabe
r2 = copy.deepcopy(res); r2["pages"][0]["niche"] = "abaya"
orig = S.GROUPES[0]
S.GROUPES[0] = (1, orig[1], "رجع 5 مرات")
try:
    S.telegram(r2, "DZ"); print("ÉCHEC piège non attrapé : chiffre en arabe"); ok = False
except S.ControleEchoue:
    print("PASSE piège attrapé : chiffre dans une ligne arabe")
S.GROUPES[0] = orig

msgs = S.telegram(res, "DZ")
c = all(len(m) <= 4096 for m in msgs) and all(m.count("<a href") == m.count("</a>") for m in msgs)
ok &= c
print(("PASSE " if c else "ÉCHEC ") + f"Telegram : {len(msgs)} message(s), balises fermées, < 4096")
for p in ["MA", "EG", "IQ", "TN"]:
    d = copy.deepcopy(DATA); d["pays"] = p
    rr = S.analyser(d); S.telegram(rr, p)
    c = rr["pages"][0]["lien"].find(f"country={p}") > 0
    ok &= c
    print(("PASSE " if c else "ÉCHEC ") + f"pays {p} : lien et message")
print("\nRÉSULTAT GLOBAL :", "PASSE" if ok else "ÉCHEC")
sys.exit(0 if ok else 1)
