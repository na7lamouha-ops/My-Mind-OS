# Archive « الطالب 1.0 » (fix 9) — l'ÉTAPE 6 de bureau/skills/scaling/SKILL.md (0.4.2)

Retirée de la skill le 27/10/2026 : en 1.0, la porte du scale est celle de `portes.mjs` (bureau), plus `manita-scaling.py --porte`.
La skill était aussi à la limite de la chaîne (60 000 caractères). Le texte est gardé tel quel ci-dessous.

---

## ETAPE 6 — la porte, RELUE et non recalculee

```
python3 manita-scaling.py --porte --commandes 100 --confirmees 60 \
  --livrees 25 --expediees 50 --retours 8 --stock 40 --be-livree 3567 \
  --cout-livree 1530 --devise-depenses DZD --devise USD --taux-dinar 262
```

**`--retours` est OBLIGATOIRE, meme a zero.** L'outil refuse de juger sans
lui, et ce refus t'a coute de l'argent tant qu'il n'existait pas. Voila
pourquoi : un colis encore EN ROUTE compte a trois sur dix — c'est la loi du
vendeur, et elle est juste, parce qu'un colis parti hier n'est pas un echec.
Mais un colis RENDU, lui, vaut zero. Sans `--retours`, l'outil ne savait pas
faire la difference : il comptait tout ce qui n'etait pas livre comme « en
route », donc a trois sur dix. La porte s'ouvrait des **14,29 %** de
livraison reelle.

```
140 expedies · 20 livres · 120 rendus
  sans --retours : 20 + 120 x 0,30 = 56 sur 140  ->  40 %  ->  PORTE OUVERTE
  avec --retours : 20 +   0 x 0,30 = 20 sur 140  ->  14 %  ->  porte fermee
```

Vingt colis livres sur cent quarante partis, et la porte s'ouvrait. Le
chiffre se **lit dans Tassyir** (`list_returns`, ou le compteur des retours
sur la periode). Il ne se deduit pas, et « je n'en ai pas » ne veut pas dire
zero : ca veut dire que tu ne l'as pas encore lu. Zero ne s'ecrit que quand
tu as verifie qu'il n'y a eu aucun retour.

C'est exactement le meme `--retours` que l'agent Coach. Les deux portes
doivent rendre le meme verdict sur les memes chiffres — si elles divergent,
tu ne choisis pas la plus gentille, tu t'arretes et tu le dis.

`--cout-livree` = la depense publicitaire divisee par le nombre de colis
LIVRES. Elle vient de Meta, donc elle suit `--devise-depenses`.
`--be-livree` vient du break even : toujours en dinars.

**C'est le seul controle de rentabilite de toute la porte.** Une erreur
d'unite ici ouvre la porte sur un produit qui perd : 470 dollars sur 20 colis
font 6 000 DA par colis livre, contre un break even de 3 567. La porte doit se
fermer. Passee en dollars, elle s'ouvrait. L'outil refuse maintenant un cout
par colis trop bas pour etre des dinars, mais la vraie protection, c'est que
tu saches ce que tu passes.

Cinq controles. **Un seul non ferme la porte.** Une bonne confirmation ne
compense jamais une mauvaise livraison : le colis qui ne part pas ne
rapporte rien.

Les cinq barres, pour que tu puisses lui dire de COMBIEN il est loin — il ne
voit jamais ces chiffres, mais toi tu dois les connaitre pour repondre « il
te manque tant » au lieu de « non » :

```
confirmation ...... au moins la moitie des commandes
livraison ......... au moins deux colis expedies sur cinq
colis livres ...... au moins vingt
rentabilite ....... le colis livre coute moins que son break even
stock ............. il en reste
```

L'outil refuse aussi les chiffres impossibles : plus de confirmees que de
commandes, plus de livrees que d'expediees. Si ca arrive, tu n'as pas
compare la meme periode des deux cotes.

Et la porte ouverte **ne lance rien**. Elle donne le droit de DEMANDER.

