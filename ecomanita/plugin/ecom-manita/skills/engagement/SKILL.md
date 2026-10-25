---
name: engagement
description: "À lancer avec /ecom-manita:engagement dans une discussion neuve quand le client veut savoir quels modèles de vêtement font beaucoup de vues sur Instagram (« engagement », « spy profils », « spy instagram ») : toutes les vidéos de plus de 200 000 vues des 30 derniers jours sur une liste de profils, lues avec l'API officielle de Meta (Business Discovery), en lecture seule, sans rien publier ni toucher à aucun compte."
---

# ENGAGEMENT — les vidéos vêtement qui dépassent 200 000 vues

## CE QUE FAIT L'AGENT, ET CE QU'IL NE FAIT PAS

| Il fait | Il ne fait PAS |
|---|---|
| Lire les publications publiques de profils Instagram **professionnels**, par l'API officielle de Meta | Publier, aimer, commenter, suivre, écrire un message |
| Garder toutes les vidéos de plus de 200 000 vues de la période, même une seule par profil | Se connecter à un compte Instagram avec un mot de passe |
| Classer les profils : nombre de vidéos, puis total de vues | Toucher à un compte publicitaire, une page ou une boutique |
| Livrer un fichier texte de liens et une page HTML cliquable | Télécharger les vidéos des autres (seulement la petite image de couverture, pour la page) |
| Vérifier le résultat par deux méthodes | Dire qu'un modèle « vend » : il donne des **vues**, pas des ventes |
| S'arrêter proprement quand Meta limite, et reprendre là où il s'est arrêté | Afficher, copier ou demander la clé dans la conversation |

## CE QU'IL FAUT AVOIR

| Élément | Pourquoi |
|---|---|
| Python 3.8 ou plus récent (Mac : `python3` ; Windows : `py` ou `python`) | Pour `spy_engagement.py`. Rien d'autre à installer : bibliothèque standard seulement |
| Un compte Instagram **professionnel** du client, relié à une **page Facebook** | Meta n'ouvre Business Discovery qu'à un compte pro |
| Une **application Meta** du client et son **jeton** | La clé qui autorise la lecture, remplie par le client dans `ig-spy.json` |
| Une liste de profils Instagram à lire | L'API lit un profil par son nom exact ; elle ne cherche pas toute seule |

## LES FICHIERS

| Fichier | Rôle |
|---|---|
| `spy_engagement.py` | Le script : préparer, tester la clé, lire, trier, livrer, vérifier |
| `signes_vente.py` | En option : régularité, commentaires pour 1 000 vues, « pub ? » (aucun appel Meta) |
| `tests/test_engagement.py` | Les essais, avec des réponses Meta simulées |

Le **dossier de travail** du client est `ecom-manita-engagement`, dans son dossier personnel (Mac et Windows), créé par la commande `preparer`. Il contient :

| Dans le dossier de travail | Contenu |
|---|---|
| `ig-spy.json` | La clé : `{"ig_user_id": "...", "jeton": "..."}`. **Le client la remplit lui-même.** |
| `profils.txt` | Un profil par ligne : `nom`, `@nom` ou le lien du profil |
| `run-mois/brut/` | Les réponses brutes de Meta, un fichier par profil (sert à la reprise et à la vérification) |
| `run-mois/images/` | Les couvertures des vidéos gardées (le lien de Meta expire, on les copie pendant la lecture) |
| `run-mois/videos-200k.txt` | La livraison texte |
| `run-mois/modeles.html` | La livraison cliquable |
| `run-mois/resultat.json` | Le tri complet |

## LA CLÉ DU CLIENT — étapes à lui donner une par une

La clé ne passe **jamais** par la conversation. Si le client colle un jeton dans le chat : ne pas le répéter, lui dire de le mettre dans `ig-spy.json` et, par prudence, d'en refaire un (étape 6).

