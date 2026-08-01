const https = require('https');
const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const { getRedirectUri, requireConfig } = require('../config/oauth');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v1/certs';
const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_AUDIENCE = 'https://appleid.apple.com';

const KEYS_TTL = 60 * 60 * 1000;
let googleCerts = null;
let googleCertsFetchedAt = 0;
let appleKeys = null;
let appleKeysFetchedAt = 0;

function httpsRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function postForm(url, formData) {
  const body = new URLSearchParams(formData).toString();
  return httpsRequest(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    },
    body
  );
}

/* ── Signing key discovery ── */

async function getGoogleCerts() {
  if (googleCerts && Date.now() - googleCertsFetchedAt < KEYS_TTL) return googleCerts;
  const { status, data } = await httpsRequest(GOOGLE_CERTS_URL, { headers: { Accept: 'application/json' } });
  if (status !== 200 || !data || typeof data !== 'object') {
    throw ApiError.internal('Unable to fetch Google signing keys');
  }
  googleCerts = data;
  googleCertsFetchedAt = Date.now();
  return googleCerts;
}

async function getAppleKeys() {
  if (appleKeys && Date.now() - appleKeysFetchedAt < KEYS_TTL) return appleKeys;
  const { status, data } = await httpsRequest(APPLE_KEYS_URL, { headers: { Accept: 'application/json' } });
  if (status !== 200 || !data || !Array.isArray(data.keys)) {
    throw ApiError.internal('Unable to fetch Apple signing keys');
  }
  appleKeys = data;
  appleKeysFetchedAt = Date.now();
  return appleKeys;
}

/* ── Minimal DER/SPKI helpers (RSA + EC P-256) ── */

function derLength(length) {
  if (length < 0x80) return Buffer.from([length]);
  if (length < 0x100) return Buffer.from([0x81, length]);
  if (length < 0x10000) return Buffer.from([0x82, (length >> 8) & 0xff, length & 0xff]);
  throw new Error('DER length too large');
}

function derTag(tag, content) {
  return Buffer.concat([Buffer.from([tag]), derLength(content.length), content]);
}

function derSequence(...items) {
  return derTag(0x30, Buffer.concat(items));
}

function derInteger(content) {
  let value = content;
  if (value[0] & 0x80) {
    value = Buffer.concat([Buffer.from([0]), value]);
  }
  return derTag(0x02, value);
}

function derBitString(content) {
  return derTag(0x03, Buffer.concat([Buffer.from([0]), content]));
}

function derToPem(base64Der, label) {
  const wrapped = base64Der.match(/.{1,64}/g).join('\n');
  return `-----BEGIN ${label}-----\n${wrapped}\n-----END ${label}-----`;
}

const OID_RSA_ENCRYPTION = Buffer.from('2a864886f70d010101', 'hex');
const OID_EC_PUBLIC_KEY = Buffer.from('2a8648ce3d0201', 'hex');
const OID_PRIME256V1 = Buffer.from('2a8648ce3d030107', 'hex');

function jwkRsaToPem(key) {
  const n = Buffer.from(key.n, 'base64url');
  const e = Buffer.from(key.e, 'base64url');
  const algorithm = derSequence(derTag(0x06, OID_RSA_ENCRYPTION), derTag(0x05, Buffer.alloc(0)));
  const rsaPublicKey = derSequence(derInteger(n), derInteger(e));
  const spki = derSequence(algorithm, derBitString(rsaPublicKey));
  return derToPem(spki.toString('base64'), 'PUBLIC KEY');
}

function jwkEcToPem(key) {
  const x = Buffer.from(key.x, 'base64url');
  const y = Buffer.from(key.y, 'base64url');
  const point = Buffer.concat([Buffer.from([0x04]), x, y]);
  const algorithm = derSequence(derTag(0x06, OID_EC_PUBLIC_KEY), derTag(0x06, OID_PRIME256V1));
  const spki = derSequence(algorithm, derBitString(point));
  return derToPem(spki.toString('base64'), 'PUBLIC KEY');
}

function jwkToPem(key) {
  if (key.kty === 'RSA') return jwkRsaToPem(key);
  if (key.kty === 'EC') return jwkEcToPem(key);
  throw ApiError.unauthorized('Unsupported signing key type');
}

/* ── ID token verification ── */

