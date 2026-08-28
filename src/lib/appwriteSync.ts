import { appwriteDatabases, checkAppwriteConnection, AppwriteStatus, getAppwriteConfig, appwriteAccount, appwriteClient } from './appwrite';
import { Query, ID } from 'appwrite';

export async function getAppwriteStatus(): Promise<AppwriteStatus> {
  return await checkAppwriteConnection();
}

/**
 * Normalizes user ID for Appwrite document IDs (max 36 chars, alphanumeric/underscore).
 */
export function getCanonicalAppwriteDocId(idOrEmail: string): string {
  if (!idOrEmail) return 'user_default';
  const clean = idOrEmail.toLowerCase().trim();
  const email = clean.startsWith('user_') ? clean.slice(5).replace(/_/g, '@') : clean;
  const docIdSafe = email.replace(/@/g, '.').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `user_${docIdSafe}`.slice(0, 36);
}

function getStoredUserEmail(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('darla_current_user') || localStorage.getItem('currentUser');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.email || '';
      }
    }
  } catch {}
  return '';
}

/**
 * Função de Atualização Direta (Update Cloud) para o documento específico 6a849358002db9e638ce com tratamento resiliente de rede
 */
export async function syncAppDataToCloud(userId?: string | any, appData?: any, userEmail?: string): Promise<boolean> {
  const databaseId = '6a83aa8d0038331e040f';
  const collectionId = 'user_financials';
  const currentUserId = typeof userId === 'string' && userId ? userId : 'default';
  const actualData = typeof userId === 'object' && userId !== null ? userId : (appData || {});
  const currentUserEmail = userEmail || getStoredUserEmail();
  const emailSanitizado = (currentUserEmail || '').toLowerCase().trim();

  const payloadData = {
    transactions: actualData.transactions || [],
    accounts: actualData.accounts || [],
    categories: actualData.categories || [],
    familyMembers: actualData.familyMembers || actualData.members || [],
    goals: actualData.goals || [],
    updatedAt: new Date().toISOString(),
    ...actualData
  };

  const payload = {
    userId: emailSanitizado || currentUserId,
    data: JSON.stringify(payloadData)
  };

  try {
    let response: any = { documents: [], total: 0 };
    if (emailSanitizado) {
      try {
        response = await appwriteDatabases.listDocuments(databaseId, collectionId, [
          Query.equal('userId', [emailSanitizado])
        ]);
      } catch (e) {}
    }

    if ((!response || !response.documents || response.documents.length === 0) && currentUserId) {
      try {
        const res2 = await appwriteDatabases.listDocuments(databaseId, collectionId, [
          Query.equal('userId', [currentUserId])
        ]);
        if (res2 && res2.documents && res2.documents.length > 0) {
          response = res2;
        }
      } catch (e) {}
    }

    let docs = response?.documents || [];

    if (docs.length > 0) {
      // Sort by $updatedAt or $createdAt desc to use the most recent document
      docs.sort((a: any, b: any) => {
        const timeA = new Date(a.$updatedAt || a.$createdAt || 0).getTime();
        const timeB = new Date(b.$updatedAt || b.$createdAt || 0).getTime();
        return timeB - timeA;
      });

      const latestDoc = docs[0];

      // SAFE MERGE: fetch the absolute latest document from database to prevent race condition overwrite of collaborative arrays
      let jsonDoBanco: any = {};
      try {
        const freshDoc = await appwriteDatabases.getDocument(databaseId, collectionId, latestDoc.$id);
        if (freshDoc && freshDoc.data) {
          jsonDoBanco = typeof freshDoc.data === 'string' ? JSON.parse(freshDoc.data) : freshDoc.data;
        } else if (latestDoc.data) {
          jsonDoBanco = typeof latestDoc.data === 'string' ? JSON.parse(latestDoc.data) : latestDoc.data;
        }
      } catch (e) {
        try {
          if (latestDoc.data) {
            jsonDoBanco = typeof latestDoc.data === 'string' ? JSON.parse(latestDoc.data) : latestDoc.data;
          }
        } catch (err2) {}
      }

      const mergedPayloadData = {
        ...payloadData,
        pedidos_acesso: jsonDoBanco.pedidos_acesso || payloadData.pedidos_acesso || [],
        allowed_users: jsonDoBanco.allowed_users || payloadData.allowed_users || [],
        shared_members: jsonDoBanco.shared_members || payloadData.shared_members || [],
        active_budget_owner: jsonDoBanco.active_budget_owner || payloadData.active_budget_owner || ''
      };

      const finalPayload = {
        userId: emailSanitizado || currentUserId,
        data: JSON.stringify(mergedPayloadData)
      };

      await appwriteDatabases.updateDocument(databaseId, collectionId, latestDoc.$id, finalPayload);
      console.log('[Appwrite Upsert Sync] Updated existing document with Safe Merge:', latestDoc.$id);

      // Clean up older duplicates if any
      if (docs.length > 1) {
        for (let i = 1; i < docs.length; i++) {
          try {
            await appwriteDatabases.deleteDocument(databaseId, collectionId, docs[i].$id);
            console.log('[Appwrite Upsert Sync] Removed duplicate document:', docs[i].$id);
          } catch (delErr) {}
        }
      }
      return true;
    } else {
      const targetDocId = getCanonicalAppwriteDocId(emailSanitizado || currentUserId);
      try {
        await appwriteDatabases.createDocument(databaseId, collectionId, targetDocId, payload);
        console.log('[Appwrite Upsert Sync] Created new document:', targetDocId);
        return true;
      } catch (createErr) {
        await appwriteDatabases.createDocument(databaseId, collectionId, ID.unique(), payload);
        console.log('[Appwrite Upsert Sync] Created new document with unique ID');
        return true;
      }
    }
  } catch (error: any) {
    const isNetworkError = error?.message?.includes('Failed to fetch') || error?.name === 'TypeError' || error?.code === 0;
    if (isNetworkError) {
      console.warn('[Appwrite Network Notice] Appwrite offline or unreachable. Using local storage.');
      return false;
    }
    console.warn('[Appwrite Sync Notice]', error?.message || error);
    return false;
  }
}

/**
 * Função Universal de Salvar na Nuvem (`saveToCloud`)
 */
export async function saveToCloud(userId: string, appData: any): Promise<boolean> {
  return await syncAppDataToCloud(userId, appData);
}

/**
 * Syncs user financial data to Cloud Appwrite databases (alias for saveToCloud).
 */
export async function syncUserDataWithAppwrite(userId: string, data: any): Promise<boolean> {
  return await saveToCloud(userId, data);
}

/**
 * Carrega diretamente do documento da nuvem com Query estrita por userId/email e proteção contra sobrescrita vazia
 */
