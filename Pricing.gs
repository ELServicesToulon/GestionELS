/**
 * Fonctions utilitaires de tarification.
 * Calcule le prix d'une course à partir du nombre total d'arrêts.
 */

function computeSupplementCost(nSupp) {
  const arr = TARIFS?.normal?.arrets || [];
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
  const precollecte = opts.precollecte === true;
  const remise = opts.remise || 0;

  // Apply V2 rules if enabled: Saturday overrides urgent (no stacking)
  const isSamedi = samedi === true;
  const isUrgent = urgent === true && (!(typeof PRICING_RULES_V2_ENABLED !== 'undefined' && PRICING_RULES_V2_ENABLED) || !isSamedi);

  const nbSupp = Math.max(0, (totalStops | 0) - 1);
  const base = TARIFS?.normal?.base || 0;
  if (!TARIFS?.normal?.base) {
    return {
      total: 0,
      nbSupp: nbSupp,
      error: 'Tarif normal.base manquant',
      breakdown: { base: 0, supplements: 0, retour: 0, urgent: 0, samedi: 0, precollecte: 0, remise: remise }
    };
  }
  const supplements = computeSupplementCost(nbSupp);
  const retourFee = retour ? (computeSupplementCost(nbSupp + 1) - supplements) : 0;
  const surcharges = TARIFS?.surcharges || {};
  const surcUrg = isUrgent ? (surcharges.URGENT || 0) : 0;
  const surcSam = isSamedi ? (surcharges.SAMEDI || 0) : 0;
  const surcPre = precollecte ? (surcharges.PRECOLLECTE || 0) : 0;

  const total = base + supplements + retourFee + surcUrg + surcSam + surcPre - remise;

  return {
    total: total,
    nbSupp: nbSupp,
    breakdown: {
      base: base,
      supplements: supplements,
      retour: retourFee,
      urgent: surcUrg,
      samedi: surcSam,
      precollecte: surcPre,
      remise: remise
    }
  };
}