async function verifyGoogleIdToken(idToken) {
  let header;
  try {
    header = jwt.decode(idToken, { complete: true });
  } catch {
    throw ApiError.unauthorized('Invalid Google ID token');
  }
  if (!header || !header.header || !header.header.kid) {
    throw ApiError.unauthorized('Invalid Google ID token');
  }

  const certs = await getGoogleCerts();
  const cert = certs[header.header.kid];
  if (!cert) {
    throw ApiError.unauthorized('Unable to verify Google ID token signature');
  }

  try {
    return jwt.verify(idToken, cert, {
      algorithms: ['RS256'],
      audience: process.env.GOOGLE_CLIENT_ID,
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
    });
  } catch (err) {
    if (err && (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError')) {
      throw ApiError.unauthorized('Google ID token is invalid or expired');
    }
    throw err;
  }
}

async function verifyAppleIdToken(idToken, expectedNonce) {
  let header;
  try {
    header = jwt.decode(idToken, { complete: true });
  } catch {
    throw ApiError.unauthorized('Invalid Apple ID token');
  }
  if (!header || !header.header || !header.header.kid) {
    throw ApiError.unauthorized('Invalid Apple ID token');
  }

  const { keys } = await getAppleKeys();
  const signingKey = keys.find((k) => k.kid === header.header.kid);
  if (!signingKey) {
    throw ApiError.unauthorized('Unable to verify Apple ID token signature');
  }

  const pem = jwkToPem(signingKey);
  const algorithms = signingKey.alg === 'RS256' ? ['RS256'] : ['ES256'];

  let payload;
  try {
    payload = jwt.verify(idToken, pem, {
      algorithms,
      audience: process.env.APPLE_CLIENT_ID,
      issuer: APPLE_AUDIENCE,
    });
  } catch (err) {
    if (err && (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError')) {
      throw ApiError.unauthorized('Apple ID token is invalid or expired');
    }
    throw err;
  }

  if (!expectedNonce || payload.nonce !== expectedNonce) {
    throw ApiError.unauthorized('Apple ID token nonce mismatch');
  }

  return payload;
}

/* ── Provider helpers ── */

function appleClientSecret() {
  const privateKey = getApplePrivateKey();
  return jwt.sign(
    {
      iss: process.env.APPLE_TEAM_ID,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 24 * 60 * 60,
      aud: APPLE_AUDIENCE,
      sub: process.env.APPLE_CLIENT_ID,
    },
    privateKey,
    { algorithm: 'ES256', keyid: process.env.APPLE_KEY_ID }
  );
}

function getApplePrivateKey() {
  const raw = process.env.APPLE_PRIVATE_KEY;
  if (!raw) {
    throw ApiError.internal('APPLE_PRIVATE_KEY is not configured');
  }
  if (raw.includes('-----BEGIN')) {
    return raw.replace(/\\n/g, '\n');
  }
  return Buffer.from(raw, 'base64').toString('utf8');
}

async function exchangeGoogleCode(code) {
  requireConfig('google');
  const { status, data } = await postForm(GOOGLE_TOKEN_URL, {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: getRedirectUri('google'),
    grant_type: 'authorization_code',
  });

  if (status !== 200 || !data || !data.id_token) {
    const message = data && data.error_description ? data.error_description : 'Google sign-in failed';
    throw ApiError.unauthorized(message);
  }

  const payload = await verifyGoogleIdToken(data.id_token);
  if (!payload.email || !payload.sub) {
    throw ApiError.unauthorized('Google account did not provide an email address');
  }

  return {
    provider: 'google',
    providerId: payload.sub,
    email: payload.email,
    name: payload.name || '',
    avatar: payload.picture || '',
  };
}

async function exchangeAppleCode(code, userJson, nonce) {
  requireConfig('apple');
  const { status, data } = await postForm(APPLE_TOKEN_URL, {
    code,
    client_id: process.env.APPLE_CLIENT_ID,
    client_secret: appleClientSecret(),
    grant_type: 'authorization_code',
  });

  if (status !== 200 || !data || !data.id_token) {
    const message = data && data.error ? data.error : 'Apple sign-in failed';
    throw ApiError.unauthorized(message);
  }

  const payload = await verifyAppleIdToken(data.id_token, nonce);
  if (!payload.email || !payload.sub) {
    throw ApiError.unauthorized('Apple account did not provide an email address');
  }

  let name = '';
  if (userJson && typeof userJson === 'string') {
    try {
      const parsed = JSON.parse(userJson);
      if (parsed && parsed.name) {
        name = [parsed.name.firstName, parsed.name.lastName].filter(Boolean).join(' ').trim();
      }
    } catch {
      /* name is optional */
    }
  }
  if (!name) name = payload.name || '';

  return {
    provider: 'apple',
    providerId: payload.sub,
    email: payload.email,
    name,
    avatar: '',
  };
}

module.exports = {
  exchangeGoogleCode,
  exchangeAppleCode,
};
