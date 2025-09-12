// =================================================================
//                      SUITE DE TESTS (DEBUG)
// =================================================================
// Description: Ce fichier contient des fonctions pour tester l'ensemble
//              des fonctionnalités du back-office. Exécutez la fonction
//              'lancerTousLesTests' pour un rapport complet.
// =================================================================

// --- CONFIGURATION DES TESTS ---
// Utilisez un client de test pour ne pas modifier les vraies données.
const TEST_CLIENT = {
  email: "test.client@example.com",
  nom: "Pharmacie de Test",
  adresse: "123 Rue du Test, 75000 Paris",
  siret: "12345678901234",
  typeRemise: "Pourcentage",
  valeurRemise: 10,
  nbTourneesOffertes: 2
};

const ADMIN_TEST_EMAIL = ADMIN_EMAIL; // Utilise l'email admin de la configuration

/**
 * Fonction principale pour exécuter tous les tests séquentiellement.
 */
function lancerTousLesTests() {
  Logger.log("===== DÉBUT DE LA SUITE DE TESTS COMPLÈTE =====");

  testerValidationConfiguration();
  testerCacheConfiguration();
  testerFlagsSerialization();
  testerCoherenceTarifs();
  testerComputeCoursePriceTarifVide();
  testerUtilitaires();
  testerFeuilleCalcul();
  testerCalendrier();
  testerReservation();
  testerGestionClient();
  testerAdministration();
  testerMaintenance();
  testerAuditDrive();

  Logger.log("===== FIN DE LA SUITE DE TESTS COMPLÈTE =====");
  // SpreadsheetApp.getUi().alert("Tests terminés. Consultez les journaux (Logs) pour les résultats détaillés.");
}


// =================================================================
//                      SUITES DE TESTS INDIVIDUELLES
// =================================================================

function testerValidationConfiguration() {
  Logger.log("\n--- Test de Validation.gs ---");
  try {
    validerConfiguration();
    Logger.log("SUCCESS: validerConfiguration() s'est exécutée sans erreur.");
  } catch (e) {
    Logger.log(`FAILURE: validerConfiguration() a échoué. Erreur: ${e.message}`);
  }
}

function testerCacheConfiguration() {
  Logger.log("\n--- Test de getConfigCached() ---");
  CacheService.getScriptCache().remove('CONFIG_JSON');
  const conf1 = getConfigCached();
  const conf2 = getConfigCached();
  Logger.log(`Premier appel TARIFS.Normal.base=${conf1.TARIFS.Normal.base}`);
  Logger.log(`Deuxième appel (cache) TARIFS.Normal.base=${conf2.TARIFS.Normal.base}`);
  CacheService.getScriptCache().remove('CONFIG_JSON');
  const conf3 = getConfigCached();
  Logger.log(`Après invalidation TARIFS.Normal.base=${conf3.TARIFS.Normal.base}`);
}

function testerFlagsSerialization() {
  Logger.log("\n--- Test de sérialisation des flags ---");
  const flags = getConfiguration();
  const expected = Object.keys(FLAGS).sort();
  const received = Object.keys(flags).sort();
  const missing = expected.filter(k => !received.includes(k));
  const extra = received.filter(k => !expected.includes(k));
  if (missing.length === 0 && extra.length === 0) {
    Logger.log("SUCCESS: getConfiguration() expose tous les flags.");
  } else {
    if (missing.length) {
      Logger.log(`FAILURE: Flags manquants - ${missing.join(', ')}`);
    }
    if (extra.length) {
      Logger.log(`FAILURE: Flags inattendus - ${extra.join(', ')}`);
    }
  }
}

