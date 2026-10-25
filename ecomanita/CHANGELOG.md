# ecomanita — CHANGELOG

## 0.5.0 (en construction, agent par agent)

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
