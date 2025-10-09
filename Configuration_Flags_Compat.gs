/**
 * Feature flags centralisés ELS (compatibilité)
 * Source unique: valeurs définies dans Configuration.gs. Ne pas dupliquer ailleurs.
 * Fournit un objet __FLAGS avec des clés UPPER_SNAKE_CASE pour usage hérité.
 */
const __FLAGS = Object.freeze({
  THEME_V2_ENABLED: typeof THEME_V2_ENABLED !== 'undefined' ? THEME_V2_ENABLED : true,
  THEME_SELECTION_ENABLED: typeof THEME_SELECTION_ENABLED !== 'undefined' ? THEME_SELECTION_ENABLED : false,
    SLOTS_AMPM_ENABLED: typeof SLOTS_AMPM_ENABLED !== 'undefined' ? SLOTS_AMPM_ENABLED : false,
    RESERVATION_CACHE_ENABLED: typeof RESERVATION_CACHE_ENABLED !== 'undefined' ? RESERVATION_CACHE_ENABLED : true,
    RESERVATION_SHOW_TAKEN_SLOTS_ENABLED: typeof RESERVATION_SHOW_TAKEN_SLOTS_ENABLED !== 'undefined' ? RESERVATION_SHOW_TAKEN_SLOTS_ENABLED : true,
    DEBUG_MENU_ENABLED: typeof DEBUG_MENU_ENABLED !== 'undefined' ? DEBUG_MENU_ENABLED : false,
  PRICING_RULES_V2_ENABLED: typeof PRICING_RULES_V2_ENABLED !== 'undefined' ? PRICING_RULES_V2_ENABLED : true,
  CALENDAR_RESYNC_ENABLED: typeof CALENDAR_RESYNC_ENABLED !== 'undefined' ? CALENDAR_RESYNC_ENABLED : true,
  CALENDAR_PURGE_ENABLED: typeof CALENDAR_PURGE_ENABLED !== 'undefined' ? CALENDAR_PURGE_ENABLED : true,
  ADMIN_OPTIMISTIC_CREATION_ENABLED: typeof ADMIN_OPTIMISTIC_CREATION_ENABLED !== 'undefined' ? ADMIN_OPTIMISTIC_CREATION_ENABLED : true,
  BILLING_ATOMIC_NUMBERING_ENABLED: typeof BILLING_ATOMIC_NUMBERING_ENABLED !== 'undefined' ? BILLING_ATOMIC_NUMBERING_ENABLED : false
});

/**
 * Constante de compatibilité pour ancien code (réintroduite si absente).
 * Dans ce projet, la sélection de thème est désactivée.
 */
(function (g) {
  if (typeof g.THEME_SELECTION_ENABLED === 'undefined') {
    g.THEME_SELECTION_ENABLED = false;
  }
})(this);

/** Renvoie true si le drapeau est activé. */
function isFlagEnabled(name) {
  return __FLAGS[name] === true;
}

/** Retourne une copie simple des drapeaux (pour UI). */
function getFlagsUpper() {
  return Object.assign({}, __FLAGS);
}
