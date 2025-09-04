
// =================================================================
//                 CONFIGURATION DE L'APPLICATION
// =================================================================
// Description: Centralise toutes les variables et paramètres
//              personnalisables de l'application.
// =================================================================

// --- Informations sur l'entreprise ---
/** @const {string} Nom officiel de l'entreprise utilisé dans l'interface et la facturation. */
const NOM_ENTREPRISE = "EL Services";
/** @const {string} Adresse postale de l'entreprise pour les documents légaux. */
const ADRESSE_ENTREPRISE = "255 Avenue Marcel Castie B, 83000 Toulon";
/** @const {string} Adresse e-mail de contact de l'entreprise. */
const EMAIL_ENTREPRISE = "elservicestoulon@gmail.com";
/** @const {string} Numéro SIRET d'immatriculation de l'entreprise. */
const SIRET = "48091306000020";
/** @const {string} IBAN utilisé pour les règlements clients. */
const RIB_ENTREPRISE = "FR7640618804760004035757187";
/** @const {string} Code BIC correspondant au compte bancaire de l'entreprise. */
const BIC_ENTREPRISE = "BOUSFRPPXXX";
/** @const {string} Adresse e-mail recevant les notifications administratives. */
const ADMIN_EMAIL = "elservicestoulon@gmail.com";

// --- Paramètres de facturation ---
/** @const {boolean} Indique si la TVA est appliquée ; désactivé par défaut. */
const TVA_APPLICABLE = false;
/** @const {number} Taux de TVA appliqué lorsque TVA_APPLICABLE est true (0.20 pour 20%). */
const TAUX_TVA = 0.20;
/** @const {number} Délai de paiement accordé au client en jours. */
const DELAI_PAIEMENT_JOURS = 5;

// --- Paramètres de rétention des données ---
/** @const {number} Durée de conservation légale des factures (années). */
const ANNEES_RETENTION_FACTURES = 5;
/** @const {number} Durée de conservation des logs d'activité (mois). */
const MOIS_RETENTION_LOGS = 12;

// --- Identifiants des services Google ---
/** @const {string} Identifiant du calendrier Google utilisé pour les réservations. */
const ID_CALENDRIER = "Elservicestoulon@gmail.com";
/** @const {string} ID du document Google Docs contenant les CGV. */
const ID_DOCUMENT_CGV = "1ze9U3k_tcS-RlhIcI8zSs2OYom2miVy8WxyxT8ktFp0";
/** @const {string} ID de la feuille de calcul Google Sheets principale. */
const ID_FEUILLE_CALCUL = "1-i8xBlCrl_Rrjo2FgiL33pIRjD1EFqyvU7ILPud3-r4";
/** @const {string} ID du modèle Google Docs utilisé pour générer les factures PDF. */
const ID_MODELE_FACTURE = "1KWDS0gmyK3qrYWJd01vGID5fBVK10xlmErjgr7lrwmU";
/** @const {string} ID du dossier Google Drive où sont archivées les factures. */
const ID_DOSSIER_ARCHIVES = "1UavaEsq6TkDw1QzJZ91geKyF7hrQY4S8";
/** @const {string} ID du dossier Google Drive temporaire pour les fichiers intermédiaires. */
const ID_DOSSIER_TEMPORAIRE = "1yDBSzTqwaUt-abT0s7Z033C2WlN1NSs6";

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

// --- Paramètres semainier ---
/** @const {Object<string,string[]>} Plages horaires par partie de journée. */
const SEMAINIER_WINDOWS = {
  matin: ['08:00','12:00'],
  midi: ['12:00','14:00'],
  apresmidi: ['14:00','18:00'],
  soir: ['18:00','21:00']
};
/** @const {number} Pas des horaires du semainier en minutes. */
const SEMAINIER_STEP_MIN = 15;

// --- Durées & Kilométrage des prestations ---
/** @const {number} Durée standard d'une prise en charge en minutes. */
const DUREE_BASE = 30;
/** @const {number} Durée supplémentaire par arrêt additionnel en minutes. */
const DUREE_ARRET_SUP = 15;
/** @const {number} Distance de base estimée pour une tournée en kilomètres. */
const KM_BASE = 9;
/** @const {number} Kilométrage ajouté pour chaque arrêt supplémentaire en kilomètres. */
const KM_ARRET_SUP = 3;

