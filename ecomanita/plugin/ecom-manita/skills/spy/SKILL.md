---
name: spy
description: "À lancer avec /ecom-manita:spy dans une discussion neuve quand le client veut savoir quels vendeurs de vêtements testent, scalent avec stock ou scalent après une production dans un pays (« spy dz », « spy morocco », « spy egypte », « spy iraq », « spy tunis ») : trente jours de la Meta Ad Library, lus sans toucher à aucun compte publicitaire."
---

# SPY — lire les dates, pas le nombre d'annonces

## CE QUE FAIT L'AGENT, ET CE QU'IL NE FAIT PAS

| Il fait | Il ne fait pas |
|---|---|
| Lire les pubs actives d'un pays dans la Ad Library | Toucher à un compte publicitaire |
| Dire qui teste, qui scale, qui a payé une production | Calculer une marge ou un prix de vente |
| Donner le lien de la page de pubs de chaque vendeur | Télécharger des vidéos |
| Envoyer le résultat sur Telegram | Deviner un prix qu'il n'a pas lu |
| Donner les deux modèles qui ont le plus de pubs par boutique, avec la photo de la pub | Deviner un modèle que le texte ne nomme pas |

## LES MOTS — à montrer au client tels quels

| Mot | Ça veut dire | Pour le client |
|---|---|---|
| **Vague** | Un moment où le vendeur lance plusieurs pubs d'un coup | Une décision du vendeur |
| **Trou** | Les jours où il ne lance **rien** entre deux vagues | Il attend quelque chose |
| **En ligne** | Depuis combien de jours sa plus vieille pub active tourne | L'âge de sa bataille |
| **TEST** | Il lance tout le même jour, une seule fois | On ne sait pas encore si ça vend |
| **AVEC STOCK** | Il revient tous les 1 à 3 jours, sans s'arrêter | Il a la marchandise et ça vend |
| **SANS STOCK** | Il teste, s'arrête 3 à 10 jours, puis revient plus fort | Il a payé une production, donc ça vend |

Le trou se lit **entre chaque vague**, pas une seule fois. Des trous qui raccourcissent (10 j, puis 5 j, puis 2 j) = le vendeur revient de plus en plus vite = le modèle gagne.

## LES VERDICTS — appliqués par `spy_calc.py`, jamais à la main

| Ce qu'on voit dans les 30 jours | Verdict | Rang |
|---|---|---|
| Petite vague, trou de 3 à 10 j, puis plus de pubs qu'avant | SANS STOCK — SCALING PRODUCTION | 1 |
| Vagues espacées de 12 h ou plus, 3 fois ou plus, aucun trou de 3 j | AVEC STOCK — WINNER | 2 |
| 2 vagues espacées de 12 h ou plus, aucun trou de 3 j | AVEC STOCK — SCALING | 3 |
| Trou de 3 à 10 j, mais un AUTRE produit après le trou | NOUVEAU MODÈLE | 4 |
| Trou de 3 à 10 j, puis autant ou moins de pubs | SANS STOCK — RE-TEST | 5 |
| Une seule vague | TEST | 6 |
| Trou de plus de 15 j | REPRISE APRÈS ABANDON | 7 |
| Rien de créé depuis 30 jours | DORMANTE | 8 |
| Titre avec « جملة », « بالسيري », « الشوالة », « gros » | GROSSISTE (écarté) | 9 |

Le meilleur signal est le rang 1 : personne ne paie une production sur un modèle qui ne vend pas.

**Le trou se juge avec le PRODUIT.** Une vague, un trou, puis une vague sur un **autre** modèle, ce n'est pas une production : c'est une boutique qui sort un nouveau modèle (verdict NOUVEAU MODÈLE, rang 4). Le rang 1 n'est gardé que si le **même** produit revient après le trou. Sans produit lu, la ligne porte « produit ? » et le verdict n'est pas prouvé.

## CE QU'IL FAUT AVOIR

