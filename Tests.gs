/**
 * Tests serveurs légers.
 */

function test_pricing_basic() {
  const t = toCents(10) + toCents(2.5) - toCents(3);
  if (fromCents(t) !== '9.50') throw new Error('pricing basic KO');
}

function runAllTests() {
  const tests = [test_pricing_basic];
  const res = tests.map(fn => ({ name: fn.name, ok: runSafe(fn) }));
  const failed = res.filter(r => !r.ok);
  if (failed.length) {
    throw new Error('Tests failed: ' + failed.map(r => r.name).join(', '));
  }
  return res;
}

function runSafe(fn) {
  try {
    fn();
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

