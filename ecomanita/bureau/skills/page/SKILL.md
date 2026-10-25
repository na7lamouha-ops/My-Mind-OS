---
name: page-produit-manita
description: "Construire une page produit et ses SKU sur une boutique Tassyir, a partir des photos, du prix, des couleurs, des tailles et du stock du client. L'outil manita-produit.py prepare le paquet ; c'est la connexion Tassyir du client qui l'envoie. Les textes suivent le script d'angles du vendeur (SCRIPT-ANGLES-MARKETING.json), en darija. La page est publiee des qu'elle est prete et relue."
---

# Page produit + SKU — ton role

Tu prepares la page produit d'un e-commercant algerien sur sa boutique
Tassyir, tu la relis, tu la PUBLIES tout de suite (regle du vendeur du
06/10/2026 : une page prete ne reste pas cachee en attendant un mot), et tu
lui montres ses photos et le lien.

Tu travailles seul. Tu ne demandes pas la permission a chaque etape.

## CE QUE TU NE TOUCHES JAMAIS

- Tu ne modifies JAMAIS le code de `manita-produit.py`. Si l'outil affiche
  une erreur, tu montres le message EXACT et tu attends. Tu n'inventes pas
  la cause, tu ne reecris pas le fichier.
- Tu ne demandes JAMAIS une cle, un mot de passe, un identifiant Tassyir ni
  un numero de carte. La connexion Tassyir est deja dans les reglages de ce
  Claude : c'est celle du client, elle ne passe pas par l'outil.
- Tu ne publies qu'une page RELUE (les controles de la fin de ce fichier).
  Une page prete et relue est publiee tout de suite, sans attendre « نشرها ».

## L'ORDRE — ne jamais l'inverser

```
1. les photos du modele   ->  le SCRIPT D'ANGLES  ->  les textes
2. les textes                                 ->  la description
3. seulement apres                            ->  la page sur Tassyir
```

Le message de la pub et celui de la page doivent etre le MEME. Si les
angles n'existent pas encore, tu les ecris d'abord. Tu n'improvises jamais
un texte de page produit quand les angles existent deja.

**Le script d'angles du vendeur** est le fichier `SCRIPT-ANGLES-MARKETING.json`,
a cote de ce fichier. Tu le suis, AVEC UNE EXCEPTION decidee par le vendeur :
la langue de tous les textes que la cliente lit est la **DARIJA ALGERIENNE**,
pas l'arabe standard que le script demande. Le reste du script s'applique
(analyse des photos sans poser de question, emojis, structure des sections).

## ETAPE 1 — l'outil

```
python3 manita-produit.py --installer
python3 manita-produit.py --verifier
```

Rien a installer : l'outil n'utilise que ce que Python apporte deja, donc
aucun mot de passe administrateur. Si un controle de `--verifier` rate, tu
t'arretes et tu montres la ligne qui a rate, telle qu'elle est affichee.

## ETAPE 2 — ce que tu demandes au client

Tu poses ces questions, dans cet ordre, et tu ne devines aucune reponse.

```
1. Le nom du produit                         (3 a 80 caracteres)
2. Sa boutique                                (tu la lis avec list_stores)
3. Le prix                                    (entre 1 500 et 59 000 DA)
4. Les couleurs                               (avec leur code #RRGGBB si connu)
5. La configuration de tailles                (LA QUESTION OBLIGATOIRE)
6. Le mode SKU                                (LA QUESTION OBLIGATOIRE)
7. Le stock REEL, taille par taille           (zero accepte)
8. Les photos                                 (6 a 15)
```

**Pour la boutique :** `list_stores` rend TOUTES les boutiques. Tu ne
proposes que celles dont le `status` est `active`. Une boutique eteinte ne
doit jamais apparaitre dans la liste que tu lui montres.

## LA QUESTION OBLIGATOIRE — avant CHAQUE produit, sans exception

Avant de fabriquer le moindre SKU, tu poses cette question. Tu la lis
telle quelle avec :

```
python3 manita-produit.py --question
```

Elle demande deux choses au client :

```
1. les tailles GROUPEES ou SEPAREES
2. les tailles en LETTRES ou en CHIFFRES
```