| Élément | Pourquoi |
|---|---|
| Claude avec le connecteur **Meta Ads** branché | C'est lui qui lit la Ad Library hors Europe |
| Un compte publicitaire Meta **actif** chez le client | Le connecteur refuse la recherche sans compte actif |
| Python 3 | Pour `spy_calc.py` |
| Le robot Telegram et le Worker de `INSTALLATION-TELEGRAM.md` | Seulement pour le mode Telegram |

Pourquoi pas l'API publique de Meta : la documentation `ads_archive` dit que les pubs qui n'ont touché aucun pays de l'Union européenne n'apparaissent que si elles parlent de politique ou de sujets de société. Les pubs de vêtements en Algérie, au Maroc, en Égypte, en Irak ou en Tunisie n'y sont donc pas. Le connecteur Meta Ads de Claude, lui, les rend.

## DÉCLENCHEURS

| Le client écrit | Pays |
|---|---|
| `spy dz` · `spy algerie` | DZ |
| `spy morocco` · `spy maroc` | MA |
| `spy egypte` · `spy egypt` | EG |
| `spy iraq` · `spy irak` | IQ |
| `spy tunis` · `spy tunisie` | TN |
| `spy` tout seul | Demander le pays (sur Telegram : 5 boutons) |

Avec le bureau ecom manita installé, le client peut aussi écrire « spy dz » (ou spy morocco / egypte / iraq / tunis) à son robot Telegram du bureau, sans Worker : le bureau fait les étapes 1 à 4 avec Claude (`ads_library_search` seul), lance `spy_calc.py`, `modeles.py` et `capture_modeles.mjs`, puis envoie la photo et la ligne de chaque boutique et la conclusion en dernier (`bureau/spy.mjs`).

## LES MOTS-CLÉS PAR PAYS — un seul mot par appel

Plusieurs mots dans `search_terms` = recherche de phrase exacte = presque rien. **Toujours un mot.**

| Pays | Mots-clés |
|---|---|
| DZ | حجاب · خمار · عباية · جلابة · جبة · فستان · روبة · قفطان · قندورة · طقم · سروال · بلوزة · تنورة · جاكيت · بيجامة · اطفال · بيبي |
| MA | جلابة · قفطان · كندورة · عباية · حجاب · فستان · تكشيطة · طقم · بيجامة · سروال · اطفال |
| EG | عباية · اسدال · خمار · حجاب · فستان · طقم · بيجامة · ترينج · بلوزة · سروال · اطفال |
| IQ | عباية · حجاب · فستان · طقم · بيجامة · دشداشة · بلوزة · بنطلون · اطفال |
| TN | جبة · قفطان · حجاب · فستان · طقم · سفساري · بيجامة · سروال · اطفال |

Le client peut ajouter ses propres mots.

## LA PROCÉDURE — 7 étapes, dans l'ordre

**Étape 1 — Ratisser.** Pour chaque mot-clé du pays, appeler `ads_library_search` :
`countries:["<PAYS>"]`, `ad_active_status:"ACTIVE"`, `limit:50`, `search_terms:"<UN MOT>"`.
Noter chaque `page_id` dont le nom vend du **vêtement au détail**. Jeter : compléments, cosmétiques, bijoux, chaussures, sacs, jouets, meubles, séries et romans, agences de voyage, écoles, locations de robes.

**Étape 2 — Choisir les pages.** Garder les pages vues avec au moins 2 pubs, ou 1 pub avec un prix dans le titre. **Plafond : 40 pages par pays**, les plus actives d'abord. Les 50 résultats d'un mot ne couvrent qu'un jour et demi : ils servent à **trouver** les pages, jamais à calculer.

**Étape 3 — Ouvrir chaque page.** `ads_library_search` avec `page_ids:["…","…","…"]` (3 au plus par appel), même pays, `limit:50`. Pour chaque pub garder : `id`, `ad_creation_time`, `ad_delivery_start_time`, `ad_creative_link_title`.
Si une réponse dit plus de 50 pubs au total (`estimated_total_count` > 50), rouvrir la page **seule** ; si elle dépasse encore 50, l'écrire dans le rapport (« liste coupée »). Mettre ce nombre dans `entree.json` sous `"total"` pour la page : le calcul écrit alors « liste coupée » tout seul (il le fait aussi dès que la page a 50 pubs).