export async function loadFromCloud(userId?: string, userEmail?: string): Promise<any | null> {
  const databaseId = '6a83aa8d0038331e040f';
  const collectionId = 'user_financials';
  const currentUserId = userId || 'default';
  const currentUserEmail = userEmail || getStoredUserEmail();
  const emailSanitizado = (currentUserEmail || '').toLowerCase().trim();

  try {
    let response: any = { documents: [], total: 0 };
    if (emailSanitizado) {
      try {
        response = await appwriteDatabases.listDocuments(databaseId, collectionId, [
          Query.equal('userId', [emailSanitizado])
        ]);
      } catch (e) {}
    }

    if ((!response || !response.documents || response.documents.length === 0) && currentUserId) {
      try {
        const res2 = await appwriteDatabases.listDocuments(databaseId, collectionId, [
          Query.equal('userId', [currentUserId])
        ]);
        if (res2 && res2.documents && res2.documents.length > 0) {
          response = res2;
        }
      } catch (e) {}
    }

    let docs = response?.documents || [];
    if (docs.length > 0) {
      docs.sort((a: any, b: any) => {
        const timeA = new Date(a.$updatedAt || a.$createdAt || 0).getTime();
        const timeB = new Date(b.$updatedAt || b.$createdAt || 0).getTime();
        return timeB - timeA;
      });

      const doc = docs[0];

      // Clean up older duplicates if any
      if (docs.length > 1) {
        for (let i = 1; i < docs.length; i++) {
          try {
            appwriteDatabases.deleteDocument(databaseId, collectionId, docs[i].$id);
          } catch (e) {}
        }
      }

      if (doc && doc.data && doc.data !== '{}' && doc.data !== 'null') {
        const parsed = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
        console.log('[Appwrite Load Success] Dados carregados da nuvem para usuário:', emailSanitizado || currentUserId);
        
        // Safety check against zeroing out local transactions
        try {
          const localStoredTx = localStorage.getItem('darla_transactions');
          if (localStoredTx) {
            const parsedLocalTx = JSON.parse(localStoredTx);
            if (Array.isArray(parsedLocalTx) && parsedLocalTx.length > 0 && (!parsed.transactions || parsed.transactions.length === 0)) {
              console.log('[Appwrite Sync Safety] Cloud data had empty transactions while local has data. Preserving local data.');
              parsed.transactions = parsedLocalTx;
            }
          }
        } catch {}

        try {
          localStorage.setItem('cached_app_data', JSON.stringify(parsed));
        } catch {}
        return parsed;
      }
    }

    // Check local storage before creating zeroed document
    let localPayloadData: any = null;
    try {
      const localAccounts = JSON.parse(localStorage.getItem('darla_accounts') || '[]');
      const localTransactions = JSON.parse(localStorage.getItem('darla_transactions') || '[]');
      const localCategories = JSON.parse(localStorage.getItem('darla_categories') || '[]');
      const localGoals = JSON.parse(localStorage.getItem('darla_goals') || '[]');
      const localFamily = JSON.parse(localStorage.getItem('darla_family_members') || '[]');

      if (localTransactions.length > 0 || localAccounts.length > 0) {
        localPayloadData = {
          saldo: 0,
          receitas: 0,
          despesas: 0,
          transactions: localTransactions,
          accounts: localAccounts,
          categories: localCategories,
          goals: localGoals,
          familyMembers: localFamily,
          updatedAt: new Date().toISOString()
        };
        console.log('[Appwrite Sync] Using local storage data to populate cloud document instead of zeroing out.');
      }
    } catch {}

    const initialPayloadData = localPayloadData || {
      saldo: 0,
      receitas: 0,
      despesas: 0,
      transactions: [],
      accounts: [],
      categories: [],
      goals: [],
      familyMembers: [],
      investorPortfolio: [],
      investmentTransactions: [],
      targetAllocations: [],
      budgetGoals: { essentials: 50, lifestyle: 30, investment: 20 },
      gamificationProfile: null,
      gamificationState: null,
      updatedAt: new Date().toISOString()
    };

    const targetDocId = getCanonicalAppwriteDocId(emailSanitizado || currentUserId);
    const createPayload = {
      userId: emailSanitizado || currentUserId,
      data: JSON.stringify(initialPayloadData)
    };
    try {
      await appwriteDatabases.createDocument(databaseId, collectionId, targetDocId, createPayload);
      console.log('[Appwrite Load] Created initial document:', targetDocId);
    } catch (createErr: any) {
      try {
        await appwriteDatabases.createDocument(databaseId, collectionId, ID.unique(), createPayload);
      } catch (retryErr: any) {}
    }
    return initialPayloadData;
  } catch (error: any) {
    const isNetworkError = error?.message?.includes('Failed to fetch') || error?.name === 'TypeError' || error?.code === 0 || error?.message === 'Timeout';
    if (!isNetworkError) {
      console.warn('[Appwrite Load Notice]', error?.message || error);
    }
  }
  return null;
}

/**
 * Migração / Sincronização com a nuvem
 */
export async function syncFromCloud(
  userId: string,
  localDataCollector?: () => any,
  applyCloudData?: (data: any) => void
): Promise<any | null> {
  try {
    const cloudData = await loadFromCloud(userId);
    if (cloudData) {
      if (applyCloudData) {
        applyCloudData(cloudData);
      }
      return cloudData;
    } else {
      const localData = localDataCollector ? localDataCollector() : { accounts: [], transactions: [], goals: [], categories: [], familyMembers: [] };
      await syncAppDataToCloud(userId, localData);
      if (applyCloudData) {
        applyCloudData(localData);
      }
      return localData;
    }
  } catch (err: any) {
    const localData = localDataCollector ? localDataCollector() : { accounts: [], transactions: [], goals: [], categories: [], familyMembers: [] };
    await syncAppDataToCloud(userId, localData);
    if (applyCloudData) applyCloudData(localData);
    return localData;
  }
}

/**
 * Compatibility wrapper for checkAndMigrateOrFetchUserFinancials
 */
export async function checkAndMigrateOrFetchUserFinancials(
  userId: string,
  localDataCollector?: () => any,
  applyCloudData?: (data: any) => void
): Promise<any | null> {
  return await syncFromCloud(userId, localDataCollector, applyCloudData);
}

/**
 * Fetches user financial data directly from Cloud Appwrite databases.
 */
export async function fetchUserDataFromAppwrite(userId: string): Promise<any | null> {
  return await loadFromCloud(userId);
}

/**
 * Direct Appwrite collection query for transactions
 */
export async function fetchTransactionsFromAppwrite(userId: string): Promise<any[]> {
  const { projectId, databaseId } = getAppwriteConfig();
  if (!projectId) return [];
  try {
    const response = await appwriteDatabases.listDocuments(databaseId, 'transactions', [
      Query.equal('userId', [userId, '6a83b38ed065c08efa49']),
    ]);
    return response.documents || [];
  } catch {
    return [];
  }
}

/**
 * Direct Appwrite mutation helpers
 */