**LE CLIENT EST PEUT-ETRE DEBUTANT. Tu EXPLIQUES, tu ne te contentes
pas de poser la question.** Beaucoup n'ont jamais utilise Claude, et
beaucoup ne savent pas ce qu'est un SKU. La question que l'outil affiche
contient deja l'explication et les exemples : tu la lis EN ENTIER, avec
les exemples, tu ne la resumes pas.

Ce qu'il doit comprendre, en une phrase chacun :

| Mot | Comment tu l'expliques |
|---|---|
| SKU | un nom interne pour reconnaitre chaque piece au magasin et sur le bon de livraison — la cliente ne le voit jamais |
| separees | chaque taille a son propre code |
| groupees | deux tailles partagent le meme code |

Et tu lui dis ce que ca CHANGE pour lui :

| Son choix | Ce que ca lui donne |
|---|---|
| un code par taille | plus de codes, mais une lecture plus fine |
| un code pour deux | moins de codes, plus simple avec l'atelier |

Dans les deux cas le stock reste compte TAILLE PAR TAILLE : s'il vend un
S, le M ne bouge pas. Dis-le-lui, c'est la peur numero un.

**S'il ne comprend pas, tu reexpliques avec SES mots** : son modele, sa
couleur, ses tailles a lui. Tu ne passes pas a la suite tant qu'il n'a
pas repondu.

**Tu ne reponds JAMAIS a sa place.** Meme s'il a repondu la semaine
derniere. Meme si c'est son dixieme produit. Meme si tu crois connaitre sa
facon de faire. Chaque client range ses tailles autrement, et tu n'as
aucun moyen de deviner lequel tu as en face.

L'outil n'a plus AUCUNE valeur par defaut pour les tailles ni pour le mode
SKU : sans sa reponse, **il refuse de fabriquer** et il reaffiche la
question. Ce n'est pas un obstacle, c'est la garantie que le choix reste
le sien.

Ce que tu fais de sa reponse :

| Sa reponse a la QUESTION 1 | La commande |
|---|---|
| par les lettres | `--tailles lettres-complete` |
| par les chiffres | `--tailles chiffres-complete` |
| par les blocs, 2 blocs | `--tailles bandes-2` |
| par les blocs, 3 blocs | `--tailles bandes-3` |
| par les blocs, 4 blocs | `--tailles bandes-4` |

| Sa reponse a la QUESTION 2 | La commande |
|---|---|
| un code par taille | `--mode par-taille` |
| un code pour deux tailles | `--mode groupe2` |

**Les blocs ne se regroupent pas deux fois.** Un bloc EST deja une taille
qui en couvre deux ou trois. `bandes-2`, `bandes-3` et `bandes-4` vont donc
avec `--mode par-taille`. Mettre `groupe2` par-dessus, c'est regrouper des
groupes : la cliente ne sait plus ce qu'elle achete.

S'il veut une bande de tailles plus courte : `--tailles-liste` montre
toutes les configurations. S'il veut composer ses groupes lui-meme :
`--mode perso --groupes "S+M, L+XL, 2XL+3XL"`.

**Une troisieme question arrive parfois toute seule.** Si une taille reste
seule parce que sa paire n'est pas complete — il prend 46 a 58, et le 46
va normalement avec le 44 — l'outil s'arrete et te fait demander : son
propre SKU, ou dans un groupe a lui. La non plus tu ne decides pas.

**Le troisieme choix, s'il le demande.** Il existe un mode
`groupe2-affiche` ou la cliente choisit « Taille 1 (S-M) » au lieu de S ou
M. Tu ne le proposes PAS de toi-meme : avec lui, le client ne saura jamais
si c'est le S ou le M qui s'est vendu. Tu l'utilises seulement s'il le
demande, et tu lui dis cette phrase avant.

**L'affichage, quand c'est TOI qui ecris :** jamais un chiffre au milieu
d'une phrase arabe. Les tailles en chiffres vont sur leur propre ligne.
Chez lui, un chiffre colle a de l'arabe s'affiche a l'envers.

## LE REGLAGE — quand il range TOUJOURS pareil

Un client qui fait toujours « groupe par deux, en chiffres » n'a pas a
repondre dix fois. Il l'ecrit UNE fois, et tu appliques.

**Au tout premier produit, tu lui proposes :**

> « Tu ranges toujours tes tailles de la meme facon ? Si oui je l'ecris
>   une fois et je ne te le redemande plus — tu pourras le changer quand
>   tu veux. »

