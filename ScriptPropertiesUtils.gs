// =================================================================
//            UTILITAIRES DE PROPRIÉTÉS SCRIPT (ELS)
// =================================================================
// Fonctions d'export/import contrôlé des Script Properties.
// Valeurs sensibles jamais loguées, aperçus masqués uniquement.
// =================================================================

const SCRIPT_PROPERTY_PLACEHOLDER_PREFIX = 'TODO_ELS_';

const SCRIPT_PROPERTIES_PLACEHOLDERS = Object.freeze({
  NOM_ENTREPRISE: 'TODO_ELS_NOM_ENTREPRISE',
  ADRESSE_ENTREPRISE: 'TODO_ELS_ADRESSE_ENTREPRISE',
  EMAIL_ENTREPRISE: 'contact@example.com',
  ADMIN_EMAIL: 'admin@example.com',
  SIRET: '00000000000000',
  ID_FEUILLE_CALCUL: 'TODO_ELS_SPREADSHEET_ID',
  ID_FACTURES_DRIVE: 'TODO_ELS_FACTURES_FOLDER_ID',
  ID_CALENDRIER: 'TODO_ELS_CALENDAR_ID',
  ID_DOCUMENT_CGV: 'TODO_ELS_DOC_CGV_ID',
  ID_MODELE_FACTURE: 'TODO_ELS_DOC_MODELE_FACTURE_ID',
  ID_DOSSIER_ARCHIVES: 'TODO_ELS_ARCHIVES_FOLDER_ID',
  ID_DOSSIER_TEMPORAIRE: 'TODO_ELS_TEMP_FOLDER_ID',
  ID_LOGO: 'TODO_ELS_LOGO_FILE_ID',
  DOSSIER_PUBLIC_FOLDER_ID: 'TODO_ELS_PUBLIC_FOLDER_ID',
  DOCS_PUBLIC_FOLDER_ID: 'TODO_ELS_PUBLIC_FOLDER_ID',
  ELS_SHARED_SECRET: 'TODO_ELS_SHARED_SECRET',
  TRACE_SECRET: 'TODO_ELS_TRACE_SECRET',
  OPENAI_API_KEY: 'sk-placeholder',
  ID_FEUILLE_CALCUL_TOURNEES: 'TODO_ELS_TOURNEES_SHEET_ID',
  ASSISTANT_THREAD_DEFAULT: 'TODO_ELS_ASSISTANT_THREAD',
  'assistant_tokens:202511': '0'
});

/**
 * Retourne la valeur placeholder éventuelle pour une propriété Script.
 * @param {string} key
 * @returns {string}
 */
function getScriptPropertyPlaceholder(key) {
  if (!key) {
    return '';
  }
  const normalizedKey = String(key).trim();
  if (!normalizedKey) {
    return '';
  }
  if (Object.prototype.hasOwnProperty.call(SCRIPT_PROPERTIES_PLACEHOLDERS, normalizedKey)) {
    return SCRIPT_PROPERTIES_PLACEHOLDERS[normalizedKey];
  }
  const safeKey = normalizedKey.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
  return SCRIPT_PROPERTY_PLACEHOLDER_PREFIX + safeKey;
}

/**
 * Indique si une valeur correspond au placeholder par défaut.
 * @param {string} key
 * @param {*} value
 * @returns {boolean}
 */
function isScriptPropertyPlaceholder(key, value) {
  if (!key) {
    return false;
  }
  const expected = getScriptPropertyPlaceholder(key);
  if (!expected) {
    return false;
  }
  return String(value || '') === expected;
}

/**
 * Masque une valeur sensible pour affichage.
 * @param {string} value
 * @returns {string}
 */
function maskPropertyValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const raw = String(value);
  if (!raw) {
    return '';
  }
  if (raw.length <= 4) {
    return '*'.repeat(raw.length);
  }
  const head = raw.substring(0, 2);
  const tail = raw.substring(raw.length - 2);
  return head + '***' + tail;
}

/**
 * Exporte les Script Properties.
 * @param {{includeValues?:boolean}} [options]
 * @returns {{ok:boolean, keys:string[], masked:Object<string,string>, properties?:Object<string,string>}}
 */
function exportScriptProperties(options) {
  const opts = options || {};
  const includeValues = !!opts.includeValues;
  const sp = PropertiesService.getScriptProperties();
  const props = sp.getProperties() || {};
  const keys = Object.keys(props).sort();
  const masked = {};
  keys.forEach(key => {
    masked[key] = maskPropertyValue(props[key]);
  });
  Logger.log('[exportScriptProperties] total=%s includeValues=%s', keys.length, includeValues);
  const result = {
    ok: true,
    keys: keys,
    masked: masked
  };
  if (includeValues) {
    result.properties = props;
  }
  return result;
}

