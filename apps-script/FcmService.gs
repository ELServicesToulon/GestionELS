const LIVREUR_FCM_ENDPOINT = 'https://fcm.googleapis.com/v1/projects/%PROJECT_ID%/messages:send';

/**
 * Envoie une notification FCM via HTTP v1.
 * @param {string} token
 * @param {{notification?:Object,data?:Object}} payload
 * @return {{ok:boolean,reason?:string}}
 */
function livreurSendFcmMessage(token, payload) {
  if (!token) {
    return { ok: false, reason: 'MISSING_FIELDS' };
  }
  try {
    const serviceAccount = JSON.parse(getSecret('FCM_SA_JSON'));
    let projectId = serviceAccount.project_id || '';
    if (!projectId) {
      try {
        projectId = sanitizeScalar(getSecret('FIREBASE_PROJECT_ID'), 120);
      } catch (_err) {
        projectId = '';
      }
    }
    if (!projectId) {
      return { ok: false, reason: 'UNCONFIGURED' };
    }
    const jwt = livreurBuildFcmJwt(serviceAccount);
    const body = {
      message: {
        token: token,
        notification: payload && payload.notification ? payload.notification : {},
        data: payload && payload.data ? payload.data : {}
      }
    };
    const endpoint = LIVREUR_FCM_ENDPOINT.replace('%PROJECT_ID%', projectId);
    const response = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(body),
      headers: { Authorization: 'Bearer ' + jwt },
      muteHttpExceptions: true
    });
    const status = response.getResponseCode();
    if (status >= 400) {
      return { ok: false, reason: 'API_ERROR', status: status, body: response.getContentText() };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: 'ERROR', details: sanitizeScalar(err && err.message, 160) };
  }
}

/**
 * Génère un access token OAuth2 pour l'API FCM.
 * @param {Object} serviceAccount
 * @return {string}
 */
function livreurBuildFcmJwt(serviceAccount) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  const toBase64 = function (input) {
    return Utilities.base64EncodeWebSafe(JSON.stringify(input));
  };
  const encodedHeader = toBase64(header);
  const encodedClaims = toBase64(claimSet);
  const signature = Utilities.computeRsaSha256Signature(encodedHeader + '.' + encodedClaims, serviceAccount.private_key);
  const encodedSignature = Utilities.base64EncodeWebSafe(signature);
  const assertion = [encodedHeader, encodedClaims, encodedSignature].join('.');
  const tokenResponse = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    muteHttpExceptions: true,
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: assertion
    }
  });
  const status = tokenResponse.getResponseCode();
  if (status >= 400) {
    throw new Error('API_ERROR_' + status);
  }
  const parsed = JSON.parse(tokenResponse.getContentText());
  return parsed.access_token;
}
