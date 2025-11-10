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
function onOpen(e) {
  const ui = SpreadsheetApp.getUi();

  // --- Création du menu principal ---
  const menuPrincipal = ui.createMenu('ELS')
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
    .addItem("Vérifier l’installation", "menuVerifierInstallation")
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

  menuPrincipal.addSeparator();
  menuPrincipal.addSubMenu(sousMenuMaintenance);
  // Actions devis PDF et refresh menu
  if (typeof genererDevisPdfDepuisSelection === 'function') {
    try { menuPrincipal.addItem('Generer un devis (PDF) - selection', 'genererDevisPdfDepuisSelection'); } catch (_e) {}
  }
  try { menuPrincipal.addItem('Rafraichir le menu', 'onOpen'); } catch (_e) {}

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
  try { SpreadsheetApp.getActive().toast('Menu ELS mis à jour', 'ELS', 5); } catch (_e) {}

  var canValidate = hasFullAuthorization_(e);
  if (!canValidate) {
    try { SpreadsheetApp.getActive().toast('Autorisations Apps Script requises pour valider la config. Ouvrez le projet Apps Script et exécutez validerConfiguration().', 'ELS', 10); } catch (_e) {}
    return;
  }
  try {
    validerConfiguration();
  } catch (err) {
    ui.alert('Configuration invalide', err.message, ui.ButtonSet.OK);
  }
}

function onInstall(e) {
  onOpen(e);
}

