// =================================================================
//                        POINT D'ENTRÉE & MENUS
// =================================================================
// Description: Contrôleur principal qui gère les menus dans le Google
//              Sheet et les requêtes web pour afficher les interfaces.
// =================================================================

/**
 * S'exécute à l'ouverture du Google Sheet pour créer les menus.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const menuPrincipal = ui.createMenu('EL Services')
      .addItem('Générer les factures sélectionnées', 'genererFactures')
      .addItem('Envoyer les factures contrôlées', 'envoyerFacturesControlees')
      .addItem("Archiver les factures du mois dernier", "archiverFacturesDuMois")
      .addSeparator()
      .addItem("Vérifier la cohérence du calendrier", "verifierCoherenceCalendrier");

  const sousMenuMaintenance = ui.createMenu('Maintenance')
      .addItem("Sauvegarder le code du projet", "sauvegarderCodeProjet")
      .addItem("Sauvegarder les données", "sauvegarderDonnees")
      .addItem("Vérifier structure des feuilles", "menuVerifierStructureFeuilles")
      .addItem("Purger les anciennes données (RGPD)", "purgerAnciennesDonnees");

     
  const sousMenuDebug = ui.createMenu('Debug')
      .addItem("Lancer tous les tests", "lancerTousLesTests")
      .addItem("Tester audit Drive", "testerAuditDrive");


  sousMenuMaintenance.addItem("Nettoyer l'onglet Facturation", "nettoyerOngletFacturation");
  sousMenuMaintenance.addItem("Reparer entetes Facturation", "reparerEntetesFacturation");
  if (CALENDAR_RESYNC_ENABLED) {
    sousMenuMaintenance.addItem("Resynchroniser événement manquant", "menuResynchroniserEvenement");
  }
  if (CALENDAR_PURGE_ENABLED) {
    sousMenuMaintenance.addItem("Purger Event ID introuvable", "menuPurgerEventId");
  }
  menuPrincipal.addSubMenu(sousMenuMaintenance);

  if (DEBUG_MENU_ENABLED) {
    const sousMenuDebug = ui.createMenu('Debug')
        .addItem("Lancer tous les tests", "lancerTousLesTests");
    menuPrincipal.addSubMenu(sousMenuDebug);
  }

  menuPrincipal.addToUi();
}

/**
 * S'exécute lorsqu'un utilisateur accède à l'URL de l'application web.
 * Fait office de routeur pour afficher la bonne page.
 * @param {Object} e L'objet d'événement de la requête.
 * @returns {HtmlOutput} Le contenu HTML à afficher.
 */