**Étape 4 — Écrire `entree.json`** :
```json
{"pays": "DZ", "pages": [
  {"page_id": "697649403431569", "page_name": "Kika collection", "niche": "abaya",
   "ads": [{"id": "1408556080877651", "created": 1791787905, "start": 1791793403,
            "title": "اطلبيها الآن"}]}
]}
```
`niche` = le mot-clé qui a fait trouver la page, en français.
`produit` = le nom court du modèle de chaque pub (« abaya moka », « robe velours »), lu dans le **texte** de la pub, pour **toutes** les pages gardées. Le texte d'abord ; le titre seulement si le texte est vide (le titre peut nommer un autre modèle que le texte : c'est le texte qui gagne). Même modèle = même nom écrit pareil. Jamais deviné : si le texte ne nomme pas le modèle, laisser vide.

**Étape 4 bis — Compléter par la page web (si un navigateur est disponible).** Pour **chaque page gardée** (les textes servent aux modèles de chaque boutique) :
1. ouvrir son lien (celui du rapport) dans le navigateur ;
2. exécuter le contenu de `lecture_navigateur.js` avec l'outil JavaScript du navigateur : il clique « Voir plus » jusqu'au bout (chargement de la liste seulement) et rend `{"total": …, "pubs": [[id, jour, groupées, texte], …]}` ;
3. coller ce résultat tel quel dans `navigateur-<page_id>.json` ;
4. `python3 fusion_navigateur.py entree.json <page_id> navigateur-<page_id>.json` — il doit écrire `PASSE`.
Les pubs ajoutées sont datées au jour près (le rapport le dit) ; une pub sans date n'est jamais inventée. Puis remplir `produit` en lisant `textes_trou` (avant / après le trou) que donne le calcul, et relancer l'étape 5.

**Étape 5 — Calculer.**
```
python3 spy_calc.py entree.json --json resultat.json --telegram messages.txt
```
Il doit écrire `PASSE`. S'il écrit `ÉCHEC`, lire la raison, corriger l'entrée, relancer. **Ne jamais rendre un résultat calculé à la main.**

