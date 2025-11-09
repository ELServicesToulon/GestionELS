/**
 * Sauvegarde image base64 dans Drive.
 * @param {string} folderId
 * @param {string} dataUrl
 * @param {string} prefix
 * @return {string}
 */
function saveBase64ToDrive(folderId, dataUrl, prefix) {
  if (!dataUrl) {
    return '';
  }
  const matches = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!matches) {
    throw new Error('INVALID_DATAURL');
  }
  const mimeType = matches[1];
  const bytes = Utilities.base64Decode(matches[2]);
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/jpeg' ? 'jpg' : 'bin';
  const folder = DriveApp.getFolderById(folderId);
  const file = folder.createFile(bytes, `${prefix}-${Date.now()}.${extension}`, mimeType);
  file.setSharing(DriveApp.Access.DOMAIN, DriveApp.Permission.VIEW);
  return file.getId();
}
