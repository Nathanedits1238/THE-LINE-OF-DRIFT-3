import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Ensure singleton Firebase App
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth: Auth = getAuth(app);

// Configure Google Provider with requested Workspace scopes
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');
provider.setCustomParameters({
  prompt: 'select_account',
});

// In-memory token cache (Do NOT store in localStorage or sessionStorage per security guidelines)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export interface AuthUserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export type AuthStateCallback = (user: User | null, token: string | null) => void;
const listeners: Set<AuthStateCallback> = new Set();

/**
 * Initializes authentication state observer and notifies subscribers.
 */
export const initAuth = (callback?: AuthStateCallback): (() => void) => {
  if (callback) {
    listeners.add(callback);
    // Immediately emit current state if available
    callback(auth.currentUser, cachedAccessToken);
  }

  const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
    if (!user) {
      cachedAccessToken = null;
    }
    listeners.forEach((cb) => {
      try {
        cb(user, cachedAccessToken);
      } catch (err) {
        console.warn('Auth callback error:', err);
      }
    });
  });

  return () => {
    if (callback) listeners.delete(callback);
    unsubscribe();
  };
};

/**
 * 1-Click Sign In with Google
 * Requests Drive and Sheets scopes and caches the bearer token in-memory.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  if (isSigningIn) {
    throw new Error('Login já em andamento...');
  }

  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Não foi possível obter o token de acesso do Google.');
    }

    cachedAccessToken = credential.accessToken;

    // Notify listeners with new user and token
    listeners.forEach((cb) => cb(result.user, cachedAccessToken));

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: unknown) {
    console.error('Google Sign-In failed:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Retrieves the active in-memory cached bearer token.
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Signs out the current user and clears cached credentials.
 */
export const googleSignOut = async (): Promise<void> => {
  try {
    await signOut(auth);
    cachedAccessToken = null;
    listeners.forEach((cb) => cb(null, null));
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

/**
 * Helper to get user profile details for game save and display.
 */
export const getCurrentUserProfile = (): AuthUserProfile | null => {
  const user = auth.currentUser;
  if (!user) return null;
  return {
    uid: user.uid,
    displayName: user.displayName || 'Piloto Google',
    email: user.email,
    photoURL: user.photoURL,
  };
};
