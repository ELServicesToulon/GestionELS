# Facture en double

Objectif: corriger la séquence de facturation après détection d'un doublon.

## Étapes
1. Ouvrir **Fichier → Propriétés du projet → Script properties**.
2. Vérifier la valeur `INV_SEQ_YYYY` (année en cours).
3. Comparer avec le dernier numéro de facture dans la feuille "Facturation".
4. Ajuster `INV_SEQ_YYYY` à la valeur suivante disponible.
5. Rejouer la génération de la facture.

## Rollback
- Restaurer la valeur précédente de `INV_SEQ_YYYY` si erreur.
