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

function bandIndexFromKm(km, bands) {
  for (var i = 0; i < bands.length; i++) {
    if (km <= bands[i]) {
      return i;
    }
  }
  return bands.length - 1;
}

function buildInvoiceLinesSainteMusseEHPAD(opts) {
  var mode = opts.mode;
  var t = mode === 'Urgence' ? TARIFS.SainteMusse_EHPAD_URGENCE : TARIFS.SainteMusse_EHPAD_CLASSIC;
  var idx = bandIndexFromKm(opts.km, t.bands);
  var zoneLabel = ['Zone A ≤18km', 'Zone B ≤24km', 'Zone C ≤30km', 'Zone D ≤36km'][idx] || 'Zone D';
  var base = t.bands[idx].prix;

  var lines = [];
  var libBase = mode === 'Urgence'
    ? 'URGENCE — Sainte-Musse ↔ EHPAD (' + zoneLabel + ', retour inclus)'
    : 'Classique — Sainte-Musse → EHPAD (' + zoneLabel + ')';
  lines.push({ label: libBase, qty: 1, unit: 'forfait', pu: base, total: base });

  var extras = Math.max(0, opts.nbArretsTotaux - 1);
  for (var i = 0; i < extras; i++) {
    var puExtra = t.PDL_PRIX[Math.min(i, t.PDL_PRIX.length - 1)];
    lines.push({ label: 'Arrêt supplémentaire #' + (i + 2), qty: 1, unit: 'arrêt', pu: puExtra, total: puExtra });
  }

  if (opts.precollecteVeille) {
    lines.push({
      label: 'Pré-collecte veille (ordonnance + carte Vitale, J-1)',
      qty: 1,
      unit: 'forfait',
      pu: 5,
      total: 5
    });
  }

  if (opts.samedi) {
    lines.push({
      label: 'Majoration samedi',
      qty: 1,
      unit: 'forfait',
      pu: t.SAMEDI_SURC,
      total: t.SAMEDI_SURC
    });
  }

  var over = Math.max(0, opts.minutesAttente - t.ATTENTE.graceMin);
  if (over > 0) {
    var tranches = Math.ceil(over / t.ATTENTE.palierMin);
    var totalAttente = tranches * t.ATTENTE.prixParPalier;
    lines.push({
      label: 'Attente au-delà de ' + t.ATTENTE.graceMin + ' min',
      qty: tranches,
      unit: t.ATTENTE.palierMin + ' min',
      pu: t.ATTENTE.prixParPalier,
      total: totalAttente
    });
  }

  return lines;
}

function sumHT(lines) {
  return lines.reduce(function (s, l) {
    return s + Number(l.total || 0);
  }, 0);
}

function computeTVA(ht) {
  return BILLING.TVA_APPLICABLE ? Math.round(ht * BILLING.TVA_RATE * 100) / 100 : 0;
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
  var ht = sumHT(lines);
  var tva = computeTVA(ht);
  var ttc = ht + tva;

  var num = BILLING.INVOICE_PREFIX + '-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');

  var tmpl = DriveApp.getFileById(BILLING.DOC_TEMPLATE_FACTURE_ID).makeCopy(num + ' - ' + res.RESIDENT_NOM, DriveApp.getFolderById(BILLING.FACTURES_FOLDER_ID));
  var doc = DocumentApp.openById(tmpl.getId());
  var body = doc.getBody();

  var repl = {
    '{{NUMERO_FACTURE}}': num,
    '{{DATE_FACTURE}}': Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy'),
    '{{CLIENT_NOM}}': res.RESIDENT_NOM || '',
    '{{CLIENT_CONTACT}}': res.RESIDENT_EMAIL || '',
    '{{ADRESSE_CLIENT}}': res.RESIDENT_CHAMBRE ? 'Chambre: ' + res.RESIDENT_CHAMBRE : '',
    '{{MENTION_TVA}}': BILLING.TVA_APPLICABLE ? '' : BILLING.TVA_MENTION,
    '{{TOTAL_HT}}': ht.toFixed(2) + ' €',
    '{{TVA}}': tva.toFixed(2) + ' €',
    '{{TOTAL_TTC}}': ttc.toFixed(2) + ' €',
    '{{DELAI_PAIEMENT}}': BILLING.PAIEMENT_DELAI_JOURS.RESIDENT === 0 ? 'Paiement à réception' : BILLING.PAIEMENT_DELAI_JOURS.RESIDENT + ' jours'
  };
  Object.keys(repl).forEach(function (k) {
    body.replaceText(k, repl[k]);
  });

  var lignesTexte = lines.map(function (l) {
    return '• ' + l.label + ' — ' + l.qty + ' ' + l.unit + ' × ' + l.pu.toFixed(2) + ' € = ' + l.total.toFixed(2) + ' €';
  }).join('\n');
  body.replaceText('{{LIGNES}}', lignesTexte || '');

  doc.saveAndClose();
  var pdf = DriveApp.getFileById(tmpl.getId()).getAs('application/pdf');
  var pdfFile = DriveApp.getFolderById(BILLING.FACTURES_FOLDER_ID).createFile(pdf).setName(num + '.pdf');
  DriveApp.getFileById(tmpl.getId()).setTrashed(true);

  var status;
  if (res.RESIDENT_EMAIL) {
    GmailApp.sendEmail(res.RESIDENT_EMAIL, '[' + BILLING.INVOICE_PREFIX + '] Votre facture ' + num,
      'Bonjour,\n\nVeuillez trouver votre facture en pièce jointe.\nMontant TTC: ' + ttc.toFixed(2) + ' €.\n' + (BILLING.TVA_APPLICABLE ? '' : BILLING.TVA_MENTION) + '\n\nMerci,',
      { attachments: [pdfFile.getBlob()] }
    );
    status = 'ENVOYEE';
  } else {
    status = 'EMAIL_MANQUANT';
  }

  if (BILLING_LOG_ENABLED) {
    var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_FACTURATION);
    if (sheet) {
      sheet.appendRow([num, pdfFile.getUrl(), status]);
    }
  }
}
