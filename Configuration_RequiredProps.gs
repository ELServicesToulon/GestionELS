/**
 * Propriétés Script requises (Script Properties)
 * Utilisées par getSecret(name) dans Utilitaires.gs et Configuration.gs.
 */
const REQUIRED_PROPS = Object.freeze([
  'NOM_ENTREPRISE',
  'SIRET',
  'ADRESSE_ENTREPRISE',
  'EMAIL_ENTREPRISE',
  'ADMIN_EMAIL',
  'RIB_ENTREPRISE',
  'BIC_ENTREPRISE',
  'ID_FEUILLE_CALCUL',
  'ID_CALENDRIER',
  'ID_MODELE_FACTURE',
  'ID_DOSSIER_ARCHIVES',
  'ID_DOSSIER_TEMPORAIRE',
  // Dossier Drive exposé publiquement (alias accepté: DOCS_PUBLIC_FOLDER_ID)
  'DOSSIER_PUBLIC_FOLDER_ID',
  'ID_DOCUMENT_CGV',
  'ELS_SHARED_SECRET'
]);

/**
 * Test simple exécutable via `clasp run test_requiredProps`.
 * Retourne l'état et la liste des propriétés manquantes.
 */
function test_requiredProps() {
  const sp = PropertiesService.getScriptProperties();
  const missing = REQUIRED_PROPS.filter(k => {
    if (k === 'DOSSIER_PUBLIC_FOLDER_ID') {
      const v1 = sp.getProperty('DOSSIER_PUBLIC_FOLDER_ID');
      const v2 = sp.getProperty('DOCS_PUBLIC_FOLDER_ID');
      return (v1 === null || v1 === '') && (v2 === null || v2 === '');
    }
    const v = sp.getProperty(k);
    return v === null || v === '';
  });
  const ok = missing.length === 0;
  Logger.log(ok ? 'Toutes les propriétés requises sont définies.' : ('Propriétés manquantes: ' + missing.join(', ')));
  return { ok: ok, missing: missing };
}

/** Lève une erreur si des propriétés sont manquantes. */
function ensureRequiredProps() {
  const res = test_requiredProps();
  if (!res.ok) {
    throw new Error('Script Properties manquantes: ' + res.missing.join(', '));
  }
}

/**
 * Récupère une propriété ou lève une erreur si absente.
 * Wrapper léger autour de getSecret(name) pour compatibilité.
 * @param {string} k Nom de la propriété Script.
 * @returns {string}
 */
function getPropOrThrow_(k) {
  if (!k) throw new Error('Clé de propriété requise.');
  return getSecret(String(k));
}
