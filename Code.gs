// =================================================================
//                      POINT D'ENTRÉE & MENUS
// =================================================================
// Description: Contrôleur principal qui gère les menus dans le Google
//              Sheet et les requêtes web pour afficher les interfaces.
// =================================================================

/**
 * S'exécute à l'ouverture du Google Sheet pour créer les menus.
 * @summary Fonction trigger `onOpen` pour créer l'interface utilisateur du menu.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  // --- Création du menu principal ---
  const menuPrincipal = ui.createMenu('EL Services')
    .addItem('Générer les factures sélectionnées', 'genererFactures')
    .addItem('Envoyer les factures contrôlées', 'envoyerFacturesControlees')
    .addItem('Générer lien Espace Client', 'menuGenererLienClient')
    .addItem("Archiver les factures du mois dernier", "archiverFacturesDuMois")
    .addSeparator()
    .addItem("Vérifier la cohérence du calendrier", "verifierCoherenceCalendrier");

  // --- Création du sous-menu Maintenance ---
  const sousMenuMaintenance = ui.createMenu('Maintenance')
    .addItem("Sauvegarder le code du projet", "sauvegarderCodeProjet")
    .addItem("Sauvegarder les données", "sauvegarderDonnees")
    .addItem("Vérifier structure des feuilles", "menuVerifierStructureFeuilles")
    .addItem("Purger les anciennes données (RGPD)", "purgerAnciennesDonnees")
    .addSeparator()
    .addItem("Nettoyer l'onglet Facturation", "nettoyerOngletFacturation")
    .addItem("Reparer entetes Facturation", "reparerEntetesFacturation")
    .addItem("Normaliser entetes Facturation", "normaliserEntetesFacturation");

  // Ajout des options conditionnelles au menu Maintenance
  if (typeof CALENDAR_RESYNC_ENABLED !== 'undefined' && CALENDAR_RESYNC_ENABLED) {
    sousMenuMaintenance.addItem("Resynchroniser événement manquant", "menuResynchroniserEvenement");
  }
  if (typeof CALENDAR_PURGE_ENABLED !== 'undefined' && CALENDAR_PURGE_ENABLED) {
    sousMenuMaintenance.addItem("Purger Event ID introuvable", "menuPurgerEventId");
  }

  menuPrincipal.addSubMenu(sousMenuMaintenance);

  // --- Ajout du sous-menu Debug (s'il est activé) ---
  // CORRECTION: La création du menu Debug est maintenant entièrement contenue
  // dans cette condition pour éviter la redondance et la confusion.
  if (typeof DEBUG_MENU_ENABLED !== 'undefined' && DEBUG_MENU_ENABLED) {
    const sousMenuDebug = ui.createMenu('Debug')
      .addItem("Lancer tous les tests", "lancerTousLesTests")
      .addItem("Tester audit Drive", "testerAuditDrive")
      .addItem("Générer lien Espace Client", "menuGenererLienClient");
    menuPrincipal.addSubMenu(sousMenuDebug);
  }

  menuPrincipal.addToUi();
}

/**
 * Menu: Génère un lien signé pour l'Espace Client (admin requis).
 */
function menuGenererLienClient() {
  const ui = SpreadsheetApp.getUi();
  try {
    if (!CLIENT_PORTAL_SIGNED_LINKS) {
      ui.alert('Fonction indisponible', "CLIENT_PORTAL_SIGNED_LINKS est désactivé dans la configuration.", ui.ButtonSet.OK);
      return;
    }
    const emailResp = ui.prompt('Générer lien Espace Client', "Email du client:", ui.ButtonSet.OK_CANCEL);
    if (emailResp.getSelectedButton() !== ui.Button.OK) return;
    const email = String(emailResp.getResponseText() || '').trim();
    if (!email) { ui.alert('Erreur', 'Email requis.', ui.ButtonSet.OK); return; }
    const hoursResp = ui.prompt('Validité du lien', "Durée en heures (défaut 168):", ui.ButtonSet.OK_CANCEL);
    if (hoursResp.getSelectedButton() !== ui.Button.OK) return;
    const hours = parseInt(hoursResp.getResponseText() || '168', 10);
    const res = genererLienEspaceClient(email, isNaN(hours) ? 168 : hours);
    const html = HtmlService.createHtmlOutput(
      `<div style="font-family:Montserrat,sans-serif;line-height:1.5">
         <h3>Lien Espace Client</h3>
         <p>Ce lien expire à: ${new Date(res.exp*1000).toLocaleString()}</p>
         <input id="l" type="text" value="${res.url.replace(/&/g,'&amp;').replace(/</g,'&lt;')}" style="width:100%" readonly />
         <div style="margin-top:8px"><button onclick="copy()">Copier</button></div>
         <script>
           function copy(){var i=document.getElementById('l');i.select();try{document.execCommand('copy');}catch(e){} }
         </script>
       </div>`
    ).setWidth(520).setHeight(160);
    ui.showModalDialog(html, 'Lien Espace Client');
  } catch (e) {
    ui.alert('Erreur', e.message, ui.ButtonSet.OK);
  }
}


