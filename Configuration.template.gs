// ============================================================================
//              GESTIONELS – CONFIGURATION TEMPLATE (Apps Script)
// ============================================================================
// This template documents every Script Property and constant consumed by
// Configuration.gs and the surrounding setup helpers. Use it as a checklist
// when provisioning a new workspace: copy the relevant sections into
// Configuration.gs or populate Script Properties with the matching keys.
// ============================================================================

/**
 * Required Script Properties (Setup_Checks.gs > REQUIRED_PROPS).
 * Replace each placeholder with your production identifiers before storing
 * them via `Script Properties` or secrets tooling.
 */
const SCRIPT_PROPERTIES_REQUIRED = {
  NOM_ENTREPRISE: 'EL Services Littoral',            // -> Configuration.gs > NOM_ENTREPRISE
  ADRESSE_ENTREPRISE: '1 Rue Exemple, 83000 Toulon', // -> Configuration.gs > ADRESSE_ENTREPRISE
  EMAIL_ENTREPRISE: 'contact@example.com',           // -> Configuration.gs > EMAIL_ENTREPRISE
  ADMIN_EMAIL: 'admin@example.com',                  // -> Configuration.gs > ADMIN_EMAIL
  ID_FEUILLE_CALCUL: '1aYourSheetId',                // -> Utilitaires.gs / Maintenance.gs openById
  ID_CALENDRIER: 'your-calendar-id@group.calendar.google.com', // -> Calendrier.gs fetchCalendarEvents
  ID_DOCUMENT_CGV: '1aYourCgvDocId',                 // -> CGV.html download links & Configuration.gs references
  ID_MODELE_FACTURE: '1aYourInvoiceDocId',           // -> BILLING.DOC_TEMPLATE_FACTURE_ID in Configuration.gs
  ID_DOSSIER_ARCHIVES: '1aYourArchiveFolderId',      // -> Maintenance.gs backup routines
  ID_DOSSIER_TEMPORAIRE: '1aYourTempFolderId',       // -> Gestion.gs upload flows
  SIRET: '00000000000000',                           // -> Factures mention légale (Configuration.gs consumers)
  ELS_SHARED_SECRET: 'set-a-long-random-secret',     // -> Utilitaires.gs signature helpers
  ID_FACTURES_DRIVE: '1aYourInvoiceExportsId'        // -> Setup_Checks.gs sanity check for Drive exports
};

/**
 * Optional Script Properties recognised across the codebase.
 */
const SCRIPT_PROPERTIES_OPTIONAL = {
  ID_DOSSIER_FACTURES: '1aYourInvoicesFolderId',     // Overrides FACTURES_FOLDER_ID fallback in Configuration.gs
  ID_LOGO_FACTURE: '1aYourInvoiceLogoId',            // Replaces BRANDING_LOGO_FILE_ID on invoices
  DOSSIER_PUBLIC_FOLDER_ID: '1aYourPublicAssetsId',  // Alternative public folder for Drive assets
  DOCS_PUBLIC_FOLDER_ID: '1aYourDocsFolderId',       // Legacy alias used during migrations
  FCM_SA_JSON: 'service-account-json-string',        // FcmService.gs > getServiceAccount_()
  CFG_FIREBASE_PROJECT_ID: 'els-services-littoral'   // README.md setup for mobile/PWA integrations
};

/**
 * Business constants mirrored from Configuration.gs.
 * Adjust to match local operating constraints before deploying.
 */
const RUNTIME_CONSTANTS = {
  TVA_APPLICABLE: false,                // -> Configuration.gs > TVA_APPLICABLE (Art. 293 B CGI mention)
  TAUX_TVA: 0.20,                       // -> Configuration.gs > TAUX_TVA when TVA_APPLICABLE === true
  DELAI_PAIEMENT_JOURS: 5,              // -> Configuration.gs > DELAI_PAIEMENT_JOURS
  HEURE_DEBUT_SERVICE: '08:30',         // -> Configuration.gs > HEURE_DEBUT_SERVICE (start of deliveries)
  HEURE_FIN_SERVICE: '18:30',           // -> Configuration.gs > HEURE_FIN_SERVICE (end of deliveries)
  DUREE_TAMPON_MINUTES: 15,             // -> Configuration.gs > DUREE_TAMPON_MINUTES (pre/post buffer)
  INTERVALLE_CRENEAUX_MINUTES: 15,      // -> Configuration.gs > INTERVALLE_CRENEAUX_MINUTES (slot granularity)
  URGENT_THRESHOLD_MINUTES: 30,         // -> Configuration.gs > URGENT_THRESHOLD_MINUTES
  DUREE_BASE: 30,                       // -> Configuration.gs > DUREE_BASE (base visit length)
  DUREE_ARRET_SUP: 15,                  // -> Configuration.gs > DUREE_ARRET_SUP (extra stop duration)
  KM_BASE: 9,                           // -> Configuration.gs > KM_BASE (baseline tour distance)
  KM_ARRET_SUP: 3,                      // -> Configuration.gs > KM_ARRET_SUP (per additional stop)
  CLIENT_SESSION_TTL_HOURS: 24          // -> Configuration.gs > CLIENT_SESSION_TTL_HOURS
};