S'il dit oui :

```
python3 manita-produit.py --reglage-ecrire \
  --tailles <sa reponse> --mode <sa reponse> --orphelin seul \
  --sortie <son dossier>
```

Ca ecrit `reglage.txt` a cote de ses produits.

**Ensuite, a chaque produit :**

| Cas | Ce que tu fais |
|---|---|
| Il a un reglage | tu ne reposes pas la question |
| Pas de reglage | tu poses la question, comme avant |
| Il dit autre chose aujourd'hui | sa reponse du jour GAGNE |

L'outil affiche un cadre a chaque fois :

```
+------------------------------------------------------------+
|  J'APPLIQUE TON REGLAGE, PAS UN CHOIX A MOI                 |
+------------------------------------------------------------+
```

**Tu ne caches JAMAIS ce cadre au client.** Tu le lui montres tel quel.
Un reglage applique en silence redevient un defaut — et un defaut, c'est
toi qui choisis a sa place.

`--reglage-voir` montre le reglage en place. Pour le changer : il ouvre
`reglage.txt`, ou il efface une ligne et tu lui reposes cette question-la.

## ETAPE 3 — les photos

Les photos doivent etre des adresses `https` publiques. L'outil refuse tout
le reste, parce que Tassyir les refuserait aussi.

Si les photos sont sur son disque, `upload_image` ne sait pas les lire : il
ne prend que des adresses. Deux chemins, tu lui laisses choisir :
- il les depose une fois dans sa mediatheque Tassyir et te colle les liens
  (`upload_image` accepte jusqu'a **vingt** adresses en un seul appel) ;
- ou il te donne un dossier public et tu passes les liens a `upload_image`.

Tu ecris ensuite un fichier `photos.txt`, une ligne par photo :

```
Noir  | https://cdn.tassyir.io/images/.../public
Beige | https://cdn.tassyir.io/images/.../public
```

La couleur devant chaque photo n'est pas decorative : c'est elle qui permet
a l'outil de ne JAMAIS mettre deux photos de la meme couleur l'une apres
l'autre. Trois photos blanches d'affilee font croire a la cliente qu'il n'y
a qu'une seule couleur, elle ecrit pour demander, et c'est une commande qui
n'est pas passee.

**L'ORDRE DES COULEURS (décision du vendeur du 10/10/2026)** : dans la galerie ET dans la description alternée
photo / texte, les couleurs vont DU FONCÉ AU CLAIR, même quand le client les nomme dans un autre ordre, puis rotation
(noir, bleu marine, gris, beige, noir, bleu marine…). JAMAIS deux fois la même couleur à la suite : c'est la RÈGLE.
Cinq couples photo / texte restent une CIBLE (voir plus bas). Une couleur épuisée est d'abord relancée seule en
captures ; sinon elle est sautée et la rotation continue sur les restantes.
Le réglage est `ORDRE_COULEURS` dans missions.mjs (une seule définition) : `'foncees'` (défaut : du foncé au clair) |
`'nommees'` (l'ordre où le CLIENT a donné les noms : chaque réponse de la palette prend la place suivante, une couleur
renommée prend sa nouvelle place) | `'fournie'` (l'ancien : la plus fournie d'abord).
- Bureau : il range lui-même par la luminance du centre de chaque famille (somme R+G+B, la mesure de captures.py), puis
  le rang — une 2e passe ou une famille ajoutée ne casse pas l'ordre ; une famille sans centre garde sa place. Il passe
  l'ordre obtenu à l'outil (`--ordre-couleurs "Noir,Marine,Gris,Beige"`) et relit le paquet : si l'outil n'a pas suivi
  la rotation de l'ordre donné, la page est refusée.
- Mode manuel : `--ordre-couleurs foncees` avec `--couleurs "Nom:#hex,…"` ; l'outil range par la luminance du hex
  (même somme R+G+B). Une couleur écrite sans hex garde sa place relative, et l'outil le DIT (« … sans code couleur
  (#hex) : gardee a sa place »). Une liste de noms (`--ordre-couleurs "Noir,Beige"`) reste possible : l'outil la
  respecte telle quel. Sans `--ordre-couleurs`, l'ancien comportement (la plus fournie d'abord).

**CINQ COUPLES PHOTO / TEXTE au moins** dans la description (`PHOTOS_DESCRIPTION = 5`) : vise quatre à cinq paragraphes
de description longue (la courte compte pour un). Moins de cinq blocs ou de photos : l'outil le DIT (« ATTENTION : N
couples… ») et garde l'alternance, il ne colle jamais deux photos ni deux textes.

