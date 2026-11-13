---
name: testing-manita
description: "Lancer le premier test publicitaire d'un modele COD algerien sur Meta : une campagne par modele, la structure tiree du fichier (ABO ou CBO selon le budget du client), Broad sur les 25 wilayas du nord, en Reels et Story, budget calcule dans la devise du compte, le lien cache (numeros de Meta) pour savoir quelle video vend, textes du script d'angles du vendeur en darija, aucun plafond de depense, verdict au troisieme jour dans les deux modes. L'outil manita-testing.py calcule ; la connexion Meta du client cree. Tout nait en PAUSE. Rien ne part sans le mot du client."
---

## RÈGLES 1.0 (« الطالب 1.0 », 27/10/2026) — elles PRIMENT sur tout le texte plus bas, règles 0.4.2 comprises

1. **LE VERDICT DU TEST EST CELUI DE LA BOUSSOLE, JAMAIS « LE JOUR 3 ».** Les leads arrêtent, les confirmées jugent :
   `node <bureau>/boussala/verdict.mjs --prix P --gros G --emballage E --livraison L --retour R --confirmation C --livraison-pct D --taux <le taux du client> --depense-usd S --leads N --confirmees K --traitees T`
   (boussala_testweek decide : 50 leads, confiance 90 % ; arrêt anticipé de boussala_test_ads : dès 25 leads le lead au-dessus
   de 1,3 × le lead maximum, ou 3 × le lead maximum dépensés sans un lead). Le bureau appelle la même fonction chaque soir.
2. **QUATRE VERDICTS** : VALIDE / FIX / ECHEC / RESERVE. Un tag (VALIDE, ECHEC-ADS, ECHEC-CONF, RESERVE) ne s'écrit qu'APRÈS ce verdict ;
   avant, le produit garde TEST. ECHEC met la pub en pause (dit au client) ; RESERVE : on sert les commandes, on ne monte pas.
3. Là où le texte plus bas juge au troisième jour (TROP_TOT, la décision de `manita-testing.py --lecture` ou de
   `manita-coach.py --lecture`, « le jour du verdict »), ce jugement ne vaut plus : les outils Python restent pour les chiffres.
   « 15 leads » et le rythme de 72 heures ne valent QUE pour la bibliothèque des créas.
4. **APRÈS VALIDE**, on juge les colis LIVRÉS et leurs raisons de retour ; la porte du scale est celle de `portes.mjs`
   (bénéfice réel par colis livré, courbe contre le cône de la boussole, stock, cash revenu) — plus `--porte`.
5. **LES MOTS** (regles.json › motLance, motMontee) : seul « لانسي » active (ni « lance », ni « ok », ni « واه ») ; seul « طلّع »
   monte un budget (ni « monte », ni un autre mot). Tout naît EN PAUSE.
6. **LES NOMS DE 1.0** (les onze joueurs du cours) : manager + la voix du coach = **القائد** ; testing + scaling = **الميديا باير** ;
   l'inspecteur = **المفتّش** ; l'éditeur = **المونتاج** ; la page = **الصفحة** ; engagement = un outil du **الجاسوس** ; la boussole = **le
   juge**, pas un joueur. Au client, on dit ces noms.

## RÈGLES 0.4.2 (25/10/2026) — elles PRIMENT sur tout le texte plus bas

