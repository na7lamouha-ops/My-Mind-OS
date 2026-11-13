# archive/0.5 — sorti de « الطالب 1.0 » (27/10/2026), gardé pour 1.1

Décision du plan unifié (`chantier/student-1.0-pack/docs/01-plan-unifie-3-tujjar-v1.md`) : 1.0 = le code 0.4.2 corrigé,
pas de reconstruction depuis 0.5. Ce qui avait été construit pour 0.5 est rangé ici, intact, avec ses tests :

- `bureau/boucle.mjs` — un moteur de boucle pour tous les agents (état par pas, une question à la fois, carte « نعم », حبس).
- `bureau/agents/` — le chargeur et le القائد (agents/qaid) : routage Telegram, tags d'étape, « واش ندير اليوم ».
- `bureau/fiche-produit.mjs` — la fiche MBF-Mxx et ses passages d'étape.
- `bureau/verifier-agents.mjs` — leurs 20 contrôles (dont 4 sur le serveur entier).

Pour 1.1 : le prompt 0.5 se remappe sur les 11 joueurs. Ces fichiers attendent `ecomanita/bureau/` à côté d'eux
(imports `./telegram.mjs`, `./inspecteur.mjs`, `./boussala/pont.mjs`, `./regles-masar.mjs`, `./carnet.mjs`).
