import { initializeApp, type FirebaseApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, type Auth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore, type Firestore } from 'firebase/firestore';
import appletConfig from '../firebase-applet-config.json';

export interface FirebaseConfigStatus {
  isConfigured: boolean;
  missingKeys: string[];
  configError: string | null;
}

interface EnvLike {
  VITE_FIREBASE_API_KEY?: string;
  VITE_FIREBASE_AUTH_DOMAIN?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_APP_ID?: string;
  VITE_FIREBASE_FIRESTORE_DATABASE_ID?: string;
  VITE_FIREBASE_STORAGE_BUCKET?: string;
  VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
}

const PLACEHOLDER_RE = /^(remixed-project-id|your_|change_me|placeholder)/i;

function pickConfigValue(envVal: string | undefined, fallbackVal: string | undefined): string {
  const fromEnv = typeof envVal === 'string' ? envVal.trim() : '';
  if (fromEnv && !PLACEHOLDER_RE.test(fromEnv)) return fromEnv;
  const fromFile = typeof fallbackVal === 'string' ? fallbackVal.trim() : '';
  if (fromFile && !PLACEHOLDER_RE.test(fromFile)) return fromFile;
  return '';
}

const env = (typeof import.meta !== 'undefined' && import.meta.env
  ? import.meta.env
  : {}) as EnvLike;

const resolvedConfig = {
  apiKey: pickConfigValue(env.VITE_FIREBASE_API_KEY, appletConfig?.apiKey),
  authDomain: pickConfigValue(env.VITE_FIREBASE_AUTH_DOMAIN, appletConfig?.authDomain),
  projectId: pickConfigValue(env.VITE_FIREBASE_PROJECT_ID, appletConfig?.projectId),
  appId: pickConfigValue(env.VITE_FIREBASE_APP_ID, appletConfig?.appId),
  firestoreDatabaseId: pickConfigValue(
    env.VITE_FIREBASE_FIRESTORE_DATABASE_ID,
    appletConfig?.firestoreDatabaseId
  ),
  storageBucket: pickConfigValue(env.VITE_FIREBASE_STORAGE_BUCKET, appletConfig?.storageBucket),
  messagingSenderId: pickConfigValue(
    env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appletConfig?.messagingSenderId
  ),
};

const requiredMap: Array<[string, string]> = [
  ['VITE_FIREBASE_API_KEY', resolvedConfig.apiKey],
  ['VITE_FIREBASE_AUTH_DOMAIN', resolvedConfig.authDomain],
  ['VITE_FIREBASE_PROJECT_ID', resolvedConfig.projectId],
  ['VITE_FIREBASE_APP_ID', resolvedConfig.appId],
];

const missingKeys = requiredMap.filter(([, val]) => !val).map(([key]) => key);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;
let initError: string | null = null;

if (missingKeys.length > 0) {
  initError = `Firebase Authentication is not configured (${missingKeys.join(', ')} missing). Add these VITE_FIREBASE_* variables in Vercel or firebase-applet-config.json.`;
} else {
  try {
    app = initializeApp({
      apiKey: resolvedConfig.apiKey,
      authDomain: resolvedConfig.authDomain,
      projectId: resolvedConfig.projectId,
      appId: resolvedConfig.appId,
      ...(resolvedConfig.storageBucket ? { storageBucket: resolvedConfig.storageBucket } : {}),
      ...(resolvedConfig.messagingSenderId
        ? { messagingSenderId: resolvedConfig.messagingSenderId }
        : {}),
    });
    db = resolvedConfig.firestoreDatabaseId
      ? getFirestore(app, resolvedConfig.firestoreDatabaseId)
      : getFirestore(app);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
  } catch (err) {
    app = null;
    db = null;
    auth = null;
    googleProvider = null;
    initError =
      err instanceof Error
        ? `Firebase initialization failed: ${err.message}`
        : 'Firebase initialization failed. Check your Firebase project configuration.';
  }
}

export const firebaseConfigStatus: FirebaseConfigStatus = {
  isConfigured: Boolean(app && db && auth && googleProvider && !initError),
  missingKeys,
  configError: initError,
};

export { app, auth, db, googleProvider };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
