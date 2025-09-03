// =================================================================
//                      CONFIGURATION DE L'APPLICATION
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
/** @const {boolean} Indique si la TVA est appliquée ; désactivé par défaut. */
const TVA_APPLICABLE = false;

/** @const {number} Taux de TVA appliqué lorsque TVA_APPLICABLE est true (0.20 pour 20%). */
const TAUX_TVA = 0.20;

/** @const {number} Délai de paiement accordé au client en jours. */
const DELAI_PAIEMENT_JOURS = 5;

// --- Paramètres de rétention des données ---
const ANNEES_RETENTION_FACTURES = 5; // Durée de conservation légale des factures (années)
const MOIS_RETENTION_LOGS = 12;      // Durée de conservation des logs d'activité (mois)

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

// --- Noms des feuilles ---
/** Feuille contenant les données de facturation. */
const SHEET_FACTURATION = 'Facturation';
/** Feuille listant les clients. */
const SHEET_CLIENTS = 'Clients';
/** Feuille stockant les paramètres globaux. */
const SHEET_PARAMETRES = 'Paramètres';
/** Feuille de journalisation pour l'administration. */
const SHEET_ADMIN_LOGS = 'Admin_Logs';
/** Feuille de journalisation générale. */
const SHEET_LOGS = 'Logs';
/** Feuille des plages horaires bloquées. */
const SHEET_PLAGES_BLOQUEES = 'Plages_Bloquees';
/** Feuille par défaut des nouveaux classeurs. */
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

// --- Durées des prestations (minutes) ---
/** @const {number} Durée standard d'une prise en charge en minutes. */
const DUREE_BASE = 30;

/** @const {number} Durée supplémentaire par arrêt additionnel en minutes. */
const DUREE_ARRET_SUP = 15;

// --- Kilométrage estimé ---
/** @const {number} Distance de base estimée pour une tournée en kilomètres. */
const KM_BASE = 9;

/** @const {number} Kilométrage ajouté pour chaque arrêt supplémentaire en kilomètres. */
const KM_ARRET_SUP = 3;

// --- Flags d'activation ---
/** @const {boolean} Désactivé par défaut. Active la mise en cache des paramètres. */
const CONFIG_CACHE_ENABLED = false;

/** @const {boolean} Activé par défaut. Resynchronise les événements manquants du calendrier Google. */
const CALENDAR_RESYNC_ENABLED = true;

/** @const {boolean} Activé par défaut. Supprime les identifiants d'événements introuvables pour garder la base propre. */
const CALENDAR_PURGE_ENABLED = true;

/** @const {boolean} Activé par défaut. Agrège toutes les feuilles "Facturation*" lors du calcul des factures. */
const BILLING_MULTI_SHEET_ENABLED = true;

/** @const {boolean} Activé par défaut. Affiche le chiffre d'affaires en cours dans l'interface admin. */
const CA_EN_COURS_ENABLED = true;

/** @const {boolean} Désactivé par défaut. Sert une version légère de la page de réservation pour démonstration. */
const DEMO_RESERVATION_ENABLED = false;

/** @const {boolean} Désactivé par défaut. Sépare l'affichage des créneaux en matin et après-midi. */
const SLOTS_AMPM_ENABLED = false;

/** @const {boolean} Désactivé par défaut. Active la nouvelle version du thème graphique. */
const THEME_V2_ENABLED = false;

/** @const {boolean} Désactivé par défaut. Simule la facturation V2 sans écriture persistante. */
const BILLING_V2_DRYRUN = false;

/** @const {boolean} Désactivé par défaut. Enregistre chaque requête entrante pour débogage. */
const REQUEST_LOGGING_ENABLED = false;

/** @const {boolean} Désactivé par défaut. Autorise le traitement des requêtes HTTP POST. */
const POST_ENDPOINT_ENABLED = false;

/** @const {boolean} Désactivé par défaut. Affiche le lien vers les informations de confidentialité. */
const PRIVACY_LINK_ENABLED = false;

/** @const {boolean} Activé par défaut. Permet aux clients de choisir leur thème visuel. */
const THEME_SELECTION_ENABLED = true;

/** @const {string} Thème appliqué par défaut lorsque aucune sélection n'est fournie. */
const THEME_DEFAULT = 'nocturne';

/** @const {Object<string,string>} Associe les clés de thème aux chemins des feuilles de style correspondantes. */
const THEMES = {
  clarte: 'branding/Theme_Clarte_CSS',
  nocturne: 'branding/Theme_Nocturne_CSS'
};

// =================================================================
// SYSTÈME DE TARIFICATION FLEXIBLE - SOURCE UNIQUE DE VÉRITÉ
// =================================================================
// Pilotez tous les tarifs depuis cet objet.
// 'base': Prix pour le premier arrêt (la prise en charge).
// 'arrets': Un tableau des prix pour les arrêts suivants.
//           Le dernier prix s'applique à tous les arrêts au-delà.
// Grille tarifaire (Normal): 1=15€, 2=20€, 3=23€, 4=27€, 5=32€, 6 et + = 37€
/**
 * @const {Object<string,{base:number, arrets:number[]}>}
 * Grille tarifaire unique pilotant tous les calculs de prix.
 */
const TARIFS = {
  'Normal': {
    base: 15,
    arrets: [5, 4, 3, 4, 5] // Prix pour Arrêt 2, 3, 4, 5, et 6+
  },
  'Samedi': {
    base: 25,
    arrets: [5, 4, 3, 4, 5]
  },
  'Urgent': {
    base: 20,
    arrets: [5, 4, 3, 4, 5]
  },
  'Special': { // Vous pouvez ajouter autant de types que vous voulez
    base: 30,
    arrets: [5, 4, 3, 4, 5]
  }
};
// =================================================================

// --- Noms des colonnes spécifiques ---
/** @const {string} Nom de la colonne indiquant le type de remise appliqué. */
const COLONNE_TYPE_REMISE_CLIENT = "Type de Remise";

/** @const {string} Nom de la colonne contenant la valeur de la remise. */
const COLONNE_VALEUR_REMISE_CLIENT = "Valeur Remise";

/** @const {string} Nom de la colonne pour le nombre de tournées offertes. */
const COLONNE_NB_TOURNEES_OFFERTES = "Nombre Tournées Offertes";


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
    TVA_APPLICABLE: typeof TVA_APPLICABLE !== 'undefined' ? TVA_APPLICABLE : false,
    ANNEES_RETENTION_FACTURES: ANNEES_RETENTION_FACTURES,
    MOIS_RETENTION_LOGS: MOIS_RETENTION_LOGS
  };
}

function getConfigCached() {
  if (!CONFIG_CACHE_ENABLED) return getConfig();
  const cache = CacheService.getScriptCache();
  const raw = cache.get('CONFIG_JSON');
  if (raw) return JSON.parse(raw);
  const conf = getConfig();
  cache.put('CONFIG_JSON', JSON.stringify(conf), 600); // 10 min
  return conf;
}

