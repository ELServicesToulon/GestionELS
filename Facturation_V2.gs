function INV2_generateInvoicePdf_(data) {
  const props = PropertiesService.getScriptProperties();
  const tplId = props.getProperty('ID_MODELE_FACTURE_V2') || props.getProperty('ID_MODELE_FACTURE');
  if (!tplId) throw new Error('ID_MODELE_FACTURE[_V2] manquant');
  const folderId = props.getProperty('ID_DOSSIER_FACTURES') || null;
  const parent = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();

  const name = `FACT-${data.numero} – ${data.client.nom}`;
  const docFile = DriveApp.getFileById(tplId).makeCopy(name, parent);
  const doc = DocumentApp.openById(docFile.getId());
  const body = doc.getBody();

  const repl = INV2_buildReplacements_(data);
  Object.keys(repl).forEach(k => body.replaceText(`\{\{${k}\}\}`, String(repl[k] ?? '')));

  INV2_insertLinesTable_(body, 'LIGNES', data.lignes);
  INV2_insertTotals_(body, 'TOTALS', data.totaux, data.options);

  doc.saveAndClose();
  let pdfBlob;
  if (docFile && typeof docFile.getAs === 'function') {
    pdfBlob = docFile.getAs('application/pdf');
  } else if (doc && typeof doc.getAs === 'function') {
    pdfBlob = doc.getAs('application/pdf');
  } else {
    pdfBlob = Utilities.newBlob('', 'application/pdf', name + '.pdf');
  }
  const pdfFile = parent.createFile(pdfBlob).setName(name + '.pdf');
  try {
    docFile.setTrashed(true);
  } catch (_trashErr) {
    Logger.log(`Impossible de supprimer la copie du modèle facture ${docFile.getId()}: ${_trashErr.message}`);
  }
  return pdfFile.getUrl();
}

function INV2_buildReplacements_(data) {
  const p = PropertiesService.getScriptProperties();
  const micro = !!data.options?.microEntreprise;
  const tvaMention = micro ? 'TVA non applicable, art. 293 B du CGI' : (data.options?.tvaMention || '');

  const clientTva = data.client?.tva ? `\nTVA intracommunautaire : ${data.client.tva}` : '';

  return {
    ENTREPRISE_NOM: p.getProperty('NOM_ENTREPRISE') || '',
    ADRESSE_ENTREPRISE: p.getProperty('ADRESSE_ENTREPRISE') || '',
    SIRET: p.getProperty('SIRET') || '',
    EMAIL_ENTREPRISE: p.getProperty('EMAIL_ENTREPRISE') || p.getProperty('ADMIN_EMAIL') || '',
    TEL_ENTREPRISE: p.getProperty('TEL_ENTREPRISE') || '',
    IBAN: p.getProperty('IBAN_ENTREPRISE') || p.getProperty('RIB_ENTREPRISE') || '',
    BIC: p.getProperty('BIC_ENTREPRISE') || '',
    FACTURE_NUMERO: data.numero,
    FACTURE_DATE: data.date,
    ECHEANCE_DATE: data.paiement?.echeance || '',
    CLIENT_NOM: data.client?.nom || '',
    CLIENT_ADRESSE: data.client?.adresse || '',
    CLIENT_EMAIL: data.client?.email || '',
    CLIENT_TVA_OPTION: clientTva,
    PERIODE_LIBELLE: data.periode || '',
    PAIEMENT_CONDITIONS: data.paiement?.conditions || 'Virement à réception',
    TVA_MENTION: tvaMention,
    NOTES: data.notes || '',
    REFERENCE_LIBRE: data.reference || '',
    LIEN_CGV: data.lienCgv || ''
  };
}

function INV2_insertLinesTable_(body, marker, lignes) {
  const m = body.findText(`\{\{${marker}\}\}`);
  if (!m) return;
  const idx = body.getChildIndex(m.getElement().getParent());
  const table = body.insertTable(idx + 1, DocumentApp.createTable());
  // entêtes
  const h = table.appendTableRow();
  ['Désignation','Qté','PU','Total'].forEach(t => h.appendTableCell(t).setBold(true));
  // lignes
  (lignes || []).forEach(l => {
    const r = table.appendTableRow();
    r.appendTableCell(l.label || '');
    r.appendTableCell(String(l.qte ?? 1));
    r.appendTableCell(INV2_fmt_(l.pu));
    r.appendTableCell(INV2_fmt_(l.total));
  });
  // retire {{LIGNES}}
  m.getElement().asText().getParent().removeFromParent();
  table.setBorderWidth(0.5);
}

function INV2_insertTotals_(body, marker, totaux, options) {
  const m = body.findText(`\{\{${marker}\}\}`);
  if (!m) return;
  const idx = body.getChildIndex(m.getElement().getParent());
  const table = body.insertTable(idx + 1, DocumentApp.createTable());
  const micro = !!options?.microEntreprise;

  const rows = micro
    ? [['Montant', INV2_fmt_(totaux.montant || 0)],
       ['Remises', INV2_fmt_(totaux.remise || 0)],
       ['Total à payer', INV2_fmt_(totaux.total || totaux.montant || 0)]]
    : [['Sous-total', INV2_fmt_(totaux.ht || 0)],
       ['TVA', INV2_fmt_(totaux.tva || 0)],
       ['Total', INV2_fmt_(totaux.ttc || 0)]];

  rows.forEach(([k,v]) => {
    const r = table.appendTableRow();
    r.appendTableCell(k).setBold(true);
    r.appendTableCell(v);
  });
  m.getElement().asText().getParent().removeFromParent();
  table.setBorderWidth(0.5);
}

function INV2_fmt_(n){ return (n==null) ? '' : Utilities.formatString('%.2f €', Number(n)); }

function INV2__exampleData() {
  return {
    numero: '2025-0098',
    date: '11/09/2025',
    periode: 'Semaine 37',
    client: { nom:'Pharmacie de Portissol', adresse:'12 rue … 83110 Sanary', email:'contact@…', tva:'' },
    lignes: [
      { label:'Course standard – 90 min (retour inclus)', qte:1, pu:36, total:36 },
      { label:'Pré-collecte ordonnances (forfait)', qte:1, pu:5, total:5 }
    ],
    totaux: { montant:41, remise:0, total:41, ht:0, tva:0, ttc:0 },
    paiement: { conditions:'Virement à réception', echeance:'25/09/2025' },
    options: { microEntreprise:true },
    lienCgv:'https://ton-site/cgv',
    notes:'Merci pour votre confiance.',
    reference:'Cmd #ABC123'
  };
}