/**
 * Crée une réponse HTML standard pour les messages d'erreur ou d'information.
 * @param {string} titre Le titre de la page HTML.
 * @param {string} message Le message à afficher dans le corps de la page.
 * @returns {HtmlOutput} Le contenu HTML formaté.
 */
function creerReponseHtml(titre, message) {
  return HtmlService.createHtmlOutput(`<h1>${titre}</h1><p>${message}</p>`).setTitle(titre);
}


/**
 * S'exécute lorsqu'un utilisateur accède à l'URL de l'application web.
 * Fait office de routeur pour afficher la bonne page.
 * @param {Object} e L'objet d'événement de la requête.
 * @returns {HtmlOutput} Le contenu HTML à afficher.
 */
function doGet(e) {
  try {
    const page = (e && e.parameter && e.parameter.page) ? String(e.parameter.page) : '';
    if (typeof REQUEST_LOGGING_ENABLED !== 'undefined' && REQUEST_LOGGING_ENABLED) {
      logRequest(e); // Assurez-vous que la fonction logRequest existe
    }

    // --- Routeur de page ---
    if (e && e.parameter && e.parameter.page) {
      switch (e.parameter.page) {

        case 'admin':
          const adminEmail = Session.getActiveUser().getEmail();
          // CORRECTION: L'opérateur de comparaison '===' était manquant.
          if (adminEmail && adminEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
            const templateAdmin = HtmlService.createTemplateFromFile('Admin_Interface');
            return templateAdmin.evaluate().setTitle("Tableau de Bord Administrateur").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
          }
          return creerReponseHtml('Accès Refusé', 'Vous n\'avez pas les permissions nécessaires.');

        case 'gestion':
          if (typeof CLIENT_PORTAL_ENABLED !== 'undefined' && CLIENT_PORTAL_ENABLED) {
            if (typeof CLIENT_PORTAL_SIGNED_LINKS !== 'undefined' && CLIENT_PORTAL_SIGNED_LINKS) {
              const params = (e && e.parameter) || {};
              const emailParam = params.email || '';
              const exp = params.exp || '';
              const sig = params.sig || '';
              if (!verifySignedLink(emailParam, exp, sig)) {
                return creerReponseHtml('Lien invalide', 'Authentification requise pour accéder à l\'espace client.');
              }
            }
            const templateGestion = HtmlService.createTemplateFromFile('Client_Espace');
            templateGestion.ADMIN_EMAIL = ADMIN_EMAIL;
            return templateGestion.evaluate().setTitle("Mon Espace Client").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
          }
          return creerReponseHtml('Espace client indisponible', 'Merci de votre compréhension.');

        case 'debug':
          if (typeof DEBUG_MENU_ENABLED !== 'undefined' && DEBUG_MENU_ENABLED) {
            const debugEmail = Session.getActiveUser().getEmail();
            if (debugEmail && debugEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
              return HtmlService.createHtmlOutputFromFile('Debug_Interface').setTitle("Panneau de Débogage");
            }
            return creerReponseHtml('Accès Refusé', 'Vous n\'avez pas les permissions nécessaires.');
          }
          // CORRECTION: Message clair si le debug est désactivé au niveau global.
          return creerReponseHtml('Accès Refusé', 'Le mode de débogage est désactivé.');

        case 'infos':
          if (typeof PRIVACY_LINK_ENABLED !== 'undefined' && PRIVACY_LINK_ENABLED) {
            return HtmlService.createHtmlOutputFromFile('Infos_confidentialite')
              .setTitle("Infos & confidentialité");
          }
          // CORRECTION: Ajout d'un 'break' pour éviter de tomber sur la page par défaut
          // si cette page est désactivée.
          break;
      }
    }

    // --- Page par défaut : Interface de réservation ---
    if (typeof DEMO_RESERVATION_ENABLED !== 'undefined' && DEMO_RESERVATION_ENABLED) {
      return HtmlService.createHtmlOutputFromFile('examples/Reservation_Demo')
        .setTitle(NOM_ENTREPRISE + " | Réservation (Démo)")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
    }

    const template = HtmlService.createTemplateFromFile('Reservation_Interface');
    const conf = getPublicConfig();

    // Assignation des variables au template
    template.appUrl = ScriptApp.getService().getUrl();
    template.nomService = NOM_ENTREPRISE;
    template.EMAIL_ENTREPRISE = EMAIL_ENTREPRISE;
    template.CLIENT_PORTAL_ENABLED = CLIENT_PORTAL_ENABLED;
    template.TARIFS_JSON = JSON.stringify(conf.TARIFS || {});
    template.TARIFS = conf.TARIFS;
    template.DUREE_BASE = conf.DUREE_BASE;
    template.DUREE_ARRET_SUP = conf.DUREE_ARRET_SUP;
    template.KM_BASE = conf.KM_BASE;
    template.KM_ARRET_SUP = conf.KM_ARRET_SUP;
    template.URGENT_THRESHOLD_MINUTES = conf.URGENT_THRESHOLD_MINUTES;
    template.dateDuJour = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    template.PRICING_RULES_V2_ENABLED = (typeof PRICING_RULES_V2_ENABLED !== 'undefined') ? PRICING_RULES_V2_ENABLED : false;
    template.RETURN_IMPACTS_ESTIMATES_ENABLED = (typeof RETURN_IMPACTS_ESTIMATES_ENABLED !== 'undefined') ? RETURN_IMPACTS_ESTIMATES_ENABLED : false;

    // Variables pour la bannière d'information
    template.heureDebut = conf.HEURE_DEBUT_SERVICE;
    template.heureFin = conf.HEURE_FIN_SERVICE;
    template.prixBaseNormal = (conf.TARIFS && conf.TARIFS['Normal']) ? conf.TARIFS['Normal'].base : '';
    template.prixBaseSamedi = (conf.TARIFS && conf.TARIFS['Samedi']) ? conf.TARIFS['Samedi'].base : '';
    template.prixBaseUrgent = (conf.TARIFS && conf.TARIFS['Urgent']) ? conf.TARIFS['Urgent'].base : '';
    template.tvaApplicable = typeof conf.TVA_APPLICABLE !== 'undefined' ? conf.TVA_APPLICABLE : false;

    return template.evaluate()
      .setTitle(NOM_ENTREPRISE + " | Réservation")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);

  } catch (error) {
    if (error && error.code === 403) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'Forbidden' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    Logger.log(`Erreur critique dans doGet: ${error.stack}`);
    return creerReponseHtml(
      'Erreur de configuration',
      `L'application ne peut pas démarrer. L'administrateur a été notifié.<br><pre style="color:red;">${error.message}</pre>`
    );
  }
}


