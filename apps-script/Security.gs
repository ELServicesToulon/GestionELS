/**
 * Vérifie l'authentification Workspace.
 * @return {string}
 */
function getCurrentUserEmail() {
  const email = Session.getActiveUser().getEmail();
  if (!email) {
    throw new Error('UNAUTHORIZED');
  }
  return email;
}

/**
 * Vérifie whitelisting domaine.
 * @param {string} email
 */
function assertAllowedDomain(email) {
  const domain = email.split('@')[1];
  const allowed = PropertiesService.getScriptProperties().getProperty('ALLOWED_DOMAIN') || 'exemple.fr';
  if (domain !== allowed) {
    throw new Error('UNAUTHORIZED');
  }
}

/**
 * Nettoie string.
 * @param {string} value
 * @param {number} maxLen
 * @return {string}
 */
function sanitizeString(value, maxLen) {
  if (!value) {
    return '';
  }
  const trimmed = value.toString().trim();
  return trimmed.slice(0, maxLen);
}

/**
 * Arrondit géoloc à 50m.
 * @param {{lat:number,lng:number,accuracy:number}} geo
 */
function roundGeo(geo) {
  if (!geo) {
    return null;
  }
  const roundCoord = function (val) {
    const metersPerDegree = 111320;
    const roundFactor = 50 / metersPerDegree;
    return Math.round(val / roundFactor) * roundFactor;
  };
  return {
    lat: roundCoord(Number(geo.lat)),
    lng: roundCoord(Number(geo.lng)),
    accuracy: Math.max(Number(geo.accuracy) || 0, 50)
  };
}
