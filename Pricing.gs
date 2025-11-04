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

function roundCurrency_(value) {
  const num = Number(value);
  if (!isFinite(num)) {
    return 0;
  }
  return Math.round(num * 100) / 100;
}

function formatEuro_(value) {
  if (!isFinite(Number(value))) {
    return '';
  }
  const rounded = roundCurrency_(value);
  return rounded.toFixed(2).replace('.', ',') + ' €';
}

function normalizeCoursePriceResult_(result) {
  if (!result) {
    return null;
  }
  const breakdown = result.breakdown || {};
  const normalized = {
    total: roundCurrency_(result.total),
    nbSupp: Math.max(0, Number(result.nbSupp) || 0),
    breakdown: {
      base: roundCurrency_(breakdown.base),
      supplements: roundCurrency_(breakdown.supplements),
      retour: roundCurrency_(breakdown.retour),
      samedi: roundCurrency_(breakdown.samedi),
      urgent: roundCurrency_(breakdown.urgent),
      remise: roundCurrency_(breakdown.remise)
    }
  };
  normalized.formattedTotal = formatEuro_(normalized.total);
  if (result.error) {
    normalized.error = result.error;
  }
  if (result.warning) {
    normalized.warning = result.warning;
  }
  return normalized;
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
  const rawTotal = typeStopTotal + retourFee;
  const appliedRemise = Math.max(0, Math.min(remise, rawTotal));
  const total = Math.max(0, rawTotal - appliedRemise);
  const baseNormal = resolveStopTotal_(normalRules, 1) || 0;
  const supplements = Math.max(0, normalStopTotal - baseNormal);
  const difference = Math.max(0, typeStopTotal - normalStopTotal);
  const breakdownUrgent = urgent ? difference : 0;
  const breakdownSamedi = samedi ? difference : 0;

  const result = {
    total: total,
    nbSupp: Math.max(0, stops - 1),
    breakdown: {
      base: baseNormal,
      supplements: supplements,
      retour: retourFee,
      urgent: breakdownUrgent,
      samedi: breakdownSamedi,
      remise: appliedRemise
    }
  };
  if (appliedRemise !== remise) {
    result.warning = 'Remise ajustée pour ne pas dépasser le montant.';
  }
  return result;
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
  let retourFee = retour ? (computeSupplementCost(nbSupp + 1) - supplements) : 0;
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
  if (isUrgent) {
    retourFee = Math.max(0, retourFee - surcUrg);
  }
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

  const rawTotal = base + supplements + retourFee + surcUrg + surcSam;
  const appliedRemise = Math.max(0, Math.min(remise, rawTotal));
  const total = Math.max(0, rawTotal - appliedRemise);

  const result = {
    total: total,
    nbSupp: nbSupp,
    breakdown: {
      base: base,
      supplements: supplements,
      retour: retourFee,
      urgent: surcUrg,
      samedi: surcSam,
      remise: appliedRemise
    }
  };
  if (appliedRemise !== remise) {
    result.warning = 'Remise ajustée pour ne pas dépasser le montant.';
  }
  return result;
}

function computeCoursePrice(opts) {
  opts = opts || {};
  const applyV2 = shouldApplyPricingRulesV2_(opts.forcePricingRulesVersion);
  let result = null;
  if (applyV2) {
    result = computeCoursePriceV2_(opts);
  }
  if (!result) {
    result = computeCoursePriceV1_(opts);
  }
  return normalizeCoursePriceResult_(result);
}

function formatCourseLabel_(dureeMin, totalStops, isReturn) {
  var nbSupp = Math.max((Number(totalStops) || 0) - 1, 0);
  var detail = nbSupp + ' supp.';
  if (isReturn && shouldApplyPricingRulesV2_(undefined)) {
    detail += ' + retour';
  }
  return 'Tournée de ' + dureeMin + 'min (' + totalStops + ' arrêt(s) total(s) (dont ' + detail + '), retour: ' + (isReturn ? 'oui' : 'non') + ')';
}

let __pricingMatrixCache = { maxStops: 0, matrix: {} };

function getClientPricingMatrix(maxStops) {
  const max = Math.max(1, Number(maxStops) || 12);
  if (__pricingMatrixCache && __pricingMatrixCache.maxStops >= max) {
    return __pricingMatrixCache.matrix;
  }
  const matrix = {};
  const booleanValues = [false, true];
  for (let stops = 1; stops <= max; stops++) {
    booleanValues.forEach(function (retour) {
      booleanValues.forEach(function (samedi) {
        booleanValues.forEach(function (urgentFlag) {
          const urgent = urgentFlag && !samedi;
          const key = buildPricingKey_(stops, retour, samedi, urgent);
          matrix[key] = computeCoursePrice({
            totalStops: stops,
            retour: retour,
            samedi: samedi,
            urgent: urgent,
            remise: 0
          });
        });
      });
    });
  }
  __pricingMatrixCache = { maxStops: max, matrix: matrix };
  return matrix;
}

function buildPricingKey_(stops, retour, samedi, urgent) {
  return [
    Math.max(1, stops | 0),
    retour ? 1 : 0,
    samedi ? 1 : 0,
    urgent ? 1 : 0
  ].join('|');
}
