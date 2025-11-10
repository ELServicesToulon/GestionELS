// =================================================================
// UtilsShared bridge
// =================================================================
// Ce fichier expose les anciennes fonctions utilitaires en les
// deleguant vers la librairie standalone Utils Shared. Tant que la
// librairie n'est pas referencee dans appsscript.json, un fallback
// local (UtilsSharedFallback) est utilise pour conserver la
// compatibilite.
// =================================================================

const UTILS_SHARED_EXPORTS = [
  'formaterDateEnYYYYMMDD',
  'formaterDateEnHHMM',
  'formaterDatePersonnalise',
  'formatMoisFrancais',
  'formatMontantEuro',
  'normaliserCodePostal',
  'insererImageDepuisPlaceholder',
  'getLogoSvgBlob',
  'loadInlineSvgFromFile',
  'getLogoBlob',
  'getLogoDataUrl',
  'blobToDataUrl',
  'getBundledLogoDataUrl',
  'getLogoPublicUrl',
  'getLogoEmailBlockHtml',
  'encodeMailSubjectUtf8',
  'toCents',
  'fromCents',
  'nextInvoiceNumber',
  'obtenirIndicesEnTetes',
  'obtenirOuCreerDossier',
  'trouverTableBordereau',
  'test_logHeadersModeleFacture',
  'logFailedLogin',
  'logRequest',
  'include',
  'getSecret',
  'normalizeSecretValue_',
  'extractIdFromUrl_',
  'normalizeCalendarId_',
  'setSecret',
  'verifySignedLink',
  'generateSignedClientLink',
  'getConfiguration',
  'assertClient',
  'assertReservationId'
];

let utilsSharedFallbackWarningLogged = false;

function getUtilsShared_() {
  if (typeof UtilsShared !== 'undefined') {
    return UtilsShared;
  }
  if (typeof UtilsSharedFallback !== 'undefined') {
    if (!utilsSharedFallbackWarningLogged) {
      Logger.log('UtilsShared library not configured; using fallback implementation.');
      utilsSharedFallbackWarningLogged = true;
    }
    return UtilsSharedFallback;
  }
  throw new Error('UtilsShared library is not available and no fallback is loaded.');
}

(function registerUtilsSharedExports_(global) {
  UTILS_SHARED_EXPORTS.forEach((name) => {
    global[name] = function () {
      const lib = getUtilsShared_();
      const fn = lib && lib[name];
      if (typeof fn !== 'function') {
        throw new Error('UtilsShared function "' + name + '" is unavailable.');
      }
      return fn.apply(lib, arguments);
    };
  });
})(this);
