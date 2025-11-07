// Fichier de tests pour Pricing.gs

// Mock des dépendances globales (TARIFS)
const MOCK_TARIFS = {
  Normal: { base: 15, arrets: [5, 4, 3, 4, 5] },
  Urgent: { base: 20, arrets: [5, 4, 3, 4, 5] },
  Samedi: { base: 25, arrets: [5, 4, 3, 4, 5] },
};

/**
 * Remplace temporairement la constante TARIFS par la version mockée afin
 * d'exécuter un test déterministe, puis restaure l'état initial.
 */
function withMockTarifs(callback) {
  const hasExistingTarifs = typeof TARIFS !== 'undefined';
  const originalTarifs = hasExistingTarifs
    ? JSON.parse(JSON.stringify(TARIFS))
    : null;

  if (!hasExistingTarifs) {
    globalThis.TARIFS = JSON.parse(JSON.stringify(MOCK_TARIFS));
  } else {
    Object.keys(TARIFS).forEach(key => delete TARIFS[key]);
    Object.assign(TARIFS, JSON.parse(JSON.stringify(MOCK_TARIFS)));
  }

  try {
    return callback();
  } finally {
    if (hasExistingTarifs) {
      Object.keys(TARIFS).forEach(key => delete TARIFS[key]);
      Object.assign(TARIFS, originalTarifs);
    } else {
      delete globalThis.TARIFS;
    }
  }
}

// Fonction de test pour le bug de retour négatif
function testComputeCoursePriceV1_NegativeReturn() {
  withMockTarifs(() => {
    const opts = {
      totalStops: 1,
      retour: true,
      urgent: true,
      remise: 0,
    };

    // Exécution de la fonction à tester
    const result = computeCoursePriceV1_(opts);

    // Journalisation pour le débogage
    console.log('Résultat du test :', result);

    // Assertion
    if (result.total === 20) {
      console.log('SUCCESS: Le total est correct.');
    } else {
      console.error(`FAILURE: Total attendu de 20, mais obtenu ${result.total}`);
    }
  });
}
