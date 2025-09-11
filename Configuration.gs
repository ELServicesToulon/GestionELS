
// =================================================================
//                 CONFIGURATION DE L'APPLICATION
// =================================================================
// Description: Centralise toutes les variables et paramètres
//              personnalisables de l'application.
// =================================================================

/**
 * Required Script Properties:
 * NOM_ENTREPRISE, ADRESSE_ENTREPRISE, EMAIL_ENTREPRISE, ADMIN_EMAIL,
 * ID_FEUILLE_CALCUL, ID_CALENDRIER, ID_DOCUMENT_CGV, ID_MODELE_FACTURE,
 * ID_DOSSIER_ARCHIVES, ID_DOSSIER_TEMPORAIRE, SIRET, ELS_SHARED_SECRET,
 * (optionally ID_DOSSIER_FACTURES)
 */

// --- Informations sur l'entreprise ---
/** @const {string} Nom officiel de l'entreprise utilisé dans l'interface et la facturation. */
const NOM_ENTREPRISE = getSecret('NOM_ENTREPRISE');
/** @const {string} Adresse postale de l'entreprise pour les documents légaux. */
const ADRESSE_ENTREPRISE = getSecret('ADRESSE_ENTREPRISE');
/** @const {string} Adresse e-mail de contact de l'entreprise. */
const EMAIL_ENTREPRISE = getSecret('EMAIL_ENTREPRISE');
/** @const {string} Adresse e-mail recevant les notifications administratives. */
const ADMIN_EMAIL = getSecret('ADMIN_EMAIL');

// --- Paramètres de facturation ---
/** @const {boolean} Indique si la TVA est appliquée ; désactivé par défaut. */
const TVA_APPLICABLE = false;
/** @const {number} Taux de TVA appliqué lorsque TVA_APPLICABLE est true (0.20 pour 20%). */
const TAUX_TVA = 0.20;
/** @const {number} Délai de paiement accordé au client en jours. */
const DELAI_PAIEMENT_JOURS = 5;

/** @const {string} ID du dossier Drive contenant les factures (retombe sur archives). */
const FACTURES_FOLDER_ID = (function() {
  try { return getSecret('ID_DOSSIER_FACTURES'); }
  catch (e) { return getSecret('ID_DOSSIER_ARCHIVES'); }
})();

// --- Bloc de facturation générique ---
/** @const {Object} Paramètres de facturation centralisés. */
const BILLING = {
  TVA_APPLICABLE: TVA_APPLICABLE,
  TVA_RATE: TVA_APPLICABLE ? TAUX_TVA : 0,
  TVA_MENTION: TVA_APPLICABLE ? "" : "TVA non applicable, art. 293B du CGI",
  DEVISE: "EUR",
  PAIEMENT_DELAI_JOURS: { RESIDENT: 0, PRO: 30 },
  INVOICE_PREFIX: "ELS",
  FACTURES_FOLDER_ID: FACTURES_FOLDER_ID,
  DOC_TEMPLATE_FACTURE_ID: getSecret('ID_MODELE_FACTURE')
};

// --- Paramètres de rétention des données ---
/** @const {number} Durée de conservation légale des factures (années). */
const ANNEES_RETENTION_FACTURES = 5;
/** @const {number} Durée de conservation des logs d'activité (mois). */
const MOIS_RETENTION_LOGS = 12;

// --- Noms des feuilles de calcul ---
/** @const {string} Feuille contenant les données de facturation. */
const SHEET_FACTURATION = 'Facturation';
/** @const {string} Feuille listant les clients. */
const SHEET_CLIENTS = 'Clients';
/** @const {string} Feuille stockant les paramètres globaux. */
const SHEET_PARAMETRES = 'Paramètres';
/** @const {string} Feuille de journalisation pour l'administration. */
const SHEET_ADMIN_LOGS = 'Admin_Logs';
/** @const {string} Feuille de journalisation générale. */
const SHEET_LOGS = 'Logs';
/** @const {string} Feuille des plages horaires bloquées. */
const SHEET_PLAGES_BLOQUEES = 'Plages_Bloquees';
/** @const {string} Feuille des réservations. */
const SHEET_RESERVATIONS = 'Réservations';
/** @const {string} Feuille par défaut des nouveaux classeurs. */
const SHEET_DEFAULT = 'Sheet1';
/** @const {string} Feuille stockant les questions des professionnels. */
const SHEET_QUESTIONS = 'Questions';

