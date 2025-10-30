/**
 * Récupère les données de facture depuis la feuille de calcul.
 * Retourne des données d'exemple si l'identifiant n'est pas trouvé.
 * @param {string} factureId Identifiant de la facture.
 * @return {Object} Données structurées de facture.
 */
function loadInvoiceData(factureId) {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty('ID_FEUILLE_CALCUL');
  if (!spreadsheetId) {
    console.warn('ID_FEUILLE_CALCUL absent, utilisation des données exemple.');
    return buildSampleInvoice_(factureId);
  }

  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName('Facturation');
    if (!sheet) {
      console.warn('Feuille "Facturation" introuvable, utilisation des données exemple.');
      return buildSampleInvoice_(factureId);
    }

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      console.warn('Feuille Facturation vide, utilisation des données exemple.');
      return buildSampleInvoice_(factureId);
    }

    const headerMap = buildHeaderIndex_(values.shift());
    const numeroIdx = findHeaderIndex_(headerMap, ['numero', 'numéro', 'facture', 'facturenumero', 'invoice']);
    if (numeroIdx === -1) {
      throw new Error('Colonne "Numéro" introuvable.');
    }

    const row = values.find(line => normalizeString_(line[numeroIdx]) === normalizeString_(factureId));
    if (!row) {
      console.warn(`Facture ${factureId} introuvable, utilisation des données exemple.`);
      return buildSampleInvoice_(factureId);
    }

    const invoiceDate = parseDate_(
      row[findHeaderIndex_(headerMap, ['date', 'facturedate', 'issuedate'])]
    ) || new Date();

    const vendeur = buildSellerInfo_(props);
    const acheteur = {
      nom: pickValue_(row, headerMap, ['client', 'acheteur', 'clientnom', 'buyer'], ''),
      adresse: pickValue_(row, headerMap, ['clientadresse', 'adresse', 'clientaddress'], ''),
      email: pickValue_(row, headerMap, ['clientemail', 'email'], '')
    };

    const lignes = loadInvoiceLineItems_(ss, factureId);
    if (!lignes.length) {
      const ref = pickValue_(row, headerMap, ['reference', 'ref'], 'LIG-1');
      const lib = pickValue_(row, headerMap, ['libelle', 'designation', 'description'], 'Prestation');
      const qte = parseNumber_(pickValue_(row, headerMap, ['quantite', 'qty'], 1)) || 1;
      const pu = parseNumber_(pickValue_(row, headerMap, ['prixunitaire', 'pu', 'unitprice'], pickValue_(row, headerMap, ['totalht', 'total', 'montant'], 0))) || 0;
      lignes.push({ ref: ref, lib: lib, qte: qte, pu: pu });
    }

    const totals = {
      ht: parseNumber_(pickValue_(row, headerMap, ['totalht', 'montantht'], sumLineTotals_(lignes))),
      tva: parseNumber_(pickValue_(row, headerMap, ['tva', 'totaltva'], 0)),
      ttc: parseNumber_(pickValue_(row, headerMap, ['totalttc', 'montantttc', 'total'], sumLineTotals_(lignes))),
      devise: pickValue_(row, headerMap, ['devise', 'currency', 'monnaie'], 'EUR'),
      conditions: pickValue_(row, headerMap, ['conditions', 'paiementconditions', 'paymentterms'], 'Règlement à réception – TVA non applicable, art. 293 B du CGI.')
    };

    return {
      numero: String(row[numeroIdx] || factureId),
      date: invoiceDate,
      vendeur: vendeur,
      acheteur: acheteur,
      lignes: lignes,
      totaux: totals
    };
  } catch (err) {
    console.error(`Chargement des données facture échoué: ${err.message}`);
    return buildSampleInvoice_(factureId);
  }
}

/**
 * Transforme la facture HTML en PDF (A4).
 * @param {Object} invoiceData Données de facture.
 * @return {GoogleAppsScript.Base.Blob} Blob PDF.
 */
function renderInvoicePdf(invoiceData) {
  const linesWithTotals = invoiceData.lignes.map((line, idx) => ({
    ref: line.ref || `LIG-${idx + 1}`,
    lib: line.lib,
    qte: Number(line.qte || 0),
    pu: Number(line.pu || 0),
    total: Number(line.qte || 0) * Number(line.pu || 0)
  }));

  const template = HtmlService.createTemplateFromFile('apps-script/Facture');
  template.invoice = Object.assign({}, invoiceData, { lignes: linesWithTotals });
  template.forPdf = true;

  const htmlOutput = template.evaluate();
  const blob = Utilities.newBlob(htmlOutput.getContent(), 'text/html', `FACTURE_${invoiceData.numero}.html`);
  const pdfBlob = blob.getAs('application/pdf');
  pdfBlob.setName(`FACTURE_${invoiceData.numero}.pdf`);
  return pdfBlob;
}

