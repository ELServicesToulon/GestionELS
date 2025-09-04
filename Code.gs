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
    .addItem("Reparer entetes Facturation", "reparerEntetesFacturation");

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
      .addItem("Tester audit Drive", "testerAuditDrive");
    menuPrincipal.addSubMenu(sousMenuDebug);
  }

  menuPrincipal.addToUi();
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
            templateAdmin.THEME_SELECTION_ENABLED = THEME_SELECTION_ENABLED;
            return templateAdmin.evaluate().setTitle("Tableau de Bord Administrateur").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
          }
          return creerReponseHtml('Accès Refusé', 'Vous n\'avez pas les permissions nécessaires.');

        case 'gestion':
          if (typeof CLIENT_PORTAL_ENABLED !== 'undefined' && CLIENT_PORTAL_ENABLED) {
            const templateGestion = HtmlService.createTemplateFromFile('Client_Espace');
            templateGestion.ADMIN_EMAIL = ADMIN_EMAIL;
            templateGestion.THEME_SELECTION_ENABLED = THEME_SELECTION_ENABLED;
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

    if (typeof RESERVATION_UI_V2_ENABLED !== 'undefined' && RESERVATION_UI_V2_ENABLED) {
      return HtmlService.createHtmlOutputFromFile('Reservation_JS_UI')
        .setTitle(NOM_ENTREPRISE + " | Réservation")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
    }

    const template = HtmlService.createTemplateFromFile('Reservation_Interface');
    const conf = getConfigCached(); // Assurez-vous que getConfigCached existe et fonctionne

    // Assignation des variables au template
    template.THEME_SELECTION_ENABLED = THEME_SELECTION_ENABLED;
    template.appUrl = ScriptApp.getService().getUrl();
    template.nomService = NOM_ENTREPRISE;
    template.CLIENT_PORTAL_ENABLED = CLIENT_PORTAL_ENABLED;
    template.TARIFS_JSON = JSON.stringify(conf.TARIFS || {});
    template.DUREE_BASE = conf.DUREE_BASE;
    template.DUREE_ARRET_SUP = conf.DUREE_ARRET_SUP;
    template.KM_BASE = conf.KM_BASE;
    template.KM_ARRET_SUP = conf.KM_ARRET_SUP;
    template.URGENT_THRESHOLD_MINUTES = conf.URGENT_THRESHOLD_MINUTES;
    template.dateDuJour = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

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
    Logger.log(`Erreur critique dans doPost: ${error.stack}`);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Renvoie l'état initial pour l'interface de réservation.
 * @param {string} dateIso Date au format ISO (YYYY-MM-DD).
 * @return {Object} Modèle initial.
 */
// ====== PARAMÈTRES SEMAINIER ======
const PB = {
  SHEET_NAME: SHEET_RESERVATIONS,
  STEP_MIN: SEMAINIER_STEP_MIN,
  WINDOWS: SEMAINIER_WINDOWS
};

// ====== API appelées par l'UI ======

/**
 * Retourne les agrégats de réservation pour une semaine donnée.
 * @param {string} weekStartIso ISO du lundi de la semaine.
 * @return {Object} Modèle pour le semainier.
 */
function listWeekSlots(weekStartIso) {
  const ws = weekStartIso || mondayIso_(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays_(ws, i));
  const sh = ensureSheet_();
  const rows = readAll_(sh);

  const capacity = {};
  Object.keys(PB.WINDOWS).forEach(p => {
    capacity[p] = countIncrements_(PB.WINDOWS[p][0], PB.WINDOWS[p][1], PB.STEP_MIN);
  });

  const occ = {};
  days.forEach(d => (occ[d] = {}));
  rows.forEach(r => {
    const d = r.date;
    const part = r.part;
    if (occ[d] && capacity[part] != null) {
      occ[d][part] = (occ[d][part] || 0) + 1;
    }
  });

  return { weekStart: ws, capacity, occ };
}

/**
 * Liste les horaires disponibles pour une date et une partie de journée.
 * @param {string} dateIso ISO du jour.
 * @param {string} part Clé de partie (matin, midi, ...).
 * @return {Array<Object>} Horaires avec disponibilité.
 */
function listAvailableTimes(dateIso, part) {
  const win = PB.WINDOWS[part];
  if (!win) return [];
  const all = buildTimes_(win[0], win[1], PB.STEP_MIN);
  const sh = ensureSheet_();
  const rows = readAll_(sh);
  const busySet = new Set(rows.filter(r => r.date === dateIso && r.part === part).map(r => r.start));
  return all.map(t => ({ t, available: !busySet.has(t) }));
}

/**
 * Crée une nouvelle réservation.
 * @param {Object} payload Détails de la réservation.
 * @return {Object} Résultat avec identifiant.
 */
function createReservation(payload) {
  const dateIso = payload?.date;
  const part = payload?.part;
  const start = payload?.start;
  if (!dateIso || !part || !start) throw new Error('Paramètres manquants.');
  if (!isAligned15_(start)) throw new Error("L'heure doit être un multiple de 15 minutes.");
  const avail = listAvailableTimes(dateIso, part).find(x => x.t === start);
  if (!avail || !avail.available) throw new Error('Créneau déjà pris.');

  const sh = ensureSheet_();
  const lastRow = sh.getLastRow();
  sh.getRange(lastRow + 1, 1, 1, 3).setValues([[dateIso, part, start]]);
  return { ok: true, id: 'RES-' + Utilities.getUuid().slice(0, 8) };
}

// ====== Helpers feuille ======
function ensureSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(PB.SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(PB.SHEET_NAME);
    sh.getRange(1, 1, 1, 3).setValues([['date', 'part', 'start']]);
  }
  return sh;
}

function readAll_(sh) {
  const rng = sh.getDataRange().getValues();
  if (rng.length <= 1) return [];
  return rng.slice(1).map(r => ({ date: String(r[0]), part: String(r[1]), start: String(r[2]) }));
}

// ====== Helpers temps ======
function buildTimes_(startHHmm, endHHmm, stepMin) {
  const [sh, sm] = startHHmm.split(':').map(Number);
  const [eh, em] = endHHmm.split(':').map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  const out = [];
  for (let m = start; m < end; m += stepMin) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    out.push(`${hh}:${mm}`);
  }
  return out;
}

function countIncrements_(s, e, step) {
  return buildTimes_(s, e, step).length;
}

function isAligned15_(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return m % PB.STEP_MIN === 0;
}

function addDays_(iso, n) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function mondayIso_(d) {
  const dt = new Date(d);
  const day = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - day);
  return dt.toISOString().slice(0, 10);
}