// --- Horaires & Tampons ---
/** @const {string} Heure d'ouverture du service au format HH:MM. */
const HEURE_DEBUT_SERVICE = "08:30";
/** @const {string} Heure de fermeture du service au format HH:MM. */
const HEURE_FIN_SERVICE = "18:30";
/** @const {number} Minutes de tampon ajoutées avant et après chaque créneau. */
const DUREE_TAMPON_MINUTES = 15;
/** @const {number} Intervalle en minutes entre deux créneaux de réservation. */
const INTERVALLE_CRENEAUX_MINUTES = 15;
/** @const {number} Délai en minutes en dessous duquel une réservation est considérée comme urgente. */
const URGENT_THRESHOLD_MINUTES = 30;

// --- Durées & Kilométrage des prestations ---
/** @const {number} Durée standard d'une prise en charge en minutes. */
const DUREE_BASE = 30;
/** @const {number} Durée supplémentaire par arrêt additionnel en minutes. */
const DUREE_ARRET_SUP = 15;
/** @const {number} Distance de base estimée pour une tournée en kilomètres. */
const KM_BASE = 9;
/** @const {number} Kilométrage ajouté pour chaque arrêt supplémentaire en kilomètres. */
const KM_ARRET_SUP = 3;

// --- Sessions client ---
/** @const {number} Durée de validité d'une session client en heures. */
const CLIENT_SESSION_TTL_HOURS = 24;

// =================================================================
//              DRAPEAUX D'ACTIVATION (FEATURE FLAGS)
// =================================================================

// --- Drapeaux de Fonctionnalités Générales ---
/** @const {boolean} Active l'espace client. */
const CLIENT_PORTAL_ENABLED = true;
/** @const {boolean} Exige un lien signé (email+exp+sig) pour l'espace client. */
const CLIENT_PORTAL_SIGNED_LINKS = false;
/** @const {number} Durée de validité d'un lien client signé (heures). */
const CLIENT_PORTAL_LINK_TTL_HOURS = 168;
/** @const {boolean} Affiche le lien vers les informations de confidentialité. */
const PRIVACY_LINK_ENABLED = false;
/** @const {boolean} Sépare l'affichage des créneaux en matin et après-midi. */
const SLOTS_AMPM_ENABLED = false;
/** @const {boolean} Stocke l'identifiant client sous forme de jeton opaque. */
const CLIENT_SESSION_OPAQUE_ID_ENABLED = false;
/** @const {boolean} Vérifie la présence du scope script.send_mail lors du setup. */
const SEND_MAIL_SCOPE_CHECK_ENABLED = false;
/** @const {boolean} Agrège toutes les feuilles "Facturation*" lors du calcul des factures. */
const BILLING_MULTI_SHEET_ENABLED = false;
/** @const {boolean} Affiche le chiffre d'affaires en cours dans l'interface admin. */
const CA_EN_COURS_ENABLED = false;
/** @const {boolean} Resynchronise les événements manquants du calendrier Google. */
const CALENDAR_RESYNC_ENABLED = true;
/** @const {boolean} Supprime les identifiants d'événements introuvables pour garder la base propre. */
const CALENDAR_PURGE_ENABLED = true;

/** @const {boolean} Module l'opacité de la barre de disponibilité selon le taux de charge. */
const CALENDAR_BAR_OPACITY_ENABLED = false;

/** @const {boolean} Active la création optimiste des courses admin. */
const ADMIN_OPTIMISTIC_CREATION_ENABLED = false;

/** @const {boolean} Active la colonne de créneaux PNG dans la modale admin. */
const ADMIN_SLOTS_PNG_ENABLED = false;