/**
 * Importe des Script Properties.
 * @param {Object<string,*>} properties
 * @param {{overwrite?:boolean,dryRun?:boolean}} [options]
 * @returns {{ok:boolean,report:{added:string[],replaced:string[],skipped:string[]},overwrite:boolean,dryRun:boolean,reason?:string}}
 */
function importScriptProperties(properties, options) {
  if (!properties || typeof properties !== 'object') {
    return { ok: false, reason: 'MISSING_FIELDS' };
  }
  const opts = options || {};
  const overwrite = typeof opts.overwrite === 'boolean' ? opts.overwrite : true;
  const dryRun = !!opts.dryRun;
  const sp = PropertiesService.getScriptProperties();
  const existing = sp.getProperties() || {};
  const report = {
    added: [],
    replaced: [],
    skipped: []
  };
  Object.keys(properties).forEach(rawKey => {
    if (!rawKey || typeof rawKey !== 'string') {
      return;
    }
    const key = rawKey.trim();
    if (!key) {
      return;
    }
    const value = properties[rawKey];
    const normalizedValue = value === null || value === undefined ? '' : String(value);
    if (Object.prototype.hasOwnProperty.call(existing, key)) {
      if (overwrite) {
        if (!dryRun) {
          sp.setProperty(key, normalizedValue);
        }
        report.replaced.push(key);
      } else {
        report.skipped.push(key);
      }
    } else {
      if (!dryRun) {
        sp.setProperty(key, normalizedValue);
      }
      report.added.push(key);
    }
  });
  Logger.log('[importScriptProperties] overwrite=%s dryRun=%s added=%s replaced=%s skipped=%s',
    overwrite, dryRun, report.added.length, report.replaced.length, report.skipped.length);
  return {
    ok: true,
    report: report,
    overwrite: overwrite,
    dryRun: dryRun
  };
}

/**
 * Importe uniquement certaines clés depuis un objet source.
 * @param {Object<string,*>} sourceProperties
 * @param {string[]} keys
 * @param {{overwrite?:boolean,dryRun?:boolean}} [options]
 * @returns {{ok:boolean,report?:{added:string[],replaced:string[],skipped:string[]},missingKeys?:string[],reason?:string,overwrite?:boolean,dryRun?:boolean}}
 */
function importSelectedProperties(sourceProperties, keys, options) {
  if (!sourceProperties || typeof sourceProperties !== 'object') {
    return { ok: false, reason: 'MISSING_FIELDS' };
  }
  if (!Array.isArray(keys)) {
    return { ok: false, reason: 'INVALID_INPUT' };
  }
  const subset = {};
  const missingKeys = [];
  keys.forEach(key => {
    if (!key || typeof key !== 'string') {
      return;
    }
    const trimmed = key.trim();
    if (!trimmed) {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(sourceProperties, trimmed)) {
      subset[trimmed] = sourceProperties[trimmed];
    } else {
      missingKeys.push(trimmed);
    }
  });
  if (Object.keys(subset).length === 0) {
    return { ok: false, reason: 'NOT_FOUND', missingKeys: missingKeys };
  }
  const res = importScriptProperties(subset, options);
  if (missingKeys.length) {
    res.missingKeys = missingKeys;
  }
  return res;
}

/**
 * Diagnostic des propriétés requises.
 * @returns {{ok:boolean,total:number,present:string[],missing:string[],empty:string[],placeholders:string[],masked:Object<string,string>}}
 */
function diagnosticProperties() {
  const sp = PropertiesService.getScriptProperties();
  const existing = sp.getProperties() || {};
  const keys = Object.keys(existing);
  const required = Array.isArray(REQUIRED_PROPS) ? REQUIRED_PROPS : [];
  const present = [];
  const missing = [];
  const empty = [];
  const placeholders = [];
  required.forEach(key => {
    if (!Object.prototype.hasOwnProperty.call(existing, key)) {
      missing.push(key);
      return;
    }
    const value = existing[key];
    if (value === null || value === '') {
      empty.push(key);
    } else if (isScriptPropertyPlaceholder(key, value)) {
      placeholders.push(key);
    } else {
      present.push(key);
    }
  });
  const masked = {};
  keys.forEach(key => {
    masked[key] = maskPropertyValue(existing[key]);
  });
  Logger.log('[diagnosticProperties] total=%s missing=%s empty=%s', keys.length, missing.length, empty.length);
  return {
    ok: true,
    total: keys.length,
    present: present,
    missing: missing,
    empty: empty,
    placeholders: placeholders,
    masked: masked
  };
}

/**
 * Retourne les propriétés requises manquantes.
 * @returns {{ok:boolean,missing:string[]}}
 */