// =================================================================
//              DRAPEAUX D'ACTIVATION (FEATURE FLAGS)
// =================================================================

// --- Drapeaux de Fonctionnalités Générales ---
/** @const {boolean} Active l'espace client. */
const CLIENT_PORTAL_ENABLED = true;
/** @const {boolean} Affiche le lien vers les informations de confidentialité. */
const PRIVACY_LINK_ENABLED = false;
/** @const {boolean} Sépare l'affichage des créneaux en matin et après-midi. */
const SLOTS_AMPM_ENABLED = false;
/** @const {boolean} Agrège toutes les feuilles "Facturation*" lors du calcul des factures. */
const BILLING_MULTI_SHEET_ENABLED = true;
/** @const {boolean} Affiche le chiffre d'affaires en cours dans l'interface admin. */
const CA_EN_COURS_ENABLED = true;
/** @const {boolean} Resynchronise les événements manquants du calendrier Google. */
const CALENDAR_RESYNC_ENABLED = true;
/** @const {boolean} Supprime les identifiants d'événements introuvables pour garder la base propre. */
const CALENDAR_PURGE_ENABLED = true;

/** @const {boolean} Active la nouvelle interface de réservation JavaScript. */
const RESERVATION_UI_V2_ENABLED = true;

// --- Drapeaux de Débogage et de Test ---
/** @const {boolean} Affiche le sous-menu Debug et l'interface associée. */
const DEBUG_MENU_ENABLED = true;
/** @const {boolean} Sert une version de démo de la page de réservation. */
const DEMO_RESERVATION_ENABLED = false;
/** @const {boolean} Active le mode test pour la facturation V2 (aucune écriture). */
const BILLING_V2_DRYRUN = false;
/** @const {boolean} Active la journalisation détaillée des requêtes web. */
const REQUEST_LOGGING_ENABLED = false;
/** @const {boolean} Active le traitement des requêtes POST. */
const POST_ENDPOINT_ENABLED = false;
/** @const {boolean} Active la mise en cache des paramètres de configuration. */
const CONFIG_CACHE_ENABLED = true;

// --- Drapeaux de Thème ---
/** @const {boolean} Active la nouvelle version du thème graphique (V2). */
const THEME_V2_ENABLED = true;
/** @const {boolean} Permet aux clients de choisir leur thème visuel. */
const THEME_SELECTION_ENABLED = true;
/** @const {string} Thème appliqué par défaut lorsque la sélection est active. */
const THEME_DEFAULT = 'nocturne';
/** @const {Object<string,string>} Associe les clés de thème aux chemins des fichiers CSS. */
const THEMES = {
  clarte: 'branding/Theme_Clarte_CSS',
  nocturne: 'branding/Theme_Nocturne_CSS'
};


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

/**
 * Retourne un objet contenant les paramètres de configuration principaux.
 * @returns {object} L'objet de configuration.
 */
function getConfig() {
  return {
    TARIFS: TARIFS,
    DUREE_BASE: DUREE_BASE,
    DUREE_ARRET_SUP: DUREE_ARRET_SUP,
    KM_BASE: KM_BASE,
    KM_ARRET_SUP: KM_ARRET_SUP,
    URGENT_THRESHOLD_MINUTES: URGENT_THRESHOLD_MINUTES,
    HEURE_DEBUT_SERVICE: HEURE_DEBUT_SERVICE,
    HEURE_FIN_SERVICE: HEURE_FIN_SERVICE,
    TVA_APPLICABLE: TVA_APPLICABLE,
    ANNEES_RETENTION_FACTURES: ANNEES_RETENTION_FACTURES,
    MOIS_RETENTION_LOGS: MOIS_RETENTION_LOGS,
    SEMAINIER_WINDOWS: SEMAINIER_WINDOWS,
    SEMAINIER_STEP_MIN: SEMAINIER_STEP_MIN,
    SHEET_RESERVATIONS: SHEET_RESERVATIONS
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
