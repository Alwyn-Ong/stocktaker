import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';

const IOS_CLIENT_ID = Constants.expoConfig?.extra?.googleIosClientId || undefined;

const SCOPES = [
  'email',
  'profile',
  'https://www.googleapis.com/auth/spreadsheets',
  // Full Drive scope (not drive.file): the report folder is created by hand in
  // Drive, and drive.file can only touch files/folders the app itself created.
  'https://www.googleapis.com/auth/drive',
];

GoogleSignin.configure({
  scopes: SCOPES,
  iosClientId: IOS_CLIENT_ID,
});

export async function signIn(): Promise<void> {
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) {
    throw new Error('Google sign-in was cancelled.');
  }
}

export async function signOut(): Promise<void> {
  await GoogleSignin.signOut();
}

export function isSignedIn(): boolean {
  return GoogleSignin.hasPreviousSignIn();
}

export async function getDisplayName(): Promise<string | null> {
  try {
    const response = await GoogleSignin.signInSilently();
    if (response.type !== 'success') return null;
    return response.data.user.name ?? response.data.user.email ?? null;
  } catch {
    return null;
  }
}

export async function getValidAccessToken(): Promise<string> {
  if (!GoogleSignin.hasPreviousSignIn()) {
    throw new Error('Not signed in to Google.');
  }
  const { accessToken } = await GoogleSignin.getTokens();
  return accessToken;
}