/**
 * Gère les requêtes POST entrantes.
 * Parse les données et route vers la logique appropriée.
 * @param {Object} e L'objet d'événement de la requête.
 * @returns {ContentService.TextOutput} Réponse au format JSON.
 */
function doPost(e) {
  try {
    if (typeof REQUEST_LOGGING_ENABLED !== 'undefined' && REQUEST_LOGGING_ENABLED) {
      logRequest(e);
    }

    if (typeof POST_ENDPOINT_ENABLED === 'undefined' || !POST_ENDPOINT_ENABLED) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'POST endpoint is disabled.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        if (e.postData.type === 'application/json') {
          payload = JSON.parse(e.postData.contents);
        } else {
          // Pour les formulaires standards (application/x-www-form-urlencoded)
          payload = e.parameter;
        }
      } catch (jsonError) {
        throw new Error("Invalid JSON payload received.");
      }
    } else {
      payload = e.parameter; // Fallback pour les cas simples
    }


    if (payload.action) {
      switch (payload.action) {
        case 'getConfiguration':
          // Assurez-vous que getConfiguration() est une fonction globale disponible
          return ContentService.createTextOutput(JSON.stringify(getConfiguration()))
            .setMimeType(ContentService.MimeType.JSON);

          // Ajoutez d'autres 'case' pour d'autres actions ici

        default:
          return ContentService.createTextOutput(JSON.stringify({
            status: 'error',
            message: 'Unknown action specified.'
          })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // Comportement par défaut si aucune action n'est spécifiée.
    // Le code original appelait doGet(e), ce qui est inhabituel pour un endpoint POST.
    // Il est souvent préférable de retourner une erreur claire.
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'No action specified in the POST request.'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    if (error && error.code === 403) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'Forbidden' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    Logger.log(`Erreur critique dans doPost: ${error.stack}`);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

