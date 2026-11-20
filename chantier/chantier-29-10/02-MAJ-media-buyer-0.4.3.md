# ecom manita : mise à jour 0.4.2 → 0.4.3 (à donner à Claude Code)

> **Version finale :** voir `00-LIS-MOI-CLAUDE-CODE.md`, section 0 (0.4.3 ou 0.5.1). Ce fichier est le détail du bloc M.

Écrit le 29/10/2026 après la revue du cours étape par étape avec NA7LA (la vendeuse).
Ces décisions sont **les siennes**. Elles priment sur tout texte plus ancien du paquet, y compris les « RÈGLES 0.4.2 ».

## Comment travailler

1. Lis tout ce fichier avant de toucher au code.
2. Fais une copie de sauvegarde du dossier `ecomanita` (par ex. `ecomanita-0.4.2-sauvegarde`) avant le premier changement.
3. Applique les parties dans l'ordre : **A** (media buyer, prioritaire), puis **B**, puis **C** (tests), puis **D** (version).
4. Les règles permanentes de la fin du fichier ne changent pas.
5. Avant de dire « c'est fait », lance toutes les épreuves existantes du paquet : celles du bureau et les contrôles intégrés de `manita-testing.py`. Elles doivent passer, les nouvelles (partie C) comprises.
6. À la fin, donne à NA7LA un résumé **en darija, simple, sans jargon** :
   - ce qui a changé ;
   - ce qui n'a pas pu être fait, avec la raison ;
   - les tests passés.

---

## A. LE MEDIA BUYER (testing) — prioritaire

Fichiers concernés :
- `plugin/ecom-manita/skills/testing/SKILL.md`, à réécrire :
  - la section « RÈGLES 0.4.2 » point 1 ;
  - « ETAPE 4 — le budget » ;
  - « ETAPE 7 — la structure » ;
  - « ETAPE 10 » ;
  - toute phrase qui dit « une vidéo = un ad set ».
- `outils/3-TESTING/manita-testing.py` : `structure_du_test`, `budget`, `structure_cli`.
- `bureau/missions.mjs` : `structureDuTest`, les constantes `PLANCHER_CBO_USD`, `LEADS_POUR_JUGER`, `JOURS_TEST`, et le texte des étapes 3 et 4 (création campagne et ad set) vers la ligne 2625.
- `bureau/accueil.mjs` vers la ligne 858 : le commentaire et le calcul du plafond par modèle.
- Les messages du bureau qui montrent la structure ou le budget.

### A1. La structure du test (remplace la règle 0.4.2 « la structure sort du fichier »)

```
1 modèle          -> 1 campagne, ABO (aucun budget sur la campagne)
1 campagne        -> 1 seul ad set
1 ad set          -> 1 à 4 vidéos, chaque vidéo = une annonce
Broad, sans intérêts, les wilayas confirmées · Reels et Story · EN PAUSE
Écriture : 1C | ABO | 1 ADSET | 4 AD
```

- **On supprime pour le test :**
  - le calcul « part = budget ÷ vidéos » comparé à « 15 × lead max ÷ 3 jours » ;
  - le passage en CBO avec `daily_min_spend_target` à 3 $ ;
  - la règle « une vidéo = un ad set ».

  Retire les constantes et le code devenus inutiles, ou laisse-les seulement s'ils servent ailleurs (le **scale** reste en CBO : ne touche pas au scaling).
- **Pourquoi :**
  - tous les signaux vont dans un seul ad set, qui sort de l'apprentissage (environ 50 leads) 4 fois plus vite ;
  - plusieurs ad sets à petit budget avec la même audience broad se concurrencent et restent en apprentissage.
- **Option, seulement si le client la demande avec une QUESTION précise** (exemple : « quelle mannequin, avec ou sans hijab ? ») :
  - 2 ad sets dans la même campagne ABO, chacun avec ses vidéos et son budget par la règle A2 ;
  - écriture `1C | ABO | 2 ADSET | 3 AD` ;
  - l'agent dit que cela coûte deux fois le budget.
- **Ce qui va dans des annonces, jamais dans des ad sets différents :** couleur, angle, mannequin (sauf l'option ci-dessus).
- **Un autre modèle = une autre campagne.**

### A2. Le budget (règle de la vendeuse, inchangée dans son montant)

| Vidéos dans l'ad set | Par vidéo | Budget du jour de l'ad set |
|---|---|---|
| 1 | 7 $ | 7 $ |
| 2 | 7 $ | 14 $ |
| 3 | 5 $ | 15 $ |
| 4 | 5 $ | 20 $ |

- Le budget va sur l'**ad set** (`daily_budget`, en centimes, devise du compte, avec le taux du client comme aujourd'hui).
- Toujours **aucun plafond de dépense** :
  - ni `daily_spend_cap` ni `lifetime_spend_cap` sur l'ad set ;
  - ni `spend_cap` sur la campagne.