function doGet(e) {
  try {
    if (REQUEST_LOGGING_ENABLED) {
      logRequest(e);
    }
    // validerConfiguration(); // Assurez-vous que cette fonction existe ou commentez-la si non utilisée

    // Routeur de page
    if (e.parameter.page) {
        switch (e.parameter.page) {
            case 'admin':
                const adminEmail = Session.getActiveUser().getEmail();
                if (adminEmail && adminEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
                    const template = HtmlService.createTemplateFromFile('Admin_Interface');
                    return template.evaluate().setTitle("Tableau de Bord Administrateur").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
                } else {
                    return HtmlService.createHtmlOutput('<h1>Accès Refusé</h1><p>Vous n\'avez pas les permissions nécessaires.</p>');
                }
            case 'gestion':
                if (CLIENT_PORTAL_ENABLED) {
                    const templateGestion = HtmlService.createTemplateFromFile('Client_Espace');
                    templateGestion.ADMIN_EMAIL = ADMIN_EMAIL;
                    return templateGestion.evaluate().setTitle("Mon Espace Client").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
                } else {
                    return HtmlService.createHtmlOutput('<h1>Espace client indisponible</h1><p>Merci de votre compréhension.</p>');
                }
            case 'debug':
                if (DEBUG_MENU_ENABLED) {
                    const debugEmail = Session.getActiveUser().getEmail();
                    if (debugEmail && debugEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
                        return HtmlService.createHtmlOutputFromFile('Debug_Interface').setTitle("Panneau de Débogage");
                    } else {
                        return HtmlService.createHtmlOutput('<h1>Accès Refusé</h1><p>Vous n\\'avez pas les permissions nécessaires.</p>');
                    }
                }
                return HtmlService.createHtmlOutput('<h1>Accès Refusé</h1><p>Debug désactivé.</p>');
            case 'infos':
                if (PRIVACY_LINK_ENABLED) {
                    return HtmlService.createHtmlOutputFromFile('Infos_confidentialite')
                        .setTitle("Infos & confidentialité");
                }
                break;
        }
    }

    // Page par défaut : Interface de réservation
    if (DEMO_RESERVATION_ENABLED) {
      return HtmlService.createHtmlOutputFromFile('examples/Reservation_Demo')
          .setTitle(NOM_ENTREPRISE + " | Réservation (Démo)")
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
    }
    const template = HtmlService.createTemplateFromFile('Reservation_Interface');
    template.appUrl = ScriptApp.getService().getUrl();
    template.nomService = NOM_ENTREPRISE;
    template.CLIENT_PORTAL_ENABLED = CLIENT_PORTAL_ENABLED;
    const conf = getConfigCached();
    template.TARIFS_JSON = JSON.stringify(conf.TARIFS);
    template.DUREE_BASE = conf.DUREE_BASE;
    template.DUREE_ARRET_SUP = conf.DUREE_ARRET_SUP;
    template.KM_BASE = conf.KM_BASE;
    template.KM_ARRET_SUP = conf.KM_ARRET_SUP;
    template.URGENT_THRESHOLD_MINUTES = conf.URGENT_THRESHOLD_MINUTES;
    template.dateDuJour = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

    // NOUVEAU : Ajout des variables pour la bannière d'information
    template.heureDebut = conf.HEURE_DEBUT_SERVICE;
    template.heureFin = conf.HEURE_FIN_SERVICE;
    // Tarifs de base pour la bannière d'information
    template.prixBaseNormal = (conf.TARIFS && conf.TARIFS['Normal']) ? conf.TARIFS['Normal'].base : '';
    template.prixBaseSamedi = (conf.TARIFS && conf.TARIFS['Samedi']) ? conf.TARIFS['Samedi'].base : '';
    template.prixBaseUrgent = (conf.TARIFS && conf.TARIFS['Urgent']) ? conf.TARIFS['Urgent'].base : '';
    template.tvaApplicable = typeof conf.TVA_APPLICABLE !== 'undefined' ? conf.TVA_APPLICABLE : false;


    return template.evaluate()
        .setTitle(NOM_ENTREPRISE + " | Réservation")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);

  } catch (error) {
    Logger.log(`Erreur critique dans doGet: ${error.stack}`);
    return HtmlService.createHtmlOutput(
      `<h1>Erreur de configuration</h1><p>L'application ne peut pas démarrer. L'administrateur a été notifié.</p><pre>${error.message}</pre>`
    );
  }
}

/**
 * Gère les requêtes POST entrantes.
 * Parse les données et route vers la logique appropriée.
 * @param {Object} e L'objet d'événement de la requête.
 * @returns {HtmlOutput|TextOutput} Réponse HTML ou JSON.
 */
function doPost(e) {
  try {
    if (REQUEST_LOGGING_ENABLED) {
      logRequest(e);
    }

    if (!POST_ENDPOINT_ENABLED) {
      return ContentService.createTextOutput(JSON.stringify({
        erreur: 'POST désactivé'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var payload = {};
    if (e && e.postData && e.postData.contents) {
      if (e.postData.type === 'application/json') {
        payload = JSON.parse(e.postData.contents);
      } else {
        payload = e.parameter;
      }
    }

    e.parameter = Object.assign({}, e.parameter, payload);

    if (payload.action) {
      switch (payload.action) {
        case 'getConfiguration':
          return ContentService.createTextOutput(JSON.stringify(getConfiguration()))
              .setMimeType(ContentService.MimeType.JSON);
        default:
          return ContentService.createTextOutput(JSON.stringify({
            erreur: 'Action inconnue'
          })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    return doGet(e);

  } catch (error) {
    Logger.log(`Erreur critique dans doPost: ${error.stack}`);
    return ContentService.createTextOutput(JSON.stringify({
      erreur: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