1. **Compte Instagram professionnel.** Dans l'application Instagram : Paramètres → Type de compte et outils → Passer à un compte professionnel (Entreprise ou Créateur). Gratuit.
2. **Page Facebook reliée.** Depuis la page Facebook du client : Paramètres → Comptes liés → Instagram → Connecter. (Ou dans Meta Business Suite.) Sans page reliée, l'API ne voit pas le compte.
3. **Application Meta.** Sur `developers.facebook.com` : se connecter avec le compte Facebook qui gère la page → Mes apps → Créer une app → type **Entreprise** (Business). L'app peut rester en mode développement : le client en est l'administrateur, cela suffit pour lire.
4. **Jeton.** Ouvrir l'**Explorateur de l'API Graph** (`developers.facebook.com/tools/explorer`) → choisir son app → « Jeton d'accès utilisateur » → cocher les autorisations `instagram_basic`, `pages_show_list`, `pages_read_engagement` et `business_management` → Générer → accepter et choisir **sa** page et **son** compte Instagram.
5. **Identifiant Instagram.** Dans le même explorateur, faire la requête `me/accounts?fields=name,instagram_business_account` → le nombre sous `instagram_business_account` → `id` est le `ig_user_id`.
6. **Jeton de longue durée.** Ouvrir l'**Outil de débogage du jeton d'accès** (`developers.facebook.com/tools/debug/accesstoken`), coller le jeton → « Étendre le jeton d'accès ». Il dure environ 60 jours ; quand il expire, le script le dit (`JETON REFUSÉ`, erreur #190) et on refait les étapes 4 et 6.
7. **Remplir le fichier.** Ouvrir `ig-spy.json` du dossier de travail avec un éditeur de texte (Mac : TextEdit en texte brut ; Windows : Bloc-notes), remplacer `COLLE-TON-ID-ICI` par l'identifiant et `COLLE-TON-JETON-ICI` par le jeton, garder les guillemets, enregistrer.
8. **Tester.** L'agent lance `cle` : `PASSE · clé valide · compte relié @...`. Le jeton n'est jamais affiché.

Les noms des écrans Meta changent parfois. Si un bouton n'a pas le même nom, chercher l'écran le plus proche ; l'étape 8 dit si la clé marche.

## LA LISTE DE PROFILS

- Le client donne des profils de **vêtement** : boutiques, ateliers, marques (abayas, caftans, robes, ensembles, hijabs, enfants…). Un nom par ligne dans `profils.txt`, ou collés dans le chat : l'agent les écrit lui-même dans le fichier.
- Nom, `@nom` ou lien `https://www.instagram.com/nom/` : tout est accepté. Les doublons sont retirés, les lignes qui ne sont pas des noms sont signalées.
- **Ne jamais inventer un nom de profil.** Pour élargir la liste à partir des profils déjà lus : commande `mentions` (les @profils cités dans les légendes), puis le client choisit ce qu'il garde.
- Conseil : des lots de 150 profils au plus, ceux qui publient le plus de modèles d'abord.

## LES COMMANDES

Le script est dans le dossier de cette skill. Sur Windows, écrire `py` à la place de `python3`. Tous les chemins sont optionnels : par défaut, le dossier de travail.