**LA DESCRIPTION STOCKÉE, RELUE** : après create_product / update_product, `get_product` et relis la description
réellement stockée. Une balise échappée (`&lt;img`, `&amp;lt;`), une image du paquet qui manque, ou un bloc entre
crochets et guillemets (une liste JSON) : refais UNE fois l'update_product avec la description du paquet caractère par
caractère, balises brutes, aucun échappement ; encore fautive → tu t'arrêtes, la page reste cachée, et tu le dis.

**LA DESCRIPTION PART SEULE, PUIS ELLE EST RELUE — OBLIGATOIRE** (10/10/2026, une description stockée abîmée constatée en vrai : la
relecture ne s'était pas faite) : la description part dans SON PROPRE `update_product` { productId, description } — rien
d'autre dans cette charge (ni nom, ni isActive, ni variantes) — puis `get_product` APRÈS cet envoi, et tu lis la
description BRUTE stockée : toutes les images du paquet en balises `<img` brutes (aucune échappée, aucune absente), aucune
liste JSON, aucun « \n » écrit. Pas relue = pas prouvée : la page ne sort pas. Fautive ou non relue → UN seul nouvel envoi
de la description seule, relu ; encore raté → tu t'arrêtes, la page reste cachée, tu le dis. La publication vient APRÈS.
C'est la DERNIÈRE écriture de la description qui compte (passe « casser » du 10/10/2026) : ne la réécris jamais après sa relecture, ni avec le nom ; la relecture lit CE produit (jamais un autre produit, jamais une variante) ; et la PUBLICATION ne renvoie jamais la description (elle est relue si elle l'a été : abîmée → arrêt dit au client).

## ETAPE 4 — les textes : le script d'angles du vendeur

Tu ouvres d'abord les photos du modele, puis tu suis le script
`SCRIPT-ANGLES-MARKETING.json` (en darija, voir plus haut). Ce qu'il te fait
sortir, et ou chaque piece va :

| Ce que le script donne | Ou ca va |
|---|---|
| le Titre du Produit | `--nom` de l'outil (le nom de la page) |
| la description COURTE (haut de page) | le PREMIER bloc de `textes.txt` |
| la description LONGUE (deux a cinq paragraphes) | les blocs suivants de `textes.txt` |
| cinq angles, choisis dans la banque de douze D'APRES LES PHOTOS | les annonces du test (agent Testing) |
| pour chaque angle : deux primary texts, deux headlines, deux descriptions | on garde le MEILLEUR de chaque (un primary, un titre, une description par angle) |
| declencheurs, audience, mots-cles, offres, positionnement du prix, idees de creas, tests, retargeting, notes finales | `strategie.json` + `strategie.txt` dans le dossier du modele : c'est pour le coach |

Les cinq angles ne sont PAS une liste fixe : ils sortent de la banque de
douze du script, choisis sur ce que les photos montrent, chacun avec une
logique de persuasion differente.

`textes.txt` : un bloc par paragraphe, separes par une ligne vide, la
description courte en premier. Deux a six lignes courtes par bloc, jamais de
pave (l'outil refuse plus de six lignes), aucun prix (l'outil ajoute la ligne
prix + livraison + paiement a la reception).

**Les controles, sur chaque texte que la cliente lit :**

```
1. jamais le mot « COD » — on ecrit « الدفع عند الاستلام »
2. aucun faux avis, aucun temoignage : aucune citation attribuee a une
   personne (« زبونة قالت … », « « … » — سارة »)
3. le prix EXACT une seule fois, dans le primary, SEUL sur sa ligne :
   « 6900 دج » ; aucun autre prix, aucun prix barre invente
4. aucun chiffre dans une ligne arabe (hors la ligne du prix)
5. aucune promesse (« مضمون », « تربح », « 100% », « الأحسن في الجزائر »)
6. aucun mot marocain (« تحوّس », « الكاس », « الصوردي », « دابا », « واخا »)
7. aucun mot francais (prix, stock, commande, livre, video…) dans une ligne
   arabe ; jamais « cod », meme colle dans un mot (« Robe Codette » : l'outil
   refuse le nom)
8. un titre d'annonce de 60 caracteres au plus, une description de 90 au plus :
   on garde un texte qui tient, on ne coupe jamais au milieu d'un mot
9. un paragraphe de la page = UN bloc : aucune ligne vide ni « --- » DEDANS
   (l'outil couperait le paragraphe en deux blocs, et l'alternance
   photo / texte se decalerait)
```

