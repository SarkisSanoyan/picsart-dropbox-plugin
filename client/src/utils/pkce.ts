/**
 * PKCE (Proof Key for Code Exchange) utility functions
 * For OAuth 2.0 Authorization Code flow with PKCE
 */

/**
 * Generate a random code verifier string
 * @param length - Length of the code verifier (43-128 characters)
 * @returns Base64URL-encoded random string
 */
export function generateCodeVerifier(length: number = 64): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let text = '';
  
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  
  return text;
}

/**
 * Generate code challenge from code verifier using SHA256
 * @param codeVerifier - The code verifier string
 * @returns Base64URL-encoded SHA256 hash of the code verifier
 */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  
  // Convert to base64url
  return base64URLEncode(digest);
}

/**
 * Convert ArrayBuffer to Base64URL string
 * @param buffer - ArrayBuffer to convert
 * @returns Base64URL-encoded string
 */
function base64URLEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate a random state parameter for OAuth
 * @returns Random state string
 */
export function generateState(): string {
  return generateCodeVerifier(32);
}

/**
 * Store PKCE parameters in sessionStorage
 * @param codeVerifier - The code verifier
 * @param state - The state parameter
 */
export function storePKCEParams(codeVerifier: string, state: string): void {
  sessionStorage.setItem('pkce_code_verifier', codeVerifier);
  sessionStorage.setItem('pkce_state', state);
}

/**
 * Retrieve PKCE parameters from sessionStorage
 * @returns Object containing code verifier and state, or null if not found
 */
export function retrievePKCEParams(): { codeVerifier: string; state: string } | null {
  const codeVerifier = sessionStorage.getItem('pkce_code_verifier');
  const state = sessionStorage.getItem('pkce_state');
  
  if (!codeVerifier || !state) {
    return null;
  }
  
  return { codeVerifier, state };
}

/**
 * Clear PKCE parameters from sessionStorage
 */
export function clearPKCEParams(): void {
  sessionStorage.removeItem('pkce_code_verifier');
  sessionStorage.removeItem('pkce_state');
}

/**
 * Build OAuth authorization URL with PKCE parameters
 * @param clientId - Dropbox client ID
 * @param redirectUri - Redirect URI
 * @param codeChallenge - Code challenge
 * @param state - State parameter
 * @returns Complete authorization URL
 */
export function buildAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  codeChallenge: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: state,
    token_access_type: 'offline', // Request refresh token
    force_reapprove: 'false'
  });
  
  return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
} 