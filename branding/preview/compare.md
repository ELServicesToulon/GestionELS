# Comparatif des modèles — ELS Theme (Phase 1)

| Modèle | Alignement marque (0–5) | Impact émotionnel (0–5) | Lisibilité / AA | Simplicité cognitive | Risques / Spécificité | Recommandation |
|---|---:|---:|---|---|---|---|
| A. Calm Clinical | 5 | 4 | AA élevé (texte sombre sur surfaces claires) | Faible charge, repères doux | Faible (sélecteurs `:where()`) | Idéal comptoir généraliste, adoption rapide |
| B. Trust Gradient | 5 | 4 | AA bon (vérifier textes sur gradient) | Moyenne (gradient saillant) | Moyen (fonds dégradés) | Pour visibilité marketing et mémorisation |
| C. Minimal Pro | 4 | 3 | AA++ (quasi monochrome) | Très élevée (peu de décors) | Très faible | Productivité maximale, contextes lumineux |
| D. Night Shift | 4 | 4 | AA dark (texte clair sur surfaces) | Élevée | Faible (media query dark) | Usage nocturne / arrière-boutique |

Notes
- Tous les modèles respectent la palette ELS stricte (gradient `#8e44ad → #3498db`, secondaire `#5dade2`), sans vert ni orange.
- Focus visible à 2 couches, reduced-motion respecté, spécificité basse.
- Le motif pilulier (alvéoles, onglets, capsules) est purement décoratif (backgrounds/gradients/masks) sans DOM additionnel en prod.

Stop gate
- Choisissez : A, B, C ou D

