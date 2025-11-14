/**
 * Propriétés Script requises (Script Properties)
 * Utilisées par getSecret(name) dans Utilitaires.gs et Configuration.gs.
 */

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
      const v1Missing = v1 === null || v1 === '' || (typeof isScriptPropertyPlaceholder === 'function' && isScriptPropertyPlaceholder(k, v1));
      const v2Missing = v2 === null || v2 === '' || (typeof isScriptPropertyPlaceholder === 'function' && isScriptPropertyPlaceholder('DOCS_PUBLIC_FOLDER_ID', v2));
      return v1Missing && v2Missing;
    }
    const v = sp.getProperty(k);
    const placeholderMissing = typeof isScriptPropertyPlaceholder === 'function' && isScriptPropertyPlaceholder(k, v);
    return v === null || v === '' || placeholderMissing;
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
