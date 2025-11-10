/**
 * Tests basiques pour le portail client (liens signés et envoi de lien).
 * Ces tests sont légers et ne vérifient pas le burst pour éviter l'envoi massif d'e-mails.
 */

function test_client_getPortalLink_signed() {
  const email = 'test.client@example.com';
  const res = client_getPortalLink(email);
  if (!res || res.success !== true || !res.url) {
    throw new Error('client_getPortalLink doit retourner une URL.');
  }
  // Si la signature est activée, l’URL doit contenir exp & sig
  if (typeof CLIENT_PORTAL_SIGNED_LINKS !== 'undefined' && CLIENT_PORTAL_SIGNED_LINKS) {
    if (res.url.indexOf('exp=') === -1 || res.url.indexOf('sig=') === -1) {
      throw new Error('Lien signé attendu (exp/sig manquants).');
    }
  }
  return { ok: true };
}

function test_envoyerLienEspaceClient_smoke() {
  const email = 'test.client@example.com';
  // Reset léger du throttle pour cet email
  try {
    const keyBase = Utilities.base64EncodeWebSafe(email.toLowerCase());
    const cache = CacheService.getScriptCache();
    cache.remove('client_link_rate:' + keyBase);
    cache.remove('client_link_burst:' + keyBase);
  } catch (_err) {}

  const res = envoyerLienEspaceClient(email);
  if (!res || res.success !== true) {
    throw new Error('envoyerLienEspaceClient doit retourner success=true. Raison: ' + (res && res.error ? res.error : 'inconnue'));
  }
  return { ok: true };
}