Si le meilleur des deux textes d'un champ casse une regle, tu gardes l'autre ;
si les deux la cassent, tu le reecris. Le bureau fait ces controles tout seul
dans sa chaine ; a la main, c'est toi qui les fais.

## ETAPE 5 — la commande

```
python3 manita-produit.py --produit \
  --nom "<le nom>" \
  --boutique <code court, ex SHOP> --modele <code, ex M05> \
  --prix <en DA> \
  --couleurs "Noir:#141414, Beige:#C9BC94" \
  --tailles <configuration> --mode <mode SKU> \
  --stock "Noir/S:8,Noir/M:12,..." \
  --photos photos.txt --textes textes.txt \
  --sortie <dossier de sortie>
```

L'outil ecrit quatre fichiers :

```
paquet-create_product.json   le paquet exact a donner a Tassyir
stock.json                   le stock reel, taille par taille
description.txt              la description en alternance photo / texte
ordre-des-photos.txt         l'ordre retenu, avec la couleur de chacune
```

Si l'outil REFUSE, tu ne contournes pas : tu montres le refus au client et
tu lui demandes ce qui manque.

## ETAPE 6 — l'ecriture dans Tassyir

Tu prends `paquet-create_product.json` et tu fais, dans cet ordre exact :

```
1. remplacer "storeId" par le vrai identifiant lu avec list_stores
2. create_product avec le paquet
3. TOUT DE SUITE : update_product isActive:false isVisible:false
3 bis. update_product { productId, description } : la DESCRIPTION SEULE, dans son propre envoi (ni nom, ni isActive, ni variantes)
3 ter. get_product de CE produit : la description BRUTE stockee — toutes les <img du paquet en balises brutes (aucune &lt;img,
       aucune absente), aucune liste JSON, aucun « \n » ecrit ; fautive ou non relue → UN seul nouvel envoi seul, relu ;
       encore ratee → tu t'arretes, la page reste cachee, tu le dis
4. render_preview storeId + productId
5. relire la page (les controles de la fin de ce fichier)
6. PUBLIER tout de suite : update_product isActive:true isVisible:true (JAMAIS la description dans cet envoi)
   + repasser chaque variante isHidden:false, puis get_product pour relire
   + CHAQUE variante envoyee porte son id, son price et ses selectedOptions TELS QUE get_product les rend (l'id seul : Tassyir refuse, erreur -32602 ; jamais un prix change)
   + MODE CHAINE (10/10/2026) : la liste complete des variantes est CONSTRUITE PAR LE BUREAU (lue chez Tassyir, recoupee avec le paquet) et donnee prete dans la consigne : tu l'envoies TELLE QUELLE, tu ne recalcules rien
7. montrer au client ses photos et le LIEN de la page publiee
```

**La page est publiee des qu'elle est prete** (regle du vendeur du
06/10/2026). Elle ne reste plus cachee en attendant « نشرها ».

**Pourquoi l'etape 3 doit suivre l'etape 2 sans rien entre les deux :**
`create_product` n'a pas de champ « actif ». Le produit nait donc visible.
L'outil cree deja toutes les variantes cachees, donc rien n'est achetable
pendant ce court moment — mais tu ne laisses pas trainer.

**N'utilise JAMAIS `set_product_active`.** C'est un interrupteur a bascule :
il ne prend pas de oui/non, et rejoue deux fois il republie ce que tu
voulais cacher. `update_product` est explicite, tu peux le rejouer dix fois.

**`render_preview` ne rend pas toujours une image.** S'il ne renvoie qu'un
lien signe, tu donnes le lien au client et tu lui dis de l'ouvrir. Tu ne dis
jamais « regarde l'image » quand il n'y a pas d'image. L'appel prend 15 a
25 secondes : tu attends, tu ne rappelles pas.

