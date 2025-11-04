// Fichier de tests pour Pricing.gs

// Mock des dépendances globales (TARIFS)
const TARIFS = {
  Normal: { base: 15, arrets: [5, 4, 3, 4, 5] },
  Urgent: { base: 20, arrets: [5, 4, 3, 4, 5] },
  Samedi: { base: 25, arrets: [5, 4, 3, 4, 5] },
};

// Fonction de test pour le bug de retour négatif
function testComputeCoursePriceV1_NegativeReturn() {
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
}
