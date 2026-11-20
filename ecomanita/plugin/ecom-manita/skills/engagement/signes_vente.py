#!/usr/bin/env python3
"""Signes qu'un profil VEND, à partir du brut déjà lu (aucun appel Meta).

    python3 signes_vente.py [dossier du run] [mois|3mois|saison] [--json sortie.json]

Sans dossier : « run-mois » du dossier de travail par défaut.
Pour chaque profil qui a au moins une vidéo au-dessus du seuil :
  régularité : part de ses vidéos de la période qui passent le seuil
  volume     : nombre de vidéos au-dessus du seuil
  intention  : commentaires pour 1 000 vues (médiane) ; en vêtement, surtout
               des questions de prix et de taille
  pub ?      : 80 % ou plus de vidéos au-dessus du seuil (3 au moins) = souvent
               poussé par la pub (à croiser avec le spy des pubs)
Classement : volume × régularité, puis intention. Ce sont des SIGNES : seule la
vente livrée (un test chez soi) prouve qu'un modèle est rentable.
"""
import json
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import spy_engagement as s  # noqa: E402

PUB_PROBABLE = 0.80


def analyser(bruts, maintenant, periode="mois"):
    debut, fin = s.fenetre(maintenant, periode)
    profils = []
    for b in bruts:
        if "erreur" in b:
            continue
        videos = [m for m in b.get("medias", []) if s.est_video(m) and "timestamp" in m
                  and debut <= s.date(m["timestamp"]) < fin and s.entier(m.get("view_count"))
                  and m["view_count"] > 0]
        gagnantes = [m for m in videos if m["view_count"] > s.SEUIL_VUES]
        if not gagnantes:
            continue
        part = len(gagnantes) / len(videos)
        intention = statistics.median((s.entier(m.get("comments_count")) or 0) / m["view_count"] * 1000 for m in videos)
        profils.append({"username": b["username"], "pays_lu": s.pays_lu(b)[0], "abonnes": b.get("followers_count"),
                        "videos": len(videos), "gagnantes": len(gagnantes), "regularite": round(part, 2),
                        "intention": round(intention, 2), "vues_gagnantes": sum(m["view_count"] for m in gagnantes),
                        "pub_probable": part >= PUB_PROBABLE and len(gagnantes) >= 3})
    profils.sort(key=lambda p: (-(p["gagnantes"] * p["regularite"]), -p["intention"], p["username"]))
    for i, p in enumerate(profils, 1):
        p["rang"] = i
    return {"periode": periode, "du": debut.isoformat()[:10], "au": fin.isoformat()[:10],
            "note": "signes d'intérêt, pas des ventes", "profils": profils}


def main(argv):
    pos, opt = s.options(argv)
    periode = pos[1] if len(pos) > 1 and pos[1] in s.PERIODES else "mois"
    run = Path(pos[0]) if pos else s.TRAVAIL_DEFAUT / f"run-{periode}"
    bruts = s.charger_bruts(run)
    res = analyser(bruts, s.horloge(), periode)
    if "--json" in opt:
        s.ecrire_json(opt["--json"], res)
    for p in res["profils"]:
        s.dire(f"{p['rang']}. @{p['username']} · {p['pays_lu'] or '?'} · {p['gagnantes']}/{p['videos']} "
               f"({p['regularite']:.0%}) · intention {p['intention']}{' · pub ?' if p['pub_probable'] else ''}")
    s.dire(f"PASSE · {len(res['profils'])} profil(s) · {len(bruts)} lu(s) · période {periode} "
           f"du {res['du']} au {res['au']}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