**Un apercu qui montre une page de DEMONSTRATION n'est pas une erreur.** Le
produit est encore cache : le rendu montre parfois une page d'exemple au lieu
de CELLE-CI. Tu ne t'arretes pas pour ca, et tu ne montres JAMAIS cet apercu
au client : tu lui montres les VRAIES photos de la page (celles que tu as
envoyees a Tassyir). Un apercu n'est montre que s'il porte le nom ou les
photos de ce produit.

## LE STOCK — comment tu le tiens a jour

Juste APRES avoir cree le produit, tu enregistres la reponse de
`create_product` dans un fichier et tu branches le stock dessus :

```
python3 manita-produit.py --stock-brancher \
  --stock-fichier <dossier>/stock.json \
  --produit-json  <dossier>/produit-tassyir.json
```

Sans ce branchement, le stock ne pourra jamais etre recompte : c'est
l'identifiant de variante qui dit QUELLE TAILLE a ete commandee.

**Quand il te demande ou il en est**, tu releves ses commandes et tu
laisses l'outil faire les comptes. Tu lis TROIS listes, pas une :

| Liste | Ce qu'elle contient |
|---|---|
| `list_orders` | en attente, confirmees, annulees |
| `list_order_tracking` | les colis DEJA partis |
| `list_returns` | ce qui est revenu |

Tu ecris ce que tu as lu dans un fichier, une ligne par article :

```json
{"lignes": [
  {"variantId": "<id-variante-1>", "quantity": 2, "statut": "delivered"},
  {"variantId": "<id-variante-2>", "quantity": 4, "statut": "pending"}
]}
```

Puis :

```
python3 manita-produit.py --stock-recompter \
  --stock-fichier <dossier>/stock.json \
  --commandes     <dossier>/commandes.json
```

**Ce que l'outil fait des statuts, et pourquoi :**

| Statut | Effet sur le stock |
|---|---|
| confirmee, expediee, livree | **deduit** |
| en attente | **PAS deduit**, compte a part |
| annulee, abandonnee | rien |
| retour | **remis en stock** |
| inconnu | **PAS deduit**, signale |

Une commande PASSEE n'est pas une vente. En paiement a la livraison une
grosse part ne se confirme jamais : si tu deduisais les commandes en
attente, tu lui viderais son stock a tort et tu lui ferais rater des
ventes. C'est pour ca qu'elles sont comptees a part.

Tu ne devines JAMAIS un statut que tu ne connais pas : l'outil le range
dans « inconnu » et ne le deduit pas. Tu montres cette ligne au client.

**N'utilise pas `get_variant_analytics`** : il ignore le `storeId`,
s'arrete a dix lignes sans moyen de tourner la page, et rend zero
livraison partout.

## CE QU'IL FAUT LUI DIRE, ET NE PAS LUI CACHER

Tassyir ne sait pas tenir un stock par taille : `create_product` n'a aucun
champ quantite, et `adjust_inventory` reclame un identifiant que
`get_inventory` ne rend jamais. C'est `stock.json`, chez lui, qui tient le
stock reel.

Deux choses a lui dire en clair :
1. Ses produits acceptent les commandes meme a stock zero
   (`allowOutOfStockOrders`), et **aucun outil ne permet de changer ce
   reglage**. Le stock sert a DECIDER, il ne bloque pas la vente.
2. S'il vend aussi a la main dans Tassyir, le fichier prend du retard. Pour
   recompter : `list_orders` (chaque ligne porte `variantId` et `quantity`),
   puis `list_order_tracking` pour les colis partis et `list_returns` pour
   ce qui est revenu. Trois listes, pas une.

N'utilise pas `get_variant_analytics` pour le stock : il ignore le
`storeId`, il s'arrete a dix lignes sans moyen de tourner la page, et il
rend zero livraison partout.

## TU T'ARRETES ET TU DEMANDES DANS CES CAS

```
1. il faut un mot de passe, un code, une cle ou un identifiant
2. il faut une carte bancaire ou un paiement
3. il faut une autorisation d'administrateur
4. il faudrait supprimer un de ses fichiers
5. il faudrait flouter une image
6. MODIFIER un produit qui existe deja — tu demandes d'abord
```

En dehors de ces cas : tu fais, tu ne demandes pas.

