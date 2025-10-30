/**
 * Retourne l'acteur courant (email) ou "anonymous".
 * @return {string}
 */
function getActiveActor_() {
  try {
    const email = Session.getActiveUser().getEmail();
    return email || 'anonymous';
  } catch (_err) {
    return 'anonymous';
  }
}

/**
 * Log applicatif côté feuille "Logs".
 * @param {string} actor Acteur à l'origine de l'action.
 * @param {string} action Code d'action.
 * @param {Object=} metadata Métadonnées sérialisées.
 */
function logEvent(actor, action, metadata) {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty('ID_FEUILLE_CALCUL');
  if (!spreadsheetId) {
    console.warn('ID_FEUILLE_CALCUL non défini, log ignoré.');
    return;
  }

  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheetName = (getConfig().SHEET_LOGS) || 'Logs';
    const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
    const metaJson = metadata ? JSON.stringify(metadata) : '';
    sheet.appendRow([new Date(), actor, action, metaJson]);
  } catch (err) {
    console.error(`Impossible d'écrire dans les logs (${action}): ${err.message}`);
  }
}