export async function createAppwriteTransaction(userId: string, tx: any): Promise<boolean> {
  const { projectId, databaseId } = getAppwriteConfig();
  if (!projectId) return false;
  try {
    const docId = tx.id ? tx.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 36) : ID.unique();
    const payload = {
      ...tx,
      userId: '6a83b38ed065c08efa49',
    };
    try {
      await appwriteDatabases.createDocument(databaseId, 'transactions', docId, payload);
    } catch (createErr: any) {
      if (createErr?.code === 409 || createErr?.type === 'document_already_exists') {
        await appwriteDatabases.updateDocument(databaseId, 'transactions', docId, payload);
      } else {
        throw createErr;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function updateAppwriteTransaction(userId: string, tx: any): Promise<boolean> {
  const { projectId, databaseId } = getAppwriteConfig();
  if (!projectId) return false;
  try {
    const docId = tx.id ? tx.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 36) : ID.unique();
    const payload = {
      ...tx,
      userId: '6a83b38ed065c08efa49',
    };
    try {
      await appwriteDatabases.updateDocument(databaseId, 'transactions', docId, payload);
    } catch (updateErr: any) {
      if (updateErr?.code === 404 || updateErr?.type === 'document_not_found') {
        await appwriteDatabases.createDocument(databaseId, 'transactions', docId, payload);
      } else {
        throw updateErr;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function deleteAppwriteTransaction(userId: string, txId: string): Promise<boolean> {
  const { projectId, databaseId } = getAppwriteConfig();
  if (!projectId) return false;
  try {
    const docId = txId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 36);
    await appwriteDatabases.deleteDocument(databaseId, 'transactions', docId);
    return true;
  } catch {
    return false;
  }
}

const DATABASE_ID = '6a83aa8d0038331e040f';
const COLLECTION_ID = 'user_financials';
const DOCUMENT_ID = '6a849358002db9e638ce';
const USER_ID = '6a83b38ed065c08efa49';

export async function saveAppData(userId?: string | any, updatedData?: any): Promise<boolean> {
  const actualUserId = typeof userId === 'string' ? userId : 'default';
  const actualData = typeof userId === 'object' && userId !== null ? userId : (updatedData || {});
  return await syncAppDataToCloud(actualUserId, actualData);
}

export async function persistCurrentStateToAppwrite(userId?: string | any, state?: any): Promise<boolean> {
  return await saveAppData(userId, state);
}

// --- TRANSACTIONAL GOALS MANAGER (CROSS-DEVICE ATOMICITY & RACE CONDITION FIX) ---

const DELETION_TTL_MS = 30000; // 30 seconds retention to prevent websocket race rollback
const recentDeletedGoalIds = new Map<string, number>();
const pendingGoalMutations = new Map<
  string,
  {
    action: string;
    goalData?: any;
    addedAmount?: number;
    timestamp: number;
  }
>();

// --- TRANSACTIONAL STRUCTURE (CATEGORIES, SUBCATEGORIES, MEMBERS) MANAGER ---
const recentDeletedCategoryIds = new Map<string, number>();
const recentDeletedMemberIds = new Map<string, number>();
const recentDeletedInvestmentTxIds = new Map<string, number>();

const pendingCategoryMutations = new Map<
  string,
  {
    action: string;
    categoryData?: any;
    timestamp: number;
  }
>();

const pendingMemberMutations = new Map<
  string,
  {
    action: string;
    memberData?: any;
    timestamp: number;
  }
>();

const pendingInvestmentTxMutations = new Map<
  string,
  {
    action: string;
    txData?: any;
    timestamp: number;
  }
>();

export function recordInvestmentTxDeletion(id: string): void {
  if (!id) return;
  recentDeletedInvestmentTxIds.set(id, Date.now());
  pendingInvestmentTxMutations.delete(id);
}

export function isInvestmentTxRecentlyDeleted(id: string): boolean {
  if (!id) return false;
  const deletedAt = recentDeletedInvestmentTxIds.get(id);
  if (!deletedAt) return false;
  if (Date.now() - deletedAt > DELETION_TTL_MS) {
    recentDeletedInvestmentTxIds.delete(id);
    return false;
  }
  return true;
}

export function getRecentDeletedInvestmentTxIds(): Set<string> {
  const now = Date.now();
  const valid = new Set<string>();
  recentDeletedInvestmentTxIds.forEach((time, id) => {
    if (now - time <= DELETION_TTL_MS) {
      valid.add(id);
    } else {
      recentDeletedInvestmentTxIds.delete(id);
    }
  });
  return valid;
}

export function recordPendingInvestmentTxMutation(id: string, action: string, txData?: any): void {
  if (!id) return;
  pendingInvestmentTxMutations.set(id, {
    action,
    txData,
    timestamp: Date.now(),
  });
}

export function clearPendingInvestmentTxMutation(id: string): void {
  pendingInvestmentTxMutations.delete(id);
}

export function mergeRemoteInvestmentTransactionsWithOptimistic(remoteTxs: any[]): any[] {
  const deletedSet = getRecentDeletedInvestmentTxIds();
  const map = new Map<string, any>();

  if (Array.isArray(remoteTxs)) {
    remoteTxs.forEach((rt: any) => {
      if (rt && rt.id && !deletedSet.has(rt.id)) {
        map.set(rt.id, rt);
      }
    });
  }

  const now = Date.now();
  pendingInvestmentTxMutations.forEach((pending, txId) => {
    if (deletedSet.has(txId)) {
      map.delete(txId);
      return;
    }

    if (now - pending.timestamp > 45000) {
      pendingInvestmentTxMutations.delete(txId);
      return;
    }

    if (pending.action === 'addInvestmentTransaction' || pending.action === 'updateInvestmentTransaction') {
      const existing = map.get(txId);
      if (!existing) {
        if (pending.txData) map.set(txId, pending.txData);
      } else {
        const remoteTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        if (pending.timestamp >= remoteTime) {
          map.set(txId, { ...existing, ...pending.txData });
        }
      }
    } else if (pending.action === 'deleteInvestmentTransaction') {
      map.delete(txId);
    }
  });

  return Array.from(map.values());
}

export function recordCategoryDeletion(id: string): void {
  if (!id) return;
  recentDeletedCategoryIds.set(id, Date.now());
  pendingCategoryMutations.delete(id);
}

export function isCategoryRecentlyDeleted(id: string): boolean {
  if (!id) return false;
  const deletedAt = recentDeletedCategoryIds.get(id);
  if (!deletedAt) return false;
  if (Date.now() - deletedAt > DELETION_TTL_MS) {
    recentDeletedCategoryIds.delete(id);
    return false;
  }
  return true;
}

export function getRecentDeletedCategoryIds(): Set<string> {
  const now = Date.now();
  const valid = new Set<string>();
  recentDeletedCategoryIds.forEach((time, id) => {
    if (now - time <= DELETION_TTL_MS) {
      valid.add(id);
    } else {
      recentDeletedCategoryIds.delete(id);
    }
  });
  return valid;
}

export function recordMemberDeletion(id: string): void {
  if (!id) return;
  recentDeletedMemberIds.set(id, Date.now());
  pendingMemberMutations.delete(id);
}

export function isMemberRecentlyDeleted(id: string): boolean {
  if (!id) return false;
  const deletedAt = recentDeletedMemberIds.get(id);
  if (!deletedAt) return false;
  if (Date.now() - deletedAt > DELETION_TTL_MS) {
    recentDeletedMemberIds.delete(id);
    return false;
  }
  return true;
}

export function getRecentDeletedMemberIds(): Set<string> {
  const now = Date.now();
  const valid = new Set<string>();
  recentDeletedMemberIds.forEach((time, id) => {
    if (now - time <= DELETION_TTL_MS) {
      valid.add(id);
    } else {
      recentDeletedMemberIds.delete(id);
    }
  });
  return valid;
}

export function recordPendingCategoryMutation(id: string, action: string, categoryData?: any): void {
  if (!id) return;
  pendingCategoryMutations.set(id, {
    action,
    categoryData,
    timestamp: Date.now(),
  });
}

export function clearPendingCategoryMutation(id: string): void {
  pendingCategoryMutations.delete(id);
}

export function recordPendingMemberMutation(id: string, action: string, memberData?: any): void {
  if (!id) return;
  pendingMemberMutations.set(id, {
    action,
    memberData,
    timestamp: Date.now(),
  });
}

export function clearPendingMemberMutation(id: string): void {
  pendingMemberMutations.delete(id);
}

export function mergeRemoteCategoriesWithOptimistic(remoteCategories: any[]): any[] {
  const deletedSet = getRecentDeletedCategoryIds();
  const map = new Map<string, any>();

  if (Array.isArray(remoteCategories)) {
    remoteCategories.forEach((rc: any) => {
      if (rc && rc.id && !deletedSet.has(rc.id)) {
        map.set(rc.id, rc);
      }
    });
  }

  const now = Date.now();
  pendingCategoryMutations.forEach((pending, cId) => {
    if (deletedSet.has(cId)) {
      map.delete(cId);
      return;
    }

    if (now - pending.timestamp > 45000) {
      pendingCategoryMutations.delete(cId);
      return;
    }

    if (pending.action === 'addCategory' || pending.action === 'updateCategory' || pending.action.includes('Subcategory')) {
      const existing = map.get(cId);
      if (!existing) {
        if (pending.categoryData) map.set(cId, pending.categoryData);
      } else {
        const remoteTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        if (pending.timestamp >= remoteTime) {
          map.set(cId, { ...existing, ...pending.categoryData });
        }
      }
    } else if (pending.action === 'deleteCategory') {
      map.delete(cId);
    }
  });

  return Array.from(map.values());
}

export function mergeRemoteMembersWithOptimistic(remoteMembers: any[]): any[] {
  const deletedSet = getRecentDeletedMemberIds();
  const map = new Map<string, any>();

  if (Array.isArray(remoteMembers)) {
    remoteMembers.forEach((rm: any) => {
      if (rm && rm.id && !deletedSet.has(rm.id)) {
        map.set(rm.id, rm);
      }
    });
  }

  const now = Date.now();
  pendingMemberMutations.forEach((pending, mId) => {
    if (deletedSet.has(mId)) {
      map.delete(mId);
      return;
    }

    if (now - pending.timestamp > 45000) {
      pendingMemberMutations.delete(mId);
      return;
    }

    if (pending.action === 'addMember' || pending.action === 'updateMember') {
      const existing = map.get(mId);
      if (!existing) {
        if (pending.memberData) map.set(mId, pending.memberData);
      } else {
        const remoteTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        if (pending.timestamp >= remoteTime) {
          map.set(mId, { ...existing, ...pending.memberData });
        }
      }
    } else if (pending.action === 'deleteMember') {
      map.delete(mId);
    }
  });

  return Array.from(map.values());
}

export function recordGoalDeletion(goalId: string): void {
  if (!goalId) return;
  recentDeletedGoalIds.set(goalId, Date.now());
  pendingGoalMutations.delete(goalId);
}

export function isGoalRecentlyDeleted(goalId: string): boolean {
  if (!goalId) return false;
  const deletedAt = recentDeletedGoalIds.get(goalId);
  if (!deletedAt) return false;
  if (Date.now() - deletedAt > DELETION_TTL_MS) {
    recentDeletedGoalIds.delete(goalId);
    return false;
  }
  return true;
}

export function getRecentDeletedGoalIds(): Set<string> {
  const now = Date.now();
  const valid = new Set<string>();
  recentDeletedGoalIds.forEach((time, id) => {
    if (now - time <= DELETION_TTL_MS) {
      valid.add(id);
    } else {
      recentDeletedGoalIds.delete(id);
    }
  });
  return valid;
}

export function recordPendingGoalMutation(id: string, action: string, goalData?: any, addedAmount?: number): void {
  if (!id) return;
  pendingGoalMutations.set(id, {
    action,
    goalData,
    addedAmount,
    timestamp: Date.now(),
  });
}

export function clearPendingGoalMutation(id: string): void {
  pendingGoalMutations.delete(id);
}

/**
 * Non-destructive merge of remote goals with local in-flight mutations & deletion guards
 */
export function mergeRemoteGoalsWithOptimistic(remoteGoals: any[]): any[] {
  const deletedSet = getRecentDeletedGoalIds();
  const map = new Map<string, any>();

  // 1. Add remote items if not recently deleted locally
  if (Array.isArray(remoteGoals)) {
    remoteGoals.forEach((rg: any) => {
      if (rg && rg.id && !deletedSet.has(rg.id)) {
        map.set(rg.id, rg);
      }
    });
  }

  // 2. Overlay any optimistic local modifications that are newer
  const now = Date.now();
  pendingGoalMutations.forEach((pending, gId) => {
    if (deletedSet.has(gId)) {
      map.delete(gId);
      return;
    }

    if (now - pending.timestamp > 45000) {
      pendingGoalMutations.delete(gId);
      return;
    }

    if (pending.action === 'addGoal' || pending.action === 'updateGoal') {
      const existing = map.get(gId);
      if (!existing) {
        map.set(gId, pending.goalData);
      } else {
        const remoteTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        if (pending.timestamp >= remoteTime) {
          map.set(gId, { ...existing, ...pending.goalData });
        }
      }
    } else if (pending.action === 'updateGoalProgress') {
      const existing = map.get(gId);
      if (existing) {
        map.set(gId, {
          ...existing,
          currentAmount: Math.max(0, (existing.currentAmount || 0) + (pending.addedAmount || 0)),
        });
      }
    } else if (pending.action === 'deleteGoal') {
      map.delete(gId);
    }
  });

  return Array.from(map.values());
}

/**
 * Executes an atomic server transaction for goal operations and updates Appwrite directly
 */
export async function executeTransactionalGoal(
  userId: string,
  action: 'addGoal' | 'updateGoal' | 'deleteGoal' | 'updateGoalProgress',
  payload: { goalData?: any; goalId?: string; addedAmount?: number }
): Promise<{ success: boolean; goals: any[] }> {
  const targetId = payload.goalId || payload.goalData?.id;

  if (action === 'deleteGoal' && targetId) {
    recordGoalDeletion(targetId);
  } else if (targetId) {
    recordPendingGoalMutation(targetId, action, payload.goalData, payload.addedAmount);
  }

  try {
    // Call backend server transactional endpoint
    const response = await fetch('/api/data/transactional-goal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        action,
        goalId: targetId,
        goalData: payload.goalData,
        addedAmount: payload.addedAmount,
      }),
    });

    if (response.ok) {
      const resData = await response.json();
      if (resData && resData.success && Array.isArray(resData.goals)) {
        if (targetId && action !== 'deleteGoal') {
          clearPendingGoalMutation(targetId);
        }
        return { success: true, goals: resData.goals };
      }
    }
  } catch (err) {
    console.warn('[Transactional Goal Server Notice] Server unreachable, executing direct Appwrite transaction:', err);
  }

  // Fallback: Direct Appwrite document transaction
  try {
    const cloudDoc = await loadFromCloud();
    const existingGoals = Array.isArray(cloudDoc?.investorGoals)
      ? cloudDoc.investorGoals
      : (Array.isArray(cloudDoc?.goals) ? cloudDoc.goals : []);

    let updatedGoals = [...existingGoals];

    if (action === 'addGoal' || action === 'updateGoal') {
      const g = payload.goalData;
      const idx = updatedGoals.findIndex((item: any) => item.id === g.id);
      if (idx >= 0) {
        updatedGoals[idx] = { ...updatedGoals[idx], ...g, updatedAt: new Date().toISOString() };
      } else {
        updatedGoals.push({ ...g, updatedAt: new Date().toISOString() });
      }
    } else if (action === 'deleteGoal') {
      updatedGoals = updatedGoals.filter((item: any) => item.id !== targetId);
    } else if (action === 'updateGoalProgress') {
      const idx = updatedGoals.findIndex((item: any) => item.id === targetId);
      if (idx >= 0) {
        const added = payload.addedAmount || 0;
        updatedGoals[idx] = {
          ...updatedGoals[idx],
          currentAmount: Math.max(0, (updatedGoals[idx].currentAmount || 0) + added),
          updatedAt: new Date().toISOString(),
        };
      }
    }

    const mergedGoals = mergeRemoteGoalsWithOptimistic(updatedGoals);

    const fullPayload = {
      ...(cloudDoc || {}),
      goals: mergedGoals,
      investorGoals: mergedGoals,
      familyBudget: [
        ...mergedGoals,
        ...(Array.isArray(cloudDoc?.familyBudget)
          ? cloudDoc.familyBudget.filter((f: any) => f.relationship !== undefined || (f.name && f.color && !f.targetAmount))
          : []),
      ],
      updatedAt: new Date().toISOString(),
    };

    await saveAppData(fullPayload);
    if (targetId && action !== 'deleteGoal') {
      clearPendingGoalMutation(targetId);
    }
    return { success: true, goals: mergedGoals };
  } catch (appwriteErr) {
    console.error('[Direct Appwrite Transaction Error]', appwriteErr);
    return { success: false, goals: [] };
  }
}

// Subcategory tree helpers for fallback direct client manipulation
function addSubcategoryToTreeClient(
  subs: any[] = [],
  parentSubId: string | null = null,
  newSub: any
): any[] {
  if (!parentSubId) {
    return [...subs, newSub];
  }
  return subs.map((s) => {
    if (s.id === parentSubId) {
      return {
        ...s,
        subcategories: [...(s.subcategories || []), newSub],
      };
    }
    if (s.subcategories && s.subcategories.length > 0) {
      return {
        ...s,
        subcategories: addSubcategoryToTreeClient(s.subcategories, parentSubId, newSub),
      };
    }
    return s;
  });
}

function deleteSubcategoryFromTreeClient(subs: any[] = [], targetSubId: string): any[] {
  return subs
    .filter((s) => s.id !== targetSubId)
    .map((s) => ({
      ...s,
      subcategories: s.subcategories ? deleteSubcategoryFromTreeClient(s.subcategories, targetSubId) : [],
    }));
}

function renameSubcategoryInTreeClient(
  subs: any[] = [],
  targetSubId: string,
  newName: string
): any[] {
  return subs.map((s) => {
    if (s.id === targetSubId) {
      return {
        ...s,
        name: newName,
      };
    }
    if (s.subcategories && s.subcategories.length > 0) {
      return {
        ...s,
        subcategories: renameSubcategoryInTreeClient(s.subcategories, targetSubId, newName),
      };
    }
    return s;
  });
}

/**
 * Executes an atomic server transaction for categories, subcategories, and members
 */
export async function executeTransactionalStructure(
  userId: string,
  action:
    | 'addCategory'
    | 'updateCategory'
    | 'deleteCategory'
    | 'addSubcategory'
    | 'updateSubcategory'
    | 'renameSubcategory'
    | 'deleteSubcategory'
    | 'moveSubcategory'
    | 'restoreDefaultCategories'
    | 'addMember'
    | 'updateMember'
    | 'deleteMember',
  payload: {
    categoryData?: any;
    categoryId?: string;
    subData?: any;
    parentSubId?: string | null;
    subId?: string;
    newSubName?: string;
    sourceCatId?: string;
    targetCatId?: string;
    memberData?: any;
    memberId?: string;
    categoriesList?: any[];
  }
): Promise<{ success: boolean; categories?: any[]; familyMembers?: any[] }> {
  const targetCatId = payload.categoryId || payload.categoryData?.id;
  const targetMemberId = payload.memberId || payload.memberData?.id;

  if (action === 'deleteCategory' && targetCatId) {
    recordCategoryDeletion(targetCatId);
  } else if (action === 'deleteMember' && targetMemberId) {
    recordMemberDeletion(targetMemberId);
  } else if (targetCatId && (action === 'addCategory' || action === 'updateCategory')) {
    recordPendingCategoryMutation(targetCatId, action, payload.categoryData);
  } else if (targetMemberId && (action === 'addMember' || action === 'updateMember')) {
    recordPendingMemberMutation(targetMemberId, action, payload.memberData);
  }

  try {
    const response = await fetch('/api/data/transactional-structure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        action,
        categoryId: payload.categoryId,
        categoryData: payload.categoryData,
        subData: payload.subData,
        parentSubId: payload.parentSubId,
        subId: payload.subId,
        newSubName: payload.newSubName,
        sourceCatId: payload.sourceCatId,
        targetCatId: payload.targetCatId,
        memberId: payload.memberId,
        memberData: payload.memberData,
        categoriesList: payload.categoriesList,
      }),
    });

    if (response.ok) {
      const resData = await response.json();
      if (resData && resData.success) {
        if (targetCatId && action !== 'deleteCategory') {
          clearPendingCategoryMutation(targetCatId);
        }
        if (targetMemberId && action !== 'deleteMember') {
          clearPendingMemberMutation(targetMemberId);
        }
        return {
          success: true,
          categories: resData.categories,
          familyMembers: resData.familyMembers,
        };
      }
    }
  } catch (err) {
    console.warn('[Transactional Structure Server Notice] Server unreachable, using direct cloud sync:', err);
  }

  // Fallback: Direct Appwrite document transaction
  try {
    const cloudDoc = await loadFromCloud();
    let existingCategories = Array.isArray(cloudDoc?.categories) ? [...cloudDoc.categories] : [];
    let existingMembers = Array.isArray(cloudDoc?.familyMembers)
      ? [...cloudDoc.familyMembers]
      : (Array.isArray(cloudDoc?.members) ? [...cloudDoc.members] : []);

    if (action === 'addCategory' || action === 'updateCategory') {
      const c = payload.categoryData;
      const idx = existingCategories.findIndex((item: any) => item.id === c.id);
      if (idx >= 0) {
        existingCategories[idx] = { ...existingCategories[idx], ...c, updatedAt: new Date().toISOString() };
      } else {
        existingCategories.push({ ...c, updatedAt: new Date().toISOString() });
      }
    } else if (action === 'deleteCategory') {
      existingCategories = existingCategories.filter((item: any) => item.id !== targetCatId);
    } else if (action === 'addSubcategory') {
      const cIdx = existingCategories.findIndex((item: any) => item.id === payload.categoryId);
      if (cIdx >= 0 && payload.subData) {
        existingCategories[cIdx].subcategories = addSubcategoryToTreeClient(
          existingCategories[cIdx].subcategories || [],
          payload.parentSubId || null,
          payload.subData
        );
        existingCategories[cIdx].updatedAt = new Date().toISOString();
      }
    } else if (action === 'updateSubcategory' || action === 'renameSubcategory') {
      const cIdx = existingCategories.findIndex((item: any) => item.id === payload.categoryId);
      if (cIdx >= 0 && payload.subId && payload.newSubName) {
        existingCategories[cIdx].subcategories = renameSubcategoryInTreeClient(
          existingCategories[cIdx].subcategories || [],
          payload.subId,
          payload.newSubName
        );
        existingCategories[cIdx].updatedAt = new Date().toISOString();
      }
    } else if (action === 'deleteSubcategory') {
      const cIdx = existingCategories.findIndex((item: any) => item.id === payload.categoryId);
      if (cIdx >= 0 && payload.subId) {
        existingCategories[cIdx].subcategories = deleteSubcategoryFromTreeClient(
          existingCategories[cIdx].subcategories || [],
          payload.subId
        );
        existingCategories[cIdx].updatedAt = new Date().toISOString();
      }
    } else if (action === 'moveSubcategory') {
      const srcIdx = existingCategories.findIndex((item: any) => item.id === payload.sourceCatId);
      const tgtIdx = existingCategories.findIndex((item: any) => item.id === payload.targetCatId);
      if (srcIdx >= 0 && tgtIdx >= 0 && payload.subData) {
        existingCategories[srcIdx].subcategories = deleteSubcategoryFromTreeClient(
          existingCategories[srcIdx].subcategories || [],
          payload.subData.id
        );
        const movedSub = { ...payload.subData, categoryId: payload.targetCatId, parentId: undefined };
        existingCategories[tgtIdx].subcategories = [...(existingCategories[tgtIdx].subcategories || []), movedSub];
        existingCategories[srcIdx].updatedAt = new Date().toISOString();
        existingCategories[tgtIdx].updatedAt = new Date().toISOString();
      }
    } else if (action === 'restoreDefaultCategories') {
      if (Array.isArray(payload.categoriesList)) {
        existingCategories = payload.categoriesList;
      }
    } else if (action === 'addMember' || action === 'updateMember') {
      const m = payload.memberData;
      const idx = existingMembers.findIndex((item: any) => item.id === m.id);
      if (idx >= 0) {
        existingMembers[idx] = { ...existingMembers[idx], ...m, updatedAt: new Date().toISOString() };
      } else {
        existingMembers.push({ ...m, updatedAt: new Date().toISOString() });
      }
    } else if (action === 'deleteMember') {
      existingMembers = existingMembers.filter((item: any) => item.id !== targetMemberId);
    }

    const mergedCategories = mergeRemoteCategoriesWithOptimistic(existingCategories);
    const mergedMembers = mergeRemoteMembersWithOptimistic(existingMembers);

    const fullPayload = {
      ...(cloudDoc || {}),
      categories: mergedCategories,
      familyMembers: mergedMembers,
      members: mergedMembers,
      familyBudget: [
        ...(Array.isArray(cloudDoc?.goals) ? cloudDoc.goals : []),
        ...mergedMembers,
      ],
      updatedAt: new Date().toISOString(),
    };

    await saveAppData(fullPayload);

    if (targetCatId && action !== 'deleteCategory') {
      clearPendingCategoryMutation(targetCatId);
    }
    if (targetMemberId && action !== 'deleteMember') {
      clearPendingMemberMutation(targetMemberId);
    }

    return { success: true, categories: mergedCategories, familyMembers: mergedMembers };
  } catch (err) {
    console.error('[Direct Structure Sync Error]', err);
    return { success: false };
  }
}

