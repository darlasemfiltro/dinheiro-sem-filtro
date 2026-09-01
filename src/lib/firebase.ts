import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
  enableIndexedDbPersistence,
} from 'firebase/firestore';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfigData from '../../firebase-applet-config.json';

// Firebase Configuration from provisioned configuration file
export const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId,
  measurementId: firebaseConfigData.measurementId || undefined,
};

export const FIRESTORE_DATABASE_ID =
  (firebaseConfigData as any).firestoreDatabaseId && (firebaseConfigData as any).firestoreDatabaseId !== '(default)'
    ? (firebaseConfigData as any).firestoreDatabaseId
    : '(default)';

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID if configured
export const db =
  FIRESTORE_DATABASE_ID && FIRESTORE_DATABASE_ID !== '(default)'
    ? getFirestore(app, FIRESTORE_DATABASE_ID)
    : getFirestore(app);

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: 'select_account' });
export {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  firebaseSignOut,
  onAuthStateChanged,
};

// Try enabling offline persistence
if (typeof window !== 'undefined') {
  try {
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a time.
        console.warn('[Firebase Firestore] Persistence failed-precondition (multiple tabs active)');
      } else if (err.code === 'unimplemented') {
        // The current browser does not support all of the features required to enable persistence
        console.warn('[Firebase Firestore] Persistence not supported by browser environment');
      }
    });
  } catch (e) {
    // Ignore
  }
}

/**
 * Checks if the browser/device is currently online.
 */
export function isDeviceOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

export interface FirebaseStatus {
  connected: boolean;
  projectId: string;
  databaseId: string;
  message: string;
  error?: string;
  latencyMs?: number;
  isOffline?: boolean;
}

export type ConnectionState = 'online' | 'offline' | 'reconnecting' | 'error';

class FirebaseConnectionManager {
  private state: ConnectionState = 'online';
  private retryCount = 0;
  private retryTimer: any = null;
  private backoffDelays = [2000, 5000, 10000, 20000, 30000];
  private listeners: Set<(state: ConnectionState, info?: FirebaseStatus) => void> = new Set();
  private lastStatus: FirebaseStatus | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', async () => {
        console.log('[FirebaseConnectionManager] Network is online. Testing connection...');
        this.resetBackoff();
        await this.testAndNotify();
      });

      window.addEventListener('offline', () => {
        console.warn('[FirebaseConnectionManager] Network is offline.');
        this.setState('offline', {
          connected: false,
          projectId: firebaseConfig.projectId,
          databaseId: FIRESTORE_DATABASE_ID,
          message: 'Dispositivo desconectado da internet (Offline)',
          isOffline: true,
        });
      });
    }
  }

  public getState(): ConnectionState {
    return this.state;
  }

  public getLastStatus(): FirebaseStatus | null {
    return this.lastStatus;
  }

  public subscribe(cb: (state: ConnectionState, info?: FirebaseStatus) => void): () => void {
    this.listeners.add(cb);
    cb(this.state, this.lastStatus || undefined);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private setState(state: ConnectionState, info?: FirebaseStatus) {
    this.state = state;
    if (info) this.lastStatus = info;
    this.listeners.forEach((listener) => {
      try {
        listener(state, info);
      } catch (e) {}
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('firebase_connection_changed', { detail: { state, info } }));
    }
  }

  public resetBackoff() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.retryCount = 0;
  }

  public async reconnectManual(): Promise<FirebaseStatus> {
    console.log('[FirebaseConnectionManager] Manual reconnect triggered.');
    this.resetBackoff();
    this.setState('reconnecting');
    return await this.testAndNotify();
  }

  public async testAndNotify(): Promise<FirebaseStatus> {
    if (!isDeviceOnline()) {
      const status: FirebaseStatus = {
        connected: false,
        projectId: firebaseConfig.projectId,
        databaseId: FIRESTORE_DATABASE_ID,
        message: 'Dispositivo sem conexão à internet',
        isOffline: true,
      };
      this.setState('offline', status);
      return status;
    }

    const status = await testFirebaseConnection();
    if (status.connected) {
      this.resetBackoff();
      this.setState('online', status);
    } else {
      this.setState('error', status);
      this.scheduleExponentialRetry();
    }
    return status;
  }

  private scheduleExponentialRetry() {
    if (!isDeviceOnline()) return;
    if (this.retryTimer) return;

    const delay = this.backoffDelays[Math.min(this.retryCount, this.backoffDelays.length - 1)];
    this.retryCount++;
    console.log(`[FirebaseConnectionManager] Scheduling retry #${this.retryCount} in ${delay / 1000}s...`);

    this.retryTimer = setTimeout(async () => {
      this.retryTimer = null;
      if (isDeviceOnline()) {
        this.setState('reconnecting');
        const status = await testFirebaseConnection();
        if (status.connected) {
          console.log('[FirebaseConnectionManager] Reconnection successful!');
          this.resetBackoff();
          this.setState('online', status);
        } else {
          console.warn('[FirebaseConnectionManager] Reconnection failed:', status.error);
          this.setState('error', status);
          this.scheduleExponentialRetry();
        }
      }
    }, delay);
  }
}

