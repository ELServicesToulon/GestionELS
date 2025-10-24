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

function shouldApplyPricingRulesV2_(forcedVersion) {
  if (forcedVersion === 'v1') return false;
  if (forcedVersion === 'v2') return true;
  return typeof PRICING_RULES_V2_ENABLED !== 'undefined' && PRICING_RULES_V2_ENABLED;
}

function resolveStopTotal_(rulesEntry, totalStops) {
  if (!rulesEntry) return null;
  const stops = Math.max(1, totalStops | 0);
  const totals = Array.isArray(rulesEntry.stopTotals) ? rulesEntry.stopTotals : [];
  if (!totals.length) return null;
  const index = stops - 1;
  if (index < totals.length && typeof totals[index] === 'number') {
    return Number(totals[index]);
  }
  const lastValue = Number(totals[totals.length - 1]);
  if (!isFinite(lastValue)) {
    return null;
  }
  const increment = typeof rulesEntry.extraStopIncrement === 'number'
    ? rulesEntry.extraStopIncrement
    : (totals.length > 1 && isFinite(Number(totals[totals.length - 1])) && isFinite(Number(totals[totals.length - 2])))
      ? Number(totals[totals.length - 1]) - Number(totals[totals.length - 2])
      : 0;
  if (!increment) {
    return lastValue;
  }
  const extraCount = stops - totals.length;
  return lastValue + (extraCount * increment);
}

function resolveReturnSurcharge_(rulesEntry, fallbackRules) {
  if (rulesEntry && typeof rulesEntry.returnSurcharge === 'number') {
    return rulesEntry.returnSurcharge;
  }
  if (fallbackRules && typeof fallbackRules.returnSurcharge === 'number') {
    return fallbackRules.returnSurcharge;
  }
  return 0;
}

function computeCoursePriceV2_(opts) {
  const totalStopsRaw = opts.totalStops === undefined ? 1 : opts.totalStops;
  const stops = Math.max(1, totalStopsRaw | 0);
  const retour = opts.retour === true;
  const samedi = opts.samedi === true;
  const urgent = opts.urgent === true && !samedi;
  const remise = Number(opts.remise) || 0;
  const rules = (typeof PRICING_RULES_V2 !== 'undefined' && PRICING_RULES_V2) ? PRICING_RULES_V2 : null;
  if (!rules || !rules.Normal) {
    return null;
  }

  const normalRules = rules.Normal;
  const typeKey = samedi ? 'Samedi' : (urgent ? 'Urgent' : 'Normal');
  const typeRules = rules[typeKey] || normalRules;
  const normalStopTotal = resolveStopTotal_(normalRules, stops);
  const typeStopTotal = resolveStopTotal_(typeRules, stops);
  if (normalStopTotal === null || typeStopTotal === null) {
    return null;
  }

  const retourFee = retour ? resolveReturnSurcharge_(typeRules, normalRules) : 0;
  const total = typeStopTotal + retourFee - remise;
  const baseNormal = resolveStopTotal_(normalRules, 1) || 0;
  const supplements = Math.max(0, normalStopTotal - baseNormal);
  const difference = Math.max(0, typeStopTotal - normalStopTotal);
  const breakdownUrgent = urgent ? difference : 0;
  const breakdownSamedi = samedi ? difference : 0;

  return {
    total: total,
    nbSupp: Math.max(0, stops - 1),
    breakdown: {
      base: baseNormal,
      supplements: supplements,
      retour: retourFee,
      urgent: breakdownUrgent,
      samedi: breakdownSamedi,
      remise: remise
    }
  };
}

function computeCoursePriceV1_(opts) {
  const totalStops = opts.totalStops === undefined ? 1 : opts.totalStops;
  const retour = opts.retour === true;
  const urgent = opts.urgent === true;
  const samedi = opts.samedi === true;
  const remise = Number(opts.remise) || 0;

  const isSamedi = samedi === true;
  const flagV2 = typeof PRICING_RULES_V2_ENABLED !== 'undefined' && PRICING_RULES_V2_ENABLED;
  const isUrgent = urgent === true && (!flagV2 || !isSamedi);

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

  const total = base + supplements + retourFee + surcUrg + surcSam - remise;

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

function computeCoursePrice(opts) {
  opts = opts || {};
  const applyV2 = shouldApplyPricingRulesV2_(opts.forcePricingRulesVersion);
  if (applyV2) {
    const v2Result = computeCoursePriceV2_(opts);
    if (v2Result) {
      return v2Result;
    }
  }
  return computeCoursePriceV1_(opts);
}

function formatCourseLabel_(dureeMin, totalStops, isReturn) {
  var nbSupp = Math.max((Number(totalStops) || 0) - 1, 0);
  var detail = nbSupp + ' supp.';
  if (isReturn && shouldApplyPricingRulesV2_(undefined)) {
    detail += ' + retour';
  }
  return 'Tournée de ' + dureeMin + 'min (' + totalStops + ' arrêt(s) total(s) (dont ' + detail + '), retour: ' + (isReturn ? 'oui' : 'non') + ')';
}