/**
 * Feature flags default values (Configuration.gs – section DRAPEAUX D'ACTIVATION).
 * Flip these booleans via Config.gs only—never duplicate business logic elsewhere.
 */
const FEATURE_FLAGS_DEFAULTS = {
  CLIENT_PORTAL_ENABLED: true,
  CLIENT_PORTAL_SIGNED_LINKS: false,
  PRIVACY_LINK_ENABLED: true,
  LEGAL_NOTICE_LINK_ENABLED: true,
  SLOTS_AMPM_ENABLED: false,
  CLIENT_SESSION_OPAQUE_ID_ENABLED: true,
  SEND_MAIL_SCOPE_CHECK_ENABLED: true,
  BILLING_MULTI_SHEET_ENABLED: true,
  CA_EN_COURS_ENABLED: true,
  CHARTS_PROXY_PREFETCH_ENABLED: false,
  CLIENT_CHARTS_ENABLED: true,
  CALENDAR_RESYNC_ENABLED: true,
  CALENDAR_PURGE_ENABLED: true,
  CALENDAR_BAR_OPACITY_ENABLED: false,
  ADMIN_OPTIMISTIC_CREATION_ENABLED: true,
  ADMIN_SLOTS_PNG_ENABLED: false,
  RESERVATION_VERIFY_ENABLED: true,
  RESERVATION_UI_V2_ENABLED: true,
  RESIDENT_BILLING_ENABLED: true,
  RESIDENT_AFFILIATION_REQUIRED: true,
  RESIDENT_REPLAN_ALLOW_ANY_SLOT: false,
  TARIFS_DETAILLE_ENABLED: true,
  FORFAIT_RESIDENT_ENABLED: true,
  BILLING_ATOMIC_NUMBERING_ENABLED: false,
  BILLING_MODAL_ENABLED: true,
  CART_RESET_ENABLED: true,
  RETURN_IMPACTS_ESTIMATES_ENABLED: true,
  PRICING_RULES_V2_ENABLED: true,
  CLIENT_ADRESSE_AUTOCOMPLETE_ENABLED: true,
  PROOF_SOCIAL_ENABLED: false,
  PRO_QA_ENABLED: false,
  EXTRA_ICONS_ENABLED: false,
  ADMIN_DEVIS_PDF_ENABLED: true,
  DEBUG_MENU_ENABLED: false,
  DEMO_RESERVATION_ENABLED: false,
  BILLING_LOG_ENABLED: true,
  BILLING_V2_DRYRUN: true,
  BILLING_ID_PDF_CHECK_ENABLED: true,
  REQUEST_LOGGING_ENABLED: true,
  POST_ENDPOINT_ENABLED: true,
  CLIENT_PORTAL_ATTEMPT_LIMIT_ENABLED: false,
  CONFIG_CACHE_ENABLED: true,
  RESERVATION_CACHE_ENABLED: true,
  DEVIS_ENABLED: true,
  RESERVATION_SHOW_TAKEN_SLOTS_ENABLED: true,
  THEME_V2_ENABLED: true,
  ELS_UI_THEMING_ENABLED: true,
  THEME_SWITCHER_ENABLED: true,
  DRIVE_ASSETS_ENABLED: false
};

/**
 * Branding placeholders reused by Configuration.gs.
 */
const BRANDING_TEMPLATE = {
  BRANDING_LOGO_FILE_ID: '1aYourLogoId',            // -> Configuration.gs constant for Drive asset
  BRANDING_LOGO_PUBLIC_URL: 'https://drive.google.com/uc?export=view&id=1aYourLogoId',
  FACTURE_LOGO_FILE_ID: '1aYourInvoiceLogoId',      // Fallback when ID_LOGO_FACTURE is provided
  DRIVE_ASSET_IDS: {
    CAPSULE_1X: '1aCapsule1x',
    CAPSULE_2X: '1aCapsule2x',
    BLISTER_1X: '1aBlister1x',
    BLISTER_2X: '1aBlister2x',
    ALUMINIUM_1X: '1aAluminium1x',
    ALUMINIUM_2X: '1aAluminium2x'
  }
};

/**
 * Export helper used by Setup_Checks.gs / getConfiguration() when testing.
 * This keeps the template purely informational—do not deploy it as-is.
 */
function getConfigurationTemplate() {
  return {
    scriptProperties: {
      required: SCRIPT_PROPERTIES_REQUIRED,
      optional: SCRIPT_PROPERTIES_OPTIONAL
    },
    runtime: RUNTIME_CONSTANTS,
    featureFlags: FEATURE_FLAGS_DEFAULTS,
    branding: BRANDING_TEMPLATE
  };
}

// End of template — copy carefully into Configuration.gs, then delete values
// that should remain secret after storing them in Script Properties.