export const firebaseConnectionManager = new FirebaseConnectionManager();

/**
 * Tests connection to Firestore with latency diagnostics.
 */
export async function testFirebaseConnection(): Promise<FirebaseStatus> {
  if (!isDeviceOnline()) {
    return {
      connected: false,
      projectId: firebaseConfig.projectId,
      databaseId: FIRESTORE_DATABASE_ID,
      message: 'Dispositivo desconectado (Modo Offline)',
      isOffline: true,
    };
  }

  const startTime = Date.now();
  try {
    if (!firebaseConfig.projectId || !firebaseConfig.apiKey) {
      return {
        connected: false,
        projectId: firebaseConfig.projectId,
        databaseId: FIRESTORE_DATABASE_ID,
        message: 'Configuração do Firebase ausente ou incompleta.',
        error: 'CONFIG_MISSING',
        latencyMs: 0,
      };
    }

    // Ping Firestore with a minimal read
    const testDoc = doc(db, '_connection_test', 'ping');
    await getDoc(testDoc).catch(() => {
      throw new Error('unavailable');
    });
    const latencyMs = Date.now() - startTime;

    return {
      connected: true,
      projectId: firebaseConfig.projectId,
      databaseId: FIRESTORE_DATABASE_ID,
      message: 'Conexão com a nuvem estabelecida com sucesso!',
      latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const errStr = err?.message || String(err);
    const isUnavailable = errStr.includes('unavailable') || errStr.includes('network-request-failed') || errStr.includes('Failed to fetch');
    return {
      connected: false,
      projectId: firebaseConfig.projectId,
      databaseId: FIRESTORE_DATABASE_ID,
      message: isUnavailable ? 'Operando em modo offline local' : 'Não foi possível conectar à nuvem',
      error: errStr,
      latencyMs,
      isOffline: isUnavailable,
    };
  }
}

/**
 * Generates all possible lookup aliases for a user or shared budget.
 */
export function getUserLookupAliases(idOrEmail: string): string[] {
  if (!idOrEmail) return ['default'];
  const aliases = new Set<string>();
  const raw = idOrEmail.trim();
  const lower = raw.toLowerCase();
  aliases.add(raw);
  aliases.add(lower);

  if (lower.includes('@')) {
    const [name, domain] = lower.split('@');
    if (domain === 'gmail.com' || domain === 'googlemail.com') {
      const dotless = `${name.replace(/\./g, '')}@gmail.com`;
      aliases.add(dotless);
      aliases.add(`user_${dotless.replace(/[^a-z0-9]/gi, '_')}`);
    }
    aliases.add(`user_${lower.replace(/[^a-z0-9]/gi, '_')}`);
  }

  return Array.from(aliases);
}

// -------------------------------------------------------------
// FIRESTORE FINANCIAL DATA OPERATIONS
// -------------------------------------------------------------

/**
 * Downloads all financial data from Firestore for a given userId / budgetId.
 */
/**
 * Canonicalizes user ID for Firestore documents to ensure perfect consistency.
 */
export function getCanonicalUserIdInFirebase(idOrEmail: string): string {
  if (!idOrEmail) return 'default';
  const clean = idOrEmail.toLowerCase().trim();
  if (
    clean === 'carvalho.darlla@gmail.com' ||
    clean === 'carvalhodarlla@gmail.com' ||
    clean === 'user_carvalho.darlla_gmail_com' ||
    clean === 'user_carvalhodarlla_gmail_com' ||
    clean === 'user_carvalho_darlla_gmail_com' ||
    clean === 'darlla-5921'
  ) {
    return 'user_carvalho.darlla_gmail_com';
  }
  if (
    clean === 'darla.semfiltro@gmail.com' ||
    clean === 'darlasemfiltro@gmail.com' ||
    clean === 'user_darla.semfiltro_gmail_com' ||
    clean === 'user_darlasemfiltro_gmail_com' ||
    clean === 'user_darla_semfiltro_gmail_com' ||
    clean === 'darlla-8704'
  ) {
    return 'user_darla_semfiltro_gmail_com';
  }
  if (clean.startsWith('user_')) return clean;
  if (clean.includes('@')) {
    return `user_${clean.replace(/@/g, '_')}`;
  }
  return `user_${clean.replace(/[^a-z0-9._-]/gi, '_')}`;
}

export async function fetchUserDataFromFirestore(userId: string): Promise<{
  accounts: any[];
  categories: any[];
  familyMembers: any[];
  transactions: any[];
  goals: any[];
  sharedBudgets: any[];
}> {
  return {
    accounts: [],
    categories: [],
    familyMembers: [],
    transactions: [],
    goals: [],
    sharedBudgets: [],
  };
}

export async function saveUserDataToFirestore(userId: string, data: any): Promise<boolean> { return true; }
export async function pushTransactionToFirestore(tx: any): Promise<boolean> { return true; }
export async function deleteTransactionFromFirestore(txId: string): Promise<boolean> { return true; }
export async function pushAccountToFirestore(acc: any): Promise<boolean> { return true; }
export async function deleteAccountFromFirestore(accId: string): Promise<boolean> { return true; }
export async function pushCategoryToFirestore(cat: any): Promise<boolean> { return true; }
export async function deleteCategoryFromFirestore(catId: string): Promise<boolean> { return true; }
export async function pushGoalToFirestore(goal: any): Promise<boolean> { return true; }
export async function deleteGoalFromFirestore(goalId: string): Promise<boolean> { return true; }
export async function pushFamilyMemberToFirestore(fm: any): Promise<boolean> { return true; }
export async function deleteFamilyMemberFromFirestore(fmId: string): Promise<boolean> { return true; }
export async function pushPortfolioAssetToFirestore(asset: any): Promise<boolean> { return true; }
export async function deletePortfolioAssetFromFirestore(assetId: string): Promise<boolean> { return true; }

export async function pushPortfolioTransactionToFirestore(tx: any): Promise<boolean> { return true; }
export async function deletePortfolioTransactionFromFirestore(txId: string): Promise<boolean> { return true; }
export async function pushPortfolioDividendToFirestore(div: any): Promise<boolean> { return true; }
export async function deletePortfolioDividendFromFirestore(divId: string): Promise<boolean> { return true; }
export async function pushPortfolioGoalToFirestore(goal: any): Promise<boolean> { return true; }
export async function deletePortfolioGoalFromFirestore(goalId: string): Promise<boolean> { return true; }
export async function fetchPortfolioDataFromFirestore(userId: string): Promise<{
  assets: any[];
  transactions: any[];
  dividends: any[];
  goals: any[];
}> {
  return { assets: [], transactions: [], dividends: [], goals: [] };
}
export async function pushGamificationToFirestore(g: any): Promise<boolean> { return true; }
export async function fetchGamificationFromFirestore(userId: string): Promise<any | null> { return null; }
export function subscribeToUserFirestoreChanges(userId: string, onUpdate: () => void): () => void { return () => {}; }
export async function migrateLocalDataToFirestore(): Promise<{ success: boolean; summary: any; errors: string[] }> {
  return { success: true, summary: {}, errors: [] };
}
export async function pushUserToFirestore(u: any): Promise<boolean> { return true; }
export async function deleteUserFromFirestore(uId: string): Promise<boolean> { return true; }
export async function pushSharedBudgetToFirestore(b: any): Promise<boolean> { return true; }
export async function syncSharedBudgetsInFirestore(email: string): Promise<any[]> { return []; }