function checkMissingProperties() {
  const diag = diagnosticProperties();
  if (!diag.ok) {
    return { ok: false, reason: 'ERROR' };
  }
  return {
    ok: true,
    missing: diag.missing
  };
}

/**
 * Compare un objet source avec les Script Properties actuelles.
 * @param {Object<string,*>} sourceProps
 * @returns {{ok:boolean,uniquementSource:string[],uniquementDestination:string[],communes:string[],diffValeurs:Array<{key:string,source:string,destination:string}> ,reason?:string}}
 */
function compareProperties(sourceProps) {
  if (!sourceProps || typeof sourceProps !== 'object') {
    return { ok: false, reason: 'MISSING_FIELDS' };
  }
  const sp = PropertiesService.getScriptProperties();
  const destProps = sp.getProperties() || {};
  const uniquementSource = [];
  const uniquementDestination = [];
  const communes = [];
  const diffValeurs = [];
  Object.keys(sourceProps).forEach(rawKey => {
    if (!rawKey || typeof rawKey !== 'string') {
      return;
    }
    const key = rawKey.trim();
    if (!key) {
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(destProps, key)) {
      uniquementSource.push(key);
      return;
    }
    communes.push(key);
    const sourceValue = sourceProps[key];
    const destValue = destProps[key];
    if (String(sourceValue) !== String(destValue)) {
      diffValeurs.push({
        key: key,
        source: maskPropertyValue(sourceValue),
        destination: maskPropertyValue(destValue)
      });
    }
  });
  Object.keys(destProps).forEach(rawKey => {
    if (!rawKey || typeof rawKey !== 'string') {
      return;
    }
    const key = rawKey.trim();
    if (!key) {
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(sourceProps, key)) {
      uniquementDestination.push(key);
    }
  });
  Logger.log('[compareProperties] sourceOnly=%s destOnly=%s diff=%s',
    uniquementSource.length, uniquementDestination.length, diffValeurs.length);
  return {
    ok: true,
    uniquementSource: uniquementSource,
    uniquementDestination: uniquementDestination,
    communes: communes,
    diffValeurs: diffValeurs
  };
}

/**
 * Déploie des placeholders pour les Script Properties manquantes.
 * @param {{keys?:string[],overwrite?:boolean}} [options]
 * @returns {{ok:boolean,written:string[],skipped:string[],total:number}}
 */
function seedScriptPropertyPlaceholders(options) {
  const opts = options || {};
  const requestedKeys = Array.isArray(opts.keys) ? opts.keys.filter(k => typeof k === 'string' && k.trim()) : [];
  const candidateKeys = requestedKeys.length ? requestedKeys.map(k => k.trim()) : getKnownScriptPropertyKeys_();
  const overwrite = !!opts.overwrite;
  const sp = PropertiesService.getScriptProperties();
  const report = {
    ok: true,
    written: [],
    skipped: [],
    total: candidateKeys.length
  };
  candidateKeys.forEach(key => {
    const placeholder = getScriptPropertyPlaceholder(key);
    if (!placeholder) {
      report.skipped.push(key);
      return;
    }
    const current = sp.getProperty(key);
    const missing = current === null || current === '' || isScriptPropertyPlaceholder(key, current);
    if (!missing && !overwrite) {
      report.skipped.push(key);
      return;
    }
    sp.setProperty(key, placeholder);
    report.written.push(key);
  });
  Logger.log('[seedScriptPropertyPlaceholders] total=%s written=%s skipped=%s overwrite=%s',
    report.total, report.written.length, report.skipped.length, overwrite);
  return report;
}

/**
 * Diagnostic autonome sans dépendance externe.
 * @returns {{ok:boolean,present:number,missing:number,keys:string[]}}
 */
function DIAGNOSTIC_STANDALONE() {
  const sp = PropertiesService.getScriptProperties();
  const props = sp.getProperties() || {};
  const required = ['NOM_ENTREPRISE','ADRESSE_ENTREPRISE','EMAIL_ENTREPRISE','ADMIN_EMAIL','ID_FEUILLE_CALCUL','ID_CALENDRIER','ID_DOCUMENT_CGV','ID_MODELE_FACTURE','ID_DOSSIER_ARCHIVES','ID_DOSSIER_TEMPORAIRE','SIRET','ELS_SHARED_SECRET','ID_FACTURES_DRIVE'];
  let presentCount = 0;
  let missingCount = 0;
  required.forEach(key => {
    const value = props[key];
    if (value === null || value === undefined || value === '' || isScriptPropertyPlaceholder(key, value)) {
      missingCount++;
    } else {
      presentCount++;
    }
  });
  Logger.log('[DIAGNOSTIC_STANDALONE] total=%s required=%s missing=%s', Object.keys(props).length, required.length, missingCount);
  return {
    ok: true,
    present: presentCount,
    missing: missingCount,
    keys: Object.keys(props)
  };
}