/** @const {boolean} Charge les images depuis le dossier Drive public au lieu des Data URI. */
const PUBLIC_ASSETS_ENABLED = false;

/** @const {boolean} Vérifie la création d'événement et l'unicité des ID de réservation. */
const RESERVATION_VERIFY_ENABLED = false;

/** @const {boolean} Active la nouvelle interface de réservation JavaScript. */
const RESERVATION_UI_V2_ENABLED = true;

/** @const {boolean} Active la facturation directe au résident. */
const RESIDENT_BILLING_ENABLED = false;

/** @const {boolean} Active la modale de coordonnées de facturation. */
const BILLING_MODAL_ENABLED = false;
/** @const {boolean} Active la réinitialisation du panier côté client. */
const CART_RESET_ENABLED = false;
/** @const {boolean} Inclut le retour dans la durée et la distance estimées (UI uniquement). */
const RETURN_IMPACTS_ESTIMATES_ENABLED = false;
/** @const {boolean} Apply pricing rules V2 (Saturday overrides urgent; no stacking). */
const PRICING_RULES_V2_ENABLED = false;

/** @const {boolean} Affiche le bloc de preuves sociales (avis/partenaires). */
const PROOF_SOCIAL_ENABLED = false;
/** @const {boolean} Active le module Questions/Réponses pour les professionnels. */
const PRO_QA_ENABLED = false;

/** @const {boolean} Affiche les pictogrammes supplémentaires (semainier, boîte scellée, livraison). */
const EXTRA_ICONS_ENABLED = false;
// --- Drapeaux de Débogage et de Test ---
/** @const {boolean} Affiche le sous-menu Debug et l'interface associée. */
const DEBUG_MENU_ENABLED = false;
/** @const {boolean} Sert une version de démo de la page de réservation. */
const DEMO_RESERVATION_ENABLED = false;
/** @const {boolean} Active l'écriture des logs de facturation. */
const BILLING_LOG_ENABLED = false;
/** @const {boolean} Active le mode test pour la facturation V2 (aucune écriture). */
const BILLING_V2_DRYRUN = false;
/** @const {boolean} Vérifie la présence de la colonne ID PDF dans l'onglet Facturation. */
const BILLING_ID_PDF_CHECK_ENABLED = false;
/** @const {boolean} Active la journalisation détaillée des requêtes web. */
const REQUEST_LOGGING_ENABLED = false;
/** @const {boolean} Active le traitement des requêtes POST. */
const POST_ENDPOINT_ENABLED = false;
/** @const {boolean} Limite le nombre de tentatives de connexion au portail client. */
const CLIENT_PORTAL_ATTEMPT_LIMIT_ENABLED = false;
/** @const {number} Nombre maximum de tentatives avant blocage. */
const CLIENT_PORTAL_MAX_ATTEMPTS = 10;
/** @const {boolean} Active la mise en cache des paramètres de configuration. */
const CONFIG_CACHE_ENABLED = false;
/** @const {boolean} Active la mise en cache des réservations (désactivé par défaut). */
const RESERVATION_CACHE_ENABLED = false;

// --- Drapeaux de Thème ---
/** @const {boolean} Active la nouvelle version du thème graphique (V2). */
const THEME_V2_ENABLED = true;
const ELS_UI_THEMING_ENABLED = true;
/** @const {boolean} Permet aux clients de choisir leur thème visuel. */
// const THEME_SELECTION_ENABLED = false; // supprimé: sélection de thème désactivée
/** @const {string} Thème appliqué par défaut lorsque la sélection est active. */
// const THEME_DEFAULT = 'clarte'; // supprimé
/** @const {Object<string,string>} Associe les clés de thème aux chemins des fichiers CSS. */
// const THEMES = {}; // supprimé

