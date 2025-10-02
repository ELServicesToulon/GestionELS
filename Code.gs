/**
 * ---------------------------
 *  Facturation ELS - Helpers
 * ---------------------------
 * - tinyMustache_ : mini-moteur de templates (variables + sections tableaux)
 * - renderInvoice_(data) : remplace les {{placeholders}} + {{#prestations}}…{{/prestations}}
 * - exportPdf_(html, filename?) : export HTML -> PDF (Drive)
 * - exampleData_() : dataset d’essai
 * - test_placeholders_() : vérifie la présence des placeholders requis
 * - test_rows_sum_() : vérifie somme des lignes = montant_total (exemple)
 *
 * NB logo :
 *  - Place un fichier "logo.png" dans un dossier Drive nommé "assets"
 *  - getLogoDataUrl_() embarque le logo en data URL dans {{logo_src}}
 */

/** -------- Template engine minimal (variables + sections tableaux) -------- */
function tinyMustache_(tpl, data) {
  // Sections (tableaux) : {{#key}} ... {{/key}}
  // On itère tant qu’on trouve des sections (gère récursif simple)
  var sectionRe = /{{#\s*([a-zA-Z0-9_]+)\s*}}([\s\S]*?){{\/\s*\1\s*}}/g;
  var match;
  while ((match = sectionRe.exec(tpl)) !== null) {
    var key = match[1];
    var inner = match[2];
    var arr = data[key];
    var rendered = "";
    if (Array.isArray(arr)) {
      rendered = arr.map(function (item) {
        // Permet d’accéder aux props parent si besoin (omission ici par simplicité)
        return tinyMustache_(inner, Object.assign({}, data, item));
      }).join("");
    } else {
      rendered = ""; // section non tableau => retire
    }
    tpl = tpl.slice(0, match.index) + rendered + tpl.slice(match.index + match[0].length);
    sectionRe.lastIndex = 0; // reset après modification
  }

  // Variables simples : {{key}}
  tpl = tpl.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, function(_, k){
    var v = (data[k] != null) ? String(data[k]) : "";
    return v;
  });
  return tpl;
}

/** -------- Rendu de la facture -------- */
function renderInvoice_(data) {
  // Charge le HTML brut (sans évaluation <% … %>)
  var tpl = HtmlService.createTemplateFromFile('Facture').getRawContent();

  // Injection du logo si absent : cherche assets/logo.png dans Drive
  if (!data.logo_src) {
    var logo = getLogoDataUrl_();
    if (logo) data.logo_src = logo;
  }

  return tinyMustache_(tpl, data);
}

/** -------- Export PDF -------- */
function exportPdf_(html, filename) {
  filename = filename || ('Facture-' + new Date().toISOString().slice(0,10));
  var out = HtmlService.createHtmlOutput(html)
    .setWidth(794)  // ~ A4 px @96dpi
    .setHeight(1123);

  var pdfBlob = out.getBlob().getAs('application/pdf');
  pdfBlob.setName(filename + '.pdf');

  var folder = getOrCreateFolder_('Factures');
  var file = folder.createFile(pdfBlob);
  Logger.log('PDF créé : %s (%s)', file.getName(), file.getUrl());
  return file;
}

/** -------- Helpers Drive -------- */
function getOrCreateFolder_(name, parent) {
  var root = parent || DriveApp.getRootFolder();
  var it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}

function getLogoDataUrl_() {
  // Cherche dossier "assets" à la racine
  var root = DriveApp.getRootFolder();
  var assets = (function(){
    var it = root.getFoldersByName('assets');
    return it.hasNext() ? it.next() : null;
  })();
  if (!assets) { return ''; }

  var files = assets.getFilesByName('logo.png');
  if (!files.hasNext()) { return ''; }

  var file = files.next();
  var blob = file.getBlob();
  var contentType = blob.getContentType() || 'image/png';
  var base64 = Utilities.base64Encode(blob.getBytes());
  return 'data:' + contentType + ';base64,' + base64;
}

/** -------- Données d’exemple -------- */
function exampleData_() {
  var prestations = [
    { designation: 'Tournée Pharmacie Portissol → EHPAD Tamaris (livraison scellée)', quantite: '1', prix_unitaire_ttc: '25.00', total_ligne_ttc: '25.00' },
    { designation: 'Arrêt supplémentaire (La Seyne)', quantite: '1', prix_unitaire_ttc: '6.00', total_ligne_ttc: '6.00' },
    { designation: 'Majoration urgence (< 2h)', quantite: '1', prix_unitaire_ttc: '9.00', total_ligne_ttc: '9.00' }
  ];
  var total = prestations.reduce(function(sum, l){
    var n = Number(String(l.total_ligne_ttc).replace(',','.'));
    return sum + (isFinite(n) ? n : 0);
  }, 0);
  total = total.toFixed(2);

  return {
    // Entreprise
    entreprise_nom: 'EI Emmanuel Lecourt – EL Services Toulon',
    entreprise_siren: '{{$SIREN}}',
    entreprise_siret: '{{$SIRET}}',
    entreprise_adresse: '{{$ADRESSE}}',
    entreprise_tel: '{{$TEL}}',
    entreprise_email: '{{$EMAIL}}',
    entreprise_site: 'elsservicestoulon.fr',
    // Facture
    facture_numero: '2025-001',
    facture_date: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy'),
    lieu_emission: 'Toulon',
    // Client
    client_nom: 'Pharmacie de Portissol',
    client_adresse: '12 Rue du Littoral\n83110 Sanary-sur-Mer',
    // Paiement / banque
    delai: '30',
    banque_nom: '{{$BANQUE}}',
    iban: '{{$IBAN}}',
    bic: '{{$BIC}}',
    // Totaux
    montant_total: total,
    // Lignes
    prestations: prestations,
    // Logo (optionnel, auto si vide)
    logo_src: ''
  };
}

/** -------- Démo rapide : génère et exporte le PDF -------- */
function demo_export_() {
  var html = renderInvoice_(exampleData_());
  exportPdf_(html, 'Facture-ELS-demo');
}

/** -------- Mini-tests -------- */
function test_placeholders_() {
  var required = [
    // Entreprise
    'entreprise_nom','entreprise_siren','entreprise_siret','entreprise_adresse','entreprise_tel','entreprise_email','entreprise_site',
    // Facture
    'facture_numero','facture_date','lieu_emission',
    // Client
    'client_nom','client_adresse',
    // Paiement
    'delai','iban','bic','banque_nom',
    // Total
    'montant_total',
    // Bloc répétable
    '#prestations','/prestations','designation','quantite','prix_unitaire_ttc','total_ligne_ttc'
  ];

  var raw = HtmlService.createTemplateFromFile('Facture').getRawContent();
  var missing = [];
  required.forEach(function(tok){
    // supporte #prestations et /prestations
    var needle = (tok === '#prestations') ? '{{#prestations}}'
               : (tok === '/prestations') ? '{{/prestations}}'
               : '{{' + tok + '}}';
    if (raw.indexOf(needle) === -1) missing.push(needle);
  });

  if (missing.length) {
    throw new Error('Placeholders manquants: ' + JSON.stringify(missing));
  }
  Logger.log('OK placeholders présents (%s).', required.length);
}

function test_rows_sum_() {
  var data = exampleData_();
  var sum = data.prestations.reduce(function(s, l){
    return s + Number(String(l.total_ligne_ttc).replace(',','.'));
  }, 0);
  sum = Number(sum.toFixed(2));
  var total = Number(String(data.montant_total).replace(',','.'));

  if (sum !== total) {
    throw new Error('Somme lignes ('+sum+') ≠ montant_total ('+total+').');
  }
  Logger.log('OK somme lignes == montant_total (%s).', total.toFixed(2));
}