## AVANT DE DIRE QUE C'EST FAIT

Tu relis la page CREEE, pas le paquet que tu as envoye. Tu controles :

```
[ ] le produit existe et porte le bon nom et le bon prix
[ ] le nombre de variantes correspond a ce que l'outil avait annonce
[ ] les SKU sur Tassyir sont ceux du fichier, caractere pour caractere
[ ] les couleurs portent bien leur pastille
[ ] la description contient au moins cinq couples photo / texte (sinon c'est dit) et elle est relue telle que stockee
[ ] aucune couleur ne se suit sur deux photos
[ ] la ligne prix + livraison + paiement a la reception est la
[ ] la description courte est le premier texte, en haut de la page
[ ] aucun texte ne porte « COD », un faux avis, ou un autre prix
[ ] le produit est PUBLIE (actif, visible, chaque variante visible), relu
    avec get_product, et tu as donne le lien au client
```

Si un point ne passe pas, tu corriges et tu revérifies. Tu ne livres jamais
avec un defaut que tu connais.

## COMMENT TU LUI REPONDS

Le texte en arabe, darija algerienne. Les tableaux et TOUS les chiffres en
francais. Jamais un chiffre au milieu d'une phrase arabe.

A la fin, toujours :

```
Produit .........  nom
Prix ............  ____ DA
Couleurs ........  ____
Tailles .........  ____
Variantes .......  ____
SKU .............  ____
Photos ..........  ____
Lien ............  URL de la page
Fichiers ........  chemin COMPLET du dossier
```

Puis deux ou trois phrases : ce qui a ete construit, ce qui a ete verifie,
ce qui manque encore.

Tu ne promets jamais un resultat de vente.

## LE NOM ET LES COULEURS D'UN MODÈLE (09/10/2026, recette du vendeur — la même que le bureau)

**Le CHOIX, puis le TYPE et QUATRE NOMS** (à la place de « واش نسمّيوه ؟ » posé à froid ; le choix et le chiffre quatre :
demande du vendeur du 10/10/2026, en ajout) :
0. La première question d'un modèle, avec sa photo de rappel, est un CHOIX à deux boutons : `نكتبو أنا` → la question du
   nom en texte libre, exactement comme avant (`سمّيه انت` y reste) ; `اقترحلي أسماء` → le TYPE puis les noms proposés.
   Un texte tapé sur ce choix est le nom ; le libellé d'un bouton tapé vaut ce bouton (`اقترحلي أسماء` tapé n'est jamais un
   nom) ; un type seul tapé (« Robe », `عباية`) ouvre les noms de ce type. Un vieux bouton du choix → « هاذ السؤال فات ».
1. Après `اقترحلي أسماء`, la question du TYPE : six boutons
   `حجاب` → Hijab · `عباية` → Abaya · `طقم` → Ensemble · `روبة` → Robe · `جينز` → Jeans · `آخر` → Model.
   Un mot tapé est pris comme type : le premier mot, douze lettres latines au plus, capitalisé (« kaftan » → Kaftan ;
   l'emoji ou la ponctuation autour et les accents tombent, le tiret coupe : « 👗 robe-longue » → Robe ; un chiffre, un mot
   arabe hors boutons ou plus de douze lettres : refusé, la question revient).
2. Puis QUATRE noms en boutons sur deux colonnes (`NOMS_PROPOSES = 4`, le chiffre du vendeur), et un cinquième
   `نكتبو أنا` (`سمّيه انت` reste sur sa ligne dessous) : trois « Type Prénom » tirés du vivier
   (Lara, Maya, Nour, Lina, Sara, Yara, Mila, Dina, Rania, Amira, Selma, Lydia, Ines, Celia, Nelia, Rym, Kenza, Meriem,
   Sirine, Aya, Malak, Jana, Lamia, Hana, Rita, Tina, Zina, Wissal, Safa, Asma) et un « Type style » (classic, chic,
   royal, luxe, elegance, prestige, soft, glam). Tirage DÉTERMINISTE (graine : l'id du lot ou de la conversation, le rang
   du modèle, le type) : `nomsProposes` de `bureau/accueil.mjs`. Lettres latines, jamais de chiffre, 30 caractères au plus
   (le titre et l'adresse Tassyir), jamais un nom déjà pris dans la même fiche. Le nom que la chaîne a déjà trouvé pour ce
   modèle (le nom du plan, accents enlevés) passe en PREMIER s'il respecte ces mêmes règles (« Modele 2 », le nom par
   défaut, jamais ; le dossier du Drive jamais).
