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
      .addItem("Vérifier la cohérence du calendrier", "verifierCoherenceCalendrier")
      .addItem("Lancer un audit des partages Drive", "lancerAuditDrive");

  const sousMenuMaintenance = ui.createMenu('Maintenance')
      .addItem("Sauvegarder le code du projet", "sauvegarderCodeProjet")
      .addItem("Sauvegarder les données", "sauvegarderDonnees")
      .addItem("Vérifier structure des feuilles", "menuVerifierStructureFeuilles")
      .addItem("Purger les anciennes données (RGPD)", "purgerAnciennesDonnees");
      
  const sousMenuDebug = ui.createMenu('Debug')
      .addItem("Lancer tous les tests", "lancerTousLesTests");

  sousMenuMaintenance.addItem("Nettoyer l'onglet Facturation", "nettoyerOngletFacturation");
  sousMenuMaintenance.addItem("Reparer entetes Facturation", "reparerEntetesFacturation");
  if (CALENDAR_RESYNC_ENABLED) {
    sousMenuMaintenance.addItem("Resynchroniser événement manquant", "menuResynchroniserEvenement");
  }
  if (CALENDAR_PURGE_ENABLED) {
    sousMenuMaintenance.addItem("Purger Event ID introuvable", "menuPurgerEventId");
  }
  menuPrincipal.addSubMenu(sousMenuMaintenance).addToUi();
  menuPrincipal.addSubMenu(sousMenuDebug).addToUi();
}

/**
 * S'exécute lorsqu'un utilisateur accède à l'URL de l'application web.
 * Fait office de routeur pour afficher la bonne page.
 * @param {Object} e L'objet d'événement de la requête.
 * @returns {HtmlOutput} Le contenu HTML à afficher.
 */
function doGet(e) {
  try {
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
                const templateGestion = HtmlService.createTemplateFromFile('Client_Espace');
                templateGestion.ADMIN_EMAIL = ADMIN_EMAIL;
                return templateGestion.evaluate().setTitle("Mon Espace Client").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
            case 'debug':
                 const debugEmail = Session.getActiveUser().getEmail();
                if (debugEmail && debugEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
                    return HtmlService.createHtmlOutputFromFile('Debug_Interface').setTitle("Panneau de Débogage");
                } else {
                    return HtmlService.createHtmlOutput('<h1>Accès Refusé</h1><p>Vous n\'avez pas les permissions nécessaires.</p>');
                }
            case 'infos':
                if (PRIVACY_LINK_ENABLED) {
                    return HtmlService.createHtmlOutputFromFile('Infos_confidentialite')
                        .setTitle("Infos & confidentialité");
                }
                break;
        }
    }

    // Page par défaut : Interface de réservation
    const template = HtmlService.createTemplateFromFile('Reservation_Interface');
    template.appUrl = ScriptApp.getService().getUrl();
    template.nomService = NOM_ENTREPRISE;
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
 * Permet d'inclure des fichiers (CSS, JS) dans les templates HTML.
 * @param {string} nomFichier Le nom du fichier à inclure.
 * @returns {string} Le contenu du fichier.
 */
function include(nomFichier) {
  return HtmlService.createHtmlOutputFromFile(nomFichier).getContent();
}

function getUserTheme() {
  return PropertiesService.getUserProperties().getProperty('theme') || THEME_DEFAULT;
}

function setUserTheme(theme) {
  if (THEMES[theme]) {
    PropertiesService.getUserProperties().setProperty('theme', theme);
  }
}

/**
 * Retourne les flags d'activation pour le client.
 * @returns {Object} Flags configurables depuis Configuration.gs.
 */
function getConfiguration() {
  return {
    slotsAmpmEnabled: SLOTS_AMPM_ENABLED,
    themeV2Enabled: THEME_V2_ENABLED,
    billingV2Dryrun: BILLING_V2_DRYRUN,
    privacyLinkEnabled: PRIVACY_LINK_ENABLED
  };
}

