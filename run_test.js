
const fs = require('fs');

// Mock a a minimal global context
global.console = require('console');
const { computeCoursePriceV1_, computeSupplementCost } = (() => {
  const script = fs.readFileSync('Pricing.gs', 'utf8');
  const a = new Function(
    `
    const TARIFS = {
      Normal: { base: 15, arrets: [5, 4, 3, 4, 5] },
      Urgent: { base: 20, arrets: [5, 4, 3, 4, 5] },
      Samedi: { base: 25, arrets: [5, 4, 3, 4, 5] },
    };
    `
    + script +
    `
    return {
      computeCoursePriceV1_: computeCoursePriceV1_,
      computeSupplementCost: computeSupplementCost
    };
    `
  );
  return a();
})();

// Load the test file and execute the test
const testScript = fs.readFileSync('tests/test_pricing.gs', 'utf8');
const testFunc = new Function(
  'computeCoursePriceV1_',
  'computeSupplementCost',
  testScript + '\n' + 'testComputeCoursePriceV1_NegativeReturn();'
);

testFunc(computeCoursePriceV1_, computeSupplementCost);
