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

/**
 * Função de Atualização Direta (Update Cloud) para o documento específico 6a849358002db9e638ce com tratamento resiliente de rede
 */
export async function syncAppDataToCloud(appData: any): Promise<boolean> {
  const databaseId = '6a83aa8d0038331e040f';
  const collectionId = 'user_financials';
  const documentId = '6a849358002db9e638ce';
  const userId = '6a83b38ed065c08efa49';

  const payload = {
    userId: userId,
    data: JSON.stringify(appData),
    updatedAt: new Date().toISOString()
  };

  try {
    await appwriteDatabases.updateDocument(databaseId, collectionId, documentId, payload);
    console.log('[Appwrite Sync] Dados gravados na nuvem com sucesso!');
    return true;
  } catch (error: any) {
    const isNetworkError = error?.message?.includes('Failed to fetch') || error?.name === 'TypeError' || error?.code === 0;
    if (isNetworkError) {
      console.warn('[Appwrite Network Notice] Appwrite offline or unreachable. Using local storage.');
      return false;
    }
    if (error?.code === 404 || error?.message?.includes('not found') || error?.type === 'document_not_found') {
      try {
        await appwriteDatabases.createDocument(databaseId, collectionId, documentId, payload);
        console.log('[Appwrite Sync] Documento criado na nuvem com sucesso!');
        return true;
      } catch (createErr) {}
    }
    console.warn('[Appwrite Sync Notice]', error?.message || error);
    return false;
  }
}

/**
 * Função Universal de Salvar na Nuvem (`saveToCloud`)
 */
export async function saveToCloud(userId: string, appData: any): Promise<boolean> {
  return await syncAppDataToCloud(appData);
}

/**
 * Syncs user financial data to Cloud Appwrite databases (alias for saveToCloud).
 */
export async function syncUserDataWithAppwrite(userId: string, data: any): Promise<boolean> {
  return await saveToCloud(userId, data);
}

/**
 * Carrega diretamente do documento específico da nuvem com tratamento resiliente de rede
 */
export async function loadFromCloud(): Promise<any | null> {
  const databaseId = '6a83aa8d0038331e040f';
  const collectionId = 'user_financials';
  const documentId = '6a849358002db9e638ce';

  try {
    const fetchPromise = appwriteDatabases.getDocument(databaseId, collectionId, documentId);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
    const doc: any = await Promise.race([fetchPromise, timeoutPromise]);

    if (doc && doc.data && doc.data !== '{}') {
      const parsed = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
      console.log('[Appwrite Load Success] Dados carregados da nuvem');
      try {
        localStorage.setItem('cached_app_data', JSON.stringify(parsed));
      } catch {}
      return parsed;
    }
  } catch (error: any) {
    const isNetworkError = error?.message?.includes('Failed to fetch') || error?.name === 'TypeError' || error?.code === 0 || error?.message === 'Timeout';
    if (isNetworkError) {
      console.warn('[Appwrite Network Notice] Appwrite offline, unreachable or slow. Using local storage instantly.');
    } else {
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
    const cloudData = await loadFromCloud();
    if (cloudData) {
      if (applyCloudData) {
        applyCloudData(cloudData);
      }
      return cloudData;
    } else {
      const localData = localDataCollector ? localDataCollector() : { accounts: [], transactions: [], goals: [], categories: [], familyMembers: [] };
      await syncAppDataToCloud(localData);
      if (applyCloudData) {
        applyCloudData(localData);
      }
      return localData;
    }
  } catch (err: any) {
    const localData = localDataCollector ? localDataCollector() : { accounts: [], transactions: [], goals: [], categories: [], familyMembers: [] };
    await syncAppDataToCloud(localData);
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
  return await loadFromCloud();
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

export async function saveAppData(updatedData: any): Promise<boolean> {
  try {
    const payloadData = {
      transactions: updatedData.transactions || [],
      accounts: updatedData.accounts || [],
      familyBudget: updatedData.familyBudget || [],
      investorPortfolio: updatedData.investorPortfolio || [],
      investmentTransactions: updatedData.investmentTransactions || [],
      goals: updatedData.goals || [],
      investorGoals: updatedData.investorGoals || updatedData.goals || [],
      updatedAt: new Date().toISOString()
    };

    const payload = {
      userId: '6a83b38ed065c08efa49',
      data: JSON.stringify(payloadData)
    };

    try {
      await appwriteDatabases.updateDocument(
        '6a83aa8d0038331e040f',
        'user_financials',
        '6a849358002db9e638ce',
        payload
      );
    } catch (err: any) {
      if (err?.code === 404 || err?.message?.includes('not found') || err?.type === 'document_not_found') {
        await appwriteDatabases.createDocument(
          '6a83aa8d0038331e040f',
          'user_financials',
          '6a849358002db9e638ce',
          payload
        );
      } else {
        throw err;
      }
    }
    console.log('[Appwrite] Dados sincronizados com sucesso na nuvem!');
    return true;
  } catch (error: any) {
    console.error('[Appwrite Error ao salvar]', error);
    return false;
  }
}

export async function persistCurrentStateToAppwrite(state: any): Promise<boolean> {
  return await saveAppData(state);
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
      userId: '6a83b38ed065c08efa49',
      data: JSON.stringify(portfolioData),
      updatedAt: new Date().toISOString(),
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
