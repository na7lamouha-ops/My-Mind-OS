# Pour Claude Code : toutes les mises à jour d'ecomanita (25/10 → 29/10/2026)

> **Comment l'utiliser (pour NA7LA) :**
> 1. Dézippe ce dossier à côté de ton dossier `ecomanita/`.
> 2. Ouvre Claude Code dans le dossier qui contient les deux.
> 3. Écris : « اقرا 00-LIS-MOI-CLAUDE-CODE.md وطبّقو ».

Ces décisions sont celles de NA7LA, la vendeuse. Quand un texte plus ancien les contredit (le paquet 0.4.2, ou le prompt 0.5 du 25/10), **ce fichier gagne**.

---

## 0. D'abord : où en est le code ?

Lis la version dans `ecomanita/bureau/package.json`, puis dis à NA7LA, en darija, ce que tu as trouvé :

| Version trouvée | Ce que tu fais |
|---|---|
| **0.4.2** | Demande-lui : « نديرو 0.5 كاملة (الوكلاء باللوب + تلغرام) مع التحديثات، ولا التحديثات برك على 0.4.2؟ ». **Les deux** : `01-PROMPT-0.5-du-25-10.md` corrigé par la section 2 ci-dessous, puis les sections 3 et 4 ; version finale **0.5.1**. **Seulement les mises à jour** : les sections 3 et 4 sur 0.4.2 ; version finale **0.4.3** |
| **0.5.x** | Les sections 3 et 4 directement. Version finale **0.5.1** (ou +1) |

**Avant le premier changement :** fais une copie de sauvegarde de `ecomanita/`.

---

## 1. Ce qu'il y a dans ce dossier

| Fichier | Contenu |
|---|---|
| `00-LIS-MOI-CLAUDE-CODE.md` | ce fichier : l'ordre et la liste complète |
| `01-PROMPT-0.5-du-25-10.md` | le grand prompt 0.5.0 (agents en boucle, Telegram, Boussole 29.18). Corrigé par la section 2 |
| `02-MAJ-media-buyer-0.4.3.md` | le détail du media buyer : structure, budget, coût par lead, Drive, étapes 24/72/50, gardien, offre, tests |
| `ecomanita-masar/` | les spécifications **à jour au 29/10** (références 00 à 07 + 01b), les petites règles `scripts/masar.js` (27/27) et la Boussole 29.18 (golden 6/6) |
| `decisions/` | les décisions : inspecteur 1.2 puis **1.3** (`agent0-inspecteur-v1.3-isharat.md`), spy 1.2, gaps, et **`qararat-tahdith-course-v2.md`** (les 18 décisions de la revue) |

