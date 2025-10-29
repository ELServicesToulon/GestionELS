/**
 * Helpers de facturation résidente.
 * Génère les lignes de facture et envoie un PDF par e-mail.
 */

/**
 * Renvoie les coordonnées de facturation par défaut selon le type.
 * @param {string} orderId
 * @param {string} billTo
 * @param {Object} ctx
 * @return {Object}
 */
function doGetBillingDefaults(orderId, billTo, ctx) {
  return {
    success: true,
    defaults: {
      nom: '',
      adresse: '',
      email: '',
      telephone: '',
      siret: '',
      tva: ''
    }
  };
}

/**
 * Persiste les coordonnées de facturation pour une commande.
 * @param {Object} payload
 * @return {Object}
 */
function doSaveBillingForOrder(payload) {
  if (BILLING_V2_DRYRUN) {
    Logger.log('DRYRUN doSaveBillingForOrder', payload);
    return { success: true, row: 0 };
  }

  try {
    var ss = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
    var sheet = ss.getSheetByName(SHEET_RESERVATIONS);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_RESERVATIONS);
    }

    var headers = ['ID Réservation', 'Facturation Nom', 'Facturation Adresse', 'Facturation Email', 'Facturation Téléphone', 'Facturation SIRET', 'Facturation TVA'];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
    }

    var existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var missing = headers.filter(function (h) {
      return existingHeaders.indexOf(h) === -1;
    });
    if (missing.length > 0) {
      sheet.getRange(1, existingHeaders.length + 1, 1, missing.length).setValues([missing]);
      existingHeaders = existingHeaders.concat(missing);
    }

    var indices = obtenirIndicesEnTetes(sheet, headers);
    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][indices['ID Réservation']]) === String(payload.orderId)) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) {
      var row = new Array(sheet.getLastColumn()).fill('');
      row[indices['ID Réservation']] = payload.orderId;
      row[indices['Facturation Nom']] = payload.nom;
      row[indices['Facturation Adresse']] = payload.adresse;
      row[indices['Facturation Email']] = payload.email;
      row[indices['Facturation Téléphone']] = payload.telephone;
      row[indices['Facturation SIRET']] = payload.siret;
      row[indices['Facturation TVA']] = payload.tva;
      sheet.appendRow(row);
      rowIndex = sheet.getLastRow();
    } else {
      sheet.getRange(rowIndex, indices['Facturation Nom'] + 1).setValue(payload.nom);
      sheet.getRange(rowIndex, indices['Facturation Adresse'] + 1).setValue(payload.adresse);
      sheet.getRange(rowIndex, indices['Facturation Email'] + 1).setValue(payload.email);
      sheet.getRange(rowIndex, indices['Facturation Téléphone'] + 1).setValue(payload.telephone);
      sheet.getRange(rowIndex, indices['Facturation SIRET'] + 1).setValue(payload.siret);
      sheet.getRange(rowIndex, indices['Facturation TVA'] + 1).setValue(payload.tva);
    }

    return { success: true, row: rowIndex };
  } catch (e) {
    Logger.log('ERREUR doSaveBillingForOrder ' + e.message);
    return { success: false, message: e.message };
  }
}

function buildInvoiceLinesSainteMusseEHPAD(opts) {
  var mode = String(opts.mode || '').toLowerCase();
  var isUrgent = mode === 'urgence' || opts.urgence === true;
  var prix = isUrgent ? FORFAIT_RESIDENT.URGENCE_PRICE : FORFAIT_RESIDENT.STANDARD_PRICE;
  var label = isUrgent
    ? (FORFAIT_RESIDENT.URGENCE_LABEL || 'Forfait résident - Urgence <4h')
    : (FORFAIT_RESIDENT.STANDARD_LABEL || 'Forfait résident');

  return [{ label: label, qty: 1, unit: 'forfait', pu: prix, total: prix }];
}

function sumHT(lines) {
  return lines.reduce(function (s, l) {
    return s + toCents(l.total || 0);
  }, 0);
}

function computeTVA(htCents) {
  return BILLING.TVA_APPLICABLE ? Math.round(htCents * BILLING.TVA_RATE) : 0;
}