// Objet regroupant tous les drapeaux de fonctionnalité exposés au client
const FLAGS = Object.freeze({
  clientPortalEnabled: CLIENT_PORTAL_ENABLED,
  clientPortalSignedLinks: CLIENT_PORTAL_SIGNED_LINKS,
  privacyLinkEnabled: PRIVACY_LINK_ENABLED,
  slotsAmpmEnabled: SLOTS_AMPM_ENABLED,
  clientSessionOpaqueIdEnabled: CLIENT_SESSION_OPAQUE_ID_ENABLED,
  billingMultiSheetEnabled: BILLING_MULTI_SHEET_ENABLED,
  caEnCoursEnabled: CA_EN_COURS_ENABLED,
  calendarResyncEnabled: CALENDAR_RESYNC_ENABLED,
  calendarPurgeEnabled: CALENDAR_PURGE_ENABLED,
  calendarBarOpacityEnabled: CALENDAR_BAR_OPACITY_ENABLED,
  reservationUiV2Enabled: RESERVATION_UI_V2_ENABLED,
  residentBillingEnabled: RESIDENT_BILLING_ENABLED,
  billingModalEnabled: BILLING_MODAL_ENABLED,
  cartResetEnabled: CART_RESET_ENABLED,
  debugMenuEnabled: DEBUG_MENU_ENABLED,
  demoReservationEnabled: DEMO_RESERVATION_ENABLED,
  billingV2Dryrun: BILLING_V2_DRYRUN,
  billingLogEnabled: BILLING_LOG_ENABLED,
  billingIdPdfCheckEnabled: BILLING_ID_PDF_CHECK_ENABLED,
  requestLoggingEnabled: REQUEST_LOGGING_ENABLED,
  postEndpointEnabled: POST_ENDPOINT_ENABLED,
  clientPortalAttemptLimitEnabled: CLIENT_PORTAL_ATTEMPT_LIMIT_ENABLED,
  configCacheEnabled: CONFIG_CACHE_ENABLED,
  reservationCacheEnabled: RESERVATION_CACHE_ENABLED,
  proofSocialEnabled: PROOF_SOCIAL_ENABLED,
  proQaEnabled: PRO_QA_ENABLED,
  extraIconsEnabled: EXTRA_ICONS_ENABLED,
  themeV2Enabled: THEME_V2_ENABLED,
  elsUiThemingEnabled: ELS_UI_THEMING_ENABLED,
  pricingRulesV2Enabled: PRICING_RULES_V2_ENABLED,
  returnImpactsEstimatesEnabled: RETURN_IMPACTS_ESTIMATES_ENABLED,
  adminOptimisticCreationEnabled: ADMIN_OPTIMISTIC_CREATION_ENABLED,
  adminSlotsPngEnabled: ADMIN_SLOTS_PNG_ENABLED,
  publicAssetsEnabled: PUBLIC_ASSETS_ENABLED
});


// =================================================================
//              SYSTÈME DE TARIFICATION FLEXIBLE
// =================================================================
// Schéma des tarifs:
// { 'Type': { base: number, arrets: number[] } }
// - 'Type': 'Normal', 'Samedi', 'Urgent', 'Special'
// - base: Prix du premier arrêt (prise en charge)
// - arrets: Tarifs des arrêts suivants; le dernier s'applique au-delà
// Exemple Grille (Normal): 1=15€, 2=20€ (15+5), 3=24€ (20+4), etc.
/**
 * @const {Object<string,{base:number, arrets:number[]}>}
 * Grille tarifaire unique pilotant tous les calculs de prix.
 */
const TARIFS = {
  'Normal': { // Tarifs standard du lundi au vendredi
    base: 15,
    arrets: [5, 4, 3, 4, 5] // Prix pour Arrêt 2, 3, 4, 5, et 6+
  },
  'Samedi': { // Livraisons effectuées le samedi
    base: 25,
    arrets: [5, 4, 3, 4, 5]
  },
  'Urgent': { // Réservations dans le délai URGENT_THRESHOLD_MINUTES
    base: 20,
    arrets: [5, 4, 3, 4, 5]
  },
  'Special': { // Cas particuliers ou tarifs temporaires
    base: 30,
    arrets: [5, 4, 3, 4, 5]
  }
};

