const FCM_ENDPOINT = 'https://fcm.googleapis.com/v1/projects/FIREBASE_PROJECT_ID/messages:send';

/**
 * Envoie notification FCM.
 * @param {string} token
 * @param {Object} payload
 */
function sendFcmMessage(token, payload) {
  const saJson = PropertiesService.getScriptProperties().getProperty('FCM_SA_JSON');
  if (!saJson) {
    throw new Error('MISSING_FCM_SA');
  }
  const serviceAccount = JSON.parse(saJson);
  const jwt = buildFcmJwt(serviceAccount);
  const body = {
    message: {
      token: token,
      notification: payload.notification,
      data: payload.data
    }
  };
  const response = UrlFetchApp.fetch(FCM_ENDPOINT.replace('FIREBASE_PROJECT_ID', serviceAccount.project_id), {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    headers: {
      Authorization: 'Bearer ' + jwt
    },
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code >= 400) {
    throw new Error('FCM_ERROR_' + code + ':' + response.getContentText());
  }
  return { ok: true };
}

/**
 * Génère JWT pour FCM.
 */
function buildFcmJwt(serviceAccount) {
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
  const jwt = [encodedHeader, encodedClaims, encodedSignature].join('.');
  const tokenResponse = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    }
  });
  const parsed = JSON.parse(tokenResponse.getContentText());
  return parsed.access_token;
}