| But | Commande |
|---|---|
| Préparer le dossier de travail (n'écrase rien) | `python3 spy_engagement.py preparer` |
| Tester la clé (un appel) | `python3 spy_engagement.py cle` |
| Tout faire : lire, livrer, vérifier | `python3 spy_engagement.py tout` |
| Lire seulement | `python3 spy_engagement.py lire [profils.txt] [dossier du run]` |
| Livrer (txt + HTML + json) | `python3 spy_engagement.py livrer [dossier du run]` |
| Vérifier par la deuxième méthode | `python3 spy_engagement.py verifier [dossier du run]` |
| Profils cités, pas encore lus | `python3 spy_engagement.py mentions` |
| Signes de vente (option) | `python3 signes_vente.py` |

Options : `--travail DOSSIER` (autre dossier de travail), `--periode mois|3mois|saison` (défaut `mois` = 30 jours ; `3mois` = 90 jours ; `saison` = la même saison l'an passé, beaucoup plus d'appels Meta), `--min-videos N` (défaut 1), `--relire-erreurs`.

**Ce que fait la lecture, sans que personne n'intervienne :**
- 10 à 15 secondes entre deux profils.
- Après chaque appel, le script lit le compteur de Meta (en-têtes `X-App-Usage` et `X-Business-Use-Case-Usage`). S'il **dépasse 75 %**, pause de 15 minutes, puis reprise toute seule.
- Si Meta bloque quand même (erreurs **#4, #17, #32, #613**) : attente de 20 minutes et nouvel essai, deux fois ; puis **arrêt propre** (code 3) avec le message « relancer la même commande plus tard ». Rien n'est perdu.
- **Reprise :** un profil déjà lu (depuis moins de 3 jours) n'est pas relu ; un compte personnel ou un nom faux n'est pas relu non plus (sauf `--relire-erreurs`). Relancer la même commande reprend là où ça s'est arrêté.
- Jeton refusé (#190) : arrêt tout de suite (code 2), refaire le jeton.

Une lecture longue peut durer des heures : la lancer en tâche de fond et revenir quand elle a fini. Si elle s'arrête sur la limite, relancer plus tard la même commande (`tout`), qui livre à nouveau avec tout ce qui a été lu.

## LA RÈGLE DU TRI

- Une vidéo compte si c'est un Reel ou une vidéo, publiée dans la période, avec **plus de** 200 000 vues (200 000 pile ne compte pas).
- Une vidéo dont Meta ne donne pas les vues n'est **jamais** comptée (elle est signalée à part, dans `vues_non_lues`).
- Un profil est gardé dès **une** vidéo au-dessus du seuil (`MIN_VIDEOS = 1`).
- Classement : nombre de vidéos, puis total de vues.
- Le pays n'est écrit que s'il est **lu** dans la bio ou le site (indicatif, nom du pays, ville), avec le mot qui l'a montré. Jamais deviné.

## LA LIVRAISON

1. `videos-200k.txt` : un bloc par profil, dans l'ordre du classement, puis une ligne par vidéo : `vues · date · lien`.
2. `modeles.html` : la page à ouvrir d'un double-clic. Groupée par profil, chaque vidéo avec sa couverture, ses vues et sa date ; un clic ouvre la vidéo sur Instagram.
3. Dans Claude : un tableau (Rang · Profil avec lien · Vidéos · Total vues · Pays lu), le chemin des deux fichiers, le nombre de profils lus et en erreur, puis deux ou trois phrases en darija, **sans aucun chiffre dans les phrases arabes**.

## LA VÉRIFICATION — deux méthodes, avant de dire « c'est fait »

1. **Le script, deux calculs.** `verifier` recompte directement le brut, avec un code écrit à part du tri, et compare : même nombre de profils, mêmes vidéos (identifiants), autant de lignes dans le `.txt` et de cartes dans la page HTML. Il doit écrire `PASSE`. Sinon : ne rien livrer, relancer `livrer` puis `verifier`, et dire ce qui ne colle pas.
2. **À l'œil.** Si un navigateur est disponible : ouvrir trois liens de la page (le premier, un du milieu, le dernier) et vérifier sur Instagram que la vidéo existe et que ses vues sont au-dessus de 200 000 (Instagram arrondit : « 1,2 M »). Sans navigateur, l'écrire : « vérification à l'œil : NON VÉRIFIABLE ».

## LIMITES À DIRE AU CLIENT, SANS LES CACHER

| Limite | Conséquence |
|---|---|
| Le `view_count` de Meta **mélange** vues payantes et organiques | Une vidéo à un million peut avoir été poussée par la pub. `signes_vente.py` marque « pub ? » quand presque toutes les vidéos d'un profil passent le seuil : un signe, pas une preuve |
| Meta limite les appels par heure et compte aussi le temps de calcul | Souvent quelques dizaines de profils par heure ; un lot de 150 peut demander plusieurs passages, avec les pauses automatiques |
| Seuls les comptes **professionnels** (Entreprise ou Créateur) sont lisibles | Un compte personnel sort en erreur, listée dans le résultat |
| Des vues, des j'aime, des commentaires : pas de ventes | Seul un test chez le client, lu sur les commandes livrées, prouve qu'un modèle est rentable |
| Le jeton dure environ 60 jours | Refaire les étapes 4 et 6 de la clé quand le script dit `JETON REFUSÉ` |
| Les écrans de Meta et la version de l'API changent | Le script utilise la version `v21.0` ; si Meta la retire, ajouter `"version_api": "v2X.0"` dans `ig-spy.json` |
| Sur Mac, un Python pris sur python.org peut refuser la connexion à Meta (CERTIFICATE_VERIFY_FAILED) | Lancer une fois « Install Certificates.command » du dossier Python dans Applications, puis relancer |
| `saison` et `3mois` lisent plus loin dans chaque profil | Beaucoup plus d'appels ; une vieille vidéo a eu plus de temps pour ses vues : comparer une saison avec une saison |

## LA PREUVE

`python3 -B -I tests/test_engagement.py` (Windows : `py -B -I tests\test_engagement.py`) rejoue, avec des réponses Meta simulées et sans aucun appel réseau : le tri au-dessus de 200 000 sur 30 jours, les vues absentes jamais comptées, `MIN_VIDEOS = 1`, la pause sur le compteur au-delà de 75 %, l'arrêt propre sur #4, #17, #32 et #613, la reprise sans relire, le jeton jamais affiché, la livraison et la vérification. Il doit finir par `RÉSULTAT GLOBAL : PASSE`.

## LA RÈGLE DU PATRON

Zéro vidéo vaut mieux qu'une vidéo inventée. Si la récolte est maigre, le dire franchement.