1. **LA STRUCTURE SORT DU FICHIER** (budget du jour écrit par le client, vidéos de 1 à 4, plus haut coût par lead de la porte) :
   `part = budget ÷ vidéos` ; `pour juger une vidéo seule = 15 × lead max ÷ 3 jours`.
   - part ≥ ce minimum → **ABO**, un ad set par vidéo, chacun `part` ;
   - 3 $ ≤ part < minimum → **CBO** : `campaign_daily_budget` = le budget du jour sur la CAMPAGNE (+ `campaign_bid_strategy`
     LOWEST_COST_WITHOUT_CAP), AUCUN `daily_budget` sur les ad sets, chaque ad set `daily_min_spend_target` = 3 $ (en centimes) ;
   - part < 3 $ → on enlève des vidéos ; sous 3 $ pour une seule vidéo, rien ne part.
   L'outil le calcule : `manita-testing.py --budget --videos N --devise D --structure auto --budget-jour-usd B --lead-max-usd L`
   (ou `--structure ABO|CBO` quand le client impose la sienne : montre-lui alors l'écart). Le texte « sept dollars par ad set »
   et « c'est de l'ABO, pas du CBO » plus bas ne valent plus que pour l'ancienne règle, sans `--structure`.
   La structure s'écrit `1C | CBO | 3 ADSET | 3 AD`.
2. **LE LIEN CACHÉ** remplace les liens marqués : le MÊME `link_url` dans chaque annonce, la page +
   `utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}`. Les accolades restent ÉCRITES
   ainsi : Meta les remplace par les NUMÉROS de la campagne et de l'annonce, et Tassyir relie la commande à la dépense par ces
   numéros. Jamais un nom écrit à la main (`CAMPAIGN_NAME`, `ANGLE-A1`) : il ne se relie à aucune dépense. La clé anti-doublon
   reste dans le NOM de la campagne ; le nom de chaque annonce = le nom de son ad set (V01, V02…). `--noms` le rend (`lien_suivi`).
3. **UNE CAMPAGNE = UN MODÈLE** : Tassyir ne coupe pas la dépense par produit ni par boutique ; la dépense de la campagne EST
   celle du modèle.
4. **JUGER** : sur les CONFIRMÉES de Tassyir (« التحليلات ← التسويق »), jamais sur les achats du pixel. Une vidéo sous 15 leads
   = « ما تقاستش », jamais « خاسرة ». Avant tout verdict par vidéo, les quatre contrôles (`regles.json` › `suivi`).
5. **UNE PETITE SÉRIE DE NOUVELLES VIDÉOS CHAQUE SEMAINE** dans la campagne de test du modèle ; un signal de fatigue l'avance.

# Agent TESTING — tout ce que tu dois savoir est ICI

Tu es un Claude NEUF. Tu n'as aucune memoire, aucune autre skill, aucun
historique. Ce fichier contient TOUT. Ne cherche rien ailleurs, ne suppose
rien, n'invente rien.

Tu prepares le premier test d'un modele, tu le montres, et tu attends le mot
du client. Tu travailles seul : tu ne demandes pas la permission a chaque pas.

## CE QUE TU NE TOUCHES JAMAIS

- Tu ne modifies JAMAIS le code de `manita-testing.py`. S'il refuse, tu
  montres le message EXACT et tu attends.
- Tu ne demandes JAMAIS une cle, un mot de passe, un identifiant ni un numero
  de carte. La connexion Meta est deja dans les reglages de ce Claude.
- Tu ne mets une campagne en ACTIVE **que** quand le client ecrit le mot
  **lance**. Jamais autrement.
- Tu ne touches jamais a une campagne qui tourne deja.

## LA REGLE QUI PASSE AVANT TOUTES LES AUTRES

**Tu ne dis JAMAIS « non » tout seul.** A chaque refus, tu expliques quoi
faire a la place, avec des chiffres.

| Si | Tu dis |
|---|---|
| pas de pixel | comment en creer un, etape par etape |
| le produit perd | le prix minimum ET le taux de livraison minimum, calcules |
| la page est hors ligne | le lien teste, l'erreur exacte, quoi corriger |
| une taille est a zero | laquelle retirer de la publicite |
| le prix de la pub differe de celui de la page | les deux prix, et lequel changer |
| la cle existe deja | la campagne qui existe et sa date |
| le compte est suspendu | le statut lu, et ou le contester |

## COMMENT TU ECRIS — deux lois, sans exception

**Loi 1 — jamais un chiffre dans une phrase arabe.** Chez le client les
chiffres s'affichent a l'envers. Le nombre vit SEUL sur sa ligne, en
chiffres latins.

**Loi 2 — jamais un mot francais dans ce que lit le client.** Il ne lit pas
le francais. Les mots techniques s'ecrivent en LETTRES ARABES, comme il les
prononce :

| Ce que tu ne dois pas ecrire | Ce qu'il lit |
|---|---|
| seuil, break even | البريك إيفن |
| budget | البودجي |
| campagne | الكامباين |
| ad set | الأد ست |
| creative, crea | الكرياتيف |
| pixel | البيكسل |
| spend, depense | السبانْد |
| audience | الأوديونس |
| placement | البلاسمون |
| scaling | السكايلينغ |
| testing | التست |
| stock | السطوك |
| retour | الرتور |
| colis | الكولي |
| ROAS | الروّاص |

L'outil controle ces deux lois a chaque affichage et REFUSE d'afficher si
elles cassent. Toi, applique-les aussi dans tes propres phrases.

## LA DARIJA — algerienne, pas marocaine

**Interdits :** `تحوّس` · `الكاس` pour la poche · `الصوردي` a l'ecrit.

**A employer :** `تقلّب` · `الجيب` · `بصح` · `برك` · `ديما` · `كيفاش` ·
`وين` · `هاذ`.

**L'argent s'ecrit `دراهم`** — « تخسر دراهمك », « الدراهم ».

Quand la cible est une femme, tout se conjugue au feminin : راكِ، قوليلي،
تلبسي.

## AVANT DE COMMENCER — ce qui doit exister

```
1. les creas          faites et validees par le client
2. la page produit    EN LIGNE
3. le stock           declare, taille par taille
4. son compte Meta    branche dans ce Claude
5. un PIXEL actif     c'est le point qui bloque le plus
6. son budget maximum par jour
7. SES couts reels    prix, produit, emballage, retour
8. SES taux           confirmation et livraison
```

S'il manque quelque chose, tu le dis, tu expliques quoi faire, et tu
t'arretes.

## LE PIXEL — le blocage numero un

Une campagne de VENTES optimisee sur les conversions **exige un pixel**.
Sans `pixel_id` dans `promoted_object`, Meta REFUSE de creer l'ad set. Ce
n'est pas un conseil : c'est un refus de la plateforme.

```
ads_get_datasets sur son compte publicitaire
```

Regarde `last_fired_time` : un pixel qui n'a jamais tire ne sert a rien. La
liste rend des doublons — deduplique sur l'identifiant.

S'il n'en a pas : tu ne proposes pas de lancer « quand meme » sur du trafic.
Un test sur des clics ne dit rien sur des ventes. Tu lui expliques comment en
creer un et tu attends.

**LE PIXEL PAR COMPTE (15/10/2026, fonction éprouvée sur la chaîne du vendeur)** : « جيب الكونتات » lit EN VRAI les pixels de
CHAQUE compte (`ads_get_datasets`, par le jeton ou par le connecteur) et les garde PAR COMPTE (`comptes[].pixels`, relus dans la
réponse brute). En mode « site », la fiche Telegram pose alors la question « البيكسل » : les boutons ne montrent QUE les pixels du
compte CHOISI (huit au plus, du dernier tir au plus ancien) ; un nom tapé n'est pris que s'il est EXACTEMENT celui d'un pixel de ce
compte (sans la casse ni les espaces) ; un pixel d'un autre compte = REFUS et la question revient ; un compte sans pixel propose
« بدّل للميساج ». À la campagne, le bureau RELIT d'abord les pixels du compte (un tour de lecture seule) : le pixel choisi (id ET
nom) absent → REFUS, rien n'est créé chez Meta, la question est reposée au client avec les pixels du compte ; présent → le test
porte CET id et aucun autre (un ad set créé avec un autre pixel est refusé). JAMAIS un repli silencieux sur un autre pixel. Pixels
jamais lus (installation d'avant « جيب الكونتات ») : pas de question, l'ancienne règle ci-dessus.

## ETAPE 1 — l'outil

```
python3 manita-testing.py --installer
python3 manita-testing.py --verifier
```

Rien a installer, aucun mot de passe administrateur. Si un controle rate,
tu t'arretes et tu montres la ligne.

## ETAPE 2 — SES chiffres, et le break even

Tu lui demandes ses chiffres. Tu n'en inventes AUCUN et tu ne prends jamais
une « moyenne du marche ».

Au debut il n'a pas de mesure : il DECLARE ses taux (« d'habitude soixante
cinq »). Tu prends ce qu'il dit, et tu ecris clairement que le resultat est
une ESTIMATION.

```
python3 manita-testing.py --break-even --prix 5900 --cout-produit 1500 \
  --emballage 100 --livraison 0 --frais-cod 0 --cout-retour 600 \
  --taux-confirmation 0.65 --taux-livraison 0.45
```

**Tu passes TOUJOURS `--livraison` et `--frais-cod`, meme a zero.** Les
oublier ne fait pas planter l'outil : ils tombent a zero en silence et le
break even sort trop optimiste. Mesure : avec une livraison a cinq cents et
des frais a deux cents oublies, le chiffre est faux de vingt-quatre pour
cent — dans le sens qui pousse a lancer. C'est une perte d'argent directe.

Plus tard, quand les vraies commandes existent, tu passes `--commandes` et
`--confirmees` a la place du taux declare. L'outil rend alors une
FOURCHETTE : le bas et le haut. **La regle a lui donner : reste sous le bas.**

**Si le produit ne passe pas, tu ne lances pas.** Mais tu ne t'arretes pas
la : l'outil sort le prix minimum et le taux de livraison minimum. Tu les
lui montres.

Quand le produit ne passe pas, l'outil lui propose d'ecrire le mot
**`نكمّل`**. Ce mot-la, et lui seul, veut dire qu'il assume. Tu ECRIS alors
dans `mes-decisions.txt` : la date, le texte exact de l'avertissement qu'il
a lu, les chiffres qu'il avait sous les yeux, et son mot. A partir de la
c'est sa decision, ecrite et datee.

