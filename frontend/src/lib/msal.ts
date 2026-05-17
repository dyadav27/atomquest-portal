import { PublicClientApplication, type AuthenticationResult } from '@azure/msal-browser';

const MSAL_CLIENT_ID = import.meta.env.VITE_MSAL_CLIENT_ID || '';
const MSAL_TENANT_ID = import.meta.env.VITE_MSAL_TENANT_ID || 'common';
const MSAL_REDIRECT_URI = import.meta.env.VITE_MSAL_REDIRECT_URI || window.location.origin;

export const msalConfig = {
  auth: {
    clientId: MSAL_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${MSAL_TENANT_ID}`,
    redirectUri: MSAL_REDIRECT_URI,
  },
  cache: {
    cacheLocation: 'sessionStorage' as const,
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
};

let _msalInstance: PublicClientApplication | null = null;

async function getMsalInstance(): Promise<PublicClientApplication> {
  if (!_msalInstance) {
    _msalInstance = new PublicClientApplication(msalConfig);
    await _msalInstance.initialize();
  }
  return _msalInstance;
}

/**
 * Opens the Microsoft login popup and returns the authentication result.
 */
export async function signInWithMicrosoft(): Promise<AuthenticationResult> {
  if (!MSAL_CLIENT_ID) {
    throw new Error(
      'Azure AD is not configured. Please set VITE_MSAL_CLIENT_ID and VITE_MSAL_TENANT_ID in your .env file.'
    );
  }

  const instance = await getMsalInstance();
  const result = await instance.loginPopup(loginRequest);
  return result;
}

/**
 * Signs out the current Microsoft account from the browser session.
 */
export async function signOutFromMicrosoft(): Promise<void> {
  if (!_msalInstance) return;

  try {
    const accounts = _msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      await _msalInstance.logoutPopup({ account: accounts[0] });
    }
  } catch (err) {
    console.warn('[MSAL] Logout failed (non-critical):', err);
  }
}

/**
 * Returns true if the MSAL client ID is configured in env.
 * Used to conditionally render the Microsoft login button.
 */
export function isMsalConfigured(): boolean {
  return Boolean(MSAL_CLIENT_ID);
}