/**
 * Construit un fichier XML CII (EN16931) conforme au profil BASE / BASIC WL.
 * @param {Object} invoice Données de facture.
 * @return {GoogleAppsScript.Base.Blob} Blob XML.
 */
function buildCIIxmlBlob(invoice) {
  const namespaces = {
    rsm: XmlService.getNamespace('rsm', 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100'),
    ram: XmlService.getNamespace('ram', 'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100'),
    qdt: XmlService.getNamespace('qdt', 'urn:un:unece:uncefact:data:standard:QualifiedDataType:100'),
    udt: XmlService.getNamespace('udt', 'urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100')
  };

  const doc = XmlService.createDocument();
  const root = XmlService.createElement('CrossIndustryInvoice', namespaces.rsm);
  root.addNamespaceDeclaration('ram', namespaces.ram.getURI());
  root.addNamespaceDeclaration('qdt', namespaces.qdt.getURI());
  root.addNamespaceDeclaration('udt', namespaces.udt.getURI());

  const issueDate = Utilities.formatDate(invoice.date, Session.getScriptTimeZone() || 'Europe/Paris', 'yyyyMMdd');
  const invoiceTotals = invoice.totaux || {};
  const dueAmount = Number(invoiceTotals.ttc || invoiceTotals.ht || sumLineTotals_(invoice.lignes));
  const vatMention = invoiceTotals.conditions || 'TVA non applicable, art. 293 B du CGI.';

  const exchangedDocument = XmlService.createElement('ExchangedDocument', namespaces.rsm)
    .addContent(createElement_(namespaces.ram, 'ID', invoice.numero))
    .addContent(createElement_(namespaces.ram, 'TypeCode', '380'))
    .addContent(
      XmlService.createElement('IssueDateTime', namespaces.ram)
        .addContent(
          XmlService.createElement('DateTimeString', namespaces.udt)
            .setAttribute('format', '102')
            .setText(issueDate)
        )
    )
    .addContent(
      XmlService.createElement('IncludedNote', namespaces.ram)
        .addContent(createElement_(namespaces.ram, 'Content', vatMention))
    );
  root.addContent(exchangedDocument);

  const context = XmlService.createElement('SpecifiedExchangedDocumentContext', namespaces.ram)
    .addContent(
      XmlService.createElement('GuidelineSpecifiedDocumentContextParameter', namespaces.ram)
        .addContent(createElement_(namespaces.ram, 'ID', 'urn:factur-x.eu:1p0:basicwl'))
    );
  root.addContent(context);

  const seller = buildTradeParty_(namespaces, invoice.vendeur, true);
  const buyer = buildTradeParty_(namespaces, invoice.acheteur, false);

  const agreement = XmlService.createElement('ApplicableHeaderTradeAgreement', namespaces.ram)
    .addContent(seller)
    .addContent(buyer)
    .addContent(createElement_(namespaces.ram, 'BuyerReference', (invoice.acheteur && invoice.acheteur.nom) || ''));

  const delivery = XmlService.createElement('ApplicableHeaderTradeDelivery', namespaces.ram)
    .addContent(
      XmlService.createElement('ActualDeliverySupplyChainEvent', namespaces.ram)
        .addContent(
          XmlService.createElement('OccurrenceDateTime', namespaces.ram)
            .addContent(
              XmlService.createElement('DateTimeString', namespaces.udt)
                .setAttribute('format', '102')
                .setText(issueDate)
            )
        )
    );

  const settlement = XmlService.createElement('ApplicableHeaderTradeSettlement', namespaces.ram)
    .addContent(createElement_(namespaces.ram, 'InvoiceCurrencyCode', invoiceTotals.devise || 'EUR'))
    .addContent(
      XmlService.createElement('SpecifiedTradeSettlementPaymentMeans', namespaces.ram)
        .addContent(createElement_(namespaces.ram, 'TypeCode', '30'))
        .addContent(createElement_(namespaces.ram, 'Information', invoiceTotals.conditions || 'Virement à réception'))
    )
    .addContent(
      XmlService.createElement('ApplicableTradeTax', namespaces.ram)
        .addContent(createElement_(namespaces.ram, 'TypeCode', 'VAT'))
        .addContent(createElement_(namespaces.ram, 'CategoryCode', 'O'))
        .addContent(createElement_(namespaces.ram, 'RateApplicablePercent', formatAmount_(0)))
        .addContent(createElement_(namespaces.ram, 'ExemptionReason', 'TVA non applicable, art. 293 B du CGI'))
        .addContent(createElement_(namespaces.ram, 'TaxBasisTotalAmount', formatAmount_(invoiceTotals.ht || dueAmount)))
        .addContent(createElement_(namespaces.ram, 'CalculatedAmount', formatAmount_(0)))
    )
    .addContent(
      XmlService.createElement('SpecifiedTradePaymentTerms', namespaces.ram)
        .addContent(createElement_(namespaces.ram, 'Description', invoiceTotals.conditions || 'Règlement à réception'))
    );

  settlement.addContent(
    XmlService.createElement('SpecifiedTradeSettlementMonetarySummation', namespaces.ram)
      .addContent(createElement_(namespaces.ram, 'LineTotalAmount', formatAmount_(invoiceTotals.ht || dueAmount)))
      .addContent(createElement_(namespaces.ram, 'ChargeTotalAmount', formatAmount_(0)))
      .addContent(createElement_(namespaces.ram, 'AllowanceTotalAmount', formatAmount_(0)))
      .addContent(createElement_(namespaces.ram, 'TaxBasisTotalAmount', formatAmount_(invoiceTotals.ht || dueAmount)))
      .addContent(createElement_(namespaces.ram, 'TaxTotalAmount', formatAmount_(invoiceTotals.tva || 0)))
      .addContent(createElement_(namespaces.ram, 'GrandTotalAmount', formatAmount_(invoiceTotals.ttc || dueAmount)))
      .addContent(createElement_(namespaces.ram, 'DuePayableAmount', formatAmount_(invoiceTotals.ttc || dueAmount)))
  );

  const transaction = XmlService.createElement('SupplyChainTradeTransaction', namespaces.rsm)
    .addContent(agreement)
    .addContent(delivery)
    .addContent(settlement);

  invoice.lignes.forEach(function(line, index) {
    const lineTotal = Number(line.qte || 0) * Number(line.pu || 0);
    const tradeLineItem = XmlService.createElement('IncludedSupplyChainTradeLineItem', namespaces.ram)
      .addContent(
        XmlService.createElement('AssociatedDocumentLineDocument', namespaces.ram)
          .addContent(createElement_(namespaces.ram, 'LineID', String(index + 1)))
      )
      .addContent(
        XmlService.createElement('SpecifiedTradeProduct', namespaces.ram)
          .addContent(createElement_(namespaces.ram, 'ID', line.ref || 'REF-' + (index + 1)))
          .addContent(createElement_(namespaces.ram, 'Name', line.lib || ''))
      )
      .addContent(
        XmlService.createElement('SpecifiedLineTradeAgreement', namespaces.ram)
          .addContent(
            XmlService.createElement('GrossPriceProductTradePrice', namespaces.ram)
              .addContent(createElement_(namespaces.ram, 'ChargeAmount', formatAmount_(line.pu || 0)))
          )
          .addContent(
            XmlService.createElement('NetPriceProductTradePrice', namespaces.ram)
              .addContent(createElement_(namespaces.ram, 'ChargeAmount', formatAmount_(line.pu || 0)))
          )
      )
      .addContent(
        XmlService.createElement('SpecifiedLineTradeDelivery', namespaces.ram)
          .addContent(
            XmlService.createElement('BilledQuantity', namespaces.ram)
              .setAttribute('unitCode', line.unitCode || 'C62')
              .setText(formatQuantity_(line.qte || 0))
          )
      )
      .addContent(
        XmlService.createElement('SpecifiedLineTradeSettlement', namespaces.ram)
          .addContent(
            XmlService.createElement('ApplicableTradeTax', namespaces.ram)
              .addContent(createElement_(namespaces.ram, 'TypeCode', 'VAT'))
              .addContent(createElement_(namespaces.ram, 'CategoryCode', 'O'))
              .addContent(createElement_(namespaces.ram, 'RateApplicablePercent', formatAmount_(0)))
              .addContent(createElement_(namespaces.ram, 'ExemptionReason', 'TVA non applicable, art. 293 B du CGI'))
          )
          .addContent(
            XmlService.createElement('SpecifiedTradeSettlementLineMonetarySummation', namespaces.ram)
              .addContent(createElement_(namespaces.ram, 'LineTotalAmount', formatAmount_(lineTotal)))
          )
      );

    transaction.addContent(tradeLineItem);
  });

  root.addContent(transaction);
  doc.setRootElement(root);

  const xml = XmlService.getPrettyFormat().format(doc);
  const blob = Utilities.newBlob(xml, 'application/xml', `FACTURE_${invoice.numero}.xml`);
  return blob;
}

/**
 * Crée ou récupère le dossier YYYY/MM sous le dossier Factures configuré.
 * @param {Date} date Date de la facture.
 * @return {GoogleAppsScript.Drive.Folder} Dossier Drive.
 */
function ensureMonthFolder_(date) {
  const config = getConfig();
  const folderId = config.BILLING && config.BILLING.FACTURES_FOLDER_ID;
  if (!folderId) {
    throw new Error('FACTURES_FOLDER_ID non configuré.');
  }
  const rootFolder = DriveApp.getFolderById(folderId);

  const year = String(date.getFullYear());
  const month = Utilities.formatDate(date, Session.getScriptTimeZone() || 'Europe/Paris', 'MM');

  const yearFolder = getOrCreateChildFolder_(rootFolder, year);
  return getOrCreateChildFolder_(yearFolder, month);
}

/**
 * Appelle le micro-service pour intégrer le XML dans un PDF/A-3 Factur-X.
 * @param {GoogleAppsScript.Base.Blob} pdfBlob Blob PDF original.
 * @param {GoogleAppsScript.Base.Blob} xmlBlob Blob XML CII.
 * @param {string} outName Nom du fichier final.
 * @param {GoogleAppsScript.Drive.Folder} folder Dossier de stockage.
 * @return {string} URL Drive du fichier Factur-X ou chaîne vide.
 */
function embedFacturX_(pdfBlob, xmlBlob, outName, folder) {
  const props = PropertiesService.getScriptProperties();
  const serviceUrl = props.getProperty('FACTURX_URL');
  const token = props.getProperty('FACTURX_TOKEN');
  if (!serviceUrl || !token) {
    throw new Error('FACTURX_URL ou FACTURX_TOKEN non configuré.');
  }

  const response = UrlFetchApp.fetch(serviceUrl, {
    method: 'post',
    payload: { pdf: pdfBlob, xml: xmlBlob },
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    const body = safeParseJson_(response.getContentText());
    const detail = body && body.detail ? body.detail : response.getContentText();
    throw new Error(`Service Factur-X (${status}) : ${detail}`);
  }

  const fxBlob = response.getBlob();
  fxBlob.setName(outName);
  const file = folder.createFile(fxBlob);
  return file.getUrl();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSellerInfo_(props) {
  const config = getConfig();
  return {
    nom: props.getProperty('NOM_ENTREPRISE') || (config.BILLING && config.BILLING.ENTREPRISE_NOM) || 'EI Emmanuel Lecourt – EL Services Toulon',
    siret: props.getProperty('SIRET') || '480 913 060',
    adresse: props.getProperty('ADRESSE_ENTREPRISE') || 'Toulon (FR)',
    email: props.getProperty('EMAIL_ENTREPRISE') || 'elservicestoulon@gmail.com'
  };
}

function buildSampleInvoice_(factureId) {
  return {
    numero: factureId || '2025-0107',
    date: new Date('2025-10-29T00:00:00Z'),
    vendeur: {
      nom: 'EI Emmanuel Lecourt – EL Services Toulon',
      siret: '480 913 060',
      adresse: 'Toulon (FR)',
      email: 'elservicestoulon@gmail.com'
    },
    acheteur: {
      nom: 'Pharmacie Portissol',
      adresse: 'Sanary-sur-Mer (FR)',
      email: ''
    },
    lignes: [
      { ref: 'SUB-Z3', lib: 'Accès Requêtes EHPAD – Zone Z3 (mois)', qte: 1, pu: 39.0 }
    ],
    totaux: {
      ht: 39.0,
      tva: 0,
      ttc: 39.0,
      devise: 'EUR',
      conditions: 'Règlement à réception – TVA non applicable, art. 293 B du CGI.'
    }
  };
}

function loadInvoiceLineItems_(spreadsheet, factureId) {
  const sheet = spreadsheet.getSheetByName('Facturation_Lignes');
  if (!sheet) {
    return [];
  }
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }
  const headerMap = buildHeaderIndex_(values.shift());
  const numeroIdx = findHeaderIndex_(headerMap, ['numero', 'facture', 'facturenumero', 'invoice']);
  if (numeroIdx === -1) {
    return [];
  }
  return values
    .filter(row => normalizeString_(row[numeroIdx]) === normalizeString_(factureId))
    .map((row, idx) => ({
      ref: pickValue_(row, headerMap, ['ref', 'reference', 'code'], `LIG-${idx + 1}`),
      lib: pickValue_(row, headerMap, ['libelle', 'designation', 'description'], ''),
      qte: parseNumber_(pickValue_(row, headerMap, ['quantite', 'qty'], 1)) || 1,
      pu: parseNumber_(pickValue_(row, headerMap, ['prixunitaire', 'pu', 'unitprice'], 0)) || 0,
      unitCode: pickValue_(row, headerMap, ['unitcode', 'codeunite'], 'C62')
    }));
}

function getOrCreateChildFolder_(parent, name) {
  const iterator = parent.getFoldersByName(name);
  if (iterator.hasNext()) {
    return iterator.next();
  }
  return parent.createFolder(name);
}

function buildHeaderIndex_(headers) {
  const map = {};
  headers.forEach(function(header, index) {
    const key = normalizeString_(header);
    if (key) {
      map[key] = index;
    }
  });
  return map;
}

function findHeaderIndex_(indexMap, candidates) {
  for (var i = 0; i < candidates.length; i += 1) {
    var key = normalizeString_(candidates[i]);
    if (Object.prototype.hasOwnProperty.call(indexMap, key)) {
      return indexMap[key];
    }
  }
  return -1;
}

function pickValue_(row, indexMap, keys, fallback) {
  var idx = findHeaderIndex_(indexMap, keys);
  if (idx === -1) {
    return fallback;
  }
  var value = row[idx];
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  return value;
}

function parseDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'number') {
    return new Date(Math.round((value - 25569) * 24 * 60 * 60 * 1000));
  }
  if (typeof value === 'string' && value) {
    var parts = value.split(/[/-]/);
    if (parts.length === 3) {
      var year = Number(parts[0].length === 4 ? parts[0] : parts[2]);
      var month = Number(parts[1]) - 1;
      var day = Number(parts[0].length === 4 ? parts[2] : parts[0]);
      return new Date(year, month, day);
    }
    var parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

function parseNumber_(value) {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    var normalized = value.replace(',', '.').replace(/[^\d.-]/g, '');
    var parsed = Number(normalized);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

function sumLineTotals_(lines) {
  return lines.reduce(function(sum, line) {
    return sum + (Number(line.qte || 0) * Number(line.pu || 0));
  }, 0);
}

function normalizeString_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function formatAmount_(value) {
  return Utilities.formatString('%.2f', Number(value || 0));
}

function formatQuantity_(value) {
  return Utilities.formatString('%.3f', Number(value || 0));
}

function createElement_(ns, name, text) {
  var element = XmlService.createElement(name, ns);
  if (text !== undefined && text !== null) {
    element.setText(String(text));
  }
  return element;
}

function buildTradeParty_(namespaces, party, isSeller) {
  var partyElement = XmlService.createElement(isSeller ? 'SellerTradeParty' : 'BuyerTradeParty', namespaces.ram)
    .addContent(createElement_(namespaces.ram, 'Name', party && party.nom ? party.nom : ''));

  if (party && party.siret) {
    partyElement.addContent(
      XmlService.createElement('SpecifiedLegalOrganization', namespaces.ram)
        .addContent(createElement_(namespaces.ram, 'ID', party.siret))
    );
  }

  if (party && party.email) {
    partyElement.addContent(
      XmlService.createElement('DefinedTradeContact', namespaces.ram)
        .addContent(
          XmlService.createElement('EmailURIUniversalCommunication', namespaces.ram)
            .addContent(createElement_(namespaces.ram, 'URIID', party.email))
        )
    );
  }

  if (party && party.adresse) {
    partyElement.addContent(
      XmlService.createElement('PostalTradeAddress', namespaces.ram)
        .addContent(createElement_(namespaces.ram, 'LineOne', party.adresse))
        .addContent(createElement_(namespaces.ram, 'CountryID', 'FR'))
    );
  }

  return partyElement;
}

function safeParseJson_(text) {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (_err) {
    return null;
  }
}
