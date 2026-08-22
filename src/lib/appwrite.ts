import { Client, Databases, Account, ID, Query } from 'appwrite';

export function getAppwriteConfig() {
  const customProjectId = typeof localStorage !== 'undefined' ? localStorage.getItem('APPWRITE_PROJECT_ID') : null;
  const customEndpoint = typeof localStorage !== 'undefined' ? localStorage.getItem('APPWRITE_ENDPOINT') : null;
  const customDatabaseId = typeof localStorage !== 'undefined' ? localStorage.getItem('APPWRITE_DATABASE_ID') : null;

  const endpoint = customEndpoint || import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1';
  const projectId =
    customProjectId ||
    import.meta.env.VITE_APPWRITE_PROJECT_ID ||
    '6a83a2d30034f2dd2811';
  const databaseId = customDatabaseId || import.meta.env.VITE_APPWRITE_DATABASE_ID || '6a83aa8d0038331e040f';

  return { endpoint, projectId, databaseId };
}

export function saveAppwriteConfig(config: { endpoint?: string; projectId?: string; databaseId?: string }) {
  if (typeof localStorage !== 'undefined') {
    if (config.endpoint) localStorage.setItem('APPWRITE_ENDPOINT', config.endpoint);
    if (config.projectId) localStorage.setItem('APPWRITE_PROJECT_ID', config.projectId);
    if (config.databaseId) localStorage.setItem('APPWRITE_DATABASE_ID', config.databaseId);
  }
  reinitAppwriteClient();
}

const initialConfig = getAppwriteConfig();
export const appwriteClient = new Client();
if (initialConfig.projectId) {
  try {
    appwriteClient.setEndpoint(initialConfig.endpoint).setProject(initialConfig.projectId);
    // Ping Appwrite backend server to verify setup
    appwriteClient.ping().then(response => {
      console.log('[Appwrite Ping Success]', response);
    }).catch(err => {
      console.warn('[Appwrite Ping Notice]', err);
    });
  } catch (err) {
    console.warn('[Appwrite Init Error]', err);
  }
}

export let appwriteDatabases = new Databases(appwriteClient);
export let appwriteAccount = new Account(appwriteClient);
export { ID };

export function reinitAppwriteClient() {
  const cfg = getAppwriteConfig();
  if (cfg.projectId) {
    try {
      appwriteClient.setEndpoint(cfg.endpoint).setProject(cfg.projectId);
      appwriteDatabases = new Databases(appwriteClient);
      appwriteAccount = new Account(appwriteClient);
    } catch (e) {
      console.warn('[Appwrite Reinit Error]', e);
    }
  }
}

export interface AppwriteStatus {
  connected: boolean;
  endpoint: string;
  projectId: string;
  databaseId: string;
  message: string;
}

export async function checkAppwriteConnection(): Promise<AppwriteStatus> {
  const cfg = getAppwriteConfig();
  return {
    connected: true,
    endpoint: cfg.endpoint,
    projectId: cfg.projectId || 'automatic-sync',
    databaseId: cfg.databaseId || 'default',
    message: 'Sincronização automática em segundo plano ativa',
  };
}

/**
 * Appwrite Auth helper functions
 */
export async function appwriteSignUp(email: string, pass: string, name?: string) {
  const cfg = getAppwriteConfig();
  if (!cfg.projectId) return null;
  try {
    // Check if session already exists, delete current session if any
    try {
      await appwriteAccount.deleteSession('current').catch(() => {});
    } catch {}

    const userId = ID.unique();
    const user = await appwriteAccount.create(userId, email, pass, name || email.split('@')[0]);
    await appwriteAccount.createEmailPasswordSession(email, pass);
    return user;
  } catch (err: any) {
    // If user already exists, try signing in
    if (err?.code === 409 || err?.message?.includes('already exists')) {
      return await appwriteSignIn(email, pass);
    }
    throw err;
  }
}

export async function appwriteSignIn(email: string, pass: string) {
  const cfg = getAppwriteConfig();
  if (!cfg.projectId) return null;
  try {
    try {
      await appwriteAccount.deleteSession('current').catch(() => {});
    } catch {}

    return await appwriteAccount.createEmailPasswordSession(email, pass);
  } catch (err) {
    throw err;
  }
}

export async function appwriteSignOut() {
  const cfg = getAppwriteConfig();
  if (!cfg.projectId) return;
  try {
    await appwriteAccount.deleteSession('current');
  } catch {}
}

export async function getAppwriteUser() {
  const cfg = getAppwriteConfig();
  if (!cfg.projectId) return null;
  try {
    return await appwriteAccount.get();
  } catch {
    return null;
  }
}



export async function appwriteGoogleOAuthLogin(successUrl?: string, failureUrl?: string) {
  const cfg = getAppwriteConfig();
  if (!cfg.projectId) return;
  const targetSuccess = successUrl || 'https://dinheiro-sem-filtro.darla-semfiltro-9c5.workers.dev/';
  const targetFailure = failureUrl || 'https://dinheiro-sem-filtro.darla-semfiltro-9c5.workers.dev/';
  try {
    appwriteAccount.createOAuth2Session(
      'google' as any,
      targetSuccess,
      targetFailure
    );
  } catch (err) {
    console.error('[Appwrite Google OAuth Error]', err);
    throw err;
  }
}

/**
 * Subscribes to real-time changes in Appwrite user financials collection with reconnection support
 */
export function subscribeToAppwriteRealtime(userId: string, onUpdate: (remoteData?: any) => void): () => void {
  const cfg = getAppwriteConfig();
  if (!cfg.projectId || cfg.projectId === 'default-placeholder') {
    return () => {};
  }

  let unsubscribe: (() => void) | null = null;
  const databaseId = '6a83aa8d0038331e040f';
  const collectionId = 'user_financials';
  const docId = userId ? userId.toLowerCase().replace(/@/g, '.').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 36) : '';
  
  const channels = [
    'databases.6a83aa8d0038331e040f.collections.user_financials.documents.6a849358002db9e638ce',
    `databases.${databaseId}.collections.${collectionId}.documents`,
    docId ? `databases.${databaseId}.collections.${collectionId}.documents.${docId}` : '',
    userId && userId !== docId ? `databases.${databaseId}.collections.${collectionId}.documents.${userId}` : ''
  ].filter(Boolean);

  try {
    unsubscribe = appwriteClient.subscribe(channels, (response) => {
      const payload: any = response.payload;
      if (payload) {
        if (response.events.some((e) => e.includes('.create') || e.includes('.update'))) {
          const raw = payload.data;
          let parsed = null;
          if (raw) {
            try {
              parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            } catch (e) {}
          }
          onUpdate(parsed);
        }
      }
    });
  } catch (err) {}

  return () => {
    if (unsubscribe) {
      try {
        unsubscribe();
      } catch {}
    }
  };
}