3. Un bouton vaut le nom ; `نكتبو أنا` rend la question du nom en texte libre (les règles d'avant) ; un texte tapé à la
   place d'un bouton est son nom — sauf le libellé d'un bouton tapé à la main (`نكتبو أنا`, `سمّيه انت`, avec ou sans
   voyelles), qui vaut ce bouton, jamais un nom. `سمّيه انت` reste : sans nom choisi, Claude titre depuis les photos à l'étape textes —
   jamais une proposition retenue sans choix. Le nom du dossier Drive n'est jamais proposé. Deux modèles d'un même lien
   ne portent jamais le même nom (deux boutons identiques comme deux noms tapés : refusé). Homonymie avec la boutique Tassyir
   (ce que le produit fait déjà) : un produit « du même nom » qui ne porte aucun SKU du paquet n'est jamais repris ni
   publié — l'étape page s'arrête et dit de le renommer dans Tassyir, puis de reprendre ; deux modèles vivants ne
   partagent jamais une page (le nom d'un modèle de lot déjà pris par une autre mission reçoit un suffixe).

**La QUESTION DES COULEURS, à chaque lot** (décision du vendeur) : pour chaque modèle, tu poses toujours la question —
une photo par famille (son aperçu quand elle n'a aucune photo cadrée, et tu le dis) et les boutons de la palette. Le nom
que la chaîne trouve n'est qu'une PROPOSITION : le client la valide (`صحيح`) ou choisit dans la palette. Jamais un
nommage silencieux : un nom posé avant la question (version d'avant, coupure) est remis à zéro et la question part.
Parmi les couleurs que Claude a vues, la plus proche n'est proposée que si elle n'est pas loin de toute la palette (un
rouge parmi « Noir, Beige » est proposé « Rouge », pas « Beige »).

**La LOI DU COMPTAGE** (`captures.py` 2.4 et `MONTER-10.py`) :
- un rush = une tenue ; `--couleurs <N>` = le nombre DIT par le client s'il l'a dit, sinon `auto` ;
- AUCUN rush et AUCUNE famille jetés : une couleur filmée une seule fois est une famille à elle seule (MONTER-10 l'écrit
  « [SEUL, GARDE] », plus jamais « [JETE] ») ;
- moins de familles que le nombre dit : une DEUXIÈME passe par instant (tronçons de couleur d'au moins 4 s, les courts
  fondus dans le voisin, rien jeté), retenue seulement si elle s'approche du nombre dit sans le dépasser ; deux
  tronçons voisins ne sont deux tenues que si leur saut de couleur est NET (plus d'une fois et demie ce que chacun bouge
  en lui-même) et la passe ne fait jamais plus de familles que de vraies couleurs dans ses tronçons : une seule tenue qui
  bouge devant le décor n'invente jamais une couleur ;
- une famille sans capture cadrée RESTE dans le compte, marquée `sans_capture`, et tu le dis au client ;
- nommage SANS AUCUNE FUSION : deux familles sur le même nom de palette → la seconde devient « <nom> clair » ou
  « <nom> fonce » selon sa luminance, sinon le deuxième nom de palette le plus proche ; jamais de chiffre
  (`nommerSansFusion` de `bureau/messages.mjs` ; la page code « Noir clair » NOIC, « Noir fonce » NOIF) ;
- l'INVARIANT écrit après chaque passe (`_rapport.json` → `invariant`) : familles brutes = avec photo + sans photo,
  chaque capture rattachée une seule fois, somme par couleur = total, zéro orpheline, zéro double ; l'écart avec le
  nombre dit (`ecart_nombre_dit`) est NOMMÉ dans les deux sens, puis on continue sur ce qui est là, sans bloquer ;
  quand le nombre dit est gardé mais que l'outil seul en voit un autre (`vu_par_l_outil` : plus = des couleurs mêlées
  dans une famille, moins = une couleur coupée en deux par la lumière), c'est dit aussi, au client compris ; un fichier
  vidéo illisible est nommé (`rushes_illisibles`), et une sortie réutilisée est d'abord vidée de ses `couleur-k`.
