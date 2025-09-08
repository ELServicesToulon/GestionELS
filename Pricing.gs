/**
 * Fonctions utilitaires de tarification.
 * Calcule le prix d'une course selon le nombre d'arrêts et surcharges.
 */
function computePrice(req) {
  req = req || {};
  const conf = TARIFS[req.typeCourse] || TARIFS.normal;
  var total = conf.base;
  var rest = Math.max(0, (req.arretsTotaux || 1) - 1);
  for (var i = 0; i < rest; i++) {
    total += conf.arrets[Math.min(i, conf.arrets.length - 1)];
  }
  if (req.isUrgent)     total += TARIFS.surcharges.URGENT || 0;
  if (req.isSamedi)     total += TARIFS.surcharges.SAMEDI || 0;
  if (req.precollecte)  total += TARIFS.surcharges.PRECOLLECTE || 0;
  return Math.round(total * 100) / 100;
}
