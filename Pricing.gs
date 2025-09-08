/**
 * Fonctions utilitaires de tarification.
 * Calcule le prix d'une course selon le nombre d'arrêts et surcharges.
 */
function computePrice(req) {
  req = req || {};
  const conf = TARIFS[req.typeCourse] || TARIFS.normal;
  let total = conf.base;
  const rest = Math.max(0, (req.arretsTotaux || 1) - 1);
  for (let i = 0; i < rest; i++) {
    total += conf.arrets[Math.min(i, conf.arrets.length - 1)];
  }
  const isSamedi = !!req.isSamedi;
  const isUrgent = !!req.isUrgent && (!PRICING_RULES_V2_ENABLED || !isSamedi);
  if (isUrgent)     total += TARIFS.surcharges.URGENT || 0;
  if (isSamedi)     total += TARIFS.surcharges.SAMEDI || 0;
  if (req.precollecte)  total += TARIFS.surcharges.PRECOLLECTE || 0;
  return Math.round(total * 100) / 100;
}