/**
 * Syncs user portfolio data to Cloud Appwrite
 */
export async function syncPortfolioWithAppwrite(userId: string, portfolioData: any): Promise<boolean> {
  const { projectId, databaseId } = getAppwriteConfig();
  if (!projectId) return false;

  try {
    const collectionId = 'user_portfolios';
    const documentId = '6a849358002db9e638ce';

    const payload = {
      userId: userId || '6a83b38ed065c08efa49',
      data: JSON.stringify(portfolioData)
    };

    try {
      await appwriteDatabases.updateDocument(databaseId, collectionId, documentId, payload);
    } catch (err: any) {
      if (err?.code === 404 || err?.message?.includes('not found') || err?.type === 'document_not_found') {
        await appwriteDatabases.createDocument(databaseId, collectionId, documentId, payload);
      }
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Fetches user portfolio data from Cloud Appwrite
 */
export async function fetchPortfolioFromAppwrite(userId: string): Promise<any | null> {
  const { projectId, databaseId } = getAppwriteConfig();
  if (!projectId) return null;

  try {
    const collectionId = 'user_portfolios';
    const documentId = '6a849358002db9e638ce';

    const doc = await appwriteDatabases.getDocument(databaseId, collectionId, documentId);
    if (doc && doc.data) {
      return typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Transactional Invoker for Investor Portfolio Transactions (Buy, Sell, Dividends).
 * Solves race conditions across devices and maintains optimistic consistency.
 */
export async function executeTransactionalInvestmentTransaction(
  userId: string,
  action: 'addInvestmentTransaction' | 'updateInvestmentTransaction' | 'deleteInvestmentTransaction',
  payload: {
    transactionData?: any;
    transactionId?: string;
  }
): Promise<{ success: boolean; investmentTransactions?: any[] }> {
  const targetTxId = payload.transactionId || payload.transactionData?.id;

  if (action === 'deleteInvestmentTransaction' && targetTxId) {
    recordInvestmentTxDeletion(targetTxId);
  } else if (targetTxId && payload.transactionData) {
    recordPendingInvestmentTxMutation(targetTxId, action, payload.transactionData);
  }

  // Primary: Server atomic transactional endpoint
  try {
    const response = await fetch('/api/portfolio/transactional-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        action,
        transactionData: payload.transactionData,
        transactionId: payload.transactionId,
      }),
    });

    if (response.ok) {
      const resData = await response.json();
      if (resData && resData.success) {
        if (targetTxId && action !== 'deleteInvestmentTransaction') {
          clearPendingInvestmentTxMutation(targetTxId);
        }
        return {
          success: true,
          investmentTransactions: resData.investmentTransactions,
        };
      }
    }
  } catch (err) {
    console.warn('[Transactional Investment Server Notice] Server unreachable, using direct cloud sync:', err);
  }

  // Fallback: Direct Appwrite document transaction
  try {
    const cloudDoc = await loadFromCloud();
    let existingTxs = Array.isArray(cloudDoc?.investmentTransactions) ? [...cloudDoc.investmentTransactions] : [];

    if (action === 'addInvestmentTransaction' || action === 'updateInvestmentTransaction') {
      const tx = payload.transactionData;
      if (tx) {
        const idx = existingTxs.findIndex((item: any) => item.id === tx.id);
        if (idx >= 0) {
          existingTxs[idx] = { ...existingTxs[idx], ...tx, updatedAt: new Date().toISOString() };
        } else {
          existingTxs.unshift({ ...tx, updatedAt: new Date().toISOString() });
        }
      }
    } else if (action === 'deleteInvestmentTransaction') {
      existingTxs = existingTxs.filter((item: any) => item.id !== targetTxId);
    }

    const mergedTxs = mergeRemoteInvestmentTransactionsWithOptimistic(existingTxs);

    const fullPayload = {
      ...(cloudDoc || {}),
      investmentTransactions: mergedTxs,
      updatedAt: new Date().toISOString(),
    };

    await saveAppData(fullPayload);

    if (targetTxId && action !== 'deleteInvestmentTransaction') {
      clearPendingInvestmentTxMutation(targetTxId);
    }

    return { success: true, investmentTransactions: mergedTxs };
  } catch (err) {
    console.error('[Direct Investment Transaction Sync Error]', err);
    return { success: false };
  }
}

// --- TRANSACTIONAL TARGET ALLOCATIONS (DESIRED PERCENTAGES) ---

let pendingTargetAllocations: { allocations: any[]; timestamp: number } | null = null;

export function recordPendingTargetAllocations(allocations: any[]): void {
  pendingTargetAllocations = {
    allocations,
    timestamp: Date.now(),
  };
}

export function clearPendingTargetAllocations(): void {
  pendingTargetAllocations = null;
}

export function mergeRemoteTargetAllocationsWithOptimistic(remoteAllocations: any[]): any[] {
  if (!Array.isArray(remoteAllocations) || remoteAllocations.length === 0) {
    return pendingTargetAllocations ? pendingTargetAllocations.allocations : (remoteAllocations || []);
  }

  if (pendingTargetAllocations) {
    const age = Date.now() - pendingTargetAllocations.timestamp;
    if (age < 15000) {
      return pendingTargetAllocations.allocations;
    }
    pendingTargetAllocations = null;
  }

  return remoteAllocations;
}

/**
 * Atomic Server & Cloud Transaction for Target Allocations
 */
export async function executeTransactionalTargetAllocations(
  userId: string,
  targetAllocations: any[]
): Promise<{ success: boolean; targetAllocations?: any[] }> {
  recordPendingTargetAllocations(targetAllocations);

  // Primary: Server atomic transactional endpoint
  try {
    const response = await fetch('/api/portfolio/transactional-allocations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        targetAllocations,
      }),
    });

    if (response.ok) {
      const resData = await response.json();
      if (resData && resData.success) {
        clearPendingTargetAllocations();
        return {
          success: true,
          targetAllocations: resData.targetAllocations || targetAllocations,
        };
      }
    }
  } catch (err) {
    console.warn('[Transactional Allocations Server Notice] Server unreachable, using direct cloud sync:', err);
  }

  // Fallback: Direct Appwrite document update
  try {
    const cloudDoc = await loadFromCloud();
    const fullPayload = {
      ...(cloudDoc || {}),
      targetAllocations,
      updatedAt: new Date().toISOString(),
    };

    const saved = await saveAppData(fullPayload);
    if (saved) {
      clearPendingTargetAllocations();
      return { success: true, targetAllocations };
    }
    return { success: false };
  } catch (err) {
    console.error('[Direct Allocations Sync Error]', err);
    return { success: false };
  }
}