/**
 * Exemple d'import complet depuis un autre projet.
 * @returns {{ok:boolean,report?:{added:string[],replaced:string[],skipped:string[]},reason?:string}}
 */
function exemple_importerDepuisAutreProjet() {
  const propsSource = {
    NOM_ENTREPRISE: 'Pharmacie Exemple',
    EMAIL_ENTREPRISE: 'contact@example.com'
  };
  return importScriptProperties(propsSource, { overwrite: true, dryRun: true });
}

/**
 * Exemple d'import partiel.
 * @returns {{ok:boolean,report?:{added:string[],replaced:string[],skipped:string[]},missingKeys?:string[],reason?:string}}
 */
function exemple_importerProprietesSpecifiques() {
  const propsSource = {
    NOM_ENTREPRISE: 'Pharmacie Exemple',
    EMAIL_ENTREPRISE: 'contact@example.com',
    ADMIN_EMAIL: 'admin@example.com'
  };
  return importSelectedProperties(propsSource, ['NOM_ENTREPRISE', 'EMAIL_ENTREPRISE'], { overwrite: false, dryRun: true });
}

/**
 * Test léger des utilitaires Script Properties.
 * @returns {{ok:boolean,reason?:string}}
 */
function test_scriptPropertiesUtils() {
  const sp = PropertiesService.getScriptProperties();
  const testKeys = ['__TEST_PROP_A__', '__TEST_PROP_B__'];
  const backup = {};
  testKeys.forEach(key => {
    const current = sp.getProperty(key);
    if (current !== null) {
      backup[key] = current;
    }
  });
  try {
    testKeys.forEach(key => sp.deleteProperty(key));
    const importRes = importScriptProperties({
      __TEST_PROP_A__: 'VALUE_A',
      __TEST_PROP_B__: 'VALUE_B'
    }, { overwrite: true });
    if (!importRes.ok) {
      return { ok: false, reason: 'IMPORT_FAILED' };
    }
    const exportRes = exportScriptProperties({ includeValues: true });
    if (!exportRes.ok) {
      return { ok: false, reason: 'EXPORT_FAILED' };
    }
    const exported = exportRes.properties || {};
    if (exported.__TEST_PROP_A__ !== 'VALUE_A' || exported.__TEST_PROP_B__ !== 'VALUE_B') {
      return { ok: false, reason: 'ROUNDTRIP_MISMATCH' };
    }
    const compareRes = compareProperties({
      __TEST_PROP_A__: 'VALUE_A',
      __TEST_PROP_B__: 'VALUE_C'
    });
    if (!compareRes.ok || compareRes.diffValeurs.length === 0) {
      return { ok: false, reason: 'COMPARE_FAILED' };
    }
    const placeholderKey = 'NOM_ENTREPRISE';
    const placeholderValue = getScriptPropertyPlaceholder(placeholderKey);
    if (placeholderValue && !isScriptPropertyPlaceholder(placeholderKey, placeholderValue)) {
      return { ok: false, reason: 'PLACEHOLDER_MISMATCH' };
    }
    const seedRes = seedScriptPropertyPlaceholders({ keys: ['__TEST_PLACEHOLDER__'], overwrite: true });
    if (!seedRes.ok || seedRes.written.indexOf('__TEST_PLACEHOLDER__') === -1) {
      return { ok: false, reason: 'SEED_FAILED' };
    }
    const seededValue = sp.getProperty('__TEST_PLACEHOLDER__');
    if (!isScriptPropertyPlaceholder('__TEST_PLACEHOLDER__', seededValue)) {
      return { ok: false, reason: 'SEED_VALUE_INVALID' };
    }
    return { ok: true };
  } finally {
    testKeys.forEach(key => sp.deleteProperty(key));
    sp.deleteProperty('__TEST_PLACEHOLDER__');
    Object.keys(backup).forEach(key => {
      sp.setProperty(key, backup[key]);
    });
  }
}

/**
 * Retourne la liste dédupliquée des clés connues (placeholders + requis).
 * @returns {string[]}
 */
function getKnownScriptPropertyKeys_() {
  const index = {};
  Object.keys(SCRIPT_PROPERTIES_PLACEHOLDERS).forEach(key => {
    index[key] = true;
  });
  if (typeof REQUIRED_PROPS !== 'undefined' && Array.isArray(REQUIRED_PROPS)) {
    REQUIRED_PROPS.forEach(key => {
      index[key] = true;
    });
  }
  return Object.keys(index).sort();
}