function testerCoherenceTarifs() {
  Logger.log("\n--- Test de cohérence des TARIFS dans Configuration.gs ---");
  const conf = getPublicConfig();
  const types = ['Normal', 'Samedi', 'Urgent'];
  types.forEach(type => {
    const tarif = conf.TARIFS && conf.TARIFS[type];
    if (tarif && typeof tarif.base === 'number') {
      Logger.log(`SUCCESS: TARIFS.${type}.base = ${tarif.base}`);
    } else {
      Logger.log(`FAILURE: TARIFS.${type}.base manquant ou invalide`);
    }
  });
}

function testerComputeCoursePriceTarifVide() {
  Logger.log("\n--- Test de computeCoursePrice() avec TARIFS vide ---");
  const backup = JSON.parse(JSON.stringify(TARIFS));
  try {
    Object.keys(TARIFS).forEach(k => delete TARIFS[k]);
    const res = computeCoursePrice({ totalStops: 2 });
    if (res && typeof res.total === 'number') {
      Logger.log('SUCCESS: computeCoursePrice() ne jette pas d\'exception avec TARIFS vide.');
    } else {
      Logger.log('FAILURE: computeCoursePrice() n\'a pas retourné de résultat valide avec TARIFS vide.');
    }
  } catch (e) {
    Logger.log(`FAILURE: computeCoursePrice() a levé une exception avec TARIFS vide: ${e.message}`);
  } finally {
    Object.assign(TARIFS, backup);
  }
}

function testerUtilitaires() {
  Logger.log("\n--- Test de Utilitaires.gs ---");
  const testDate = new Date(2025, 9, 31, 14, 30); // 31 Octobre 2025, 14:30
  
  // Test formaterDateEnYYYYMMDD
  const yyyymmdd = formaterDateEnYYYYMMDD(testDate);
  if (yyyymmdd === "2025-10-31") {
    Logger.log("SUCCESS: formaterDateEnYYYYMMDD()");
  } else {
    Logger.log(`FAILURE: formaterDateEnYYYYMMDD(). Attendu: "2025-10-31", Obtenu: "${yyyymmdd}"`);
  }

  // Test formaterDateEnHHMM
  const hhmm = formaterDateEnHHMM(testDate);
  if (hhmm === "14h30") {
    Logger.log("SUCCESS: formaterDateEnHHMM()");
  } else {
    Logger.log(`FAILURE: formaterDateEnHHMM(). Attendu: "14h30", Obtenu: "${hhmm}"`);
  }
}

function testerFeuilleCalcul() {
  Logger.log("\n--- Test de FeuilleCalcul.gs ---");
  
  // Test enregistrerOuMajClient (création)
  enregistrerOuMajClient(TEST_CLIENT);
  const clientCree = obtenirInfosClientParEmail(TEST_CLIENT.email);
  if (clientCree && clientCree.nom === TEST_CLIENT.nom) {
    Logger.log("SUCCESS: enregistrerOuMajClient() - Création");
  } else {
    Logger.log("FAILURE: enregistrerOuMajClient() - Création");
  }

  // Test decrementerTourneesOffertesClient
  decrementerTourneesOffertesClient(TEST_CLIENT.email);
  const clientMaj = obtenirInfosClientParEmail(TEST_CLIENT.email);
  if (clientMaj && clientMaj.nbTourneesOffertes === TEST_CLIENT.nbTourneesOffertes - 1) {
     Logger.log("SUCCESS: decrementerTourneesOffertesClient()");
  } else {
     Logger.log(`FAILURE: decrementerTourneesOffertesClient(). Attendu: ${TEST_CLIENT.nbTourneesOffertes - 1}, Obtenu: ${clientMaj ? clientMaj.nbTourneesOffertes : 'N/A'}`);
  }
  // Remettre la valeur initiale
  enregistrerOuMajClient(TEST_CLIENT);
}