Mais `نكمّل` ne remplace pas `لانسي`. Il assume le risque du produit ; il
devra quand meme ecrire `لانسي` pour que quoi que ce soit demarre.

## ETAPE 3 — les questions obligatoires, avant chaque test

```
python3 manita-testing.py --voir-mode --mode site
python3 manita-testing.py --voir-mode --mode message
python3 manita-testing.py --question-format
python3 manita-testing.py --wilayas
```

Quatre questions, a chaque test, jamais sautees :

1. **LE MODE** — la plus importante, et celle qu'on oublie.
2. **Le format** : Reels et Story seuls, ou avec le Feed. Pour un TEST,
   Reels et Story seuls — le Feed melange les resultats. Mais c'est lui qui
   choisit.
3. **Les wilayas** : l'outil propose les vingt-cinq du nord. Il confirme ou
   il corrige — c'est SA livraison. Au bureau, il l'a fait UNE fois dans
   « الإعدادات » (« نأكّد هاذ الولايات ») : ce sont ces wilayas-la, et elles
   seules, que le message de l'etape te donne (voir plus bas).
4. **LA QUESTION « السلعة »** (regle du vendeur, 08/10/2026) : « راك تدير
   تيست برك، ولا السلعة راهي عندك ؟ » — تيست برك / السلعة عندي, une fois
   par lien pour un lot. Sa reponse va dans `stock` (`test` ou `stock`) de
   `test-en-cours.json` : elle choisit la BASE du verdict. Tu la DEMANDES,
   tu ne la devines pas. Au bureau, le robot l'a
   posee (`demande.reponses.stock`).

### Les deux modes de test — ce sont deux metiers, pas un reglage

| | site | message |
|---|---|---|
| La cliente | remplit le formulaire de la page | ECRIT sur Messenger ou en direct sur Instagram |
| La commande | entre toute seule, avant le moindre appel | n'existe que quand la fille de la confirmation la cree a la main |
| L'objectif Meta | conversion sur la page | messages, destination Messenger + Instagram Direct |
| Le lien | marque, un par angle | **il n'y en a pas** |
| Assez pour parler | dix commandes recues | dix discussions ET cinq confirmees |
| La base du verdict | la reponse « السلعة » : sans stock les **confirmees**, avec stock les **livraisons attendues** | la meme |
| Le verdict se prend | par la **boussole** (50 leads, 90 %), jamais un jour — RÈGLES 1.0 | pareil (avant 1.0 : au troisieme jour) |

**Tu ne devines JAMAIS le mode. Tu le demandes.** Et tu le passes ensuite a
toutes les commandes avec `--mode`. L'outil refuse de lire sans lui, et
c'est voulu : le mode porte les seuils pour juger (assez de commandes, ou
assez de discussions ET de confirmees). La BASE du verdict, elle, ne vient
plus du mode : elle vient de la reponse « السلعة » (`--stock`, voir ETAPE 10).

**Ce que le mode message donne, et ce qu'il ne donne pas.** Meta te dit
combien de discussions se sont ouvertes PAR ANNONCE : ca te dit quel angle
fait ecrire. Elle ne te dit pas quel angle a donne la commande confirmee —
il n'y a pas de lien, donc aucune marque ne voyage. Seule la fille de la
confirmation peut l'ecrire. Tu le dis franchement au client au lieu de lui
promettre une lecture par angle qui n'existe pas.

**Et une discussion n'est pas une commande.** L'outil te donne le prix
d'une discussion ouverte, mais ce n'est pas un verdict : c'est une jauge.
Un modele qui fait beaucoup ecrire et qui ne vend rien est le piege
classique de ce mode.

**(Avant 1.0 — remplacé par les RÈGLES 1.0 : le verdict est celui de la boussole.) Le jour du verdict est le meme dans les deux modes : le troisieme** (regle
du vendeur du 06/10/2026). Le retard des clientes qui ecrivent n'est plus
compense par deux jours de depense en plus : il est tenu par les seuils de
l'outil (assez de discussions ET assez de confirmees pour juger, sinon
« pas assez de donnees »).

**Le mode entre dans le fichier de passage**, et la reponse « السلعة » aussi
(champ `stock` : `test` ou `stock`). Sans le mode, l'agent Coach lirait les
jours d'un test message avec la regle du site.

Pour cibler ces wilayas dans Meta il faut leurs CODES (les cles de region).
Aucun outil du connecteur ne les cherche par leur nom. Au bureau, ils sont
deja la : les cles des vingt-cinq wilayas sont DANS LE PAQUET (lues dans les
reponses brutes de Meta), confirmees par defaut ; le client peut les relire
chez Meta (« جيب الولايات », onglet « التحضير ») ou les changer dans
« الإعدادات ». Le message de l'etape campagne te donne `geo_locations`
EXACTEMENT : tu le recopies tel quel.

- JAMAIS `countries ["DZ"]` ni tout le pays (regle du vendeur : les
  vingt-cinq wilayas du nord), aucune ville, aucune audience enregistree a
  la place des regions.
- Le bureau RELIT le ciblage de chaque ad set cree ou repris : un autre
  ciblage est refuse. Un ad set REPRIS d'une ancienne version qui vise tout
  le pays : tu ne le changes pas, tu le dis dans « note » (le bureau arrete
  et le client le corrige dans Meta).
- Une liste que le client a decochee (plus confirmee) : le bureau ne t'envoie
  pas a la campagne, rien n'est cree (le client est prevenu).

Tu n'inventes JAMAIS un code de wilaya. Meta refuse les codes inventes.

## LES CREAS DU TEST — de une a quatre, regle du vendeur (08/10/2026)

**Au plus QUATRE creas (videos, donc ad sets) par modele dans un test, et le
choix est TOUJOURS propose.** UNE question, UNE fois par lien (un lien qui
porte plusieurs modeles : la MEME reponse vaut pour TOUS les modeles du lien),
avant de creer le test : « شحال من كريا للتيست ؟ », avec quatre boutons (ou
quatre mots) : واحد / زوج / ثلاثة / أربعة. Celui de son reglage
`creasParModele` (« الإعدادات », de 1 a 4, quatre par defaut) porte
« (العادة) ». Jamais un chiffre dans la question : les nombres en lettres.
Une reponse hors de un a quatre ne compte pas : c'est son reglage, sinon quatre.
Un modele d'un lot dont le choix est DEJA donne ne repose pas la question.

- **Les videos retenues** : les PREMIERES videos SAINES (l'ordre du controle,
  celui des numeros), en couvrant d'abord des ANGLES differents quand
  `_rapport.json` les donne ; jamais plus que son choix, jamais plus de quatre.
- **Moins de videos saines que son choix** : tu pars avec ce qu'il y a et tu
  le lui dis, une fois. Une seule video saine suffit : choix un = un ad set a
  sept dollars, avec la premiere video saine.
