# Installer le mode Telegram de SPY — pas à pas

À faire **une seule fois**. Durée : 20 minutes. Rien ne coûte de l'argent (offre gratuite Cloudflare).

## Le schéma

| Qui | Fait quoi |
|---|---|
| Le client | Écrit `spy` ou `spy dz` au robot |
| Le robot (Worker Cloudflare) | Range la demande, puis envoie la réponse |
| L'agent Claude (tâche planifiée) | Lit les demandes, fait l'analyse, renvoie les messages |

Le robot ne fait **aucune** analyse : la Ad Library hors Europe ne se lit que depuis Claude, avec le connecteur Meta Ads.

## Étape 1 — Créer le robot

1. Dans Telegram, ouvrir **@BotFather**.
2. Envoyer `/newbot`, donner un nom, puis un identifiant qui finit par `bot`.
3. BotFather renvoie un **jeton**. Le garder pour l'étape 3, ne le coller nulle part ailleurs.
4. Ouvrir **@userinfobot** et noter son propre **identifiant** (un nombre).

## Étape 2 — Créer le Worker

1. Sur dash.cloudflare.com : **Workers & Pages** → **Create** → **Create Worker** → nom `spy-robot` → **Deploy**.
2. **Edit code** : tout effacer, coller le contenu de `worker.js`, **Deploy**.
3. **Storage & Databases** → **KV** → **Create** → nom `spy`.
4. Retour au Worker → **Settings** → **Bindings** → **Add** → **KV namespace** → nom de variable `SPY`, namespace `spy`.

## Étape 3 — Les 4 variables (Settings → Variables and Secrets)

| Nom | Valeur | Type |
|---|---|---|
| `BOT_TOKEN` | le jeton de BotFather | Secret |
| `SECRET_WEBHOOK` | une phrase inventée, sans espace | Secret |
| `CLE_AGENTS` | une autre phrase inventée, sans espace | Secret |
| `CHATS_AUTORISES` | l'identifiant de l'étape 1, plusieurs séparés par des virgules | Texte |

## Étape 4 — Brancher Telegram sur le Worker

Ouvrir cette adresse dans le navigateur, en remplaçant les 3 morceaux :
```
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://spy-robot.<compte>.workers.dev/telegram&secret_token=<SECRET_WEBHOOK>
```
La page doit répondre `"ok":true`.

## Étape 5 — Tester le robot

1. Écrire `spy` au robot → 5 boutons apparaissent.
2. Toucher **spy dz** → le robot répond « راني نخدم على SPY DZ ».
3. Ouvrir `https://spy-robot.<compte>.workers.dev/spy/demandes` : la page doit dire `interdit` (normal : la clé manque, c'est la protection).

## Étape 6 — Brancher l'agent Claude

1. Dans Claude, installer le plugin ecom manita (agent `/ecom-manita:spy`) et brancher le connecteur **Meta Ads**.
2. Créer une **tâche planifiée** toutes les 30 minutes avec cette consigne :
   > Lis les demandes SPY : `GET <WORKER_URL>/spy/demandes` avec l'en-tête `X-Cle` (variable `CLE_AGENTS`). Pour chaque demande, applique l'agent `/ecom-manita:spy` au pays demandé, puis renvoie les messages par `POST <WORKER_URL>/spy/reponse` avec sa `key` et son `chat_id`. S'il n'y a aucune demande, ne fais rien.
3. Mettre `WORKER_URL` et `CLE_AGENTS` dans les variables de l'environnement de la tâche, **jamais dans la consigne**.
4. Approuver la tâche.

## Contrôles déjà passés sur ces fichiers

| Fichier | Test | Résultat |
|---|---|---|
| `spy_calc.py` | 8 vendeurs réels à verdict connu + 4 pièges | PASSE |
| `worker.js` | 10 contrôles hors ligne, dont 4 pièges de sécurité | PASSE |

Relancer les tests : `python3 tests/test_spy.py` et `node tests/test_worker.mjs`.