- Plafond du jour écrit par le client :
  - il passe avant la règle ;
  - s'il ne paie pas 4 vidéos, on prend moins de vidéos et on le dit ;
  - s'il ne paie pas 7 $, rien n'est créé et on montre ce qu'il faudrait (en DA et en USD).
- Lot de N modèles : le plafond se partage, `plafond ÷ N` par modèle, comme aujourd'hui.
- **Le coût par lead ne change JAMAIS le budget.** Il sert seulement aux prévisions (A3).

### A3. NOUVEAU : le coût par lead habituel du client, avant le tableau

Avant le tableau du test, l'agent cherche le coût par lead habituel, dans cet ordre, et **n'invente aucun chiffre** :

| # | Source | Comment | Remarque |
|---|---|---|---|
| 1 | Tassyir | dépense pub ÷ commandes venues de Facebook (UTM / lien caché), 30 derniers jours | la plus fiable : de vraies commandes. Si la dépense pub n'est pas enregistrée dans Tassyir (0), on saute et on le dit |
| 2 | Meta (MCP) | coût par résultat du compte, 30 derniers jours, sans les campagnes de moins de 20 résultats | peut surcompter si le pixel a un problème |
| 3 | Le carnet du bureau | le coût par lead du test précédent | — |
| 4 | Le client | il l'écrit | — |
| 5 | Par défaut | 1 $ (habituel en vêtements) | dit clairement comme une hypothèse |

- Si 1 et 2 existent et diffèrent : montrer les deux côte à côte, conseiller Tassyir, et dire que l'écart est un signal sur le pixel.
- Montrer aussi le **coût par confirmée** = coût par lead ÷ son taux de confirmation.
- Le client **choisit**. Garder le choix et sa source dans le dossier du test (`cpl_reference`, `cpl_source`).
- Après 24 h, le vrai coût par lead remplace la référence pour les prévisions.

Message à reproduire, en darija (les chiffres viennent de SES données) :

```
📊 سعر الليد العادي تاعك (آخر 30 يوم):
• تسيير: 1.4$ (890 طلبية من فيسبوك)
• ميتا: 1.2$ (1,030 نتيجة)
• التأكيد تاعك 62% ← المؤكّد بـ 2.3$
ننصح نبنيو بـ 1.4$ (تاع تسيير، طلبيات حقيقية).
بأنهي سعر نخطّطو؟  [1.4$ ✓]  [1.2$]  [رقم آخر]
```

Client sans historique :

```
ما لقيت حتى تاريخ إعلان. نخطّطو بـ 1$ (العادي في الملابس)، وبعد 24 ساعة نبدّلوه بالسعر الحقيقي.
[واجد]  [رقم آخر]
```

**Prévisions à afficher** (calculées, jamais inventées), avec le budget de l'ad set B et le coût par lead C :
- leads attendus à 72 h = 3 × B ÷ C ;
- jour de sortie d'apprentissage = 50 × C ÷ B, arrondi au jour supérieur.

**Signal 🟠** si 50 × C > 7 × B, soit plus de 2.8 $ par lead avec 4 vidéos. On n'augmente pas le budget :

```
🟠 بـ <C>$ لليد، الأدسات يبقى في التعلّم بعد الأسبوع. الحكم في 72 ساعة يبقى صالح بتحفّظ.
```

### A4. NOUVEAU : lire le Drive du client, puis proposer la campagne

Le client donne **un seul lien partagé**. L'arborescence habituelle :

```
📁 <NOM> SHOOTING
├── 📁 Modele <A>
│   ├── 📁 Mannequin 1   → Photos / Videos
│   └── 📁 Mannequin 2   → Photos / Videos
└── 📁 Modele <B> …
```

L'agent :
1. **Lit l'arborescence.** Il compte les modèles, les mannequins, les photos et les vidéos par dossier.
   - Si le lien n'est pas lisible depuis la machine, il demande au client de le mettre sur « tous ceux qui ont le lien », ou de déposer le dossier.
   - Jamais de mot de passe Google.
