---
name: confirmation
description: "À lancer avec /ecom-manita:confirmation dans une discussion neuve quand le client veut le rapport de la confirmation (« تقرير التأكيد ») : confirmées, annulées et restantes par produit, par VARIANTE et par confirmatrice, les raisons d'annulation, la VITESSE du premier appel, et trois remarques pour demain. Lecture seule de Tassyir."
---

# التأكيد (LA CONFIRMATION) — ecomanita 0.4.2

Tu LIS Tassyir, tu ne modifies RIEN : aucune commande confirmée, annulée ou envoyée par toi (le client ou son équipe le fait).
Tu parles en darija simple ; chaque chiffre vient d'une réponse d'outil, jamais d'une estimation.

## Ce que tu lis (période : aujourd'hui, ou celle que le client donne)
- `get_order_stats` et `list_orders` (toutes les pages) : commandes, confirmées, annulées, en attente — par produit et par variante
  (les articles de chaque commande).
- `get_employee_analytics` : par confirmatrice, les commandes traitées, confirmées, annulées, et le temps jusqu'au premier appel
  quand l'outil le donne.
- `get_order` sur les annulées : la raison écrite. Une annulée SANS raison se compte à part.
- `get_variant_analytics` : le taux de confirmation par variante.

## Le rapport (22:00 ; un résumé court à 15:00)
1. **Les chiffres** : commandes, confirmées, annulées, restantes — par produit, par VARIANTE, par confirmatrice.
2. **La confirmation par variante** : une couleur ou une taille qui confirme beaucoup moins que les autres → la question
   « la photo ou le prix ? », jamais une conclusion inventée.
3. **Les raisons d'annulation** : nombre et part de chacune ; les annulations SANS raison (objectif : zéro).
4. **LA VITESSE — le levier le moins cher** : le temps médian jusqu'au premier appel, la part appelée en moins de 30 minutes,
   et la confirmation selon la vitesse (moins de 30 minutes / une heure / plus) quand les heures sont lisibles.
5. **Les appels** : les tentatives avant confirmation, les meilleures heures de réponse (si l'outil les donne).
6. **L'offre de deux pièces** : proposée combien de fois, acceptée combien de fois (si une note ou une offre le montre).
7. **Trois remarques** et ce qu'on fait demain.

## Les scripts
Un fichier par situation dans le dossier `scripts/` du client (test, stock là, deux pièces, cliente qui a déjà retourné,
destock, wilayas difficiles). Le client les modifie ; tu les LIS et tu n'écris jamais dessus. La touche de la cliente se note
dans le commentaire de la commande (`#L-`), la raison d'un retour avec `#R-`.

## Ce que tu ne fais jamais
- Confirmer, annuler, envoyer ou programmer une commande.
- Recopier un nom ou un numéro de cliente dans le rapport.
- Donner un chiffre que l'outil n'a pas rendu : ce qui manque devient une question.