**Étape 5 bis — Les deux modèles de chaque boutique, avec leur photo** (EN PLUS du rapport, il ne change aucune ligne) :
```
python3 modeles.py entree.json resultat.json modeles.json modeles.txt
node capture_modeles.mjs modeles.json captures
```
`modeles.py` doit écrire `PASSE`. Il compte les pubs par `produit` et garde les deux premiers modèles (égalité au 2e rang : tous gardés, aucun choisi ; un 2e modèle avec une seule pub n'est pas montré). Une boutique sans aucun nom lu porte « non nommés » ou « textes non lus ».
`capture_modeles.mjs` ouvre la page publique des 5 pubs les plus récentes de chaque modèle et télécharge la **photo de la pub** (aucun champ du connecteur ne la donne). Un modèle qui n'a que des vidéos porte « vidéo seulement » : la 1re image d'une vidéo montre rarement le modèle. À lancer juste avant l'envoi : les liens des photos expirent.
Ouvrir deux photos et vérifier à l'œil qu'elles montrent le modèle nommé. Une photo manquante ne bloque jamais le rapport.

**Étape 6 — Vérifier par une deuxième méthode.** Si un navigateur est disponible, ouvrir le lien des 3 premières pages du rang 1 et contrôler à l'œil : les dates « Started running on » doivent coller aux vagues calculées. Relever le prix s'il est écrit dans le texte de la pub. Si aucun navigateur n'est disponible, l'écrire : « vérification visuelle : NON VÉRIFIABLE ».
Pour chaque page du rang 1 : remplir `produit` dans `entree.json` et relancer l'étape 5. Une page qui passe en NOUVEAU MODÈLE quitte le rang 1. Une page qui reste « produit ? » est rendue avec cette mention, jamais présentée comme une production prouvée.

**Étape 7 — Rendre.**
- **Dans Claude** : un tableau par verdict (Page avec lien · Niche · Vagues · Trous · En ligne · Prix), puis 2 ou 3 phrases en darija, sans aucun chiffre dans les phrases arabes.
- **Dans Claude, pour chaque boutique** (dans l'ordre des verdicts) : montrer la **photo** de ses modèles (fichiers du dossier `captures`), puis **sa ligne** du calcul (vagues, trous, en ligne, prix, réserves) et **ses pubs actives** : « Pubs actives : N » (champ `actives` de `resultat.json`), ou « Pubs actives : N (M lues) » quand la liste est coupée (`actives_lues`). Pas de noms de modèles sous la photo. Boutique sans photo : sa ligne seule. Le nombre de pubs actives est celui du moment du spy.
- **Sur Telegram (lancement automatique)** : `python3 spy_envoi.py <key> <chat_id> messages.txt` (avec `resultat.json`, `modeles.json` et `captures` à côté de `messages.txt` ; `WORKER_URL` et `CLE_AGENTS` en variables d'environnement) envoie, boutique par boutique dans l'ordre des verdicts, la **photo** de ses modèles puis **sa ligne** et **ses pubs actives**. Le `worker.js` fourni n'envoie que du texte : il refuse les photos et `spy_envoi.py` renvoie alors le même rapport en texte seul, même ordre (ligne + pubs actives de chaque boutique) ; les photos se voient dans Claude. `conclusion.txt` (2 ou 3 phrases en darija, à côté de `messages.txt`) part en dernier.
- **Sur Telegram (à la main)** : envoyer le contenu de `messages.txt` (messages séparés par `===`) au Worker :
```
curl -s -X POST "$WORKER_URL/spy/reponse" \
  -H "X-Cle: $CLE_AGENTS" -H "content-type: application/json" \
  -d '{"key":"<key de la demande>","chat_id":<chat_id>,"messages":[ "...", "..." ]}'
```
La clé `CLE_AGENTS` vient d'une variable d'environnement. **Elle n'est jamais écrite dans un fichier ni dans la conversation.**
La réponse doit contenir `"ok": true` et autant d'identifiants que de messages. Sinon : le dire, ne pas annoncer « envoyé ».

## LE MODE TELEGRAM — comment la demande arrive

1. Le client écrit `spy` → le robot montre 5 boutons ; ou il écrit directement `spy dz`.
2. Le Worker range la demande et répond « راني نخدم على SPY DZ ».
3. Une tâche planifiée Claude (toutes les 30 minutes, approuvée par le client) lit `GET $WORKER_URL/spy/demandes` avec l'en-tête `X-Cle`.
4. Pour chaque demande : étapes 1 à 7, puis `POST /spy/reponse` avec la `key` et le `chat_id` de la demande.
5. Le Worker envoie les messages et efface la demande.

## LIMITES À DIRE AU CLIENT, SANS LES CACHER

| Limite | Conséquence |
|---|---|
| La Ad Library ne donne ni budget, ni ventes, ni nombre d'adsets | On lit des décisions du vendeur, pas son chiffre |
| Le prix n'est lu que s'il est écrit dans le titre ou le texte de la pub | Sinon : « prix ? » |
| Le connecteur rend 50 pubs au plus | La page web les complète (étape 4 bis) ; s'il en manque encore : « liste coupée » |
| Les pubs lues sur la page web n'ont que le jour | « dates au jour près » sur la ligne |
| Un modèle n'existe que si le texte de la pub le nomme | « non nommés » ; on ne regroupe jamais à l'œil |
| Un modèle qui n'a que des vidéos | « vidéo seulement », pas de photo |
| Lire toutes les pages et capturer les photos prend du temps | Un spy dure environ deux fois et demie plus longtemps |
| TikTok n'a pas de bibliothèque de pubs pour ces pays | Pas d'analyse TikTok possible |
| Un trou peut aussi venir d'un compte bloqué ou d'un congé | Le verdict SANS STOCK est un signal fort, pas une preuve |

## LA RÈGLE DU PATRON

Zéro produit vaut mieux qu'un produit tiède. Si la récolte est mauvaise, le dire franchement.