function hasFullAuthorization_(event) {
  try {
    if (event && typeof event.authMode !== 'undefined' && ScriptApp && ScriptApp.AuthMode) {
      if (event.authMode === ScriptApp.AuthMode.LIMITED || event.authMode === ScriptApp.AuthMode.NONE) {
        return false;
      }
    }
    if (ScriptApp && ScriptApp.getAuthorizationInfo && ScriptApp.AuthMode && ScriptApp.AuthorizationStatus) {
      const info = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
      if (info && typeof info.getAuthorizationStatus === 'function') {
        return info.getAuthorizationStatus() !== ScriptApp.AuthorizationStatus.REQUIRED;
      }
    }
  } catch (authErr) {
    Logger.log('hasFullAuthorization_ check failed: ' + authErr);
  }
  return true;
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
    const sanitizedUrl = res.url
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
    const html = HtmlService.createHtmlOutput(
      `<div style="font-family:Montserrat,sans-serif;line-height:1.5">
         <h3>Lien Espace Client</h3>
         <p>Ce lien expire à: ${new Date(res.exp*1000).toLocaleString()}</p>
         <input id="l" type="text" value="${sanitizedUrl}" style="width:100%" readonly />
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
 * Menu: Vérifie l'installation via checkSetup_ELS.
 */
function menuVerifierInstallation() {
  const ui = SpreadsheetApp.getUi();
  const result = checkSetup_ELS();
  Logger.log(JSON.stringify(result));
  const message = result.ok
    ? 'OK'
    : 'Propriétés manquantes: ' + result.missingProps.join(', ');
  ui.alert('Vérification installation', message, ui.ButtonSet.OK);
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
 * Vérifie si la requête possède les droits administrateur soit via l'utilisateur actif,
 * soit via un lien signé associé à l'adresse email administrateur.
 * @param {Object} e Paramètres de la requête.
 * @returns {boolean} true si l'accès est autorisé.
 */
function hasAdminAccess(e) {
  const adminEmail = (typeof ADMIN_EMAIL === 'string') ? ADMIN_EMAIL.toLowerCase() : '';
  if (!adminEmail) {
    return false;
  }

  try {
    const activeUser = Session.getActiveUser();
    if (activeUser) {
      const email = activeUser.getEmail();
      if (email && email.toLowerCase() === adminEmail) {
        return true;
      }
    }
  } catch (_err) {
    // Ignorer et reposer sur les paramètres signés.
  }

  const params = (e && e.parameter) || {};
  const emailParam = String(params.email || '').trim().toLowerCase();
  if (!emailParam || emailParam !== adminEmail) {
    return false;
  }
  const exp = params.exp || '';
  const sig = params.sig || '';
  if (typeof verifySignedLink === 'function' && sig && exp) {
    try {
      return verifySignedLink(emailParam, exp, sig);
    } catch (_err) {
      return false;
    }
  }

  return false;
}


/**
 * S'exécute lorsqu'un utilisateur accède à l'URL de l'application web.
 * Fait office de routeur pour afficher la bonne page.
 * @param {Object} e L'objet d'événement de la requête.
 * @returns {HtmlOutput} Le contenu HTML à afficher.
 */
function doGet(e) {
  try {
    try {
      const setup = checkSetup_ELS();
      if (setup.missingProps && setup.missingProps.length > 0) {
        return HtmlService.createHtmlOutput(
          `<h1>Configuration manquante</h1><p>Propriétés manquantes: ${setup.missingProps.join(', ')}</p>`
        ).setTitle('Configuration manquante');
      }
    } catch (err) {
      Logger.log('checkSetup_ELS erreur: ' + err.message);
    }

    const page = (e && e.parameter && e.parameter.page) ? String(e.parameter.page) : '';
    if (typeof REQUEST_LOGGING_ENABLED !== 'undefined' && REQUEST_LOGGING_ENABLED && typeof logRequest === 'function') {
      logRequest(e);
    }

    // --- Routeur de page ---
    if (page) {
      switch (page) {

        case 'admin':
          if (hasAdminAccess(e)) {
            const templateAdmin = HtmlService.createTemplateFromFile('Admin_Interface');
            return templateAdmin.evaluate().setTitle("Tableau de Bord Administrateur").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
          }
          return creerReponseHtml(
            'Accès Refusé',
            'Authentification administrateur requise. Utilisez un lien signé valide ou connectez-vous avec le compte administrateur.'
          );

        case 'gestion':
          if (typeof CLIENT_PORTAL_ENABLED !== 'undefined' && CLIENT_PORTAL_ENABLED) {
            const params = (e && e.parameter) || {};
            if (typeof CLIENT_PORTAL_SIGNED_LINKS !== 'undefined' && CLIENT_PORTAL_SIGNED_LINKS) {
              const emailRaw = String(params.email || '').trim();
              const emailParam = emailRaw.toLowerCase();
              const exp = params.exp || '';
              const sig = params.sig || '';
              if (!verifySignedLink(emailParam, exp, sig)) {
                return creerReponseHtml('Lien invalide', 'Authentification requise pour accéder à l\'espace client.');
              }
            }
            const templateGestion = HtmlService.createTemplateFromFile('Client_Espace');
            templateGestion.ADMIN_EMAIL = ADMIN_EMAIL;
            const embedMode = String(params.embed || '') === '1';
            templateGestion.EMBED_MODE = embedMode;
            const sortieGestion = templateGestion.evaluate().setTitle("Mon Espace Client");
            return sortieGestion.setXFrameOptionsMode(
              embedMode ? HtmlService.XFrameOptionsMode.ALLOWALL : HtmlService.XFrameOptionsMode.DEFAULT
            );
          }
          return creerReponseHtml('Espace client indisponible', 'Merci de votre compréhension.');

        case 'debug':
          if (typeof DEBUG_MENU_ENABLED !== 'undefined' && DEBUG_MENU_ENABLED) {
            if (hasAdminAccess(e)) {
              return HtmlService.createHtmlOutputFromFile('Debug_Interface').setTitle("Panneau de Débogage");
            }
            return creerReponseHtml(
              'Accès Refusé',
              'Le panneau de débogage n’est accessible qu’avec un accès administrateur signé.'
            );
          }
          // CORRECTION: Message clair si le debug est désactivé au niveau global.
          return creerReponseHtml('Accès Refusé', 'Le mode de débogage est désactivé.');

        case 'infos':
          if (typeof PRIVACY_LINK_ENABLED !== 'undefined' && PRIVACY_LINK_ENABLED) {
            const templateInfos = HtmlService.createTemplateFromFile('Infos_confidentialite');
            return templateInfos.evaluate()
              .setTitle("Infos & confidentialité")
              .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
          }
          // CORRECTION: Ajout d'un 'break' pour éviter de tomber sur la page par défaut
          // si cette page est désactivée.
          break;

        case 'mentions':
          if (typeof LEGAL_NOTICE_LINK_ENABLED !== 'undefined' && LEGAL_NOTICE_LINK_ENABLED) {
            const templateMentions = HtmlService.createTemplateFromFile('Mentions_Legales');
            return templateMentions.evaluate()
              .setTitle("Mentions légales")
              .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
          }
          break;

        case 'cgv':
          // Conditions Générales de Vente
          var templateCgv = HtmlService.createTemplateFromFile('CGV');
          templateCgv.appUrl = ScriptApp.getService().getUrl();
          templateCgv.nomService = NOM_ENTREPRISE;
          templateCgv.emailEntreprise = EMAIL_ENTREPRISE;
          templateCgv.brandingLogoPublicUrl = BRANDING_LOGO_PUBLIC_URL;
          return templateCgv.evaluate()
            .setTitle(NOM_ENTREPRISE + " | CGV")
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);

        case 'accueil':
        case 'home':
        case 'index':
        case 'reservation':
          return renderReservationInterface();
      }
    }

    return renderReservationInterface();

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


function renderReservationInterface() {
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
  template.PRICING_RULES_V2_JSON = JSON.stringify(conf.PRICING_RULES_V2 || {});
  template.PRICING_RULES_V2 = conf.PRICING_RULES_V2;
  template.PRICING_MATRIX_JSON = JSON.stringify(getClientPricingMatrix(30) || {});
  const logoDataUrl = getLogoDataUrl();
  const logoPublicUrl = getLogoPublicUrl();
  const heroImages = buildReservationHeroImages();
  template.logoDataUrl = logoDataUrl;
  template.logoPublicUrl = logoPublicUrl;
  template.heroImages = heroImages;
  template.heroAssetsJson = JSON.stringify({
    logo: logoDataUrl || null,
    hero: heroImages || {}
  }).replace(/</g, '\\u003c');
  template.DUREE_BASE = conf.DUREE_BASE;
  template.DUREE_ARRET_SUP = conf.DUREE_ARRET_SUP;
  template.KM_BASE = conf.KM_BASE;
  template.KM_ARRET_SUP = conf.KM_ARRET_SUP;
  template.URGENT_THRESHOLD_MINUTES = conf.URGENT_THRESHOLD_MINUTES;
  template.dateDuJour = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  template.PRICING_RULES_V2_ENABLED = (typeof PRICING_RULES_V2_ENABLED !== 'undefined') ? PRICING_RULES_V2_ENABLED : false;
  template.RETURN_IMPACTS_ESTIMATES_ENABLED = (typeof RETURN_IMPACTS_ESTIMATES_ENABLED !== 'undefined') ? RETURN_IMPACTS_ESTIMATES_ENABLED : false;
  template.CFG_ENABLE_ASSISTANT = (typeof CFG_ENABLE_ASSISTANT !== 'undefined') ? CFG_ENABLE_ASSISTANT : false;

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
}


function buildReservationHeroImages() {
  const files = {
    banner: 'Hero_ElsBanner_b64',
    tours: 'Hero_ElesTournees_b64',
    logistics: 'Hero_VotreLogistique_b64',
    care: 'Hero_OfficinesInfirmeries_b64'
  };
  const images = {};
  Object.keys(files).forEach(function(key) {
    images[key] = loadBase64ImageDataUri(files[key]);
  });
  return images;
}

function loadBase64ImageDataUri(partialName) {
  try {
    // Lire le contenu brut du fichier d'actif.
    // Utiliser getCode() permet d'éviter l'évaluation du template.
    const template = HtmlService.createTemplateFromFile(partialName);
    let content = template.getCode();
    if (!content) {
      return '';
    }
    content = String(content).replace(/^\uFEFF/, '').trim();
    // Si déjà une Data URI complète, la retourner telle quelle.
    if (/^data:image\//i.test(content)) {
      return content;
    }
    // Normaliser: supprimer les espaces et retours à la ligne.
    const normalized = content.replace(/[\s\r\n]+/g, '');
    // Valider via un décodage base64 pour être robuste aux encodages/retours.
    try {
      Utilities.base64Decode(normalized);
    } catch (_e) {
      // En dernier recours, élargir l'acceptation si le contenu semble du base64.
      if (!/^[A-Za-z0-9+/=]+$/.test(normalized)) {
        throw new Error('Contenu base64 invalide');
      }
    }
    return 'data:image/png;base64,' + normalized;
  } catch (err) {
    Logger.log('Asset manquant pour ' + partialName + ': ' + err.message);
    return '';
  }
}

function fetchGoogleChartsLoader() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'GOOGLE_CHARTS_LOADER_V1';
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const response = UrlFetchApp.fetch('https://www.gstatic.com/charts/loader.js', { muteHttpExceptions: true });
  const status = response.getResponseCode();
  if (status === 200) {
    const content = response.getContentText();
    cache.put(cacheKey, content, 21600);
    return content;
  }
  throw new Error('Impossible de recuperer Google Charts loader (HTTP ' + status + ')');
}

/**
 * Gère les requêtes POST entrantes.
 * Parse les données et route vers la logique appropriée.
 * @param {Object} e L'objet d'événement de la requête.
 * @returns {ContentService.TextOutput} Réponse au format JSON.
 */
function doPost(e) {
  try {
    const event = e && typeof e === 'object' ? e : {};
    if (!event.parameter || typeof event.parameter !== 'object') {
      event.parameter = {};
    }
    if (!event.headers || typeof event.headers !== 'object') {
      event.headers = {};
    }
    if (!event.postData || typeof event.postData !== 'object') {
      event.postData = null;
    }

    if (CONFIG_CACHE_ENABLED) {
      const cache = CacheService.getScriptCache();
      const lastValidated = cache.get('CONFIG_VALIDATED_AT');
      const now = Date.now();
      const stale = !lastValidated || (now - Number(lastValidated)) > 300000;
      if (stale) {
        validerConfiguration();
        cache.put('CONFIG_VALIDATED_AT', String(now), 600);
      }
    } else {
      validerConfiguration();
    }

    if (typeof REQUEST_LOGGING_ENABLED !== 'undefined' && REQUEST_LOGGING_ENABLED && typeof logRequest === 'function') {
      logRequest(event);
    }

    if (typeof POST_ENDPOINT_ENABLED === 'undefined' || !POST_ENDPOINT_ENABLED) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'POST endpoint is disabled.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    let payload = {};
    if (event.postData && event.postData.contents) {
      try {
        if (event.postData.type === 'application/json') {
          payload = JSON.parse(event.postData.contents);
        } else {
          // Pour les formulaires standards (application/x-www-form-urlencoded)
          payload = event.parameter;
        }
      } catch (jsonError) {
        throw new Error("Invalid JSON payload received.");
      }
    } else {
      payload = event.parameter; // Fallback pour les cas simples
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
function _forceReAuth() {
  // Déclenche le consentement pour GmailApp
  const dummy = GmailApp.createDraft(Session.getActiveUser().getEmail(), 'ELS - Autorisation', 'Test d’autorisations Gmail.');
  GmailApp.getDraft(dummy.getId()).deleteDraft();
}
function testEnvoyerDevis() {
    envoyerDevisParEmail({
      client: { email: 'test@example.com', nom: 'Client Test' },
      items: [{
        date: '2025-05-15',
        startTime: '10h00',
        details: 'Essai devis',
        prix: 120
      }]
    });
  }

