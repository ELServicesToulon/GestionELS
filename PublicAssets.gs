/**
 * Gestion des ressources publiques hébergées dans Drive.
 * Fournit une fonction de seed et un accès en lecture au mapping.
 */

/**
 * Crée les fichiers d'assets dans le dossier public et retourne la map nom->URL.
 * À exécuter manuellement via l'éditeur Apps Script.
 * @returns {Object<string,string>}
 */
function seedPublicAssets() {
  const folderId = PropertiesService.getScriptProperties().getProperty('DOCS_PUBLIC_FOLDER_ID');
  if (!folderId) throw new Error('DOCS_PUBLIC_FOLDER_ID manquant');
  const folder = DriveApp.getFolderById(folderId);
  const assets = [
    { name: 'capsule1x.png', blob: Utilities.newBlob(Utilities.base64Decode(HtmlService.createHtmlOutputFromFile('Capsule1x_b64').getContent().trim()), 'image/png', 'capsule1x.png') },
    { name: 'capsule1x_urgent.png', blob: Utilities.newBlob(Utilities.base64Decode(HtmlService.createHtmlOutputFromFile('CapsuleUrg1x_b64').getContent().trim()), 'image/png', 'capsule1x_urgent.png') },
    { name: 'blister_vide1x.png', blob: Utilities.newBlob(Utilities.base64Decode(HtmlService.createHtmlOutputFromFile('Blister1x_b64').getContent().trim()), 'image/png', 'blister_vide1x.png') }
  ];
  const map = {};
  assets.forEach(a => {
    let file = null;
    const existing = folder.getFilesByName(a.name);
    if (existing.hasNext()) {
      file = existing.next();
    } else {
      file = folder.createFile(a.blob);
      if (file.getName() !== a.name) {
        try { file.setName(a.name); } catch (_err) {}
      }
    }
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (_shareErr) {
      // ignore sharing errors, we keep proceeding
    }
    map[a.name] = file.getUrl();
  });
  PropertiesService.getScriptProperties().setProperty('PUBLIC_ASSETS_MAP', JSON.stringify(map));
  return map;
}

/**
 * Retourne la map des assets publics depuis les Script Properties.
 * @returns {Object<string,string>}
 */
function getPublicAssetsMap() {
  const sp = PropertiesService.getScriptProperties();
  const str = sp.getProperty('PUBLIC_ASSETS_MAP');
  try {
    return str ? JSON.parse(str) : {};
  } catch (e) {
    return {};
  }
}