function creerEtEnvoyerFactureResident(res) {
  if (!RESIDENT_BILLING_ENABLED) return;
  if (res.PAYER_TYPE !== 'Resident') return;
  if (BILLING_V2_DRYRUN) {
    Logger.log('DRYRUN creerEtEnvoyerFactureResident', res);
    return;
  }

  var mode = res.MODE;
  var opts = {
    mode: mode,
    km: Number(res.KM_ESTIME),
    nbArretsTotaux: Number(res.ARRETS_TOTAUX || 1),
    precollecteVeille: res.PRECOLLECTE_VEILLE === true || String(res.PRECOLLECTE_VEILLE).toLowerCase() === 'true',
    samedi: res.SAMEDI === true || String(res.SAMEDI).toLowerCase() === 'true',
    minutesAttente: Number(res.ATTENTE_MIN || 0)
  };

  var lines = buildInvoiceLinesSainteMusseEHPAD(opts);
  var htCents = sumHT(lines);
  var tvaCents = computeTVA(htCents);
  var ttcCents = Math.max(0, htCents + tvaCents);

  var num = BILLING_ATOMIC_NUMBERING_ENABLED
    ? BILLING.INVOICE_PREFIX + '-' + nextInvoiceNumber()
    : BILLING.INVOICE_PREFIX + '-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');

  var parentFolder = DriveApp.getFolderById(BILLING.FACTURES_FOLDER_ID);
  if (BILLING_ATOMIC_NUMBERING_ENABLED) {
    var now = new Date();
    var yearFolder = obtenirOuCreerDossier(parentFolder, String(now.getFullYear()));
    var monthFolder = obtenirOuCreerDossier(yearFolder, Utilities.formatDate(now, Session.getScriptTimeZone(), 'MM'));
    parentFolder = monthFolder;
  }
  // Modèle dédié résident si présent, sinon fallback modèle global
  var _props = PropertiesService.getScriptProperties();
  var _tplResident = (function(){ try { return _props.getProperty('ID_MODELE_FACTURE_RESIDENT'); } catch(e){ return null; } })();
  var _tplId = _tplResident || BILLING.DOC_TEMPLATE_FACTURE_ID;
  var tmpl = DriveApp.getFileById(_tplId).makeCopy(num + ' - ' + res.RESIDENT_NOM, parentFolder);
  var doc = DocumentApp.openById(tmpl.getId());
  var body = doc.getBody();

  var repl = {
    '{{NUMERO_FACTURE}}': num,
    '{{DATE_FACTURE}}': Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy'),
    '{{CLIENT_NOM}}': res.RESIDENT_NOM || '',
    '{{CLIENT_CONTACT}}': res.RESIDENT_EMAIL || '',
    '{{ADRESSE_CLIENT}}': res.RESIDENT_CHAMBRE ? 'Chambre: ' + res.RESIDENT_CHAMBRE : '',
    '{{MENTION_TVA}}': BILLING.TVA_APPLICABLE ? '' : BILLING.TVA_MENTION,
    '{{TOTAL_HT}}': fromCents(htCents) + ' €',
    '{{TVA}}': fromCents(tvaCents) + ' €',
    '{{TOTAL_TTC}}': fromCents(ttcCents) + ' €',
    '{{DELAI_PAIEMENT}}': BILLING.PAIEMENT_DELAI_JOURS.RESIDENT === 0 ? 'Paiement à réception' : BILLING.PAIEMENT_DELAI_JOURS.RESIDENT + ' jours'
  };
  Object.keys(repl).forEach(function (k) {
    body.replaceText(k, repl[k]);
  });

  var lignesTexte = lines.map(function (l) {
    return '• ' + l.label + ' — ' + l.qty + ' ' + l.unit + ' × ' + l.pu.toFixed(2) + ' € = ' + l.total.toFixed(2) + ' €';
  }).join('\n');
  body.replaceText('{{LIGNES}}', lignesTexte || '');

  // Alignement supplémentaire sur le modèle Admin (tokens minuscules) et compléments
  try {
    var _dateFacture = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
    var _delai = Number(BILLING.PAIEMENT_DELAI_JOURS.RESIDENT || 0);
    var _echeance = new Date();
    if (_delai > 0) { _echeance = new Date(_echeance.getTime() + _delai * 24 * 60 * 60 * 1000); }
    var _dateEcheance = Utilities.formatDate(_echeance, Session.getScriptTimeZone(), 'dd/MM/yyyy');

    var _nomEnt = (function(){ try { return getSecret('NOM_ENTREPRISE'); } catch(e){ return ''; } })();
    var _adrEnt = (function(){ try { return getSecret('ADRESSE_ENTREPRISE'); } catch(e){ return ''; } })();
    var _mailEnt = (function(){ try { return getSecret('EMAIL_ENTREPRISE'); } catch(e){ try { return getSecret('ADMIN_EMAIL'); } catch(_e){ return ''; } } })();
    var _siret = (function(){ try { return getSecret('SIRET'); } catch(e){ return ''; } })();
    var _rib = (function(){ try { return getSecret('RIB_ENTREPRISE'); } catch(e){ return ''; } })();
    var _bic = (function(){ try { return getSecret('BIC_ENTREPRISE'); } catch(e){ return ''; } })();
    var _lienTarifs = (function(){
      try { var u = getSecret('URL_TARIFS_PUBLIC'); if (u) return u; } catch(e){}
      try { var id = getSecret('ID_DOCUMENT_TARIFS'); if (id) return 'https://drive.google.com/open?id=' + id; } catch(e){}
      return '';
    })();
    var _lienCgv = (function(){ try { var id = getSecret('ID_DOCUMENT_CGV'); return id ? ('https://drive.google.com/open?id=' + id) : ''; } catch(e){ return ''; } })();

    var _repl = {
      '{{numero_facture}}': num,
      '{{date_facture}}': _dateFacture,
      '{{date_echeance}}': _dateEcheance,
      '{{client_nom}}': res.RESIDENT_NOM || '',
      '{{client_adresse}}': res.RESIDENT_CHAMBRE ? ('Chambre: ' + res.RESIDENT_CHAMBRE) : '',
      '{{total_du}}': fromCents(ttcCents) + ' €',
      '{{nombre_courses}}': '1',
      '{{delai_paiement}}': String(_delai || 0),
      '{{lien_tarifs}}': _lienTarifs,
      '{{lien_cgv}}': _lienCgv,
      '{{nom_entreprise}}': _nomEnt,
      '{{adresse_entreprise}}': _adrEnt,
      '{{email_entreprise}}': _mailEnt,
      '{{siret}}': _siret,
      '{{rib_entreprise}}': _rib,
      '{{bic_entreprise}}': _bic
    };
    Object.keys(_repl).forEach(function (k) { body.replaceText(k, _repl[k]); });

    // Réécrit {{LIGNES}} si présent avec un formatage clair
    try {
      var _lignesTxt = lines.map(function (l) {
        return '• ' + l.label + ' - ' + l.qty + ' ' + l.unit + ' à ' + Number(l.pu).toFixed(2) + ' € = ' + Number(l.total).toFixed(2) + ' €';
      }).join('\n');
      body.replaceText('{{LIGNES}}', _lignesTxt || '');
    } catch (_inner) {}
  } catch (_outer) {}

  doc.saveAndClose();
  var pdf = DriveApp.getFileById(tmpl.getId()).getAs('application/pdf');
  var pdfFile = parentFolder.createFile(pdf).setName(num + '.pdf');
  DriveApp.getFileById(tmpl.getId()).setTrashed(true);

  var status;
  var props = PropertiesService.getScriptProperties();
  var sentKey = 'INVOICE_SENT_' + num;
  var alreadySent = props.getProperty(sentKey) === 'true';
  if (res.RESIDENT_EMAIL) {
    if (alreadySent) {
      status = 'DEJA_ENVOYEE';
      Logger.log('[Facturation] Facture ' + num + ' déjà envoyée, email ignoré.');
    } else {
      try {
        GmailApp.sendEmail(res.RESIDENT_EMAIL, '[' + BILLING.INVOICE_PREFIX + '] Votre facture ' + num,
          'Bonjour,\n\nVeuillez trouver votre facture en pièce jointe.\nMontant: ' + fromCents(ttcCents) + ' €.\n' + (BILLING.TVA_APPLICABLE ? '' : BILLING.TVA_MENTION) + '\n\nMerci,',
          { attachments: [pdfFile.getBlob()] }
        );
        status = 'ENVOYEE';
        props.setProperty(sentKey, 'true');
      } catch (mailErr) {
        status = 'ERREUR_ENVOI';
        Logger.log('Erreur envoi facture ' + num + ' : ' + mailErr);
      }
    }
  } else {
    status = 'EMAIL_MANQUANT';
  }

  if (BILLING_LOG_ENABLED) {
    var logSpreadsheet = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
    var sheet = logSpreadsheet.getSheetByName(SHEET_FACTURATION);
    if (sheet) {
      sheet.appendRow([num, pdfFile.getUrl(), status]);
    }
  }
}