if (TARIFS.SainteMusse_EHPAD_CLASSIC) {
  TARIFS.SainteMusse_EHPAD_CLASSIC.PRECOLLECTE_VEILLE = {
    prixParBande: [5, 5, 5, 5],
    label: "Pré-collecte veille (ordonnance + carte Vitale, J-1)"
  };
}
if (TARIFS.SainteMusse_EHPAD_URGENCE) {
  TARIFS.SainteMusse_EHPAD_URGENCE.PRECOLLECTE_VEILLE = {
    prixParBande: [5, 5, 5, 5],
    label: "Pré-collecte veille (ordonnance + carte Vitale, J-1)"
  };
}


// --- Noms des colonnes spécifiques (Feuille Clients) ---
/** @const {string} Nom de la colonne indiquant le type de remise appliqué. */
const COLONNE_TYPE_REMISE_CLIENT = "Type de Remise";
/** @const {string} Nom de la colonne contenant la valeur de la remise. */
const COLONNE_VALEUR_REMISE_CLIENT = "Valeur Remise";
/** @const {string} Nom de la colonne pour le nombre de tournées offertes. */
const COLONNE_NB_TOURNEES_OFFERTES = "Nombre Tournées Offertes";


// =================================================================
//              FONCTIONS D'ACCÈS À LA CONFIGURATION
// =================================================================

const CONFIG = Object.freeze({
  TARIFS,
  DUREE_BASE,
  DUREE_ARRET_SUP,
  KM_BASE,
  KM_ARRET_SUP,
  URGENT_THRESHOLD_MINUTES,
  HEURE_DEBUT_SERVICE,
  HEURE_FIN_SERVICE,
  TVA_APPLICABLE,
  ANNEES_RETENTION_FACTURES,
  MOIS_RETENTION_LOGS,
  CLIENT_PORTAL_ATTEMPT_LIMIT_ENABLED,
  CLIENT_PORTAL_MAX_ATTEMPTS,
  SHEET_RESERVATIONS,
  BILLING,
  BILLING_MODAL_ENABLED,
  RESIDENT_BILLING_ENABLED,
  RESERVATION_VERIFY_ENABLED,
  BILLING_LOG_ENABLED,
  BILLING_V2_DRYRUN,
  BILLING_ID_PDF_CHECK_ENABLED
});

/**
 * Retourne un objet contenant les paramètres de configuration principaux.
 * @returns {object} L'objet de configuration.
 */
function getConfig() {
  return CONFIG;
}

function getPublicConfig() {
  return {
    TARIFS: CONFIG.TARIFS,
    DUREE_BASE: CONFIG.DUREE_BASE,
    DUREE_ARRET_SUP: CONFIG.DUREE_ARRET_SUP,
    KM_BASE: CONFIG.KM_BASE,
    KM_ARRET_SUP: CONFIG.KM_ARRET_SUP,
    URGENT_THRESHOLD_MINUTES: CONFIG.URGENT_THRESHOLD_MINUTES,
    HEURE_DEBUT_SERVICE: CONFIG.HEURE_DEBUT_SERVICE,
    HEURE_FIN_SERVICE: CONFIG.HEURE_FIN_SERVICE,
    TVA_APPLICABLE: CONFIG.TVA_APPLICABLE
  };
}

/**
 * Retourne la configuration depuis le cache si activé, sinon la recalcule.
 * Utile pour améliorer les performances en limitant les accès globaux.
 * @returns {object} L'objet de configuration, potentiellement depuis le cache.
 */
function getConfigCached() {
  if (!CONFIG_CACHE_ENABLED) {
    return getConfig();
  }
  const cache = CacheService.getScriptCache();
  const cachedConfig = cache.get('CONFIG_JSON');
  if (cachedConfig) {
    return JSON.parse(cachedConfig);
  }
  const config = getConfig();
  // Met en cache la configuration pour 10 minutes (600 secondes)
  cache.put('CONFIG_JSON', JSON.stringify(config), 600);
  return config;
}
