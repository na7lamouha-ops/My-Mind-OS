---
name: dourahem
description: "À lancer avec /ecom-manita:dourahem dans une discussion neuve quand le client veut savoir ce que chaque modèle et chaque variante lui rapporte VRAIMENT (« الدراهم », « المالية تاع المنتجات ») : le bénéfice de Tassyir corrigé de la pub, de la commission et du retour, le STOCK RESTANT au prix d'achat, les jours de couverture et le cash net. Lecture seule."
---

# الدراهم (L'ARGENT) — ecomanita 0.4.2

Tu LIS Tassyir (et Meta si le client le demande), tu ne modifies RIEN : aucune dépense, aucune transaction, aucun stock.
Un bénéfice n'en est un qu'une fois ENCAISSÉ (mode « cash »).

## Ce que tu lis
- `get_variant_analytics` (Finance → Produits) : commandes, livrées, retours, prix d'achat, commission, frais de retour moyen,
  « bénéfice net » de Tassyir, par modèle et par variante. ⚠️ Cet outil ignore `storeId` : il rend tout le business.
- `get_inventory` : cinq totaux pour TOUT le business (`totalItems`, `totalValue`, `delivered`, `inTransit`, `damaged`).
  ⚠️ `totalItems` = tout ce qui est ENTRÉ depuis le début, PAS le stock. Le stock sur l'étagère, c'est
  `totalItems − delivered − inTransit − damaged`, ou la colonne « Sellable » de l'écran Inventaire de Tassyir (demande-la au
  client si un seul modèle t'intéresse : l'outil ne sépare pas les produits).
- `get_finance_summary`, `list_commissions`, `get_marketing_analytics` (la dépense pub, SANS storeId ; par campagne = par modèle).
- Les réglages du bureau : le prix du retour (« الرجوع ») et le taux du dollar du client.

## Ce que tu corriges, toujours, en le disant
1. **La pub** : le « bénéfice net » de Tassyir ne la retire pas. Tu retires la dépense de la campagne du modèle (une campagne =
   un modèle). Pas de dépense reliée → tu le dis, tu n'inventes pas de coût par lead.
2. **La commission** : sur les LIVRÉES seulement ; si Tassyir la compte sur toutes les commandes, tu montres les deux chiffres.
3. **Le retour** : au prix du client (réglage « الرجوع »). Tassyir compte 200 DA quand le tableau « معدلات الاسترجاع » est vide.
4. **Le stock** : les pièces DISPONIBLES (formule ci-dessus, jamais `totalItems` seul), au PRIX D'ACHAT. Exemple réel (NEXOR,
   25/10) : 90 entrées − 71 livrées − 6 chez le livreur − 1 perdue = **12 sur l'étagère** (30 000 DA) ; avec les 6 en route,
   18 × 2 500 = 45 000 DA = la valeur de Tassyir, juste. Lire 90 comme du stock donnait 225 000 DA et 115 jours : FAUX.
   La pièce en route n'est ni vendue ni sur l'étagère : tu la montres à part.

## Le rapport, par modèle
| | |
|---|---|
| Bénéfice sur le papier | après pub, commission juste et retour |
| **Cash net** | encaissé − toute la marchandise achetée − pub − retours − commissions |
| Stock au prix d'achat | pièces DISPONIBLES × prix d'achat (+ la ligne « en route », à part) |
| Jours de couverture | pièces disponibles ÷ livrées par jour |

**Les trois lignes du stock viennent TOUJOURS avec le bénéfice.**
- Couverture > 30 jours : aucune nouvelle production.
- > 45 jours : propose DESTOCK (deux pièces, prix plus bas, couleur avec couleur).
- Le bénéfice est « bloqué dans la marchandise » quand le cash net est négatif et le stock gros : tu le dis en une phrase.

## Ce que tu ne fais jamais
- Écrire une dépense, une transaction ou un stock.
- Présenter le « bénéfice net » de Tassyir comme le vrai bénéfice sans les trois corrections.
- Lire `totalItems` comme un stock.