// --- TRANSACTIONAL BUDGET GOALS (50/30/20 STRATEGY) ---

let pendingBudgetGoals: { goals: { essentials: number; lifestyle: number; investment: number }; timestamp: number } | null = null;

export function recordPendingBudgetGoals(goals: { essentials: number; lifestyle: number; investment: number }): void {
  pendingBudgetGoals = {
    goals: {
      essentials: Number(goals.essentials) || 50,
      lifestyle: Number(goals.lifestyle) || 30,
      investment: Number(goals.investment) || 20,
    },
    timestamp: Date.now(),
  };
}

export function clearPendingBudgetGoals(): void {
  pendingBudgetGoals = null;
}

export function mergeRemoteBudgetGoalsWithOptimistic(
  remoteGoals: { essentials?: number; lifestyle?: number; investment?: number } | null | undefined
): { essentials: number; lifestyle: number; investment: number } {
  if (pendingBudgetGoals) {
    const age = Date.now() - pendingBudgetGoals.timestamp;
    if (age < 15000) {
      return pendingBudgetGoals.goals;
    }
    pendingBudgetGoals = null;
  }

  if (
    remoteGoals &&
    typeof remoteGoals.essentials === 'number' &&
    typeof remoteGoals.lifestyle === 'number' &&
    typeof remoteGoals.investment === 'number'
  ) {
    return {
      essentials: remoteGoals.essentials,
      lifestyle: remoteGoals.lifestyle,
      investment: remoteGoals.investment,
    };
  }

  return { essentials: 50, lifestyle: 30, investment: 20 };
}

