import axios from 'axios';
import jwt, { JwtHeader } from 'jsonwebtoken';
import { config } from '../config/env';

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  id_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

interface GoogleIdTokenPayload {
  iss: string;
  azp?: string;
  aud: string;
  sub: string; // Google user ID
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  iat: number;
  exp: number;
}

const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

export function buildGoogleAuthUrl(state: string): string {
  if (!config.google.enabled) {
    throw new Error('Google OAuth is disabled');
  }
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  });
  return `${GOOGLE_AUTH_BASE}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  if (!config.google.enabled) {
    throw new Error('Google OAuth is disabled');
  }
  const body = new URLSearchParams({
    code,
    client_id: config.google.clientId,
    redirect_uri: config.google.redirectUri,
    grant_type: 'authorization_code',
  });
  // Include client_secret only when provided (web apps). Android/iOS tokens don't require it.
  if (config.google.clientSecret) {
    body.set('client_secret', config.google.clientSecret);
  }
  const { data } = await axios.post<GoogleTokenResponse>(GOOGLE_TOKEN_URL, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });
  return data;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdTokenPayload> {
  if (!config.google.enabled) {
    throw new Error('Google OAuth is disabled');
  }
  const decoded = jwt.decode(idToken, { complete: true }) as { header: JwtHeader } | null;
  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new Error('Invalid id_token header');
  }

  const { data } = await axios.get<{ keys: Array<{ kid: string; alg: string; x5c: string[] }> }>(GOOGLE_JWKS_URL, { timeout: 10000 });
  const matchingKey = data.keys.find(k => k.kid === decoded.header.kid);
  if (!matchingKey || !matchingKey.x5c || matchingKey.x5c.length === 0) {
    throw new Error('Unable to find matching Google public key');
  }

  const cert = matchingKey.x5c[0];
  const pem = `-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----`;

  const payload = jwt.verify(idToken, pem, {
    algorithms: ['RS256'],
    audience: config.google.clientId,
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
  }) as GoogleIdTokenPayload;

  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < nowInSeconds) {
    throw new Error('id_token has expired');
  }

  if (payload.aud !== config.google.clientId) {
    throw new Error('id_token audience mismatch');
  }

  if (!['https://accounts.google.com', 'accounts.google.com'].includes(payload.iss)) {
    throw new Error('id_token issuer invalid');
  }

  return payload;
}

export function createState(payload?: { redirect?: string | null }): string {
  // Sign a short-lived state token to protect against CSRF without server storage
  return jwt.sign({ purpose: 'oauth_state', redirect: payload?.redirect || null }, config.jwt.secret, { expiresIn: '5m' });
}

export function verifyState(state: string): { valid: true; redirect: string | null } | { valid: false } {
  try {
    const decoded = jwt.verify(state, config.jwt.secret) as any;
    if (!decoded || decoded.purpose !== 'oauth_state') return { valid: false };
    return { valid: true, redirect: decoded.redirect ?? null };
  } catch {
    return { valid: false };
  }
}

export type { GoogleTokenResponse, GoogleIdTokenPayload };