**Les fichiers de `ecomanita-masar` changés depuis le 25/10** (les reporter dans le bureau s'ils y ont déjà été copiés) :
- `SKILL.md`
- `references/01-tajhiz-mofattich.md`
- `references/01b-isharat-mofattich.md` (nouveau)
- `references/02-wijha-bahth-filtra.md`
- `references/07-taqarir.md`
- `scripts/masar.js` (`noteInspecteur` ne bloque plus, nouveau test)
- `boussala/engine/{triage,reasons,manette,events,onboard}.js`
- `boussala/agent/SYSTEM_PROMPT.md` (« أسبوع »)

Contrôle : `node ecomanita-masar/scripts/masar.js test` → **27/27**, et `node ecomanita-masar/boussala/tests/run.js` → **6/6**.

---

## 2. Corrections au prompt 0.5 (si tu l'appliques)

| Ligne du prompt 0.5 | Remplacée par |
|---|---|
| Loi 2 : « التوقيف ديما مسموح (الوكيل يوقّف وحدو عند الستوب) » | **L'agent ne coupe jamais seul.** Alerte, analyse, proposition, puis « نوقّف؟ (نعم / لا) ». Le client peut toujours couper avec « وقّف » |
| Inspecteur, « الباب: حتى أحمر وحتى مجهول ← يحل البوصلة والجاسوس » | **L'inspecteur ne bloque pas.** Il donne les signaux, son avis et « القرار تاعك ». La Boussole et le spy s'ouvrent après sa décision |
| La boucle « يعاود حتى الباب يتحل ولا الوكيل يحبس » | La boucle continue, mais une porte = **un avis + le mot du client**, jamais un verrou. Ce qui reste verrouillé : l'argent (« لانسي »), les écritures (« نعم »), les nombres sans moteur (pas de chiffre inventé) |
| Page produit : « مسودة … ← التاجر ينشر » | **NE PAS CHANGER** la règle actuelle du paquet (publier quand prête et relue). La décision de NA7LA est en attente |
| « CBO و`{{…}}` في `link_url` ما تجرّبوش » (premier test) | Le test est maintenant en **ABO, 1 ad set** (section 3, M1). Le CBO reste pour le **scale** seulement. La vérification du `{{…}}` la première nuit reste |
| « الوكلاء لازم يحبسو الضعاف » (épreuve d'acceptation) | Ils **proposent** l'arrêt des faibles avec la raison, et le client dit « نعم » |
| Partout : « الجمعة », « الروافع » (pour tout) | « أسبوع » ; « الرافعة » = l'offre seulement (section 3, D2) |

---

## 3. La liste complète des mises à jour (28–29/10)

### M. Media buyer (testing) — le détail est dans `02-MAJ-media-buyer-0.4.3.md`
- **M1 Structure :** 1 modèle = 1 campagne ABO · 1 ad set · 1 à 4 vidéos en annonces. 2 ad sets seulement si le client a une question (quelle mannequin). Couleur, angle et mannequin vont dans des annonces.
- **M2 Budget :** 7 $ par vidéo (1–2 vidéos), 5 $ (3–4 vidéos), soit 7 · 14 · 15 · 20 $ sur l'ad set. Aucun plafond Meta. Le coût par lead ne change jamais le budget.
- **M3 Coût par lead habituel :** Tassyir (dépense ÷ commandes Facebook, 30 jours) → Meta → carnet → client → 1 $ par défaut. Le client choisit. Il sert aux prévisions (leads à 72 h, jour de sortie d'apprentissage) et au signal 🟠 si 50 × C > 7 × B.
- **M4 Drive :** l'agent lit l'arborescence (Modèle / Mannequin / Photos / Vidéos) et propose le plan. Jamais de vidéo brute. Les noms des dossiers passent dans les noms des annonces.
- **M5 Étapes de lecture :**
  - 24 h : règles d'échec seulement ;
  - 72 h : verdict et série de réserve (tous les changements ensemble) ;
  - 50 leads dans l'ad set : sortie d'apprentissage → VALIDE.
- **M6 Gardien :** il alerte et propose, ne coupe jamais seul. Pas de nouvelle annonce avant 72 h.
- **M7 L'offre deux pièces n'est pas un modèle :** elle est sur la page de chaque modèle. Le plafond du lead se calcule sans l'offre et se recalcule à 72 h. Exception : un test de l'offre comme idée.
- **M8 Le prix dans la vidéo de test :** c'est la **décision du client**, avec un conseil. L'agent pose la question avec les deux choix (« بلا سعر » / « بالسعر ») et un conseil court, mais n'impose rien. S'il y a un prix, il est égal au prix de la page (règle actuelle).

### I. Inspecteur 1.3 (`bureau/inspecteur.mjs`, `bureau/portes.mjs`, messages)
- **I1** Un seul passage ; il ne bloque jamais. Résultat : `bloquant: false`, `avis` ∈ `pret` / `corriger_avant` / `repondre_questions` (voir `noteInspecteur` dans `masar.js`).
- **I2** Format en 3 lignes (الخطأ / النزيف en chaîne / التصليح avec l'écran et le temps), niveaux 🔴 🟠 ⚪, fin « ⚖️ رأيي » + « القرار تاعك: نصلّحو أولاً (ننصح) / نلانسيو بهذا الخطر ». Jamais « تقدر تلانسي » ni « الباب مسكّر ». La bibliothèque des 29 contrôles et l'exemple complet sont dans `references/01b-isharat-mofattich.md`.
- **I3** Le choix du client est gardé dans le carnet. S'il a lancé avec le risque, le signal ne revient que quand il coûte.
- **I4** Contrôles nouveaux :
  - 27 : commandes de test de l'équipe dans les chiffres ;
  - 28 : compte d'équipe avec email temporaire et droits de manager ;
  - 29 : produits de test visibles.
- **I5** L'offre deux pièces dans l'inspecteur = une ligne ⚪ « عرض القطعتين ← الخطوة 05 », rien d'autre.

### S. Suivi, lecture du soir, scale (`bureau/controles-suivi.mjs`, `missions.mjs`, routines)
- **S1** Contrôle rouge = verdict **avec réserve** et sa raison (« VALIDE بتحفّظ: … »).
- **S2** Porte du scale : 5 signaux avec leur fuite, et le « نعم » du client décide. Le ROI est montré.
- **S3 Commandes en attente en probabilité selon l'âge** (rapport 22:00) : aujourd'hui × 1, hier × 0.6, 2–3 jours × 0.3, plus de 3 jours = 5 % (du taux du client), à calibrer sur son historique. Jamais comptées comme annulées. Le taux de confirmation se calcule sur les commandes **traitées**. Le rapport dit qui appeler avant 12:00, des plus anciennes aux plus récentes.

### B. Boussole et chemin vers le test (`ecomanita-masar/references/02-wijha-bahth-filtra.md`)
- **B1 La destination avant le produit :**
  - 3 questions seulement : objectif cash, durée, capital ;
  - le reste vient de Tassyir ou des chiffres de la niche, en une ligne ;
  - durée = **jours de vente** (50 jours = 40) ;
  - sortie = la carte de l'objectif par net par colis livré ;
  - **jamais de produit de référence choisi à la place de l'élève.**
- **B2 Le chemin :** يجيب (spy) ← نشوف (à l'œil, avant le prix) ← نسعّر (une ligne par modèle : numéro · vente · achat) ← نحسب ونختار (Boussole + offre deux pièces).
- **B3 Le modèle rentable passe 4 portes :**
  - papier ;
  - test ;
  - VALIDE ;
  - réalité : profit réel par colis livré > 0, cash revenu, stock ≤ 30 jours.
- **B4** Le **ROI** toujours, à côté du net, dans le choix (05), VALIDE (11) et le scale (12).

### P. Spy (`bureau/spy.mjs`)
- **P1** Message avec les modèles **numérotés**. Prix **seulement s'il est écrit**. Jamais de marge ni de prix deviné.
- **P2** NA7LA va donner la **nouvelle mission** du spy : ne pas refaire le spy au-delà de P1.

### D. Dictionnaire (tous les textes, messages, scripts)
- **D1** « أسبوع » à la place de « الجمعة ». Déjà fait dans le moteur ; garder la compréhension de « جمعة » dans les entrées (`onboard.js`).
- **D2** « الرافعة » = l'offre **seulement** (deux pièces, ou un prix plus haut avec une valeur visible). Livraison, confirmation, lead, retrait, paniers abandonnés = « حركات بلا دينار ».
- **D3** Les gros montants en « مليون » (1 000 000 DA = « 100 مليون »), sans « سنتيم ». Les petits par commande en دج.

### N. À NE PAS changer (décisions en attente)
- **N1** Page produit : publier ou brouillon ? Garder la règle actuelle du paquet.
- **N2** Le spy au-delà de P1.

---

## 4. Tests, version, fin

1. Toutes les épreuves existantes passent : `bureau/verifier.mjs`, les contrôles de `manita-testing.py`, `masar.js` 27/27, golden 6/6.
2. Les épreuves nouvelles :
   - celles de la section C de `02-MAJ-media-buyer-0.4.3.md` ;
   - inspecteur non bloquant ;
   - attentes en probabilité : 10 + 10 + 10 + 10 avec un taux de 60 % → 11.9 ;
   - gardien sans pause sans « نعم » ou « وقّف » ;
   - aucun « الجمعة » dans les textes sortants.
3. Les anciennes épreuves contraires (CBO à 3 $, une vidéo = un ad set, inspecteur qui bloque) sont **réécrites** avec la nouvelle règle, pas supprimées sans remplacement.
4. Version : **0.4.3** ou **0.5.1** (section 0) dans `bureau/package.json` et `plugin/ecom-manita/.claude-plugin/plugin.json`. Un bloc « RÈGLES <version> (29/10/2026) — elles PRIMENT » en tête des SKILL.md touchés. Une ligne dans le journal des versions.
5. Teste depuis une copie dézippée propre, puis fais le zip pour l'élève. **Aucune donnée réelle d'un marchand dedans** : pas de nom, pas de numéro, pas de chiffres de compte.
6. À la fin, un résumé à NA7LA **en darija, simple, sans jargon** :
   - ce qui a changé ;
   - ce qui n'a pas pu être fait, avec la raison ;
   - les tests passés ;
   - où est le zip.

**Travaille par blocs, dans cet ordre :** M → I → S → B → P → D. Après chaque bloc : les tests du bloc au vert, un résumé de 3 lignes, et tu attends « كمّل » de NA7LA.

---

## Règles permanentes (ne changent jamais)
- Tout est créé **EN PAUSE**. Rien n'est activé sans « لانسي » écrit. La pause est toujours permise au client.
- Lecture seule par défaut. Toute écriture dans Tassyir ou Meta : dire le changement exact, attendre « نعم », écrire, relire.
- **Aucun plafond de dépense** Meta. Seul le budget du jour compte.
- Jamais `confirm_order`, `cancel_order`, `dispatch_orders`, `deliver_order`, `return_order` sans « نعم ». Aucune suppression.
- L'agent ne tape jamais : prix de retour, portefeuilles, liaison publicitaire, jetons, mots de passe. Le client les met lui-même.
- Aucun chiffre inventé : chaque nombre vient de Tassyir, de Meta, du moteur ou du client.
- Pas de fausse urgence, faux avis, prix barré inventé, « مضمون / 100% ».
- Darija algérienne en lettres arabes, chiffres latins (0-9), « شركة التوصيل », « أسبوع ». « ECOMANITA » en lettres latines.
