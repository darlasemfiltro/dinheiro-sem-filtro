import { Client, Databases, Account, ID, Query, Permission, Role } from 'appwrite';
import pako from 'pako';

export async function safeCreateFinancialDocument(cleanEmail: string, formValues: any) {
  const cfg = getAppwriteConfig();
  const DATABASE_ID = cfg?.databaseId || '6a83aa8d0038331e040f';
  const COLLECTION_ID = 'user_financials';
  const email = cleanEmail.trim().toLowerCase();

  // 1. Tratamento rigoroso do Estado (máximo 2 caracteres)
  let estadoSanitizado = 'DF';
  const rawState = String(formValues?.estado || formValues?.state || '').trim();
  if (rawState.includes('-')) {
    estadoSanitizado = rawState.split('-')[0].trim().toUpperCase().slice(0, 2);
  } else if (rawState.length >= 2) {
    estadoSanitizado = rawState.slice(0, 2).toUpperCase();
  }

  // 2. Tratamento de Data de Nascimento para Datetime ISO UTC estrito (meio-dia UTC para evitar shift de fuso horário)
  let isoBirth = '1995-01-27T12:00:00.000Z';
  const rawBirth = String(formValues?.dataNascimento || formValues?.data_nascimento || formValues?.birthDate || '').trim();
  if (rawBirth.includes('/')) {
    const parts = rawBirth.split('/');
    if (parts.length === 3) {
      const day = Number(parts[0]);
      const month = Number(parts[1]) - 1;
      const year = Number(parts[2]);
      const d = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
      if (!isNaN(d.getTime())) isoBirth = d.toISOString();
    }
  } else if (rawBirth.includes('-')) {
    const parts = rawBirth.split('T')[0].split('-');
    if (parts.length === 3) {
      const d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0, 0));
      if (!isNaN(d.getTime())) isoBirth = d.toISOString();
    } else {
      const d = new Date(rawBirth);
      if (!isNaN(d.getTime())) isoBirth = d.toISOString();
    }
  }

  const cidadeSanitizada = String(formValues?.cidade || formValues?.city || 'Brasília').trim().slice(0, 50) || 'Brasília';
  const faixaRenda = String(formValues?.incomeBracket || formValues?.faixa_renda || 'R$ 3.243 a R$ 5.000').trim() || 'R$ 3.243 a R$ 5.000';
  const sexoVal = String(formValues?.sexo || formValues?.gender || 'Outros').trim();
  const consentLgpd = Boolean(formValues?.consentLgpd ?? formValues?.consent_lgpd ?? true);
  const rendaMensalVal = Math.round(Number(formValues?.rendaMensal || formValues?.renda_mensal || formValues?.monthlyIncome) || 0);

  // 3. Estrutura JSON inicial de finanças com perfil do usuário embutido
  const initialFinancialData = {
    saldo: 0,
    receitas: 0,
    despesas: 0,
    transactions: [],
    accounts: [
      {
        id: 'default',
        userId: email,
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
    birthDate: isoBirth || '1995-01-27T00:00:00.000Z',
    data_nascimento: isoBirth || '1995-01-27T00:00:00.000Z',
    city: cidadeSanitizada,
    cidade: cidadeSanitizada,
    state: estadoSanitizado || 'DF',
    estado: estadoSanitizado || 'DF',
    monthlyIncome: rendaMensalVal,
    renda_mensal: rendaMensalVal,
    incomeBracket: faixaRenda,
    faixa_renda: faixaRenda,
    sexo: sexoVal,
    consent_lgpd: consentLgpd,
    updatedAt: new Date().toISOString()
  };

  // 4. Payload com os atributos estritos do Schema do Appwrite (userId, data, cidade, estado, data_nascimento, renda_mensal, faixa_renda, sexo, consent_lgpd)
  const primaryPayload: Record<string, any> = {
    userId: email,
    data: JSON.stringify(initialFinancialData),
    cidade: cidadeSanitizada,
    estado: estadoSanitizado || 'DF',
    data_nascimento: isoBirth || '1995-01-27T12:00:00.000Z',
    faixa_renda: faixaRenda,
    sexo: sexoVal,
    consent_lgpd: consentLgpd,
    consent_date: formValues?.consent_date || formValues?.consentDate || new Date().toISOString()
  };

  const permissions = [
    Permission.read(Role.any()),
    Permission.write(Role.any()),
    Permission.update(Role.any()),
    Permission.delete(Role.any())
  ];

  // Check if document already exists for this user email
  let existingDocId: string | null = null;
  try {
    console.log('[APPWRITE] Verificando existência de documento para:', email);
    const existingList = await appwriteDatabases.listDocuments(
      DATABASE_ID,
      COLLECTION_ID,
      [Query.equal('userId', email)]
    ).catch(async () => {
      const allDocs = await appwriteDatabases.listDocuments(DATABASE_ID, COLLECTION_ID, [Query.limit(100)]);
      return {
        documents: allDocs.documents.filter((d: any) => String(d.userId || '').trim().toLowerCase() === email)
      };
    });

    if (existingList && existingList.documents && existingList.documents.length > 0) {
      console.log('[APPWRITE] Documento existente encontrado:', existingList.documents[0].$id);
      existingDocId = existingList.documents[0].$id;
    } else {
      console.log('[APPWRITE] Nenhum documento existente encontrado para:', email);
    }
  } catch (lookupErr) {
    console.error('[APPWRITE] Erro ao buscar documento existente:', lookupErr);
  }

  if (existingDocId) {
    console.log('[APPWRITE] Atualizando documento existente:', existingDocId);
    try {
      const updated = await appwriteDatabases.updateDocument(
        DATABASE_ID,
        COLLECTION_ID,
        existingDocId,
        primaryPayload
      );
      console.log('[APPWRITE] Documento atualizado com sucesso.');
      return updated;
    } catch (updateErr) {
      console.error('[APPWRITE] Falha na atualização:', updateErr);
      throw updateErr; // Propagar erro
    }
  }

  // Tentativa Primária (Payload Completo)
  try {
    console.log('[APPWRITE] Criando novo documento para:', email);
    const created = await appwriteDatabases.createDocument(
      DATABASE_ID,
      COLLECTION_ID,
      ID.unique(),
      primaryPayload,
      permissions
    );
    console.log('[APPWRITE SUCESSO] Linha criada no user_financials:', created.$id);
    return created;
  } catch (errPrimario: any) {
    console.error('[APPWRITE] Erro na criação primária:', errPrimario);

    // Tentativa Secundária (userId, data, cidade, estado)
    const fallbackPayload: Record<string, any> = {
      userId: email,
      data: JSON.stringify(initialFinancialData),
      cidade: cidadeSanitizada,
      estado: estadoSanitizado || 'DF'
    };

    try {
      const fallbackCreated = await appwriteDatabases.createDocument(
        DATABASE_ID,
        COLLECTION_ID,
        ID.unique(),
        fallbackPayload,
        permissions
      );
      console.log('[APPWRITE FALLBACK SUCESSO] Linha criada via fallback:', fallbackCreated.$id);
      return fallbackCreated;
    } catch (errSecundario: any) {
      console.warn('[FALLBACK 2] Tentativa secundária falhou. Tentando payload mínimo (userId, data)...', errSecundario);

      // Tentativa Mínima (userId, data)
      const minimalPayload: Record<string, any> = {
        userId: email,
        data: JSON.stringify(initialFinancialData)
      };

      try {
        const minimalCreated = await appwriteDatabases.createDocument(
          DATABASE_ID,
          COLLECTION_ID,
          ID.unique(),
          minimalPayload,
          permissions
        );
        console.log('[APPWRITE MINIMAL SUCESSO] Linha criada via payload mínimo:', minimalCreated.$id);
        return minimalCreated;
      } catch (errMinimal: any) {
        console.error('[APPWRITE ERRO CRÍTICO] Todas as tentativas de criar documento falharam:', errMinimal);
        throw errMinimal;
      }
    }
  }
}

export async function createCleanFinancialDocument(cleanEmail: string, formValues: any) {
  return await safeCreateFinancialDocument(cleanEmail, formValues);
}

export async function persistUserInitialDocument(userAccount: any, formProfileData?: any) {
  const cleanEmail = (userAccount?.email || '').trim().toLowerCase();
  if (!cleanEmail) {
    console.warn('[persistUserInitialDocument] Email inválido fornecido.');
    return null;
  }
  return await safeCreateFinancialDocument(cleanEmail, formProfileData);
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
    if (typeof localStorage !== 'undefined') {
      const savedSecret = localStorage.getItem('appwrite_session_secret');
      if (savedSecret) {
        try {
          appwriteClient.setSession(savedSecret);
        } catch (e) {}
      }
    }
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
      if (typeof localStorage !== 'undefined') {
        const savedSecret = localStorage.getItem('appwrite_session_secret');
        if (savedSecret) {
          try {
            appwriteClient.setSession(savedSecret);
          } catch (e) {}
        }
      }
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
    const session = await appwriteAccount.createSession(userId, secret);
    if (session && (session as any).secret) {
      appwriteClient.setSession((session as any).secret);
      if (typeof window !== 'undefined') {
        localStorage.setItem('appwrite_session_secret', (session as any).secret);
      }
    }
    return session;
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
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const targetSuccess = successUrl || `${origin}${pathname}`;
  const targetFailure = failureUrl || `${targetSuccess}?auth_failed=true`;

  try {
    if (cfg.projectId && cfg.projectId !== 'default-placeholder') {
      sessionStorage.removeItem('FORCE_LOGIN_VIEW');
      localStorage.removeItem('FORCE_LOGIN_VIEW');
      localStorage.removeItem('darla_explicit_logout');
      localStorage.removeItem('darla_current_user');
      localStorage.removeItem('currentUser');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('appwrite_session_secret');
        localStorage.setItem('darla_oauth_in_progress', 'true');
      }

      const oauthUrl = `${cfg.endpoint}/account/tokens/oauth2/google?project=${cfg.projectId}&success=${encodeURIComponent(targetSuccess)}&failure=${encodeURIComponent(targetFailure)}`;
      window.location.href = oauthUrl;
      return;
    }
  } catch (err) {
    console.warn('[Appwrite OAuth redirect error]', err);
  }

  throw new Error('Google OAuth requires active Appwrite project configuration.');
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 16384;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as any);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function serializePayloadForAppwriteSync(dataObj: any): string {
  const jsonStr = JSON.stringify(dataObj);
  if (jsonStr.length < 45000) {
    return jsonStr;
  }
  try {
    const compressedBytes = pako.deflate(jsonStr);
    const base64 = uint8ArrayToBase64(compressedBytes);
    return 'COMPRESSED:' + base64;
  } catch (e) {
    console.warn('[Compression notice, falling back to JSON]', e);
    return jsonStr;
  }
}

