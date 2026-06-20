import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

const ACCESS_TOKEN_KEY = 'stocktaker_google_access_token';
const REFRESH_TOKEN_KEY = 'stocktaker_google_refresh_token';
const EXPIRES_AT_KEY = 'stocktaker_google_expires_at';

const ANDROID_CLIENT_ID = Constants.expoConfig?.extra?.googleAndroidClientId ?? '';
const IOS_CLIENT_ID = Constants.expoConfig?.extra?.googleIosClientId ?? '';

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://www.googleapis.com/oauth2/v4/token',
  revocationEndpoint: 'https://oauth.google.com/revoke',
};

const SCOPES = ['https://www.googleapis.com/auth/drive'];

function getClientId(): string {
  const clientId = Platform.OS === 'ios' ? IOS_CLIENT_ID : ANDROID_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      'Google OAuth client ID is not configured. Set googleAndroidClientId/googleIosClientId in app.json under expo.extra.'
    );
  }
  return clientId;
}

async function storeTokens(accessToken: string, refreshToken: string | undefined, expiresIn: number | undefined) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  }
  const expiresAt = Date.now() + (expiresIn ?? 3600) * 1000;
  await SecureStore.setItemAsync(EXPIRES_AT_KEY, String(expiresAt));
}

export async function signIn(): Promise<void> {
  const clientId = getClientId();
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'stocktaker' });

  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: SCOPES,
    redirectUri,
    usePKCE: true,
    responseType: AuthSession.ResponseType.Code,
  });

  const result = await request.promptAsync(discovery);
  if (result.type !== 'success' || !result.params.code) {
    throw new Error('Google sign-in was cancelled or failed.');
  }

  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code: result.params.code,
      redirectUri,
      extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
    },
    discovery
  );

  await storeTokens(tokenResult.accessToken, tokenResult.refreshToken, tokenResult.expiresIn);
}

export async function signOut(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(EXPIRES_AT_KEY);
}

export async function isSignedIn(): Promise<boolean> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  return !!refreshToken;
}

export async function getValidAccessToken(): Promise<string> {
  const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  const expiresAt = Number(await SecureStore.getItemAsync(EXPIRES_AT_KEY) ?? 0);

  if (accessToken && Date.now() < expiresAt - 60_000) {
    return accessToken;
  }

  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    throw new Error('Not signed in to Google.');
  }

  const clientId = getClientId();
  const tokenResult = await AuthSession.refreshAsync(
    { clientId, refreshToken },
    discovery
  );

  await storeTokens(tokenResult.accessToken, tokenResult.refreshToken ?? refreshToken, tokenResult.expiresIn);
  return tokenResult.accessToken;
}