/**
 * Atomic Server & Cloud Transaction for Budget Goals (50/30/20 Strategy)
 */
export async function executeTransactionalBudgetGoals(
  userId: string,
  budgetGoals: { essentials: number; lifestyle: number; investment: number }
): Promise<{ success: boolean; budgetGoals?: { essentials: number; lifestyle: number; investment: number } }> {
  const sanitized = {
    essentials: Number(budgetGoals.essentials) || 50,
    lifestyle: Number(budgetGoals.lifestyle) || 30,
    investment: Number(budgetGoals.investment) || 20,
  };

  recordPendingBudgetGoals(sanitized);

  // Primary: Server atomic transactional endpoint
  try {
    const response = await fetch('/api/financials/transactional-budget-goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        budgetGoals: sanitized,
      }),
    });

    if (response.ok) {
      const resData = await response.json();
      if (resData && resData.success) {
        clearPendingBudgetGoals();
        return {
          success: true,
          budgetGoals: resData.budgetGoals || sanitized,
        };
      }
    }
  } catch (err) {
    console.warn('[Transactional Budget Goals Server Notice] Server unreachable, using direct cloud sync:', err);
  }

  // Fallback: Direct Appwrite document update (Document ID: '6a849358002db9e638ce')
  try {
    const cloudDoc = await loadFromCloud();
    const fullPayload = {
      ...(cloudDoc || {}),
      budgetGoals: sanitized,
      budgetStrategy: sanitized,
      updatedAt: new Date().toISOString(),
    };

    const saved = await saveAppData(fullPayload);
    if (saved) {
      clearPendingBudgetGoals();
      return { success: true, budgetGoals: sanitized };
    }
    return { success: false };
  } catch (err) {
    console.error('[Direct Budget Goals Sync Error]', err);
    return { success: false };
  }
}

