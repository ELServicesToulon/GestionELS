/**
 * Fonctions utilitaires de tarification.
 * Calcule le prix d'une course à partir du nombre total d'arrêts.
 */

function computeSupplementCost(nSupp) {
  const arr = TARIFS?.Normal?.arrets || [];
  const fallback = arr.length ? arr[arr.length - 1] : 0;
  let sum = 0;
  for (let i = 0; i < nSupp; i++) sum += (i < arr.length ? arr[i] : fallback);
  return sum;
}

function computeCoursePrice(opts) {
  opts = opts || {};
  const totalStops = opts.totalStops === undefined ? 1 : opts.totalStops;
  const retour = opts.retour === true;
  const urgent = opts.urgent === true;
  const samedi = opts.samedi === true;
  const remise = opts.remise || 0;

  // Apply V2 rules if enabled: Saturday overrides urgent (no stacking)
  var isSamedi = samedi === true;
  var isUrgent = urgent === true && (!(typeof PRICING_RULES_V2_ENABLED !== 'undefined' && PRICING_RULES_V2_ENABLED) || !isSamedi);

  const nbSupp = Math.max(0, (totalStops | 0) - 1);
  const base = TARIFS?.Normal?.base || 0;
  if (!TARIFS?.Normal?.base) {
    return {
      total: 0,
      nbSupp: nbSupp,
      error: 'Tarif Normal.base manquant',
      breakdown: { base: 0, supplements: 0, retour: 0, urgent: 0, samedi: 0, remise: remise }
    };
  }
  const supplements = computeSupplementCost(nbSupp);
  const retourFee = retour ? (computeSupplementCost(nbSupp + 1) - supplements) : 0;
  const urgentBase = TARIFS?.Urgent?.base || 0;
  if (isUrgent && !TARIFS?.Urgent?.base) {
    return {
      total: 0,
      nbSupp: nbSupp,
      error: 'Tarif Urgent.base manquant',
      breakdown: { base: base, supplements: supplements, retour: retourFee, urgent: 0, samedi: 0, remise: remise }
    };
  }
  const surcUrg = isUrgent ? (urgentBase - base) : 0;
  const samediBase = TARIFS?.Samedi?.base || 0;
  if (isSamedi && !TARIFS?.Samedi?.base) {
    return {
      total: 0,
      nbSupp: nbSupp,
      error: 'Tarif Samedi.base manquant',
      breakdown: { base: base, supplements: supplements, retour: retourFee, urgent: surcUrg, samedi: 0, remise: remise }
    };
  }
  const surcSam = isSamedi ? (samediBase - base) : 0;

  let total = base + supplements + retourFee + surcUrg + surcSam - remise;

  return {
    total: total,
    nbSupp: nbSupp,
    breakdown: {
      base: base,
      supplements: supplements,
      retour: retourFee,
      urgent: surcUrg,
      samedi: surcSam,
      remise: remise
    }
  };
}

function formatCourseLabel_(dureeMin, totalStops, isReturn) {
  var nbSupp = Math.max((Number(totalStops) || 0) - 1, 0);
  return 'Tournée de ' + dureeMin + 'min (' + totalStops + ' arrêt(s) total(s) (dont ' + nbSupp + ' supp.), retour: ' + (isReturn ? 'oui' : 'non') + ')';
}
