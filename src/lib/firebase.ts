/**
 * Firebase App Check and Auth Client Initialization
 * Integrates reCAPTCHA Enterprise for Web App Check protection
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

// Default Firebase Configuration (falls back gracefully in preview container)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD-PlaceholderApiKeyForAppCheckValidation",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "salonai-desk.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "salonai-desk",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "salonai-desk.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1029384756",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1029384756:web:abcd1234efgh5678"
};

// Initialize or reuse Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore & Auth
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize App Check (reCAPTCHA Enterprise)
let appCheckInstance: any = null;

if (typeof window !== 'undefined') {
  try {
    const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "6Ld_PlaceholderSiteKeyForReCaptchaEnterprise";
    
    // Enable self-signed debug token in non-production environments
    if (import.meta.env.DEV) {
      (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }

    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true
    });
    console.log("Firebase App Check initialized with reCAPTCHA Enterprise protection.");
  } catch (err) {
    console.warn("App Check initialization notice (running in container dev mode):", err);
  }
}

export const appCheck = appCheckInstance;

// Helper function for user email verification flow
export async function triggerEmailVerification(user: any) {
  if (user && !user.emailVerified) {
    await sendEmailVerification(user);
    return true;
  }
  return false;
}

// Helper function for password reset
export async function triggerPasswordReset(email: string) {
  await sendPasswordResetEmail(auth, email);
  return true;
}
