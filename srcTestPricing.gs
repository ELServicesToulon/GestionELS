/**
 * Harnais minimal de test pour le calcul de tarifs.
 * Appelle computeCoursePrice(...) pour comparer les scénarios clés.
 */
function RunPricingAudit() {
  var cases = [
    { label: 'Base 1 arret', stops: 1, urgent: false, samedi: false, retour: false, km: 9, min: 30 },
    { label: '2 arrets', stops: 2, urgent: false, samedi: false, retour: false, km: 12, min: 40 },
    { label: 'Urgent', stops: 1, urgent: true, samedi: false, retour: false, km: 9, min: 30 },
    { label: 'Samedi', stops: 1, urgent: false, samedi: true, retour: false, km: 9, min: 30 },
    { label: 'Retour pharmacie', stops: 1, urgent: false, samedi: false, retour: true, km: 11, min: 36 },
    { label: 'Combo ++', stops: 3, urgent: true, samedi: true, retour: true, km: 18, min: 55 }
  ];

  var out = [];

  cases.forEach(function (scenario) {
    var res = computeCoursePrice({
      totalStops: scenario.stops,
      urgent: scenario.urgent,
      samedi: scenario.samedi,
      retour: scenario.retour,
      distanceKm: scenario.km,
      dureeMinutes: scenario.min
    });

    out.push({
      label: scenario.label,
      inputs: {
        stops: scenario.stops,
        urgent: scenario.urgent,
        saturday: scenario.samedi,
        returnToPharmacy: scenario.retour,
        distanceKm: scenario.km,
        durationMin: scenario.min
      },
      output: res
    });
  });

  Logger.log(JSON.stringify(out, null, 2));
  return out;
}