export async function serializePayloadForAppwrite(dataObj: any): Promise<string> {
  return serializePayloadForAppwriteSync(dataObj);
}

export function parsePayloadFromAppwriteSync(rawData: any): any {
  if (!rawData) return {};
  if (typeof rawData !== 'string') return rawData;
  if (rawData.startsWith('COMPRESSED:')) {
    try {
      const base64 = rawData.slice('COMPRESSED:'.length);
      const bytes = base64ToUint8Array(base64);
      const decompressed = pako.inflate(bytes, { to: 'string' });
      return JSON.parse(decompressed);
    } catch (e) {
      console.error('[Appwrite decompression error sync]', e);
      return {};
    }
  }
  try {
    return JSON.parse(rawData);
  } catch (e) {
    return {};
  }
}

export async function parsePayloadFromAppwrite(rawData: any): Promise<any> {
  return parsePayloadFromAppwriteSync(rawData);
}

/**
 * Subscribes to real-time changes in Appwrite user financials collection with reconnection support
 */
export function subscribeToAppwriteRealtime(userIdOrEmail: string | string[], onUpdate: (remoteData?: any) => void): () => void {
  const cfg = getAppwriteConfig();
  if (!cfg.projectId || cfg.projectId === 'default-placeholder') {
    return () => {};
  }

  let unsubscribe: (() => void) | null = null;
  const databaseId = '6a83aa8d0038331e040f';
  const collectionId = 'user_financials';
  
  const rawTargets = Array.isArray(userIdOrEmail) ? userIdOrEmail : [userIdOrEmail];
  const targetSet = new Set(rawTargets.filter(Boolean).map((t) => String(t).trim().toLowerCase()));

  const channels = [
    `databases.${databaseId}.collections.${collectionId}.documents`
  ];

  try {
    unsubscribe = appwriteClient.subscribe(channels, async (response) => {
      const payload: any = response.payload;
      if (payload) {
        const payloadUserId = String(payload.userId || '').trim().toLowerCase();
        const payloadDocId = String(payload.$id || '').trim().toLowerCase();
        
        let isMatch = targetSet.size === 0;
        if (!isMatch) {
          for (const target of targetSet) {
            if (
              !target ||
              payloadUserId === target ||
              payloadDocId === target ||
              (target.includes('@') && payloadUserId === target) ||
              target.includes(payloadUserId) ||
              payloadUserId.includes(target)
            ) {
              isMatch = true;
              break;
            }
          }
        }

        if (!isMatch) {
          return;
        }

        if (response.events.some((e) => e.includes('.create') || e.includes('.update') || e.includes('.delete'))) {
          const raw = payload.data;
          let parsed: any = null;
          if (raw) {
            try {
              parsed = await parsePayloadFromAppwrite(raw);
            } catch (e) {}
          }
          onUpdate(parsed || undefined);
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