2. **Ne lance jamais une vidéo brute du tournage.** Seules les vidéos montées (`variante_*.mp4` de l'éditeur) partent. Si le Drive ne contient que du brut, il le dit et passe la main à l'éditeur.
3. **Propose le plan :**
   - un modèle = une campagne ;
   - jusqu'à 4 vidéos par ad set, en mélangeant mannequins et angles différents ;
   - le reste devient la **réserve**.
4. **Reprend les noms des dossiers dans les noms** (modèle, mannequin), en gardant les conventions actuelles de l'ETAPE 5. Ainsi la lecture du soir sait quelle mannequin a ramené les confirmées.

   Exemple : campagne `TESTING | 2P-BLANC`, annonce `2P-BLANC | M2-HIJAB | V01 | A1`.

Message à reproduire :

```
📁 قريت الدرايف: 2 موديلات · 2 مانكان لكل واحد · 10 فيديوهات لكل مانكان
| الحملة     | الهيكل              | الفيديوهات              | في النهار |
| 2P BLANC   | 1 أدسات · 4 إعلانات | 2 بلا حجاب + 2 بالحجاب  | 20$ |
| DRAPEE NV  | 1 أدسات · 4 إعلانات | 2 مانكان 1 + 2 بيج      | 20$ |
| المجموع    |                     | 8 للبداية · الباقي احتياط | 40$ (10,200 دج) |
• 72 ساعة: 120$ ← حوالي 86 ليد بـ 1.4$ ← الحكم الأول ودفعة الاحتياط
• النهار 4: كل أدسات يخرج من التعلّم
• إذا تحب تعرف أنهي مانكان بالضبط: زوج أدسات لكل موديل ← 80$ في النهار
نبنيو هكذا؟  [نعم]  [بدّل]
```

Ensuite, rien ne change :
- tout est créé **EN PAUSE** ;
- rien n'est activé sans le mot écrit « لانسي » (« ok » et « واه » ne sont pas « لانسي ») ;
- le lien caché est dans chaque annonce.

### A5. Les étapes de lecture (remplace « le verdict du 3e jour » seul)

La lecture reste **chaque jour à 22:00**, mais elle dit à quelle étape on est, et la décision dépend de l'étape :

| Étape | Ce qu'on décide | Ce qu'on ne fait PAS |
|---|---|---|
| **24 h** | Règles d'échec seulement : une vidéo sans lead après environ 2.3 × le plafond du lead → alerte. Un ad set sans aucun lead après une journée → vérifier le technique d'abord (page, lien, formulaire, pixel) | Pas de jugement du modèle, pas de changement de budget, **pas de nouvelle annonce** |
| **72 h** | Premier verdict : coût par lead comparé au plafond, coût par confirmée (commandes en attente comptées en probabilité, partie B4). On continue, ou une nouvelle série de vidéos, ou on arrête le modèle. **Tous les changements partent ensemble, une seule fois** | — |
| **50 leads dans l'ad set** | Sortie d'apprentissage → porte VALIDE | — |

- La base de lecture actuelle ne change pas : confirmées ou livraisons attendues, selon la réponse « السلعة ».
- Une vidéo qui a reçu 15 leads ou plus sous le plafond = candidate gagnante.
- Une vidéo que Meta n'a presque pas servie = « pas testée », pas « perdante ». Elle peut revenir dans une prochaine série.

### A6. Le gardien : il alerte et propose, il ne coupe jamais seul

- **Jamais de pause automatique.** Format : alerte, analyse, proposition, puis « نوقّفوه؟ (نعم / لا) ».
- **Avant 72 h, jamais de vidéo de réserve ajoutée dans un ad set qui tourne.** Une nouvelle annonce relance l'apprentissage. La réserve entre à l'étape 72 h, avec les autres changements.
- La pause reste toujours permise : le client écrit « وقّف » à n'importe quel moment.

Exemple :

```
🟡 فيديو «ساترة» (2P BLANC): صرف 10$ بلا حتى ليد
التحليل: الفيديوهات الأخرين جابو 9 ليدات بـ 1.9$. المشكل في هاذ الفيديو، ماشي في الموديل.
الاقتراح: نوقّفوه. الاحتياط يدخل مع دفعة 72 ساعة باش ما نرجعوش التعلّم.
نوقّفوه؟  [نعم]  [لا]
ما نوقّف حتى حاجة وحدي. والتوقيف ديما مسموح: اكتب «وقّف».
```

### A7. L'offre deux pièces (« الرافعة ») n'est pas un modèle

- L'offre deux pièces se met sur la page de **chaque** modèle. Ce n'est pas une campagne séparée.
- Le plafond du lead pour les règles d'arrêt se calcule **sans l'offre** (prudent), puisqu'on ne sait pas qui la prendra avant le test.
- À 72 h, on lit la part réelle qui a pris deux pièces, et la Boussole recalcule le plafond (il monte si l'offre marche).
- **Seule exception :** un test de l'offre comme idée dès le départ. Mêmes vidéos, deux pages (une pièce contre deux pièces). Là, c'est une campagne ou un ad set à part, et l'agent le dit.

### A8. Ce qui reste

- Le **plafond du lead** pour les règles d'arrêt vient toujours de la Boussole (break even ÷ taux), jamais du coût par lead moyen.
- Les textes (5 angles), les 10 contrôles, le prix de la pub = le prix de la page, les champs exacts Meta : inchangés.

---

## B. Les autres décisions de la revue (déjà dans le cours, à mettre dans le code)

### B1. L'inspecteur ne bloque jamais (`bureau/inspecteur.mjs`, `bureau/portes.mjs`)

- Il tourne une fois ; le client peut le relancer.
- Il ne bloque aucune étape, mais ne dit jamais « تقدر تلانسي » ni « الباب مسكّر ».
- Chaque erreur s'écrit en 3 lignes :

  ```
  🔴 <الخطأ في جملة>
  النزيف: <الخطأ> ← <واش يصرا> ← <شحال تخسر / واش ما تعرفش>
  التصليح: <واش تدير> · <الشاشة> · <الوقت>
  ```

- Les niveaux : 🔴 grosse fuite · 🟠 petite fuite · ⚪ info (ce n'est pas une erreur, ça sert à une étape suivante).
- Le rapport se termine par :

  ```
  ⚖️ رأيي: <نصلّحو … قبل أول دينار (حوالي … دقيقة)> — وإذا لانسيت دروك، <أكبر خسارة>.
  القرار تاعك: [نصلّحو أولاً (ننصح)]  [نلانسيو بهذا الخطر]
  ```

- La décision est gardée dans le carnet. Si le client lance avec le risque, le signal ne revient **que** quand il commence à coûter (dans la lecture du soir).
- Dans le résultat : `bloquant: false` toujours. `avis` vaut `pret`, `corriger_avant` ou `repondre_questions`.
- **Trois contrôles nouveaux :**
  - 27 🟠 commandes de test de l'équipe comptées dans les chiffres ;
  - 28 🔴 compte d'équipe avec email temporaire et droits de manager ;
  - 29 🟠 produits de test visibles par les clients.
- L'offre deux pièces dans l'inspecteur = **seulement** une ligne ⚪ « عرض القطعتين ← الخطوة 05 ».

### B2. Même principe pour la lecture du soir et la porte du scale (`bureau/controles-suivi.mjs`)

- Contrôle rouge = verdict **avec réserve** et sa raison. Exemple : « VALIDE بتحفّظ: 30% من الطلبيات بلا مصدر ».
- Porte du scale : 5 signaux, chacun avec sa fuite. C'est le « نعم » du client qui décide.

### B3. Le gardien : voir A6, partout dans le bureau (routines, Telegram)

### B4. Les commandes en attente comptées en probabilité selon leur âge (rapport de 22:00)

Aujourd'hui, une commande en attente compte comme annulée : c'est **faux**. Le nouveau calcul :

| Âge de la commande en attente | Probabilité de confirmation |
|---|---|
| arrivée aujourd'hui | taux du client × 1 |
| hier | taux du client × 0.6 |
| 2 à 3 jours | taux du client × 0.3 |
| plus de 3 jours | 5 % |

- Calibrer ces coefficients sur l'historique du client quand il y en a assez. Sinon, garder ceux-ci.
- Le rapport dit :
  - combien de confirmées probables ;
  - le coût par confirmée qui en sort ;
  - qui appeler avant 12:00, des plus anciennes aux plus récentes.
- Les endroits où les attentes sont traitées comme annulées : la lecture du soir (`missions.mjs`, `controles-suivi.mjs`) et le calcul de la Boussole (`bureau/boussole/calcul.js`, s'il juge la semaine de test).
- Le taux de confirmation se lit sur les commandes **traitées**, pas sur toutes les commandes reçues (le taux de Tassyir est confirmées ÷ reçues, donc les attentes le font baisser).

### B5. Le vocabulaire

- « أسبوع » à la place de « الجمعة » partout. Garder la compréhension de « جمعة » dans les entrées.
- « الرافعة » = l'offre **seulement** (deux pièces, ou un prix plus haut avec une valeur visible). Les anciens textes qui appellent « الروافع » la livraison, la confirmation, le lead, le retrait ou les paniers abandonnés : les renommer « حركات بلا دينار ».
- Les gros montants en « مليون » (1 000 000 DA = « 100 مليون »), sans « سنتيم ». Les petits montants par commande restent en دج.

### B6. Le spy (`bureau/spy.mjs`) : léger, NA7LA va donner la nouvelle mission

- Le message liste les modèles **numérotés**.
- Il ne donne le prix **que s'il est écrit** dans la pub ou la page. Jamais de prix deviné, jamais de marge.
- Ne pas refaire le spy au-delà : la nouvelle mission arrive de NA7LA.

### B7. Le ROI toujours dans les décisions

Dans le choix du modèle (Boussole), VALIDE et le scale, montrer le ROI à côté du net par colis livré. Il peut changer la décision : un bon net avec un capital bloqué longtemps peut être un mauvais choix.

### B8. La page produit : publier ou brouillon ? **Décision de NA7LA en attente, NE PAS CHANGER**

Aujourd'hui, la règle du paquet (06/10) est de publier directement quand la page est prête et relue. Laisser tel quel.

---

## C. Les tests (épreuves) à mettre à jour ou à ajouter

1. **Structure :**
   - 4 vidéos et un plafond suffisant → `1 ADSET`, 4 annonces, 20 $ sur l'ad set, aucun budget sur la campagne ;
   - 2 vidéos → 14 $ ;
   - 3 vidéos → 15 $ ;
   - plafond de 12 $ avec 4 vidéos → **1 vidéo à 7 $** (il en faut 14 pour 2), et le message le dit ;
   - plafond de 14 $ → 2 vidéos ; de 15 à 19 $ → 3 vidéos ; 20 $ et plus → 4 vidéos ;
   - plafond de 5 $ → rien n'est créé.
2. **Aucun champ** `daily_spend_cap`, `lifetime_spend_cap`, `spend_cap` ni `campaign_daily_budget` dans un test.
3. **Prévisions :** B = 20, C = 1.4 → 43 leads à 72 h, sortie au jour 4. C = 3 → signal 🟠.
4. **Option 2 ad sets :** seulement si le client la demande ; 2 × le budget.
5. **Attentes :** 10 du jour, 10 d'hier, 10 de 2 jours, 10 de 5 jours, avec un taux de 60 % → 6 + 3.6 + 1.8 + 0.5 = **11.9** confirmées probables.
6. **Inspecteur :** avec 3 rouges → `bloquant: false`, `avis: 'corriger_avant'`, et le texte contient « القرار تاعك ».
7. **Gardien :** aucune action de pause n'est envoyée sans « نعم » ou « وقّف » du client.
8. Toutes les anciennes épreuves passent encore. Celles qui testaient l'ancien CBO à 3 $ et « une vidéo = un ad set » : à réécrire avec la nouvelle règle, pas à supprimer sans remplacement.

---

## D. Version et journal

- `bureau/package.json` et `plugin/ecom-manita/.claude-plugin/plugin.json` passent à **0.4.3**.
- Le numéro `VERSION` de `manita-testing.py` augmente.
- Ajoute en tête de `testing/SKILL.md` un bloc « RÈGLES 0.4.3 (29/10/2026) — elles PRIMENT sur tout le texte plus bas » qui résume A1 à A7. Mets à jour ou barre les phrases contraires plus bas.
- Une ligne dans le journal des versions, s'il existe : « 0.4.3 : test = 1 ad set · 1 à 4 vidéos · 7/5 $ par vidéo ; coût par lead habituel + Drive → proposition ; étapes 24/72/50 ; gardien sans coupure ; attentes en probabilité ; inspecteur non bloquant ».

---

## RÈGLES PERMANENTES (ne changent pas)

- Tout est créé **EN PAUSE**. Rien n'est activé sans « لانسي » écrit. La pause est toujours permise.
- **Aucun plafond de dépense** Meta. Seul le budget du jour compte.
- Jamais `confirm_order`, `cancel_order`, `dispatch_orders`, `deliver_order`, `return_order`, et aucune suppression.
- Jamais de mot de passe, de jeton ou de clé tapé par l'agent : le client les colle lui-même.
- Aucun chiffre inventé : chaque nombre montré vient d'un outil ou du client.
- Pas de fausse urgence, de faux avis, de prix barré inventé, ni de « مضمون / 100% ».
- La darija est algérienne, en lettres arabes. Les chiffres sont latins (0-9). On écrit « شركة التوصيل », « أسبوع », « الرافعة » (l'offre seulement). « ECOMANITA » reste en lettres latines.
