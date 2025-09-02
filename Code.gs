function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('EL Services Littoral — Réservation livraison pharmacie')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Inclus un fichier .html (Styles, Script, Partials…)
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
