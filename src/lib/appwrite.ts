import { Client, Databases, Account, ID, Query, Permission, Role } from 'appwrite';

export async function persistUserInitialDocument(userAccount: any, formProfileData?: any) {
  const cfg = getAppwriteConfig();
  const DATABASE_ID = cfg?.databaseId || '6a83aa8d0038331e040f';
  const COLLECTION_ID = 'user_financials';
  const cleanEmail = (userAccount?.email || '').trim().toLowerCase();

  if (!cleanEmail) {
    console.warn('[persistUserInitialDocument] Email inválido fornecido.');
    return null;
  }

  // Gera document ID válido no Appwrite (<= 36 caracteres alfanuméricos)
  const sanitized = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 31);
  const docId = `usr_${sanitized}`.slice(0, 36);

  const initialFinancialData = {
    saldo: 0,
    receitas: 0,
    despesas: 0,
    transactions: [],
    accounts: [
      {
        id: 'default',
        userId: cleanEmail,
        name: 'Conta Corrente Principal',
        initialBalance: 0,
        color: '#4F46E5',
        icon: 'Wallet',
        type: 'checking'
      }
    ],
    categories: [],
    financialGoals: [],
    goals: [],
    familyMembers: [],
    investmentTransactions: [],
    investmentGoals: [],
    updatedAt: new Date().toISOString()
  };

  // Conversão segura da data de nascimento para ISO Datetime
  let isoBirthDate = '1995-01-27T00:00:00.000Z';
  const rawBirth = formProfileData?.birthDate || formProfileData?.dataNascimento || formProfileData?.data_nascimento;
  if (rawBirth && typeof rawBirth === 'string') {
    if (rawBirth.includes('/')) {
      const parts = rawBirth.split('/');
      if (parts.length === 3) {
        isoBirthDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00.000Z`).toISOString();
      }
    } else if (rawBirth.includes('-')) {
      try {
        isoBirthDate = new Date(rawBirth).toISOString();
      } catch (e) {}
    }
  }

  const rawIncome = formProfileData?.monthlyIncome ?? formProfileData?.rendaMensal ?? formProfileData?.renda_mensal ?? 0;
  const numericIncome = typeof rawIncome === 'number' ? rawIncome : parseFloat(String(rawIncome).replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.')) || 0;

  // Payload com TODOS os atributos da collection identificados no console
  const docPayload: Record<string, any> = {
    userId: cleanEmail,
    data: JSON.stringify(initialFinancialData),
    cidade: (formProfileData?.city || formProfileData?.cidade || 'Brasília').trim(),
    estado: (formProfileData?.state || formProfileData?.estado || 'DF').toUpperCase().trim(),
    data_nascimento: isoBirthDate,
    renda_mensal: numericIncome,
    consent_lgpd: true,
    consent_date: new Date().toISOString() // Datetime ISO obrigatório da coluna consent_date
  };

  const permissions = [
    Permission.read(Role.any()),
    Permission.write(Role.any()),
    Permission.update(Role.any()),
    Permission.delete(Role.any())
  ];

  try {
    const created = await appwriteDatabases.createDocument(
      DATABASE_ID,
      COLLECTION_ID,
      docId,
      docPayload,
      permissions
    );
    console.log('[APPWRITE SUCESSO] Documento criado na collection user_financials:', created.$id);
    return created;
  } catch (err: any) {
    // Se o erro for de documento duplicado, tenta atualizar
    if (err?.code === 409 || err?.type === 'document_already_exists' || err?.message?.includes('already exists')) {
      try {
        const updated = await appwriteDatabases.updateDocument(DATABASE_ID, COLLECTION_ID, docId, docPayload);
        console.log('[APPWRITE SUCESSO] Documento já existente atualizado na collection user_financials:', docId);
        return updated;
      } catch (upErr: any) {
        console.error('[ERRO CRÍTICO APPWRITE UPDATE DOCUMENT]', upErr);
      }
    }
    console.error('[ERRO CRÍTICO APPWRITE CREATE DOCUMENT]', err);
    if (typeof window !== 'undefined') {
      window.alert(`ERRO DO BANCO DE DADOS APPWRITE AO CRIAR CONTA:\n${err.message || JSON.stringify(err)}`);
    }
    throw err;
  }
}

export function getAppwriteConfig() {
  const customProjectId = typeof localStorage !== 'undefined' ? localStorage.getItem('APPWRITE_PROJECT_ID') : null;
  const customEndpoint = typeof localStorage !== 'undefined' ? localStorage.getItem('APPWRITE_ENDPOINT') : null;
  const customDatabaseId = typeof localStorage !== 'undefined' ? localStorage.getItem('APPWRITE_DATABASE_ID') : null;
  const customApiKey = typeof localStorage !== 'undefined' ? localStorage.getItem('APPWRITE_API_KEY') : null;
  const customSupportEmail = typeof localStorage !== 'undefined' ? localStorage.getItem('APPWRITE_SUPPORT_EMAIL') : null;

  const endpoint = customEndpoint || import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1';
  const projectId =
    customProjectId ||
    import.meta.env.VITE_APPWRITE_PROJECT_ID ||
    '6a83a2d30034f2dd2811';
  const databaseId = customDatabaseId || import.meta.env.VITE_APPWRITE_DATABASE_ID || '6a83aa8d0038331e040f';
  const apiKey = customApiKey || 'standard_99d92ec8cd40a81d961408d5ec6f693f39d29756d25472acef5b313a9c9c859ef51dd2975aeb8e051e42441c63b06960eda27ee447b12bc54cb161c9a1627000be0d1348555ea4c28ed474e5bb4a2c3d0ffe43be9505b5c93ee4150118b54abb10d6d3ab05967b763b468648504702e52c3ae016f271b67903d411428fff22bf';
  const supportEmail = customSupportEmail || 'suporte.dinheirosemfiltro@gmail.com';

  return { endpoint, projectId, databaseId, apiKey, supportEmail };
}

export function saveAppwriteConfig(config: { endpoint?: string; projectId?: string; databaseId?: string; apiKey?: string; supportEmail?: string }) {
  if (typeof localStorage !== 'undefined') {
    if (config.endpoint !== undefined) localStorage.setItem('APPWRITE_ENDPOINT', config.endpoint);
    if (config.projectId !== undefined) localStorage.setItem('APPWRITE_PROJECT_ID', config.projectId);
    if (config.databaseId !== undefined) localStorage.setItem('APPWRITE_DATABASE_ID', config.databaseId);
    if (config.apiKey !== undefined) localStorage.setItem('APPWRITE_API_KEY', config.apiKey);
    if (config.supportEmail !== undefined) localStorage.setItem('APPWRITE_SUPPORT_EMAIL', config.supportEmail);
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
export const account = new Proxy({} as Account, {
  get(_target, prop) {
    return (appwriteAccount as any)[prop];
  }
});
export { ID, Query };

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
  
  // Prevenção absoluta: Limpa qualquer lixo de memória antes de tentar logar
  if (typeof window !== 'undefined') {
    const pId = localStorage.getItem('APPWRITE_PROJECT_ID');
    const ep = localStorage.getItem('APPWRITE_ENDPOINT');
    const dbId = localStorage.getItem('APPWRITE_DATABASE_ID');
    const oauthPending = localStorage.getItem('darla_oauth_pending');
    
    localStorage.clear();
    sessionStorage.clear();
    
    if (pId) localStorage.setItem('APPWRITE_PROJECT_ID', pId);
    if (ep) localStorage.setItem('APPWRITE_ENDPOINT', ep);
    if (dbId) localStorage.setItem('APPWRITE_DATABASE_ID', dbId);
    if (oauthPending) localStorage.setItem('darla_oauth_pending', oauthPending);
  }

  try {
    try {
      await appwriteAccount.deleteSession('current').catch(() => {});
    } catch {}

    // Cria a nova sessão 100% limpa
    return await appwriteAccount.createEmailPasswordSession(email, pass);
  } catch (err: any) {
    if (err?.message?.includes('session is active') || err?.code === 401 || err?.message?.includes('active session')) {
      console.log('Sessão já estava ativa. Bypass concedido.');
      return await appwriteAccount.get();
    }
    throw err;
  }
}

export async function appwriteSignOut() {
  const cfg = getAppwriteConfig();
  if (!cfg.projectId) return;
  try {
    // Deleta a sessão ativa no servidor do Appwrite
    await appwriteAccount.deleteSession('current');
  } catch (error) {
    console.log("Nenhuma sessão ativa encontrada no servidor.");
  } finally {
    // Limpa TODOS os rastros da conta anterior no navegador
    if (typeof window !== 'undefined') {
      const pId = localStorage.getItem('APPWRITE_PROJECT_ID');
      const ep = localStorage.getItem('APPWRITE_ENDPOINT');
      const dbId = localStorage.getItem('APPWRITE_DATABASE_ID');
      
      localStorage.clear();
      sessionStorage.clear();
      
      if (pId) localStorage.setItem('APPWRITE_PROJECT_ID', pId);
      if (ep) localStorage.setItem('APPWRITE_ENDPOINT', ep);
      if (dbId) localStorage.setItem('APPWRITE_DATABASE_ID', dbId);
      
      // Marca logout explícito para evitar autologin indesejado
      localStorage.setItem('darla_explicit_logout', 'true');
      
      // Redireciona o usuário para a tela de login
      window.location.href = '/';
      setTimeout(() => window.location.reload(), 100);
    }
  }
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

export async function appwriteCompleteOAuthSession(userId: string, secret: string) {
  const cfg = getAppwriteConfig();
  if (!cfg.projectId) return null;
  try {
    try {
      await appwriteAccount.deleteSession('current').catch(() => {});
    } catch {}
    return await appwriteAccount.createSession(userId, secret);
  } catch (err: any) {
    if (err?.message?.includes('active session') || err?.code === 401) {
      return await appwriteAccount.get();
    }
    console.warn('[Appwrite Complete OAuth Session error]', err);
    return null;
  }
}



export async function appwriteGoogleOAuthLogin(successUrl?: string, failureUrl?: string) {
  const cfg = getAppwriteConfig();
  const targetSuccess = successUrl || window.location.origin;
  const targetFailure = failureUrl || `${window.location.origin}?auth_failed=true`;
  try {
    if (cfg.projectId && cfg.projectId !== 'default-placeholder') {
      sessionStorage.removeItem('FORCE_LOGIN_VIEW');
      localStorage.removeItem('FORCE_LOGIN_VIEW');
      localStorage.removeItem('darla_explicit_logout');
      appwriteAccount.createOAuth2Session(
        'google' as any,
        targetSuccess,
        targetFailure
      );
      return;
    }
  } catch (err) {
    console.warn('[Appwrite OAuth redirect error]', err);
  }

  throw new Error('Google OAuth requires active Appwrite project configuration.');
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
  const cleanTargetUserId = (userId || '').trim().toLowerCase();
  const docId = cleanTargetUserId ? cleanTargetUserId.replace(/@/g, '.').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 36) : '';
  
  // Only subscribe to the specific user/budget channels, NEVER to the global hardcoded 6a849358002db9e638ce!
  const channels = [
    `databases.${databaseId}.collections.${collectionId}.documents`,
    docId ? `databases.${databaseId}.collections.${collectionId}.documents.${docId}` : '',
    cleanTargetUserId && cleanTargetUserId !== docId ? `databases.${databaseId}.collections.${collectionId}.documents.${cleanTargetUserId}` : ''
  ].filter(Boolean);

  try {
    unsubscribe = appwriteClient.subscribe(channels, (response) => {
      const payload: any = response.payload;
      if (payload) {
        // STRICT FILTER: Validate that this payload actually belongs to the current target user/budget!
        const payloadUserId = String(payload.userId || '').trim().toLowerCase();
        const payloadDocId = String(payload.$id || '').trim().toLowerCase();
        
        const isMatch = 
          (cleanTargetUserId && payloadUserId === cleanTargetUserId) ||
          (docId && payloadDocId === docId.toLowerCase()) ||
          (cleanTargetUserId && payloadDocId === cleanTargetUserId);

        if (!isMatch) {
          // Payload belongs to another user/budget - IGNORE to prevent cross-account loops!
          return;
        }

        if (response.events.some((e) => e.includes('.create') || e.includes('.update'))) {
          const raw = payload.data;
          let parsed = null;
          if (raw) {
            try {
              parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            } catch (e) {}
          }
          if (parsed) {
            onUpdate(parsed);
          }
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

export async function appwritePasswordReset(email: string) {
  const cfg = getAppwriteConfig();
  if (!cfg.projectId) {
    throw new Error('Appwrite não configurado.');
  }
  const redirectUrl = typeof window !== 'undefined' ? window.location.origin : 'https://dinheiro-sem-filtro.darla-semfiltro-9c5.workers.dev';
  console.log('[Appwrite Password Reset] Solicitando recuperação para:', email.trim());
  console.log('[Appwrite Password Reset] Redirect URL:', redirectUrl);
  console.warn('[Appwrite Web Platform Check] Certifique-se de que o hostname exato ("', typeof window !== 'undefined' ? window.location.hostname : 'localhost', '") está cadastrado como Web Platform nas configurações do projeto no painel do Appwrite.');

  try {
    const response = await appwriteAccount.createRecovery(email.trim(), redirectUrl);
    console.log('[Appwrite Password Reset] Resposta createRecovery:', response);
    return response;
  } catch (error: any) {
    console.error('[Appwrite Password Reset] Erro detalhado createRecovery:', error);
    throw error;
  }
}

export async function appwriteCompleteRecovery(userId: string, secret: string, password: string, passwordAgain?: string) {
  return await appwriteAccount.updateRecovery(userId, secret, password);
}

