# Le jeton Meta du bureau (serveur Meta local) — facultatif

Sans jeton, le bureau parle à Meta par le connecteur claude.ai « Meta Ads » (comme avant). Avec un jeton d'**utilisateur système**, il parle à Meta par son propre petit serveur (`bureau/meta-mcp.mjs`), sur la machine du client : plus de connecteur qui se déconnecte en pleine mission.

Le jeton ne s'écrit **jamais dans le chat**. Le client le colle lui-même dans la page du bureau : onglet « التحضير », case « توكن ميتا », puis « افحص التوكن ». Collé quand même dans Telegram, le bureau efface le message du chat, ne le lit pas et répond où le coller ; collé dans le chat du coach ou une tâche du bureau, il est refusé (jamais envoyé à Claude).

## 1. L'app, en mode Développement
1. https://developers.facebook.com/apps → « Créer une app ».
2. Cas d'usage : « Autre » ; type : « Entreprise » (Business) ; un nom (ex. `ecom-manita-<boutique>`) ; le portefeuille business du client.
3. Dans l'app : ajouter le produit « API Marketing » (Marketing API).
4. L'app reste en mode **Développement** : aucune revue d'app n'est nécessaire pour agir sur les comptes du client lui-même. Le niveau d'accès de l'API Marketing « Limited » (le niveau de départ) suffit pour une mission normale : il limite seulement le nombre d'appels par heure.

## 2. L'utilisateur système
1. https://business.facebook.com/settings → Utilisateurs → **Utilisateurs système** → Ajouter.
2. Un nom (ex. `bureau-ecom-manita`), rôle **Employé**.
3. « Attribuer des éléments » :
   - **Comptes publicitaires** : le compte du test → contrôle total (gérer les campagnes) ;
   - **Pages** : la page des pubs → contrôle total (ou au moins créer des publicités) ;
   - **Pixels / jeux de données** : le pixel de la boutique → gérer.
4. **Applications** : l'app de l'étape 1 → ajouter l'utilisateur système (sinon le bouton du jeton ne la propose pas).

## 3. Le jeton
1. Utilisateur système → « Générer un nouveau jeton ».
2. Application : l'app de l'étape 1.
3. Expiration : **Jamais**.
4. Autorisations (cocher exactement) : `ads_management`, `ads_read`, `business_management`, `pages_read_engagement`, `pages_show_list`.
5. « Générer », puis copier le jeton.

## 4. Dans le bureau
1. http://localhost:4620 → onglet « التحضير » → case « توكن ميتا » : coller, puis « افحص التوكن » (ou « سجّل »).
2. La sonde lit trois choses (aucune écriture) : `GET /me`, le compte (`account_status`, `currency`, `name`), la page (`id`, `name`). Elle répond :
   - « التوكن يخدم مع الكونت و الصفحة » : bon ;
   - « التوكن غالط ولا فات وقتو » : jeton faux, révoqué ou expiré → en générer un nouveau ;
   - « ناقصو الحق على الكونت ولا الصفحة » : le compte ou la page n'est pas attribué à l'utilisateur système (étape 2.3) ;
   - « ميتا رافضة ولا ما راهيش تجاوب » : Meta refuse ou est indisponible → réessayer plus tard ;
   - « اختار الكونت و الصفحة قبل الفحص » : aucun compte ou aucune page dans les réglages → les lire d'abord (la sonde ne dit jamais « يخدم » sur `GET /me` seul).
   La sonde n'est verte que si Meta rend **le** compte et **la** page demandés (leurs ids), compte actif. La ligne « ميتا (التوكن) » de l'installation ne vaut que pour le jeton sondé : un jeton changé redevient « pas encore sondé ».
3. L'écriture se prouve à la vérification de l'installation (« افحص كلش ») : l'essai vidéo part par le jeton dans la bibliothèque du compte (aucune publicité). Jeton lu ET essai vidéo passés : la ligne « الكونيكتورات » n'exige plus le connecteur Meta claude.ai (Tassyir reste un connecteur). Avec un jeton posé, « جيب الكونتات » (comptes et pages) et « جيب الولايات » lisent aussi par le jeton. Un jeton posé mais refusé par Meta (sonde, ou essai vidéo refusé pour le jeton) met la ligne « الكونيكتورات » en ✗ même si le connecteur Meta claude.ai est branché : remplacez le jeton ou retirez-le.
4. La case n'affiche jamais le jeton : seulement `••••` et ses quatre derniers caractères. `GET /api/reglages` ne le rend jamais.

## 5. Révoquer et recoller
- Révoquer : Paramètres business → Utilisateurs système → l'utilisateur → « Révoquer les jetons ».
- Recoller : générer un nouveau jeton (étape 3), le coller dans « توكن ميتا », « افحص التوكن ».

## Ce que le serveur local fait, et ne fait pas
- Mêmes noms d'outils que le connecteur (`ads_get_ad_entities`, `ads_create_campaign`…), version de la Graph API épinglée (`VERSION_GRAPH` de `meta-mcp.mjs`, aujourd'hui v25.0).
- Tout ce qu'il crée naît **EN PAUSE** ; aucun plafond de dépense ni budget de vie (refusés même demandés) ; aucune suppression, aucune audience, aucun catalogue, aucun boost.
- L'activation n'est possible qu'avec la **porte** que le bureau pose après « لانسي », pour les objets de cette mission, une seule fois chacun.
- Dans un lot, la porte « لانسي » est GROUPÉE : une seule porte pour les ids de tous les modèles validés ensemble. L'heure de début (`start_time`) d'un ad set ne se pose qu'avec cette porte, seule dans la mise à jour (ni budget, ni statut), dans le futur et à sept jours au plus, puis elle est relue. NON PROUVÉ chez Meta jusqu'au premier vrai essai : qu'un ad set activé avec un `start_time` futur reste programmé sans dépenser avant l'heure.
- Au début de chaque mission, une vraie lecture décide du chemin (jeton qui marche → serveur local ; sinon → connecteur) ; la mission garde ce chemin jusqu'au bout (une panne passagère de Meta ne décide rien : on réessaie). Un refus de droits sur un objet d'un tour (pixel, page) n'est pas un jeton mort : l'étape échoue avec la réponse brute de Meta. Un jeton révoqué en route : la mission attend (« التوكن تاع ميتا ما بقاش يخدم »), aucun essai perdu, et reprend dès que la sonde repasse.
- La **pause** (arrêter la dépense) est la seule étape qui change de chemin, dans les deux sens : jeton mort → le connecteur ; connecteur tombé → le jeton, si une vraie lecture le prouve vivant. Elle ne fait que mettre EN PAUSE les objets du modèle (sur le jeton, le serveur refuse tout le reste pendant ce tour).
- Le **mode manuel** (`/ecom-manita:testing`, `scaling`, `coach`…) garde le connecteur claude.ai.