// --- TRANSACTIONAL GAMIFICATION MANAGER (OPTIMISTIC UI WITH 0ms FEEDBACK & REALTIME) ---

let pendingGamificationState: any = null;
let pendingGamificationTimestamp = 0;
const GAMIFICATION_PENDING_TTL_MS = 15000;

export function recordPendingGamification(state: any) {
  pendingGamificationState = state ? JSON.parse(JSON.stringify(state)) : null;
  pendingGamificationTimestamp = Date.now();
}

export function clearPendingGamification() {
  pendingGamificationState = null;
  pendingGamificationTimestamp = 0;
}

export function mergeRemoteGamificationWithOptimistic(remoteGamif: any, userId?: string): any {
  if (!remoteGamif || typeof remoteGamif !== 'object') {
    if (pendingGamificationState && Date.now() - pendingGamificationTimestamp < GAMIFICATION_PENDING_TTL_MS) {
      return pendingGamificationState;
    }
    return null;
  }

  // If we have a very recent pending local gamification action (e.g. check-in, shop buy, quest claim), prioritize optimistic state
  if (pendingGamificationState && Date.now() - pendingGamificationTimestamp < GAMIFICATION_PENDING_TTL_MS) {
    const remoteTime = remoteGamif.updatedAt ? new Date(remoteGamif.updatedAt).getTime() : 0;
    if (remoteTime && remoteTime > pendingGamificationTimestamp) {
      clearPendingGamification();
      return remoteGamif;
    }
    return pendingGamificationState;
  }

  return remoteGamif;
}