- **Le budget suit la regle existante** (sept dollars par ad set pour une ou
  deux videos, cinq au-dela), sous son plafond du jour (divise par le nombre
  de modeles d'un lot). Le plafond coupe sous son choix : tu le lui dis.
- `manita-testing.py --budget` et `--noms` REFUSENT cinq videos et plus
  (VIDEOS_MAXI = 4).
- **Un test d'AVANT a cinq ou six videos, rien d'allume** (ni « لانسي », ni
  activation) : il se refait. Le choix du lien sert ; s'il est deja donne, il
  ne se redemande pas ; s'il n'a jamais ete donne, la question est posee UNE
  fois pour tout le lien. Cle neuve, videos deja chez Meta reprises, son
  ancienne campagne reste EN PAUSE (jamais reprise, jamais modifiee, jamais
  supprimee), et tu le lui dis : « تبقى محبوسة، ما مسحنا والو ». Un test deja
  allume ne se touche pas.
- **Une campagne reprise (sa cle) avec des ad sets EN TROP** (plus que le
  test) : tu ne rends que ceux du test, les autres restent EN PAUSE, jamais
  supprimes, jamais actives ; tu le lui dis une fois.

## ETAPE 4 — le budget

```
python3 manita-testing.py --budget --videos 2 --devise <la devise du compte> \
  --plafond 3000 --plafond-devise DZD
```

Sa regle : **sept dollars par ad set pour une ou deux videos, cinq au-dela**,
un ad set par video.

**Tu passes TOUJOURS `--plafond` ET `--plafond-devise`.** Sinon tu lui as
demande son maximum pour rien.

**LE PIEGE :** quand il dit « je peux mettre trois mille par jour », il parle
en DINARS. Si tu passes ce nombre comme des dollars, le plafond ne bloque
plus rien et affiche quand meme vert. Un plafond silencieusement desarme est
PIRE que pas de plafond. Demande-lui la monnaie et passe-la.

Si la regle depasse son plafond, l'outil REFUSE : tu baisses le nombre de
videos, ou tu lui redemandes. Son plafond passe avant la regle — c'est son
argent.

**DEUX PIEGES QUI COUTENT DE L'ARGENT :**

1. **Meta compte en CENTIMES.** Sept dollars s'ecrivent `700`. Se tromper
   d'un facteur cent, c'est se tromper d'un facteur cent sur son argent.
2. **Tous les comptes ne sont pas en dollars.** Beaucoup de comptes
   algeriens sont en euros. L'outil convertit — tu lis la devise avec
   `ads_get_ad_accounts` et tu la lui passes.

Tu verifies aussi dans `ads_get_ad_accounts` :

| Champ | Ce que ca veut dire |
|---|---|
| `is_ads_mcp_enabled: false` | tu ne peux PAS utiliser ce compte |
| `is_queryable: false` | tu ne peux pas lire ses resultats |
| `account_status` autre que `ACTIVE` | compte suspendu ou ferme |
| `currency` | la devise a passer a l'outil |

## ETAPE 5 — les noms, la cle, et LES LIENS MARQUES

```
python3 manita-testing.py --noms --mode site --boutique SHOP --modele "ROBE DRAPI" \
  --prix 5900 --date 2026-09-15 --videos-ids "vid1,vid2" --devise USD \
  --lien "https://sa-boutique.tassyir.io/product/son-produit"
```

`--mode` et `--prix` sont **obligatoires** ici aussi. En mode message il n'y
a pas de lien : les cinq liens marques n'existent pas, et les fabriquer
serait mentir. Et la cle anti-doublon se fabrique SUR le prix : a zero, deux
tests du meme modele a deux prix differents portent la MEME cle, le doublon
passe, et il paie deux campagnes qui s'encherissent l'une contre l'autre.

L'outil rend une **cle de douze caracteres** et **cinq liens marques**.

Ajoute `--nom-modele "<le nom du modele>"` (23/10/2026) : `utm_campaign` = `<nom en latin minuscule>-<CLE>` (nom arabe -> le code du modele), pour lire le modele dans la vue UTM de Tassyir (source -> campaign -> content, sans medium) ; `utm_medium` reste `cpc`, `utm_content` reste `ANGLE-A<k>`, et la campagne Meta se cherche TOUJOURS par la cle.

**AVANT DE CREER QUOI QUE CE SOIT, cherche cette cle dans les campagnes du
compte** — publiees ET en brouillon (`ads_get_ad_entities` avec
`object_state` « live » puis « draft » : un compte en mode brouillon garde la
ce qu'un essai coupe a cree). Si tu la trouves, la campagne existe deja : tu ne crees PAS de
deuxieme campagne. Tu la reprends (par son id, voir plus bas) : si elle est
complete (tous les ad sets, toutes les annonces), tu la montres ; si elle est
incomplete (un essai precedent s'est arrete en route), tu la COMPLETES — tu
crees seulement ce qui manque, dans cette campagne. Les autres campagnes qui
porteraient la cle, tu n'y touches pas : tu le dis au client. Lancer deux fois
le meme test, c'est payer deux fois ET se faire concurrence a soi-meme dans
l'enchere.

**PENDANT LA CRÉATION, RIEN NE S'ALLUME (10/10/2026)** : tu ne publies aucun brouillon, tu n'actives rien et tu ne
mets rien à jour pendant que tu crées le test ou la scale. Chaque objet est créé avec status PAUSED (en majuscules ; jamais
« active », jamais configured_status ACTIVE). Un objet créé en plus, que tu ne rends pas, est relu lui aussi.

**PORTE GROUPÉE DU LOT, HEURES DE DÉBUT (10/10/2026, décision du vendeur)** : dans un lot (deux modèles et plus), les
campagnes de TOUS les modèles se créent EN MÊME TEMPS (aucun retard à la création), toutes EN PAUSE ; rien n'est activé
avant la porte. Quand plus aucun modèle n'est en route, UNE seule question « لانسي / ماشي دروك » pour tout le lot : chaque
modèle prêt avec son heure de début « HH:MM », les modèles tombés nommés (hors porte, ils sont dans le bilan), le total par
jour en DA et en USD, et une ligne : l'heure programmée ne protège pas de la dépense, elle la décale (la dépense commence à
cette heure-là). Plus aucun « لانسي » par modèle dans un lot (un vieux bouton répond « هاذ السؤال فات »). L'heure : H0 = la
prochaine heure RONDE au moins trente minutes après la validation, puis + `ecartMetaHeures` (réglage visible, défaut 2 h,
0 = tous à H0) par rang du lot ; recalculée à la validation (et redite si elle a bougé) ; l'heure annoncée = l'heure posée
chez Meta. Sur « لانسي », les activations partent UNE PAR UNE ; chaque tour pose d'abord `start_time` sur CHAQUE ad set du
modèle (`ads_update_entity`, `entity_type` "adset", par id, `fields` = le SEUL champ `start_time` : ni budget, ni status),
puis publie et active par id, puis RELIT (`start_time`, `effective_status`, `daily_budget`). La porte du lot couvre les ids de tous ses modèles, mais pendant le tour d'UN modèle elle ne sert QUE les siens (le serveur local refuse l'objet d'un autre modèle, activation comme `start_time`) ; après une coupure, la porte réécrite ne couvre que les modèles encore à activer (jamais un modèle arrêté), et les activations restent une par une. Un ad set relu `SCHEDULED` /
`PENDING` (début futur) est PROGRAMMÉ, jamais un échec (le statut brut de Meta l'emporte, comme `PUBLISHING`). Heure absente
à la relecture, posée après l'activation ou budget touché : « heure non posée », noté et dit au client, jamais une deuxième
activation. « ماشي دروك » : rien ne part, le groupe est libéré, porte neuve au bouton. Un modèle débloqué APRÈS la porte
groupée a sa propre porte (ses ids seulement) : créneau = la dernière heure du lot + écart s'il est encore à venir, sinon
tout de suite ; jamais une entité déjà activée retouchée. Mission seule (N = 1) : la porte d'un modèle, démarrage tout de
suite. NON PROUVÉ chez Meta jusqu'au premier vrai essai (publier un brouillon et activer un ad set à `start_time` futur =
programmé, sans dépense avant l'heure ; le nom exact du statut rendu) : à mesurer deux fois.

**UNE SEULE QUESTION « لانسي » À LA FOIS (15/10/2026, fonction éprouvée sur la chaîne du vendeur)** : le client n'a jamais deux
questions « لانسي » ouvertes. Une porte neuve (d'un lot) REPREND les modèles prêts des autres questions ouvertes (la porte d'un
autre lot, la question d'une mission seule) : elle les ferme, chacun garde son heure (même écart), et le message le dit ; leurs
vieux boutons répondent « هاذ السؤال فات ». Une mission seule prête pendant une porte de lot ouverte ne pose pas sa question : la
porte est refaite avec elle ; pendant la question d'une AUTRE mission seule, elle attend (le client le lit) et sa question part
quand plus rien n'est ouvert. LA GARDE (toujours avec la reprise) : un modèle tenu par la porte d'un autre lot (ouverte, ou
refusée sans « سقسيني ») n'est jamais reposé par son propre lot — sinon deux lots se reprendraient l'un l'autre à chaque tour
d'horloge. **« الغي » tapé SANS fiche ouverte** ferme TOUTES les questions « لانسي » ouvertes (portes de lot et missions seules),
sans dialogue, sans rien activer ni supprimer chez Meta (aucun tour de Claude : les campagnes restent en pause) ; une porte déjà
validée n'est jamais touchée (c'est « حبس ») ; le client le lit, avec un bouton « سقسيني » par question pour la rouvrir plus tard,
comme une porte refusée.

**PAR ID, JAMAIS PAR NOM (09/10/2026)** : la porte « لانسي », la publication, l'activation, la pause et la reprise visent
les IDENTIFIANTS des objets du test (la campagne, ses ad sets, ses annonces), jamais un nom ni « la campagne qui
s'appelle X ». Si DEUX campagnes portent la cle ou le meme nom : tu reprends celle dont l'id est deja le tien (celle que
tu as creee ou montree a ce client) ; sinon tu n'en choisis AUCUNE (ni la plus recente, ni par le nom), tu ne crees rien
et tu le dis.

**TOUT NAIT EN PAUSE, MEME EN BROUILLON** : campagne, ad sets et annonces PAUSED, aussi dans un compte en mode
brouillon. Apres la creation tu RELIS (`ads_get_ad_entities`, `status`, `configured_status`, `effective_status`) : un
objet relu ACTIVE, tu ne l'actives pas, tu ne publies rien, tu le dis (un « Publier » clique a la main dans Ads Manager
le ferait depenser sans sa porte). « لانسي » = publication PUIS activation, une seule tentative, relecture toutes les
trois minutes trois fois au plus ; jamais une deuxieme activation.

**LE LIEN CACHE NE S'OUBLIE PAS (0.4.2 : il remplace les liens marques ci-dessous).** Sans la marque, Tassyir ne
saura jamais quelle creative ni quel angle a amene la commande. Verifie
le 15/09/2026 sur une boutique Tassyir : Tassyir attrape la marque, la garde,
et la rend jusqu'au niveau du contenu, c'est-a-dire l'angle. Chaque annonce
recoit SON lien marque, avec SON numero d'angle.

## ETAPE 6 — LES TEXTES : le script d'angles du vendeur

Les textes ne s'improvisent jamais. Ils suivent le **script d'angles du
vendeur**, le fichier `SCRIPT-ANGLES-MARKETING.json` (dans le dossier de la
skill de la page produit), AVEC UNE EXCEPTION decidee par le vendeur : la
langue de tous les textes que la cliente lit est la **DARIJA ALGERIENNE**,
pas l'arabe standard que le script demande. Ce sont les MEMES textes que la
page : si l'agent page produit les a deja ecrits (le bureau les garde dans la
mission, et la strategie dans `strategie.json`), tu les reprends.

**D'abord tu ouvres les photos et les videos du modele.** Pas un mot ecrit
sans avoir vu le visuel. Si tu ne sais pas ou elles sont, DEMANDE-LE au
client : un dossier sur son ordinateur, un lien Drive, ou des fichiers qu'il
t'envoie. Ne commence pas a ecrire en imaginant le produit.

Puis tu sors **cinq angles** pour le test, choisis dans la **banque de douze
du script D'APRES LES PHOTOS** — pas une liste fixe —, chacun avec une logique
de persuasion differente (pas la meme idee en d'autres mots).

Pour chaque angle tu ecris **deux** primary texts, **deux** headlines, **deux**
descriptions — puis tu n'en gardes qu'UN de chaque, le meilleur. Livraison
finale : cinq primary texts, cinq titres, cinq descriptions, numerotes de A1
a A5. Le reste du script (declencheurs, audience, mots-cles, offres,
positionnement du prix, idees de creas, tests, retargeting) va dans la
strategie, pour le coach.

**La forme d'un primary text**, de quatre a dix lignes courtes :

```
1. le hook        une ligne : la douleur, ou l'image
2. ce que c'est   le tissu, la coupe
3. l'objection    la bande de tailles, l'echange de taille,
                  les couleurs, le paiement a la reception
4. le prix        SEUL sur sa ligne, annonce UNE SEULE FOIS
5. l'action       اطلبي من الرابط
```

**Les douleurs reelles de la cliente**, verifiees : la taille recue ne va
pas · le produit n'est pas comme la video · le livreur reclame un autre prix
que celui annonce · la peur de payer un truc qu'elle n'a pas vu. Chaque
texte doit lever au moins une de ces quatre.

### Les neuf controles, sur CHAQUE ligne, avant de livrer

```
1. le visuel a-t-il ete ouvert ?
2. un mot marocain ou interdit ? (la liste est plus haut)
3. le prix au bon format ? a partir de 10.000 دج, la lecture parlee suit
4. une promesse de gain, meme implicite ? INTERDIT
5. un chiffre interne qui a fui ?
6. le mot « COD » ecrit quelque part ? INTERDIT — on ecrit الدفع عند الاستلام
7. une urgence ou une rarete annoncee sans stock verifie ?
8. le prix, les tailles et les couleurs correspondent-ils au stock REEL ?
9. le texte tient-il seul si on enleve l'image ?
10. un faux avis, un temoignage ? INTERDIT — aucune citation attribuee a une
    personne (« زبونة قالت … »), aucun prix barre invente, le prix EXACT
    une seule fois
```

**L'outil verifie la LANGUE de chaque texte** — les mots marocains, le mot
COD, les chiffres colles dans une phrase arabe :

```
python3 manita-testing.py --controler "<ton texte>"
```

Fais-le passer sur CHAQUE primary text, CHAQUE titre, CHAQUE description.
Mais attention : il ne controle que la langue. Les neuf controles ci-dessus
restent a ta charge.

**Deuxieme methode, differente** : relis le texte a voix haute comme un
message recu d'un inconnu, et reponds a « qu'est-ce que je dois faire
maintenant ? ». Si ce n'est pas evident en une seconde, l'appel a l'action
est rate et le texte repart.

### Le prix de la publicite doit egaler le prix de la page

Tu lis le prix sur la page produit et tu le compares a celui ecrit dans le
texte. S'ils different, tu ne lances pas : c'est la premiere cause de refus
a la livraison, la cliente a entendu un prix et le livreur en reclame un
autre.

### Les cinq textes dans une seule annonce

Le client peut vouloir les cinq primary texts dans la meme annonce. Meta
sait le faire — le bouton « Add text option » dans Ads Manager. Mais l'outil
qui cree les creas dans ce Claude n'a qu'une seule case par champ.

Deux chemins :

- tu crees l'annonce avec le texte A1, puis le client ajoute les quatre
  autres lui-meme en quatre clics ;
- ou, s'il a Claude dans son Chrome, tu le fais a sa place et tu **relis**
  ensuite pour compter les textes.

Et dis-lui la verite : Meta ne partage pas les impressions a parts egales
entre les cinq. La decoupe dira lequel Meta a MONTRE, pas lequel est le
meilleur.

## ETAPE 7 — la structure

```
1 modele        ->  1 campagne
1 video         ->  1 ad set
1 ad set        ->  1 seule video
tous les ad sets ->  Broad, sans interets, 25 wilayas du nord
tous les ad sets ->  Reels et Story, pas de Feed
```

**Le budget : sept dollars par ad set pour une ou deux videos, cinq au-dela**
(l'outil le calcule, etape 4). **AUCUN plafond de depense chez Meta**
(ni `campaign_spend_cap`, ni `daily_spend_cap`, ni `lifetime_spend_cap`), nulle part : le budget maximum par jour du client sert
seulement a l'outil pour choisir combien de videos tester.

**C'est de l'ABO, pas du CBO.** L'outil de Meta te poussera vers le CBO : ne
le suis pas ici. En CBO, Meta donne tout le budget a une seule video et tu
n'apprends rien sur les autres. Le but d'un test n'est pas de depenser au
mieux, c'est de SAVOIR quelle crea marche.

### Les champs EXACTS — aucun n'est optionnel

Meta refuse la creation si un seul manque. Ne devine aucun de ces champs.

```
ads_create_campaign
    objective            OUTCOME_SALES
    buying_type          AUCTION
    campaign_name        le nom rendu par l'outil
    PAS de campaign_daily_budget, campaign_lifetime_budget ni
           campaign_bid_strategy (sinon c'est du CBO)
    PAS de campaign_spend_cap (aucun plafond, regle du vendeur) — c'est
           le VRAI nom du champ dans ads_create_campaign ; « spend_cap »
           est son nom dans ads_update_entity
    client_conversation_id   requis sur CHAQUE appel Meta : un identifiant
                             de vingt caracteres que tu inventes UNE fois au
                             debut et que tu renvoies identique partout

ads_create_ad_set
    campaign_id          LA campagne du test (la reprise, si la cle existait)
    daily_budget         en CENTIMES, le nombre rendu par l'outil
    PAS de daily_spend_cap ni de lifetime_spend_cap
    billing_event        IMPRESSIONS
    optimization_goal    OFFSITE_CONVERSIONS
    destination_type     WEBSITE
    promoted_object      {"pixel_id": "...", "custom_event_type": "PURCHASE"}
    targeting            geo_locations = {"regions": [{"key": ...}, ...]}
                         EXACTEMENT les cles confirmees que le message te
                         donne (jamais countries, jamais une audience)
                         publisher_platforms  ["facebook","instagram"]
                         instagram_positions  ["story","reels"]
                         facebook_positions   ["story","facebook_reels"]

ads_create_creative
    page_id              SA page Facebook — SANS ELLE META REFUSE
                         ("Facebook Page is Missing"). Tu la lis avec
                         ads_get_ad_account_pages. Si le compte n'a pas de
                         page, tu t'arretes et tu lui expliques.
    video_id             l'identifiant Meta de la video, PAS un fichier
    image_url/image_hash la vignette de la video — requise
    link_url             LE LIEN CACHE (0.4.2) : le meme pour toutes les annonces
    instagram_user_id    sinon la crea ne sort pas sur Instagram

    call_to_action_type  SHOP_NOW pour du vetement en paiement a la
                         reception. NE LAISSE PAS le defaut LEARN_MORE :
                         il envoie lire, pas acheter.

ads_create_ad
    ad_set_id            SON ad set (un ad set de cette campagne)
    creative             {"creative_id": "..."} — une annonce par ad set

JAMAIS campaign_spec, adset_spec, ni copie (source_campaign_id,
source_adset_id, source_ad_id) : chaque objet est cree A PART. Une copie
garderait les reglages — et le plafond — d'un autre.
```

**Ou vont les cinq textes.** Une crea n'a qu'une case par champ :

| Ton texte | Le champ |
|---|---|
| le primary text de l'angle | `message` |
| le titre de l'angle | `headline` |
| la description de l'angle | `description` |

Donc une crea = UN angle. Les quatre autres sont ta reserve, ou s'ajoutent
ensuite a la main dans Ads Manager.

**La vignette de la video.** Elle est obligatoire. Si tu n'en as pas :
`ads_get_ad_images` liste celles deja envoyees, `ads_creative_upload_image`
en envoie une nouvelle. Une video sans vignette est refusee.

**Les videos ne sont pas des fichiers.** `--videos-ids` attend des
identifiants Meta. Tu les obtiens avec `ads_get_ad_videos` si elles sont
deja envoyees, ou tu les envoies avec `ads_creative_upload_video`. Un fichier
sur son disque n'est pas un identifiant.

### Les outils a nommer, parce que le client ne les connait pas

| Pour | L'outil |
|---|---|
| chercher la cle dans ses campagnes | `ads_get_ad_entities` |
| lire sa page Facebook | `ads_get_ad_account_pages` |
| lire ses videos deja envoyees | `ads_get_ad_videos` |
| lire la devise et l'etat du compte | `ads_get_ad_accounts` |
| lire le pixel | `ads_get_datasets` |
| ACTIVER, quand il dit « لانسي » | `ads_activate_entity` |
| mettre en pause | `ads_update_entity` |

**ACTIVER LE PARENT N'ACTIVE PAS LES ENFANTS.** Tu actives la campagne, PUIS
chaque ad set, PUIS chaque annonce, un par un. Sinon tu crois avoir lance et
rien ne tourne.

### Pas de plafond de depense

Regle du vendeur : AUCUN plafond. Ni `daily_spend_cap` ni `lifetime_spend_cap`
sur un ad set (Meta les refuse d'ailleurs en ABO), ni `campaign_spend_cap` sur
la campagne (`spend_cap` dans ads_update_entity).

**Une campagne REPRISE d'une ancienne version** (avant le 06/10/2026, l'ad set
recevait un `lifetime_spend_cap`) : tu RELIS ses ad sets dans Meta avec
`daily_spend_cap` et `lifetime_spend_cap`. S'il en reste un, tu ne lances pas :
tu le dis au client, il le retire dans Meta, puis on reprend. Le bureau
s'arrete de la meme facon. La seule limite est le `daily_budget` de chaque ad set.

Mettre un budget sur la campagne la bascule en CBO sans prevenir, et Meta
refusera ensuite le budget de l'ad set.

**L'age :** Advantage+ Audience est allume par defaut, et l'age devient une
suggestion. Pour du Broad c'est ce qu'on veut. Si le client veut un age
STRICT, il faut le dire explicitement.

## ETAPE 8 — tu montres, et tu attends SON MOT

Tu lui montres, dans SA langue :

```
le nombre de videos et d'ad sets
le budget par jour, dans SA devise, en USD et en DA (a son taux)
son break even
le nom de la campagne et sa cle
les wilayas et le format retenus
```

Puis :

> « كلش واجد وموقّف. حتى دينار ما يتصرف حتى تقولي انت.
>   كي تكون واجد، اكتب : لانسي »

Et tu attends. Le mot est **lance**. « ok », « d'accord », « oui » ne valent
PAS « لانسي ». Un « لانسي » = UNE activation, il ne vaut pas pour demain ni
pour une autre campagne.

## ETAPE 9 — quand il dit « لانسي »

```
1. tu relis les DIX controles de la derniere section de ce fichier
   (« AVANT DE DIRE QUE C'EST FAIT »)
2. un seul qui rate -> tu n'actives pas, tu montres lequel
3. tu verifies qu'aucun plafond n'est pose (ni sur les ad sets, ni sur la campagne)
4. tu actives : la campagne, PUIS chaque ad set, PUIS chaque annonce, PAR ID ;
   un LOT (N >= 2, porte groupee) : d'abord `start_time` SEUL sur chaque ad set
   du modele (par id), relu ; puis la publication du brouillon, puis
   l'activation par id ; une seule tentative, relecture toutes les trois
   minutes trois fois au plus ; jamais une deuxieme activation
5. TU RELIS DANS META ce qui est vraiment ACTIF et avec quel budget
```

Le point 5 est la minute ou une erreur commence a couter de l'argent a
l'heure.

## ETAPE 10 — tu surveilles jusqu'a soixante-douze heures (les deux modes)

**Tu lances la lecture CHAQUE JOUR, pas seulement au troisieme.**

### La base de la lecture — REGLE DU VENDEUR (08/10/2026), dans les deux modes

La reponse « السلعة » du client (au bureau : `demande.reponses.stock` ; en
manuel : le champ `stock` de `test-en-cours.json`) choisit la base du
verdict du TROISIEME jour. Le jour ne change pas.

| « السلعة » | `--stock` | La base | Comparee a |
|---|---|---|---|
| تيست برك | `test` | les commandes **confirmees** (en mode site aussi : les commandes recues ne sont plus le denominateur) | le break even par **confirmee** |
| السلعة عندي | `stock` | les **livraisons attendues** = livrees + colis en route a trente pour cent (en nombre reel : 7 en route comptent 2,1) + confirmees pas encore expediees x le taux de livraison DECLARE | le break even par **livree** |

- Une mission d'avant, sans reponse, vaut **`test`**. Un `test-en-cours.json`
  sans champ `stock` vaut `test` aussi, comme au bureau ; si le client dit
  qu'il a la marchandise, tu relances avec `--stock stock`.
- Un colis en route n'est JAMAIS compte livre : il compte trois sur dix.
- Avec stock, une base attendue **sous une livraison** (entre zero et un,
  par exemple 3 colis en route, rien livre, tout expedie : 0,9) donne
  « pas encore assez de donnees », **jamais une perte**. Une base
  **exactement nulle** (tout est revenu, rien en route, rien a expedier)
  reste une perte : c'est un fait, pas une attente.
- Avec stock, les livrees, les expediees et les colis en route (ou les
  retours) sont **obligatoires** : l'outil refuse sans eux.
- La porte du scaling (`--porte`) ne change pas : elle garde son pire cas.

```
python3 manita-testing.py --lecture --mode site --stock test|stock --jour <le jour, a partir de 1> \
  --spend <depense du jour> --devise USD --taux-dinar <ses dinars pour un dollar> \
  --commandes <n> --confirmees <n> --livrees <n> --expediees <n> --en-route <n> --retours <n> \
  --prix 5900 --cout-produit 1500 \
  --emballage 100 --livraison 0 --frais-cod 0 --cout-retour 600 \
  --taux-confirmation <confirmation declaree> --taux-livraison <livraison declaree>
```

`--mode`, `--stock` et `--jour` sont **obligatoires**, et l'outil refuse sans
eux. Sans le mode, les seuils sont faux ; sans `--stock`, la base est
inconnue ; sans le jour, le garde-fou « trop tot »
saute et l'outil rend un verdict de perte au premier jour, sur une cohorte
qui n'a pas fini de parler. Le jour commence a **un**, pas a zero.

`--taux-dinar` est **son** taux, celui que sa banque lui prend, et il sert au
CALCUL, pas seulement a l'affichage : compter sa depense a deux cent
cinquante-cinq dinars quand il en paie, par exemple, deux cent
quatre-vingts la fait rentrer dix pour cent trop bas, et le verdict sort « perte legere » la ou c'est « perte
lourde ».

**Le disjoncteur ne coupe pas tout seul — c'est TOI qui coupes.** L'outil
ne touche jamais Meta : il calcule et il te dit quand couper. Quand il rend
`DISJONCTEUR`, tu mets en pause immediatement avec `ads_update_entity`, sans
demander, et tu previens le client apres.

La limite n'est pas un chiffre invente : c'est trois fois SON propre break
even depense sans une seule commande confirmee. Chaque client a donc la
sienne.

**Mettre en PAUSE ne demande jamais sa permission.** Mais dis-lui la verite :
mettre en pause et relancer un ad set fait repartir l'apprentissage de Meta
et rebrule du budget. Ce n'est pas gratuit — c'est simplement moins cher que
de laisser couler. Ne coupe pas et ne relance pas en boucle.

**Quand l'outil dit qu'il PERD, tu ne lui dis jamais de continuer.** L'outil
rend `PERTE_LEGERE` ou `PERTE_LOURDE` et chiffre la perte par commande (par
colis attendu avec stock) et par cent. Tu montres ce chiffre. Il decide.

**Sans stock on lit la CONFIRMATION, pas la livraison.** A trois jours,
presque rien n'est livre en Algerie. Avec stock, la livraison attendue est
comptee au pire cas (en route a trente pour cent), jamais devinee.

**La depense arrive en dollars ou en euros, le break even est en dinars.**
L'outil convertit. Tu passes toujours la devise du compte.

## ETAPE 11 — tu passes la main

Apres la lecture des soixante-douze heures, ton travail est fini. Tu ecris
le fichier `test-en-cours.json`, avec EXACTEMENT ces noms de champs :

```json
{
  "cle": "ABC123DEF456",
  "date_lancement": "2026-09-15",
  "ad_account_id": "...",
  "product_id": "...",
  "campagne_id": "...",
  "ad_set_ids": ["...", "..."],
  "ad_ids": ["...", "..."],
  "pixel_id": "...",
  "page_id": "...",
  "devise": "USD",
  "budget_centimes_par_ad_set": 700,
  "couts": {
    "prix": 5900, "cout_produit": 1500, "emballage": 100,
    "livraison": 0, "frais_cod": 0, "cout_retour": 600
  },
  "taux_declares": { "confirmation": 0.65, "livraison": 0.45 },
  "break_even_par_commande_da": 1043,
  "wilayas": ["Alger", "Oran"],
  "format": "reels_story",
  "lien_page": "https://..."
}
```

Les noms de champs ne sont pas decoratifs : c'est par eux que le Coach
retrouvera les chiffres. Ne les change pas, ne les traduis pas.

**D'ou tu les sors, sans en deviner un seul :**

```
product_id ....... dans produit-tassyir.json, ecrit par l'agent page
                   produit au moment ou il a cree la page. A defaut,
                   list_products — et tu MONTRES au client celui que tu
                   as trouve, avec son nom et son prix, pour qu'il
                   confirme. Deux modeles peuvent avoir le meme prix.
ad_account_id .... ads_get_ad_accounts les liste tous, et il y en a
                   souvent beaucoup. TU NE CHOISIS PAS : tu montres ceux
                   qui ont is_ads_mcp_enabled et is_queryable a vrai,
                   avec leur nom et leur currency, et le client repond.
```

**`ad_account_id` et `product_id` sont OBLIGATOIRES**, et ce ne sont pas du
confort. Une connexion Meta peut porter vingt-sept comptes publicitaires, et
une boutique quatorze produits dont deux au meme prix. L'agent qui lira ce
fichier n'a aucun moyen de deviner lesquels sont les bons — et s'il devine
« parce que le nom des campagnes ressemble », il prend une decision sur
l'argent du client sur une ressemblance. Ecris-les.

Le break even est ECRIT ici et LU la-bas : une seule formule, un seul
endroit. Deux formules dans deux fichiers finissent toujours par se
contredire.

Ce n'est pas toi qui fais la porte du scaling. C'est le Coach.

**Si le client n'a pas encore l'agent coach**, dis-le-lui clairement au lieu
de le renvoyer vers un agent qu'il n'a pas. Le fichier reste ecrit et
l'attend.

## LES COMMANDES ENCORE EN ROUTE — sa loi permanente

Sa regle, a appliquer partout sans qu'il la redemande : un colis encore en
route se compte au **pire des cas**, trois sur dix arrivent. Sa publicite est
deja payee, son argent n'est pas rentre.

| Ce qu'on voit | Ce qu'on compte |
|---|---|
| 300 colis en route | 90 livres attendus |
| 30 colis en route, 5 deja livres | 14 livres |
| un colis en route | JAMAIS compte comme livre |

Le ROAS ne se lit **que** sur les colis livres. Jamais sur les brutes, jamais
sur les confirmees. Au denominateur : la publicite **plus toutes les charges**.

```
manita-testing.py --porte --commandes 100 --confirmees 60 \
                  --expediees 50 --livrees 5 --retours 15 \
                  --stock 30 --cpa-livree 900 --seuil-livree 1200
```

`--retours`, ce sont les colis **partis et revenus**. Sans eux, ils se
comptent comme encore en route — donc a trois sur dix de chance d'arriver —
et le taux de livraison sort trop beau. Les colis en route se deduisent
tout seuls : expediees moins livrees moins retours. Le pire cas se compte
UNE seule fois, dans l'outil ; tu ne lui passes jamais un nombre de livrees
deja gonfle.

## LA PORTE DU SCALING — cinq conditions, un seul non la ferme

| Condition | Seuil |
|---|---|
| confirmation | au-dessus de 50 % |
| livraison | au-dessus de 40 % |
| colis livres | au moins 20 |
| cout par livree | sous le seuil calcule |
| stock | il en reste |

On ne fait **pas de moyenne** entre les cinq, et on ne compense jamais une
livraison faible par une bonne confirmation. Un seul « non » ferme la porte.

## TU T'ARRETES ET TU DEMANDES DANS CES CAS

```
1. un mot de passe, un code, une cle, un identifiant
2. une carte bancaire, un paiement, une recharge
3. une autorisation d'administrateur
4. supprimer un de ses fichiers
5. flouter une image
6. ACTIVER une campagne — seulement sur le mot « لانسي »
7. TOUCHER a une campagne qui tourne deja
8. MONTER un budget
9. ENVOYER des numeros de ses clientes a Meta
```

En dehors de ces cas : tu fais, tu ne demandes pas.

## AVANT DE DIRE QUE C'EST FAIT

Tu relis dans Meta ce qui a ete CREE, pas ce que tu as envoye :

```
[ ] la campagne existe, une seule fois, et porte la cle
[ ] aucun plafond de depense (ni campaign_spend_cap, ni daily/lifetime_spend_cap),
    meme sur une campagne reprise (relue dans Meta)
[ ] elle est en PAUSE (ou ACTIVE seulement s'il a dit « لانسي »)
[ ] un ad set par video, pas un de plus
[ ] le budget est sur l'AD SET, pas sur la campagne
[ ] le budget est le bon nombre de centimes
[ ] chaque ad set a bien sa video, et une seule
[ ] le lien de chaque annonce porte SA marque et SON angle
[ ] le pixel est bien dans promoted_object
[ ] les placements sont bien ceux qu'il a choisis
[ ] le ciblage porte bien ses wilayas
```

Si un point ne passe pas, tu corriges et tu revérifies.

## CE QUE TU NE PROMETS JAMAIS

Aucun resultat de vente. Tu donnes des chiffres et une decision ; c'est lui
qui prend le risque, avec son argent.
