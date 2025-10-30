/**
 * Point d'entrée appelé depuis l'interface pour lancer un export Factur-X.
 * @param {string} factureId Identifiant (numéro) de la facture à exporter.
 * @return {{pdfUrl:string, xmlUrl:string, fxUrl:string}} URLs Drive des artefacts générés.
 */
function exportFacturX(factureId) {
  const startedAt = Date.now();
  const actor = getActiveActor_();

  if (!factureId) {
    logEvent(actor, 'EXPORT_FACTURX_ERROR', { message: 'factureId manquant' });
    throw new Error('Identifiant de facture requis pour l’export Factur-X.');
  }

  try {
    const invoice = loadInvoiceData(factureId);
    if (!invoice) {
      throw new Error('Facture introuvable.');
    }

    const archiveFolder = ensureMonthFolder_(invoice.date);
    const pdfBlob = renderInvoicePdf(invoice);
    pdfBlob.setName(`FACTURE_${invoice.numero}.pdf`);
    const pdfFile = archiveFolder.createFile(pdfBlob);

    const xmlBlob = buildCIIxmlBlob(invoice);
    xmlBlob.setName(`FACTURE_${invoice.numero}.xml`);
    const xmlFile = archiveFolder.createFile(xmlBlob);

    let fxUrl = '';
    try {
      fxUrl = embedFacturX_(
        pdfFile.getBlob(),
        xmlFile.getBlob(),
        `FACTURE_${invoice.numero}_FacturX.pdf`,
        archiveFolder
      ) || '';
    } catch (embedErr) {
      console.error(`Échec de l’embed Factur-X pour ${factureId}: ${embedErr.message}`);
      logEvent(
        actor,
        'EXPORT_FACTURX_EMBED_FAILED',
        {
          factureId: factureId,
          durationMs: Date.now() - startedAt,
          error: embedErr.message
        }
      );
    }

    const result = {
      pdfUrl: pdfFile.getUrl(),
      xmlUrl: xmlFile.getUrl(),
      fxUrl: fxUrl
    };

    logEvent(
      actor,
      'EXPORT_FACTURX_SUCCESS',
      {
        factureId: factureId,
        durationMs: Date.now() - startedAt,
        pdfSize: pdfBlob.getBytes().length,
        xmlSize: xmlBlob.getBytes().length,
        fxGenerated: Boolean(fxUrl)
      }
    );

    return result;
  } catch (err) {
    console.error(`Export Factur-X échoué pour ${factureId}: ${err.message}`);
    logEvent(
      actor,
      'EXPORT_FACTURX_ERROR',
      {
        factureId: factureId,
        durationMs: Date.now() - startedAt,
        error: err.message
      }
    );
    throw new Error(`Impossible d’exporter la facture ${factureId}: ${err.message}`);
  }
}