/**
 * Executes an atomic server transaction and direct cloud update for the entire Gamification ecosystem.
 * Supports GamificationProfile (xp, gems, weeklyStreak, inventory, claimedMissions) and WeeklyGamificationState.
 */
export async function executeTransactionalGamification(
  userId: string,
  state: any,
  profile?: any
): Promise<{ success: boolean; state?: any; profile?: any }> {
  if (!userId || (!state && !profile)) {
    return { success: false };
  }

  const nowIso = new Date().toISOString();
  const xpVal = Number(state?.xpTotal ?? profile?.xp) || 0;
  const gemsVal = Number(state?.gems ?? profile?.gems) || 0;
  const streakVal = Number(state?.weeklyStreakCount ?? profile?.weeklyStreak) || 0;
  const freezesVal = Number(state?.streakFreezeCount ?? state?.inventory?.freezes ?? profile?.inventory?.freezes) || 0;
  const doubleXpVal = state?.inventory?.doubleXpActiveUntil ?? profile?.inventory?.doubleXpActiveUntil ?? null;
  const claimedMissionsVal = Array.isArray(state?.claimedMissions)
    ? state.claimedMissions
    : Array.isArray(profile?.claimedMissions)
    ? profile.claimedMissions
    : (state?.weeklyQuests || []).filter((q: any) => q.completed).map((q: any) => q.id);

  const gamificationProfile = {
    xp: xpVal,
    gems: gemsVal,
    weeklyStreak: streakVal,
    inventory: {
      freezes: freezesVal,
      doubleXpActiveUntil: doubleXpVal,
    },
    claimedMissions: claimedMissionsVal,
  };

  const sanitizedState = {
    ...(state || {}),
    userId,
    xpTotal: xpVal,
    gems: gemsVal,
    weeklyStreakCount: streakVal,
    streakFreezeCount: freezesVal,
    inventory: gamificationProfile.inventory,
    claimedMissions: claimedMissionsVal,
    updatedAt: nowIso,
  };

  recordPendingGamification(sanitizedState);

  // 1. Primary: Server atomic transactional endpoint
  try {
    const response = await fetch('/api/financials/transactional-gamification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        state: sanitizedState,
        profile: gamificationProfile,
      }),
    });

    if (response.ok) {
      const resData = await response.json();
      if (resData && resData.success) {
        clearPendingGamification();
        return {
          success: true,
          state: resData.state || sanitizedState,
          profile: resData.profile || gamificationProfile,
        };
      }
    }
  } catch (err) {
    console.warn('[Transactional Gamification Server Notice] Server unreachable, using direct cloud sync:', err);
  }

  // 2. Fallback: Direct Appwrite document update (Document ID: '6a849358002db9e638ce')
  try {
    const cloudDoc = await loadFromCloud();
    const fullPayload = {
      ...(cloudDoc || {}),
      gamificationProfile: gamificationProfile,
      gamificationState: sanitizedState,
      gamification: sanitizedState,
      updatedAt: nowIso,
    };

    const saved = await saveAppData(fullPayload);
    if (saved) {
      clearPendingGamification();
      return {
        success: true,
        state: sanitizedState,
        profile: gamificationProfile,
      };
    }
    return { success: false };
  } catch (err) {
    console.error('[Direct Gamification Sync Error]', err);
    return { success: false };
  }
}

export async function forceEmailSync(): Promise<void> {
  // No-op (email column abandoned in favor of userId)
}

export async function syncUserEmailToDatabase(_userAccount: any): Promise<void> {
  // No-op (email column abandoned in favor of userId)
}

export async function findUserAccount(emailDigitado: string): Promise<any | null> {
  const emailLimpo = String(emailDigitado || '').toLowerCase().trim();
  if (!emailLimpo) return null;
  const databaseId = '6a83aa8d0038331e040f';
  const collectionId = 'user_financials';

  try {
    // Camada 1: Busca primária pela coluna userId
    let response = await appwriteDatabases.listDocuments(
      databaseId,
      collectionId,
      [Query.equal('userId', emailLimpo)]
    );
    if (response && response.total > 0) return response.documents[0];

    // Camada 2: Busca direta pela Key (ID do Documento)
    try {
      const docId = getCanonicalAppwriteDocId(emailLimpo);
      const doc = await appwriteDatabases.getDocument(databaseId, collectionId, docId);
      if (doc) return doc;
    } catch (fallbackError: any) {
      console.log("Fallback direto falhou:", fallbackError.message);
    }

    return null;
  } catch (error: any) {
    console.error("[ERRO NATIVO APPWRITE] findUserAccount:", error);
    return null;
  }
}





