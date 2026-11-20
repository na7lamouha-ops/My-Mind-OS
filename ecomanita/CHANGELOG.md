# ecomanita — CHANGELOG

## 0.5.0 (en construction, agent par agent)

### Repris de 0.3.9-windows (branche parallèle, jamais fusionnée dans 0.4.x)
- **ffmpeg / ffprobe sans figer le bureau** (`missions.executer`, `sonderA`, `quelMoteurA`, `compterMusiquesA`) : le montage,
  les vignettes, la lecture des planches et la photo du modèle ne bloquent plus l'écoute Telegram ni la page.
- **Renommer sous Windows** (`renommerSur`) : un antivirus qui tient le fichier un instant (EPERM / EACCES / EBUSY) ne casse
  plus `mission.json`, `chaine.json` ni `lot.json`. Ailleurs, rien ne change.
- **Les erreurs Meta connues** (`erreurMetaConnue`) : paiement, impayé, compte désactivé, limite de dépense, droits — dites en
  darija avec l'action, aucun essai consommé, la mission attend « عاود » ; un compte que Meta dit bloqué est refusé à la
  question du compte, avant le montage.
- **Les photos du shooting pour la page** (`couleurDePhoto`, `listerPhotos`) : la couleur lue dans le nom du fichier, les photos
  préparées (EXIF, 2000 px, ≤ 450 Ko) ; les images tirées des vidéos seulement en complément, et le client le lit.
- Et `avancer()` ne fait plus tomber le serveur sur une erreur hors étape (même hunk que l'async).
- **Pas repris** (en attente d'une décision) : réseau Telegram (réessais, écoute non bloquante), « ids » de Meta v26, vidéos sans
  POV, « كيما المرة اللي فاتت », temps du montage, qualité des vidéos, couleurs des planches, guide à l'écran, DNS Cloudflare,
  et le reste de l'installeur Windows.

### Étape 0 — les fondations + le القائد
- **La boussole 29.18 dans le bureau** : `bureau/boussala/` (copiée telle quelle de `chantier/ecomanita-masar/boussala`, CommonJS,
  `package.json` local `type: commonjs`). Le pont `boussala/pont.mjs` rejoue le golden dans le processus (6/6), appelle les
  23 outils, et refuse tout calcul quand le golden n'est pas 6/6 (« العقل ما راهوش »). La ligne « العقل : البوصلة » s'ajoute à
  التحضير, et le démarrage le dit dans le journal (et sur Telegram s'il manque).
- **Les petites règles** : `bureau/regles-masar.mjs`, port ESM de `masar.js` (13 fonctions, les 26 contrôles rejoués).
- **La boucle** : `bureau/boucle.mjs`, un seul moteur pour tous les agents — lire → prérequis (une question à la fois) →
  exécuter (écriture = carte « نعم ») → vérifier (relire) → carnet + rapport (loi de forme) → porte (carte du القائد + « نعم »).
  État écrit après chaque pas (`carnet/etat/<id>.json`), reprise après coupure, clé anti-doublon des écritures, même erreur
  ×3 → `bloque`, plafond de cycles par jour, « حبس » / « حبس الكل » / « شعّل ». Une écriture sans le jeton d'une carte acceptée
  est refusée par le connecteur lui-même.
- **La fiche produit partagée** : `bureau/fiche-produit.mjs` → `carnet/produits/MBF-Mxx.json` ; les passages d'étape permis
  (TEST → VALIDE → SCALE → DESTOCK, ECHEC-ADS / ECHEC-CONF / RESERVE), seulement par le القائد et avec « نعم ».
- **Les agents** : `bureau/agents/<id>/{agent.json, agent.mjs, prompt.md}`, chargés et validés par `agents/index.mjs`
  (un contrat faux n'est jamais chargé).
- **Le القائد** (`agents/qaid`) : route les phrases Telegram vers l'agent concerné (un agent pas encore construit garde le
  chemin de 0.4.2), tient l'étape de chaque modèle, écrit la carte du tag (relit les anciens tags, garde SRC-/PRF-, écrit après
  « نعم », relit), « واش ندير اليوم » à 08:00 (trois choses, l'argent d'abord), « وين راني », le portefeuille (test / scale /
  réserve, signal de faiblesse → le successeur). Il ne calcule rien.
- **Le serveur** : les boutons `b:<agent>:<action>` et les phrases passent par la boucle (le travail en arrière-plan, l'écoute
  n'est jamais sourde), l'horloge des agents chaque minute, `/api/agents` pour la page.
- **L'épreuve** : `bureau/verifier-agents.mjs` (+20 contrôles, appelés par `verifier.mjs`), dont 4 sur le serveur entier avec
  un faux Telegram.