function testerCalendrier() {
  Logger.log("\n--- Test de Calendrier.gs ---");
  const demain = new Date();
  demain.setDate(demain.getDate() + 1);
  const dateTest = formaterDateEnYYYYMMDD(demain);

  const creneaux = obtenirCreneauxDisponiblesPourDate(dateTest, 30);
  if (Array.isArray(creneaux)) {
    Logger.log(`SUCCESS: obtenirCreneauxDisponiblesPourDate() a retourné ${creneaux.length} créneaux pour demain.`);
  } else {
    Logger.log("FAILURE: obtenirCreneauxDisponiblesPourDate() n'a pas retourné un tableau.");
  }

  const calPublic = obtenirDonneesCalendrierPublic(demain.getMonth() + 1, demain.getFullYear());
  if (calPublic && typeof calPublic.disponibilite === 'object') {
     Logger.log("SUCCESS: obtenirDonneesCalendrierPublic()");
  } else {
     Logger.log("FAILURE: obtenirDonneesCalendrierPublic()");
  }
}

function testerReservation() {
  Logger.log("\n--- Test de Reservation.gs ---");
  const demain = new Date();
  demain.setDate(demain.getDate() + 1);
  const dateTest = formaterDateEnYYYYMMDD(demain);

  const calcul = calculerPrixEtDureeServeur(2, true, dateTest, "10h00", TEST_CLIENT);
  if (calcul && typeof calcul.prix === 'number' && typeof calcul.duree === 'number') {
    Logger.log(`SUCCESS: calculerPrixEtDureeServeur(). Prix calculé: ${calcul.prix.toFixed(2)}€, Durée: ${calcul.duree}min.`);
  } else {
    Logger.log("FAILURE: calculerPrixEtDureeServeur()");
  }

}

function testerGestionClient() {
  Logger.log("\n--- Test de Gestion.gs ---");
  const validation = validerClientParEmail(TEST_CLIENT.email, '', '');
  if (validation && validation.success) {
    Logger.log("SUCCESS: validerClientParEmail()");
  } else {
    Logger.log(`FAILURE: validerClientParEmail(). Erreur: ${validation.error}`);
  }
}

function testerAdministration() {
  Logger.log("\n--- Test de Administration.gs ---");
  const demain = new Date();
  demain.setDate(demain.getDate() + 1);
  const dateTest = formaterDateEnYYYYMMDD(demain);

  // Simuler l'exécution en tant qu'admin
  const reponse = obtenirToutesReservationsPourDate(dateTest);
  if (reponse && reponse.success) {
    Logger.log(`SUCCESS: obtenirToutesReservationsPourDate() a trouvé ${reponse.reservations.length} réservations.`);
  } else {
    Logger.log(`FAILURE: obtenirToutesReservationsPourDate(). Erreur: ${reponse.error}`);
  }
}

function testerMaintenance() {
  Logger.log("\n--- Test de Maintenance.gs ---");
  logAdminAction("TEST", "Test de la fonction de log");
  Logger.log("SUCCESS: logAdminAction() exécuté. Vérifiez l'onglet Admin_Logs.");

  notifyAdminWithThrottle("TEST_ERREUR", "Email de test", "Ceci est un test de la fonction de notification.");
  Logger.log("SUCCESS: notifyAdminWithThrottle() exécuté. Vérifiez votre boîte de réception.");
}

function testerAuditDrive() {
  Logger.log("\n--- Test de lancerAuditDrive() ---");
  try {
    lancerAuditDrive();
    Logger.log("SUCCESS: lancerAuditDrive() s'est exécutée sans erreur.");
  } catch (e) {
    Logger.log(`FAILURE: lancerAuditDrive() a échoué. Erreur: ${e.message}`);
  }
}

/**
 * Exécute tous les tests et retourne le contenu du Logger pour l'afficher côté client.
 * @returns {string} Les logs générés par la suite de tests.
 */
function lancerTousLesTestsEtRetournerLogs() {
  // Vide le logger pour cette session de test
  Logger.clear();
  
  // Lance la suite de tests
  lancerTousLesTests();
  
  // Retourne le contenu des logs
  return Logger.getLog();
}
