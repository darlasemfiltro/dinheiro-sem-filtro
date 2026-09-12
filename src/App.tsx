import React, { useState, useEffect, useRef } from 'react';
// Last deployment sync: 2026-08-25T17:05:00Z - anti-crash and decoupled auth enforced
import { User, Account, Category, Transaction, Goal, FamilyMember, Subcategory } from './types';
import { StorageService, SEED_CATEGORIES } from './services/storage';
import { PortfolioStorageService } from './services/portfolioStorage';
import { realtimeSync } from './services/websocket';
import { subscribeToAppwriteRealtime, getAppwriteUser, appwriteCompleteOAuthSession, appwriteSignOut, appwriteDatabases as databases, appwriteClient as client, getAppwriteConfig, account } from './lib/appwrite';
import { Query } from 'appwrite';
import {
  saveAppData,
  persistCurrentStateToAppwrite,
  loadFromCloud,
  executeTransactionalGoal,
  mergeRemoteGoalsWithOptimistic,
  recordGoalDeletion,
  executeTransactionalStructure,
  recordPendingCategoryMutation,
  mergeRemoteCategoriesWithOptimistic,
  mergeRemoteMembersWithOptimistic,
  recordCategoryDeletion,
  recordMemberDeletion,
  executeTransactionalInvestmentTransaction,
  mergeRemoteInvestmentTransactionsWithOptimistic,
  recordInvestmentTxDeletion,
  mergeRemoteTargetAllocationsWithOptimistic,
  mergeRemoteBudgetGoalsWithOptimistic,
  mergeRemoteGamificationWithOptimistic,
  syncUserEmailToDatabase,
  getCanonicalAppwriteDocId,
  executeTransactionalInvestmentGoal,
} from './lib/appwriteSync';
import {
  calculateMonthSummary,
  calculateAccountBalances,
  usePrivacyMode,
  addSubcategoryToTree,
  deleteSubcategoryFromTree,
  renameSubcategoryInTree,
} from './utils/finance';
import { CustomAlertModal } from './components/CustomAlertModal';
import { AuthScreen } from './components/AuthScreen';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { DashboardView } from './components/DashboardView';
import { TransactionsView } from './components/TransactionsView';
import { AccountsView } from './components/AccountsView';
import { CategoriesView } from './components/CategoriesView';
import { GoalsView } from './components/GoalsView';
import { ReportsView } from './components/ReportsView';
import { PlansAndPricingView } from './components/PlansAndPricingView';
import { GamificationView } from './components/GamificationView';
import { FinancialCalculatorView } from './components/FinancialCalculatorView';
import { PortfolioView } from './components/PortfolioView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AiTipsView } from './components/AiTipsView';
import { GamificationService } from './services/gamification';
import { TransactionModal } from './components/TransactionModal';

import { EditProfileModal } from './components/EditProfileModal';
import { SharedBudgetModal } from './components/SharedBudgetModal';
import { CriticalActionsModal } from './components/CriticalActionsModal';
import { FeatureLockModal } from './components/FeatureLockModal';
import { TrialCountdownWidget } from './components/TrialCountdownWidget';
import { BudgetSubNav } from './components/BudgetSubNav';
import { AppwriteSettingsModal } from './components/AppwriteSettingsModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { Heart, CheckCircle2, RefreshCw, ShieldAlert, AlertTriangle, Check, X, Cloud } from 'lucide-react';

export default function App() {
  const isPrivacyActive = usePrivacyMode();
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const currentEffectiveBudgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
  const lastBudgetSwitch = (currentUser as any)?.lastBudgetSwitch || 0;
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem('app_active_tab') || 'dashboard';
  });
  const [permissionVersion, setPermissionVersion] = useState<number>(() => {
    return Number(localStorage.getItem('app_permission_version') || '0');
  });

  // App Zoom State (Requirement: Zoom controls adjusting layout between 50% and 200%)
  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    const saved = localStorage.getItem('app_zoom_level');
    return saved ? Math.min(200, Math.max(50, Number(saved))) : 100;
  });

  const handleZoomChange = (newZoom: number) => {
    const clamped = Math.min(200, Math.max(50, Math.round(newZoom)));
    setZoomLevel(clamped);
    localStorage.setItem('app_zoom_level', clamped.toString());
  };

  useEffect(() => {
    // Ensure document element remains at standard 100% scale
    (document.documentElement.style as any).zoom = '100%';
  }, []);

  // Modal States
  const [recoveryTokens, setRecoveryTokens] = useState<{ userId: string; secret: string } | null>(null);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isCriticalActionsModalOpen, setIsCriticalActionsModalOpen] = useState(false);
  const [isFeatureLockModalOpen, setIsFeatureLockModalOpen] = useState(false);
  const [featureLockTitle, setFeatureLockTitle] = useState('');
  const [featureLockDesc, setFeatureLockDesc] = useState('');
  const [globalAlert, setGlobalAlert] = useState<{
    isOpen: boolean;
    message: string;
    title?: string;
    type?: 'success' | 'error' | 'warning' | 'info' | 'confirm';
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
  } | null>(null);

  const [installmentPrompt, setInstallmentPrompt] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'warning' | 'delete';
    buttons: Array<{ label: string; onClick: () => void; variant?: 'secondary' | 'primary' | 'danger' }>;
  } | null>(null);

  const promptInstallmentAction = (
    title: string,
    message: string,
    includeExit = true,
    alertType: 'warning' | 'delete' = 'warning'
  ): Promise<'single' | 'all' | 'from_this' | 'exit'> => {
    return new Promise((resolve) => {
      const buttons: Array<{ label: string; onClick: () => void; variant?: 'secondary' | 'primary' | 'danger' }> = [
        {
          label: 'Apenas este',
          onClick: () => {
            setInstallmentPrompt(null);
            resolve('single');
          },
          variant: 'secondary',
        },
        {
          label: 'A partir deste',
          onClick: () => {
            setInstallmentPrompt(null);
            resolve('from_this');
          },
          variant: 'secondary',
        },
        {
          label: 'Todos da série',
          onClick: () => {
            setInstallmentPrompt(null);
            resolve('all');
          },
          variant: 'primary',
        },
      ];

      if (includeExit) {
        buttons.push({
          label: 'Sair',
          onClick: () => {
            setInstallmentPrompt(null);
            resolve('exit');
          },
          variant: 'secondary',
        });
      }

      setInstallmentPrompt({
        isOpen: true,
        title,
        message,
        type: alertType,
        buttons,
      });
    });
  };

  // Month / Year Navigation
  const now = new Date();
  const [currentYear, setCurrentYear] = useState<number>(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(now.getMonth() + 1);

  // Data Collections (Synchronous initial read from storage)
  const [accounts, setAccounts] = useState<Account[]>(() => {
    const user = StorageService.getCurrentUser();
    const bId = user ? StorageService.getEffectiveBudgetId(user) : '';
    return bId ? StorageService.getAccounts(bId) : [];
  });
  const [categories, setCategories] = useState<Category[]>(() => {
    const user = StorageService.getCurrentUser();
    const bId = user ? StorageService.getEffectiveBudgetId(user) : '';
    return bId ? StorageService.getCategories(bId) : [];
  });
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const user = StorageService.getCurrentUser();
    const bId = user ? StorageService.getEffectiveBudgetId(user) : '';
    return bId ? StorageService.getTransactions(bId) : [];
  });
  const [investmentTransactions, setInvestmentTransactions] = useState<any[]>(() => {
    const user = StorageService.getCurrentUser();
    const portfolioUserId = user ? (user.email || user.id || 'default') : 'default';
    return portfolioUserId ? PortfolioStorageService.getTransactions(portfolioUserId) : [];
  });
  const [financialGoals, setFinancialGoals] = useState<Goal[]>(() => {
    const user = StorageService.getCurrentUser();
    const bId = user ? StorageService.getEffectiveBudgetId(user) : '';
    return bId ? StorageService.getGoals(bId) : [];
  });
  const [investmentGoals, setInvestmentGoals] = useState<any[]>(() => {
    const user = StorageService.getCurrentUser();
    const portfolioUserId = user ? (user.email || user.id || 'default') : 'default';
    return portfolioUserId ? PortfolioStorageService.getGoals(portfolioUserId) : [];
  });
  const goals = financialGoals;
  const setGoals = setFinancialGoals;
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(() => {
    const user = StorageService.getCurrentUser();
    const bId = user ? StorageService.getEffectiveBudgetId(user) : '';
    return bId ? StorageService.getFamilyMembers(bId) : [];
  });

  const [budgets, setBudgets] = useState<any[]>(() => StorageService.deduplicateSharedBudgets());

  const [persistentInvites, setPersistentInvites] = useState<any[]>([]);
  const [loadingInviteId, setLoadingInviteId] = useState<string | null>(null);

  // Transaction Modal State
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Sync Progress State & Notifications
  type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [syncProgress, setSyncProgress] = useState<number | null>(null);
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);
  const [syncErrorPopupMessage, setSyncErrorPopupMessage] = useState<string | null>(null);

  // Security Concurrency & Logout Safety Modals
  const [sessionRevokedModalOpen, setSessionRevokedModalOpen] = useState(false);
  const [isAppwriteModalOpen, setIsAppwriteModalOpen] = useState(false);
  const [isSharedBudgetModalOpen, setIsSharedBudgetModalOpen] = useState(false);

  const isSyncingRemoteRef = useRef(false);
  const isFetchingRef = useRef(false);
  const isResettingRef = useRef(false);
  const hasPendingRefreshRef = useRef(false);
  const lastSyncTimeRef = useRef(0);
  const isInitialLoadComplete = useRef(false);

  useEffect(() => {
    const handleSyncError = (e: any) => {
      const msg = e?.detail || 'Não foi possível sincronizar os dados no momento. Verifique sua conexão.';
      setSyncErrorPopupMessage(msg);
    };
    window.addEventListener('sync-error', handleSyncError);

    const handleAppToast = (e: any) => {
      const msg = e?.detail || 'Operação realizada com sucesso!';
      setSyncToastMessage(msg);
      setTimeout(() => setSyncToastMessage(null), 3000);
    };
    window.addEventListener('app-toast', handleAppToast);

    const handleAppAlert = (e: any) => {
      const detail = e?.detail;
      const message = typeof detail === 'string' ? detail : detail?.message || 'Aviso';
      const title = detail?.title;
      const onOk = detail?.onOk;
      setGlobalAlert({
        isOpen: true,
        message,
        title,
        type: 'info',
        onConfirm: onOk
      });
    };
    window.addEventListener('app-alert', handleAppAlert as EventListener);

    const handleAppConfirm = (e: any) => {
      const detail = e?.detail;
      const message = detail?.message || 'Tem certeza?';
      const title = detail?.title;
      const onConfirm = detail?.onConfirm;
      const confirmText = detail?.confirmText || 'Sim';
      const cancelText = detail?.cancelText || 'Não';
      setGlobalAlert({
        isOpen: true,
        message,
        title,
        type: 'confirm',
        confirmText,
        cancelText,
        onConfirm
      });
    };
    window.addEventListener('app-confirm', handleAppConfirm as EventListener);

    return () => {
      window.removeEventListener('sync-error', handleSyncError);
      window.removeEventListener('app-toast', handleAppToast);
      window.removeEventListener('app-alert', handleAppAlert as EventListener);
      window.removeEventListener('app-confirm', handleAppConfirm as EventListener);
    };
  }, []);

  const loadInvites = async () => {
    try {
      const userEmail = currentUser?.email?.toLowerCase()?.trim();
      if (!userEmail) return;
      const cfg = getAppwriteConfig();
      const DATABASE_ID = cfg.databaseId;
      
      let pending: any[] = [];
      try {
        const res = await databases.listDocuments(
          DATABASE_ID,
          'user_financials',
          [Query.equal('userId', userEmail)]
        );
        if (res.documents.length > 0 && res.documents[0].data) {
          const parsed = typeof res.documents[0].data === 'string' ? JSON.parse(res.documents[0].data) : res.documents[0].data;
          pending = parsed.pedidos_acesso || parsed.pending_invites || [];
        }
      } catch (e1) {
        const docId = getCanonicalAppwriteDocId(userEmail);
        const doc = await databases.getDocument(DATABASE_ID, 'user_financials', docId);
        if (doc && doc.data) {
          const parsed = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
          pending = parsed.pedidos_acesso || parsed.pending_invites || [];
        }
      }

      if (Array.isArray(pending) && pending.length > 0) {
        setPersistentInvites(pending);
      }
    } catch (err) {
      console.warn('[loadInvites error]', err);
    }
  };

  useEffect(() => {
    if (currentUser?.email) {
      loadInvites();
    }
  }, [currentUser?.email]);

  const handleAcceptInvite = async (invite: any) => {
    if (!currentUser) return;
    const inviteKey = invite.id || invite.budget_owner_id;
    setLoadingInviteId(inviteKey);
    try {
      const cfg = getAppwriteConfig();
      const DATABASE_ID = cfg.databaseId;
      
      const emailLimpo = String(currentUser.email).toLowerCase().trim();
      const docIdCorreto = getCanonicalAppwriteDocId(currentUser.email) || ('user_' + emailLimpo.replace('@', '_').replace(/\./g, '_'));

      const inviteType = invite.type || 'INVITE';

      if (inviteType === 'INVITE') {
        const docAtualizado = await databases.getDocument(DATABASE_ID, 'user_financials', docIdCorreto);
        let parsed = docAtualizado && docAtualizado.data ? (typeof docAtualizado.data === 'string' ? JSON.parse(docAtualizado.data) : docAtualizado.data) : {};

        parsed.active_budget_owner = invite.owner_budget_id;
        const existingInvites = parsed.pedidos_acesso || parsed.pending_invites || [];
        parsed.pedidos_acesso = existingInvites.filter((inv: any) => inv.id !== invite.id && inv.budget_owner_id !== invite.budget_owner_id);

        const newDataString = JSON.stringify(parsed);

        await databases.updateDocument(
          DATABASE_ID,
          'user_financials',
          docIdCorreto,
          { userId: currentUser.email, data: newDataString }
        );

        try {
          const ownerDocId = invite.owner_budget_id;
          const ownerDoc = await databases.getDocument(DATABASE_ID, 'user_financials', ownerDocId);
          let ownerParsed = ownerDoc && ownerDoc.data ? (typeof ownerDoc.data === 'string' ? JSON.parse(ownerDoc.data) : ownerDoc.data) : {};
          if (!Array.isArray(ownerParsed.shared_members)) {
            ownerParsed.shared_members = [];
          }
          if (!ownerParsed.shared_members.some((m: string) => m.toLowerCase() === currentUser.email.toLowerCase())) {
            ownerParsed.shared_members.push(currentUser.email.toLowerCase().trim());
          }
          if (!Array.isArray(ownerParsed.allowed_users)) {
            ownerParsed.allowed_users = [];
          }
          if (!ownerParsed.allowed_users.some((m: string) => m.toLowerCase() === currentUser.email.toLowerCase())) {
            ownerParsed.allowed_users.push(currentUser.email.toLowerCase().trim());
          }
          await databases.updateDocument(
            DATABASE_ID,
            'user_financials',
            ownerDocId,
            { userId: ownerDoc.userId || ownerDocId, data: JSON.stringify(ownerParsed) }
          );
        } catch (ownerErr) {
          console.warn('[Owner shared_members update error]', ownerErr);
        }

        setPersistentInvites(prev => prev.filter(i => i.id !== invite.id && i.budget_owner_id !== invite.budget_owner_id));

        const updatedUser: User = {
          ...currentUser,
          budgetId: invite.owner_budget_id
        };
        localStorage.setItem('darla_current_user', JSON.stringify(updatedUser));
        setCurrentUser(updatedUser);
        refreshData(updatedUser);

        window.dispatchEvent(new CustomEvent('notifications_updated'));
        window.dispatchEvent(new Event('remote_data_updated'));
        window.dispatchEvent(new CustomEvent('app-alert', {
          detail: {
            message: 'Convite aceito com sucesso! O orçamento compartilhado foi ativado.',
            onOk: () => window.location.reload()
          }
        }));

      } else {
        const emailMembro = (invite.emailRemetente || invite.from || invite.email || invite.remetente || invite.from_email || '').toLowerCase().trim();
        if (!emailMembro) {
          setLoadingInviteId(null);
          window.dispatchEvent(new CustomEvent('app-alert', { detail: { message: "[ERRO] Falha ao extrair e-mail do convite." } }));
          return;
        }

        const doc = await databases.getDocument(DATABASE_ID, 'user_financials', docIdCorreto);
        const json = doc.data ? (typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data) : {};

        let membrosAtivos = Array.isArray(json.allowed_users) ? [...json.allowed_users] : [];
        if (!membrosAtivos.includes(emailMembro)) {
            membrosAtivos.push(emailMembro);
        }
        json.allowed_users = membrosAtivos;

        let sharedMembers = Array.isArray(json.shared_members) ? [...json.shared_members] : [];
        if (!sharedMembers.includes(emailMembro)) {
            sharedMembers.push(emailMembro);
        }
        json.shared_members = sharedMembers;

        json.pedidos_acesso = (json.pedidos_acesso || json.pending_invites || []).filter((p: any) => {
            const mail = (p.emailRemetente || p.from || p.email || p.remetente || p.from_email || '').toLowerCase().trim();
            return mail !== emailMembro && p.id !== invite.id;
        });

        await databases.updateDocument(DATABASE_ID, 'user_financials', docIdCorreto, { userId: currentUser.email, data: JSON.stringify(json) });

        const docIdConvidado = getCanonicalAppwriteDocId(emailMembro) || ('user_' + emailMembro.replace('@', '_').replace(/\./g, '_'));
        try {
            const docConvidado = await databases.getDocument(DATABASE_ID, 'user_financials', docIdConvidado);
            const jsonConvidado = docConvidado.data ? (typeof docConvidado.data === 'string' ? JSON.parse(docConvidado.data) : docConvidado.data) : {};
            
            const orcamentosConectados = Array.isArray(jsonConvidado.shared_with_me) ? [...jsonConvidado.shared_with_me] : [];
            if (!orcamentosConectados.includes(currentUser.email)) {
                orcamentosConectados.push(currentUser.email);
            }
            jsonConvidado.shared_with_me = orcamentosConectados;
            
            await databases.updateDocument(DATABASE_ID, 'user_financials', docIdConvidado, { userId: emailMembro, data: JSON.stringify(jsonConvidado) });
        } catch (err) {
            console.warn("Convidado ainda não possui documento inicializado.", err);
        }

        window.dispatchEvent(new CustomEvent('app-alert', {
          detail: {
            message: `Sucesso! ${emailMembro} agora tem acesso ao seu orçamento.`,
            onOk: () => window.location.reload()
          }
        }));
      }
    } catch (error: any) {
      window.dispatchEvent(new CustomEvent('app-alert', { detail: { message: `[ERRO NO ACEITE] ${error.message || error}` } }));
      console.error(error);
    } finally {
      setLoadingInviteId(null);
    }
  };

  const handleRejectInvite = async (invite: any) => {
    if (!currentUser) return;
    const inviteKey = invite.id || invite.budget_owner_id;
    setLoadingInviteId(inviteKey);
    try {
      const cfg = getAppwriteConfig();
      const DATABASE_ID = cfg.databaseId;
      const docId = getCanonicalAppwriteDocId(currentUser.email);

      const doc = await databases.getDocument(DATABASE_ID, 'user_financials', docId);
      let parsed = doc && doc.data ? (typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data) : {};

      const existingInvites = parsed.pedidos_acesso || parsed.pending_invites || [];
      parsed.pedidos_acesso = existingInvites.filter((inv: any) => inv.id !== invite.id && inv.budget_owner_id !== invite.budget_owner_id && inv.from_email !== invite.from_email && inv.emailRemetente !== invite.emailRemetente);

      await databases.updateDocument(
        DATABASE_ID,
        'user_financials',
        docId,
        { userId: currentUser.email, data: JSON.stringify(parsed) }
      );

      setPersistentInvites(prev => prev.filter(i => i.id !== invite.id && i.budget_owner_id !== invite.budget_owner_id && i.from_email !== invite.from_email && i.emailRemetente !== invite.emailRemetente));
      window.dispatchEvent(new CustomEvent('app-alert', { detail: { message: 'Solicitação/convite recusado com sucesso.' } }));
    } catch (err: any) {
      console.error('Erro ao recusar:', err);
    } finally {
      setLoadingInviteId(null);
    }
  };

  useEffect(() => {
    // Carga inicial isolada para evitar flickering e race conditions
    async function fetchInitialData() {
      try {
        if (sessionStorage.getItem('IS_PERFORMING_RESET') === 'true') {
          sessionStorage.removeItem('IS_PERFORMING_RESET');
          setTransactions([]);
          const user = StorageService.getCurrentUser();
          const effectiveBudgetId = user ? StorageService.getEffectiveBudgetId(user) : 'default';
          const freshAccs = [{ id: 'default', userId: effectiveBudgetId, name: 'Conta Principal', initialBalance: 0, color: '#4F46E5', icon: 'Wallet', type: 'checking' as const }];
          setAccounts(freshAccs);
          StorageService.setTransactions([], effectiveBudgetId);
          StorageService.setAccounts(freshAccs, effectiveBudgetId);
          isInitialLoadComplete.current = true;
          return;
        }

        const user = StorageService.getCurrentUser();
        const effectiveBudgetId = user ? StorageService.getEffectiveBudgetId(user) : 'default';
        const remoteData = await loadFromCloud(effectiveBudgetId, user?.email);
        if (remoteData) {
          if (remoteData.transactions && Array.isArray(remoteData.transactions)) {
            setTransactions(remoteData.transactions);
            StorageService.setTransactions(remoteData.transactions, effectiveBudgetId);
          } else {
            setTransactions([]);
            StorageService.setTransactions([], effectiveBudgetId);
          }
          if (remoteData.accounts && Array.isArray(remoteData.accounts)) {
            setAccounts(remoteData.accounts);
            StorageService.setAccounts(remoteData.accounts, effectiveBudgetId);
          } else {
            const defaultAccs = [{ id: 'default', userId: effectiveBudgetId, name: 'Conta Principal', initialBalance: 0, color: '#4F46E5', icon: 'Wallet', type: 'checking' as const }];
            setAccounts(defaultAccs);
            StorageService.setAccounts(defaultAccs, effectiveBudgetId);
          }
          if (remoteData.budgets) {
            setBudgets(remoteData.budgets);
          }
          if (remoteData.familyBudget) {
            const goalsList = remoteData.familyBudget.filter((item: any) => item.targetAmount !== undefined || item.targetDate !== undefined);
            const familyList = remoteData.familyBudget.filter((item: any) => item.relationship !== undefined || (item.name && item.color && !item.targetAmount));
            if (goalsList.length > 0) {
              setGoals(goalsList);
            }
            if (familyList.length > 0) {
              setFamilyMembers(familyList);
            }
          }
          const bId = effectiveBudgetId;
          if (remoteData.investorPortfolio && Array.isArray(remoteData.investorPortfolio)) {
            PortfolioStorageService.saveAssets(remoteData.investorPortfolio, bId);
          }
          if (remoteData.assets && Array.isArray(remoteData.assets)) {
            PortfolioStorageService.saveAssets(remoteData.assets, bId);
          }
          if (remoteData.investments && Array.isArray(remoteData.investments)) {
            PortfolioStorageService.saveAssets(remoteData.investments, bId);
          }
          const incomingInvGoals = remoteData.investmentGoals || remoteData.investorGoals;
          if (incomingInvGoals && Array.isArray(incomingInvGoals)) {
            PortfolioStorageService.saveGoals(incomingInvGoals, bId);
          }
          const investmentsFromCloud = remoteData.investmentTransactions || remoteData.investments || [];
          console.log('[BOOT CLOUD] Ativos recuperados do Appwrite:', investmentsFromCloud);
          setInvestmentTransactions(investmentsFromCloud);
          localStorage.setItem('dsf_investments_cache', JSON.stringify(investmentsFromCloud));
          localStorage.setItem(`dsf_investments_cache_${effectiveBudgetId}`, JSON.stringify(investmentsFromCloud));

          const remoteInvTxs = investmentsFromCloud;
          if (remoteInvTxs.length > 0) {
            console.log(`[BOOT] Carregados ${remoteInvTxs.length} ativos do Appwrite.`);
          } else {
            console.warn('[BOOT] Nenhum ativo de investimento encontrado no JSON baixado do Appwrite.');
          }
          if (Array.isArray(remoteInvTxs)) {
            const mergedInvTxs = mergeRemoteInvestmentTransactionsWithOptimistic(remoteInvTxs);
            setInvestmentTransactions(mergedInvTxs);
            (PortfolioStorageService as any).saveToAllAliasKeys('darla_portfolio_transactions', bId, mergedInvTxs);
            localStorage.setItem('dsf_investments_cache', JSON.stringify(mergedInvTxs));
            localStorage.setItem(`dsf_investments_cache_${bId}`, JSON.stringify(mergedInvTxs));
          }
          if (remoteData.targetAllocations && Array.isArray(remoteData.targetAllocations)) {
            const mergedTargets = mergeRemoteTargetAllocationsWithOptimistic(remoteData.targetAllocations);
            (PortfolioStorageService as any).saveToAllAliasKeys('darla_target_allocations', bId, mergedTargets);
          }
          if (remoteData.budgetGoals || remoteData.budgetStrategy) {
            const incomingBudgetGoals = remoteData.budgetGoals || remoteData.budgetStrategy;
            const mergedBudgetGoals = mergeRemoteBudgetGoalsWithOptimistic(incomingBudgetGoals);
            StorageService.saveBudgetGoals(mergedBudgetGoals, bId);
            window.dispatchEvent(new CustomEvent('budget_goals_updated', { detail: { budgetGoals: mergedBudgetGoals } }));
          }
          window.dispatchEvent(new Event('portfolio_updated'));
        }
      } catch (err: any) {
        const isNetworkError = err?.message?.includes('Failed to fetch') || err?.name === 'TypeError';
        if (!isNetworkError) {
          console.warn('[Initial Load Notice]', err?.message || err);
        }
      } finally {
        isInitialLoadComplete.current = true;
      }
    }
    fetchInitialData();
  }, []);



  // Load User Data & Synchronize with Remote
  const refreshData = async (user: User | null, forceRemote: boolean = true) => {
    if (!user || isResettingRef.current) return;
    const budgetId = StorageService.getEffectiveBudgetId(user);
    if (!budgetId) return;

    if (isFetchingRef.current && forceRemote) {
      return;
    }
    isFetchingRef.current = true;

    // 1. Instant local read so UI responds immediately (0ms delay)
    const localAccounts = StorageService.getAccounts(budgetId);
    const localCategories = StorageService.getCategories(budgetId);
    const localTransactions = StorageService.getTransactions(budgetId);
    const localGoals = StorageService.getGoals(budgetId);
    const localFamily = StorageService.getFamilyMembers(budgetId);

    setAccounts(prev => JSON.stringify(prev) === JSON.stringify(localAccounts) ? prev : localAccounts);
    setCategories(prev => JSON.stringify(prev) === JSON.stringify(localCategories) ? prev : localCategories);
    setTransactions(prev => JSON.stringify(prev) === JSON.stringify(localTransactions) ? prev : localTransactions);
    setGoals(prev => JSON.stringify(prev) === JSON.stringify(localGoals) ? prev : localGoals);
    setFamilyMembers(prev => JSON.stringify(prev) === JSON.stringify(localFamily) ? prev : localFamily);

    const now = Date.now();
    const minCooldown = forceRemote ? 2000 : 1000;
    if (isSyncingRemoteRef.current || now - lastSyncTimeRef.current < minCooldown) {
      if (forceRemote) hasPendingRefreshRef.current = true;
      isFetchingRef.current = false;
      return;
    }
    isSyncingRemoteRef.current = true;
    lastSyncTimeRef.current = now;
    hasPendingRefreshRef.current = false;

    // 2. Synchronize with remote server with clean progress tracking
    try {
      if (forceRemote) {
        setSyncStatus('syncing');
        setPendingSyncCount(1);
        setSyncProgress(25);
        setSyncMessage('Sincronizando contas e transações...');
      }
      await StorageService.syncUserDataWithRemote(budgetId);

      if (forceRemote) {
        setSyncProgress(65);
        setSyncMessage('Sincronizando portfólio...');
      }
      await PortfolioStorageService.syncPortfolioWithRemote(budgetId).then(() =>
        PortfolioStorageService.loadPortfolioFromRemote(budgetId)
      );

      if (forceRemote) {
        setSyncProgress(85);
        setSyncMessage('Atualizando conquistas...');
      }
      await GamificationService.loadGamificationFromRemote(budgetId);
      if (user?.email) {
        await StorageService.syncSharedBudgetsWithServer(user.email);
      }

      if (forceRemote) {
        setSyncProgress(100);
        setSyncMessage('Tudo atualizado!');
      }
    } catch (e) {
      console.warn('[refreshData sync remote error]', e);
      if (forceRemote) {
        setSyncStatus('error');
        setSyncProgress(null);
      }
    } finally {
      isSyncingRemoteRef.current = false;
      isFetchingRef.current = false;
      if (forceRemote) setPendingSyncCount(0);

      // Re-read storage once remote sync finishes to capture any inbound changes & update state setters
      const newAccounts = StorageService.getAccounts(budgetId);
      const newCategories = StorageService.getCategories(budgetId);
      const newTransactions = StorageService.getTransactions(budgetId);
      const newGoals = StorageService.getGoals(budgetId);
      const newFamily = StorageService.getFamilyMembers(budgetId);

      setAccounts(prev => JSON.stringify(prev) === JSON.stringify(newAccounts) ? prev : newAccounts);
      setCategories(prev => JSON.stringify(prev) === JSON.stringify(newCategories) ? prev : newCategories);
      setTransactions(prev => JSON.stringify(prev) === JSON.stringify(newTransactions) ? prev : newTransactions);
      setGoals(prev => JSON.stringify(prev) === JSON.stringify(newGoals) ? prev : newGoals);
      setFamilyMembers(prev => JSON.stringify(prev) === JSON.stringify(newFamily) ? prev : newFamily);

      if (forceRemote) {
        // Guarantee synced status and success toast only AFTER data is fully loaded and setters executed
        setSyncStatus('synced');
        setSyncToastMessage('SINCRONIZAÇÃO CONCLUÍDA');

        setTimeout(() => {
          setSyncToastMessage(prev => (prev === 'SINCRONIZAÇÃO CONCLUÍDA' ? null : prev));
        }, 3800);

        setTimeout(() => {
          setSyncProgress(null);
        }, 1000);
      }

      if (hasPendingRefreshRef.current) {
        hasPendingRefreshRef.current = false;
        setTimeout(() => {
          refreshData(user, false);
        }, 100);
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      setIsAuthLoading(true);
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');

        const rUserId = searchParams.get('userId') || hashParams.get('userId');
        const rSecret = searchParams.get('secret') || hashParams.get('secret');

        if (rUserId && rSecret && !searchParams.has('code')) {
          setRecoveryTokens({ userId: rUserId, secret: rSecret });
          setIsResetPasswordOpen(true);
        }

        if (sessionStorage.getItem('FORCE_LOGIN_VIEW') === 'true') {
          sessionStorage.removeItem('FORCE_LOGIN_VIEW');
          if (mounted) {
            setCurrentUser(null);
            setIsAuthLoading(false);
          }
          return;
        }

        const isExplicitLogout = localStorage.getItem('darla_explicit_logout') === 'true';
        if (isExplicitLogout) {
          if (mounted) {
            setCurrentUser(null);
            setIsAuthLoading(false);
          }
          return;
        }

        // Retry logic for OAuth redirect session settling
        let session = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            session = await account.get();
            if (session && session.email) break;
          } catch (err) {
            if (attempt < 2) {
              await new Promise((res) => setTimeout(res, 400));
            }
          }
        }

        if (session && session.email) {
          const userObj: User = {
            id: session.$id || session.id || 'usr_' + Date.now(),
            name: session.name || session.email.split('@')[0],
            email: session.email,
            authProvider: 'google',
            createdAt: session.$createdAt || new Date().toISOString(),
          };
          StorageService.setCurrentUser(userObj);
          localStorage.removeItem('darla_explicit_logout');
          localStorage.removeItem('darla_oauth_pending');

          // Clean up URL parameters after successful OAuth callback
          if (window.location.search || window.location.hash) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }

          if (mounted) {
            setCurrentUser(userObj);
            setIsAuthLoading(false);
            refreshData(userObj, false);
          }
          return;
        }

        const localUser = StorageService.getCurrentUser();
        if (localUser && localUser.email && !isExplicitLogout) {
          if (mounted) {
            setCurrentUser(localUser);
            setIsAuthLoading(false);
            refreshData(localUser, false);
          }
          return;
        }

        if (mounted) {
          setCurrentUser(null);
          setIsAuthLoading(false);
        }
      } catch (error: any) {
        console.log('Sem sessão ativa:', error?.message);
        if (mounted) {
          setCurrentUser(null);
          setIsAuthLoading(false);
        }
      }
    };

    checkSession();

    return () => {
      mounted = false;
    };
  }, []);


  // Immediate local data population and state reset when currentUser changes or budgetId changes
  useEffect(() => {
    if (currentUser) {
      const bId = StorageService.getEffectiveBudgetId(currentUser);
      // Zere imediatamente os estados locais do React para evitar contaminação entre orçamentos
      setTransactions([]);
      setAccounts([]);
      setCategories([]);
      setGoals([]);
      setFamilyMembers([]);
      if (bId) {
        setAccounts(StorageService.getAccounts(bId));
        setCategories(StorageService.getCategories(bId));
        setTransactions(StorageService.getTransactions(bId));
        setGoals(StorageService.getGoals(bId));
        setFamilyMembers(StorageService.getFamilyMembers(bId));
        refreshData(currentUser, true);
      }
    }
  }, [currentUser?.id, currentEffectiveBudgetId, lastBudgetSwitch]);

  // Listen to shared budget updates or data mutations for immediate synchronization
  useEffect(() => {
    const handleBudgetUpdate = () => {
      if (currentUser) {
        refreshData(currentUser, false);
      }
    };
    const handleDataMutation = (e: Event) => {
      if (currentUser) {
        const detail = (e as CustomEvent)?.detail;
        const bId = StorageService.getEffectiveBudgetId(currentUser);
        if (!detail || !detail.userId || detail.userId === bId) {
          setAccounts(StorageService.getAccounts(bId));
          setCategories(StorageService.getCategories(bId));
          setTransactions(StorageService.getTransactions(bId));
          setGoals(StorageService.getGoals(bId));
          setFamilyMembers(StorageService.getFamilyMembers(bId));
        }
      }
    };
    window.addEventListener('shared_budget_updated', handleBudgetUpdate);
    window.addEventListener('financial_data_mutated', handleDataMutation);
    return () => {
      window.removeEventListener('shared_budget_updated', handleBudgetUpdate);
      window.removeEventListener('financial_data_mutated', handleDataMutation);
    };
  }, [currentUser]);



  // Real-time Background Synchronization & Single Device Concurrency Lock
  useEffect(() => {
    if (!currentUser) return;

    const syncFn = async () => {
      if (currentUser?.email) {
        try {
          const res = await fetch(`/api/users/lookup?email=${encodeURIComponent(currentUser.email)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.user) {
              const serverUser = data.user;
              const localSessionId = StorageService.getClientSessionId();

              // Multi-device simultaneous access enabled
              setCurrentUser((prev) => {
                if (!prev) return serverUser;
                if (
                  prev.createdAt !== serverUser.createdAt ||
                  prev.isPro !== serverUser.isPro ||
                  prev.plan !== serverUser.plan ||
                  prev.subscriptionStatus !== serverUser.subscriptionStatus ||
                  prev.name !== serverUser.name ||
                  prev.avatarUrl !== serverUser.avatarUrl
                ) {
                  const updated = { ...prev, ...serverUser };
                  localStorage.setItem('darla_current_user', JSON.stringify(updated));
                  return updated;
                }
                return prev;
              });
            } else if (data.success === false) {
              fetch('/api/users/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentUser),
              }).catch(() => {});
            }
          }
        } catch (e) {}
      }

      const budgetId = StorageService.getEffectiveBudgetId(currentUser);
      if (budgetId) {
        refreshData(currentUser, false);
      }

      // Hard sync user email to Appwrite database if missing or null
      syncUserEmailToDatabase(currentUser).catch(() => {});

      if (currentUser?.email) {
        try {
          const curBudget = StorageService.getSharedBudget(budgetId, currentUser);
          await StorageService.syncNotificationsWithServer(currentUser.email, curBudget?.code);
          window.dispatchEvent(new CustomEvent('notifications_updated'));
        } catch (e) {}
      }
    };

    // Run initial sync
    syncFn();

    const activeBudgetId = StorageService.getEffectiveBudgetId(currentUser);
    // Initialize Real-Time WebSocket connection
    realtimeSync.connect(currentUser.email, activeBudgetId);

    // Initialize Cloud Appwrite Real-Time subscription
    const unsubscribeAppwrite = subscribeToAppwriteRealtime(activeBudgetId, (remoteData) => {
      if (remoteData) {
        if (remoteData.transactions) {
          setTransactions(remoteData.transactions);
          StorageService.setTransactions(remoteData.transactions, activeBudgetId);
        }
        if (remoteData.accounts) {
          setAccounts(remoteData.accounts);
          StorageService.setAccounts(remoteData.accounts, activeBudgetId);
        }
        if (remoteData.investmentTransactions) {
          setInvestmentTransactions(remoteData.investmentTransactions);
          const budgetId = StorageService.getEffectiveBudgetId(currentUser);
          (PortfolioStorageService as any).saveToAllAliasKeys('darla_portfolio_transactions', budgetId, remoteData.investmentTransactions);
          localStorage.setItem('dsf_investments_cache', JSON.stringify(remoteData.investmentTransactions));
          localStorage.setItem(`dsf_investments_cache_${budgetId}`, JSON.stringify(remoteData.investmentTransactions));
        }
        if (remoteData.investorPortfolio) {
          const budgetId = StorageService.getEffectiveBudgetId(currentUser);
          (PortfolioStorageService as any).saveToAllAliasKeys('darla_portfolio_assets', budgetId, remoteData.investorPortfolio);
        }
        const incomingInvGoals = remoteData.investmentGoals || remoteData.investorGoals;
        if (incomingInvGoals && Array.isArray(incomingInvGoals)) {
          const budgetId = StorageService.getEffectiveBudgetId(currentUser);
          const mergedInvestorGoals = mergeRemoteGoalsWithOptimistic(incomingInvGoals);
          PortfolioStorageService.saveGoals(mergedInvestorGoals, budgetId);
          setInvestmentGoals(mergedInvestorGoals);
        }
        const incomingFinancialGoals = remoteData.financialGoals || remoteData.goals;
        if (incomingFinancialGoals && Array.isArray(incomingFinancialGoals)) {
          const mergedFinancialGoals = mergeRemoteGoalsWithOptimistic(incomingFinancialGoals);
          setFinancialGoals(mergedFinancialGoals);
          StorageService.setGoals(mergedFinancialGoals as any, activeBudgetId);
        }
        if (remoteData.categories && Array.isArray(remoteData.categories)) {
          const mergedCats = mergeRemoteCategoriesWithOptimistic(remoteData.categories);
          setCategories(mergedCats);
          StorageService.setCategories(mergedCats, activeBudgetId);
        }
        const incomingMembers = remoteData.familyMembers || remoteData.members;
        if (incomingMembers && Array.isArray(incomingMembers)) {
          const mergedMembers = mergeRemoteMembersWithOptimistic(incomingMembers);
          setFamilyMembers(mergedMembers);
          StorageService.setFamilyMembers(mergedMembers, activeBudgetId);
        }
        if (remoteData.member_permissions) {
          StorageService.syncSharedBudgetsWithServer(currentUser.email).then(() => {
            window.dispatchEvent(new Event('shared_budgets_updated'));
            refreshData(currentUser);
          });
        }
        const incomingBudgetGoals = remoteData.budgetGoals || remoteData.budgetStrategy;
        if (incomingBudgetGoals && typeof incomingBudgetGoals === 'object') {
          const mergedBudgetGoals = mergeRemoteBudgetGoalsWithOptimistic(incomingBudgetGoals);
          const budgetId = StorageService.getEffectiveBudgetId(currentUser);
          StorageService.saveBudgetGoals(mergedBudgetGoals, budgetId);
          window.dispatchEvent(new CustomEvent('budget_goals_updated', { detail: { budgetGoals: mergedBudgetGoals } }));
        }
        const incomingGamif = remoteData.gamificationState || remoteData.gamificationProfile || remoteData.gamification;
        if (incomingGamif) {
          const budgetId = StorageService.getEffectiveBudgetId(currentUser);
          const sanitizedGamif = {
            ...incomingGamif,
            xp: Number(incomingGamif.xp ?? incomingGamif.xpTotal) || 0,
            gems: Number(incomingGamif.gems) || 0,
          };
          const mergedGamif = mergeRemoteGamificationWithOptimistic(sanitizedGamif, budgetId);
          if (mergedGamif) {
            GamificationService.setGamificationStateDirectly(budgetId, mergedGamif);
            window.dispatchEvent(new CustomEvent('gamification_updated_event', { detail: mergedGamif }));
          }
        }
      }
      refreshData(currentUser, false);
      window.dispatchEvent(new Event('portfolio_updated'));
    });

    const handleFocus = () => {
      syncFn();
      refreshData(currentUser, true);
    };

    let remoteUpdateDebounceTimer: any = null;
    const handleRemoteUpdate = (evt?: any) => {
      const detail = evt?.detail;
      const curBudgetId = StorageService.getEffectiveBudgetId(currentUser);
      if (detail && (detail.userId || detail.budgetId)) {
        const target = String(detail.userId || detail.budgetId || '').toLowerCase();
        const curTarget = curBudgetId.toLowerCase();
        const canonicalTarget = StorageService.getCanonicalUserId(target);
        const canonicalCur = StorageService.getCanonicalUserId(curTarget);
        if (target !== curTarget && canonicalTarget !== canonicalCur) {
          return;
        }
      }

      // If categories are included directly in remote payload, update local cache and React state immediately
      if (detail?.categories && Array.isArray(detail.categories) && detail.categories.length > 0) {
        const canonicalCur = StorageService.getCanonicalUserId(curBudgetId);
        const mergedCats = mergeRemoteCategoriesWithOptimistic(detail.categories);
        const mappedCats = mergedCats.map((c: any) => ({ ...c, userId: canonicalCur }));
        StorageService.setCategories(mappedCats, canonicalCur);
        setCategories(mappedCats);
        if (detail.mutationType === 'STRUCTURE') {
          return;
        }
      }

      // Debounce remote update so we never spam refreshData
      if (remoteUpdateDebounceTimer) clearTimeout(remoteUpdateDebounceTimer);
      remoteUpdateDebounceTimer = setTimeout(() => {
        refreshData(currentUser, false);
      }, 1000);
    };

    const handleSharedBudgetUpdated = async (evt?: any) => {
      if (!currentUser?.email) return;
      const detail = evt?.detail;
      const curBudgetId = StorageService.getEffectiveBudgetId(currentUser);
      if (detail && detail.budgetId) {
        const target = String(detail.budgetId).toLowerCase();
        const curTarget = curBudgetId.toLowerCase();
        const myEmail = String(currentUser?.email || '').toLowerCase();
        if (target !== curTarget && target !== myEmail) {
          return;
        }
      }
      refreshData(currentUser, false);
      const newVer = Date.now();
      localStorage.setItem('app_permission_version', String(newVer));
      setPermissionVersion(newVer);
    };

    const handleSharedBudgetsListUpdated = () => {
      refreshData(currentUser, false);
    };

    // Support seamless multi-device concurrent synchronization (phone + desktop)
    const handleSessionRevoked = (_evt: any) => {
      // Multi-device concurrent sessions are active and synchronized in real-time
    };



    const handleUserDeleted = (evt: any) => {
      const payload = evt?.detail;
      const userEmail = currentUser?.email ? currentUser.email.trim().toLowerCase() : '';
      const userId = currentUser?.id || '';
      if (
        payload &&
        (payload.all === true ||
          (payload.email && payload.email.toLowerCase() === userEmail) ||
          payload.userId === userId ||
          payload.rawUserId === userId)
      ) {
        realtimeSync.disconnect();
        StorageService.logout();
        setCurrentUser(null);
      }
    };


    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('pageshow', handleFocus);
    window.addEventListener('online', handleFocus);
    window.addEventListener('remote_data_updated', handleRemoteUpdate);
    window.addEventListener('shared_budget_updated', handleSharedBudgetUpdated);
    window.addEventListener('shared_budgets_updated', handleSharedBudgetsListUpdated);
    window.addEventListener('user_profile_updated', handleRemoteUpdate);
    window.addEventListener('session_revoked_event', handleSessionRevoked);
    window.addEventListener('user_deleted_event', handleUserDeleted);

    // Real-time permission & shared budget sync polling interval (every 20 seconds)
    const permissionPollInterval = setInterval(async () => {
      if (currentUser?.email) {
        try {
          await StorageService.syncSharedBudgetsWithServer(currentUser.email);
        } catch (e) {}
      }
    }, 20000);

    return () => {
      if (typeof unsubscribeAppwrite === 'function') unsubscribeAppwrite();
      realtimeSync.disconnect();
      clearInterval(permissionPollInterval);
      if (remoteUpdateDebounceTimer) clearTimeout(remoteUpdateDebounceTimer);

      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('pageshow', handleFocus);
      window.removeEventListener('online', handleFocus);
      window.removeEventListener('remote_data_updated', handleRemoteUpdate);
      window.removeEventListener('shared_budget_updated', handleSharedBudgetUpdated);
      window.removeEventListener('shared_budgets_updated', handleSharedBudgetsListUpdated);
      window.removeEventListener('user_profile_updated', handleRemoteUpdate);
      window.removeEventListener('session_revoked_event', handleSessionRevoked);
      window.removeEventListener('user_deleted_event', handleUserDeleted);

    };
  }, [currentUser?.id, currentEffectiveBudgetId, lastBudgetSwitch]);

  // Login Handler
  const handleLoginSuccess = (user: User) => {
    localStorage.removeItem('darla_explicit_logout');
    setCurrentUser(user);
    try {
      localStorage.setItem('darla_current_user', JSON.stringify(user));
    } catch (e) {}
    const bId = StorageService.getEffectiveBudgetId(user);
    if (bId) {
      setAccounts(StorageService.getAccounts(bId));
      setCategories(StorageService.getCategories(bId));
      setTransactions(StorageService.getTransactions(bId));
      setGoals(StorageService.getGoals(bId));
      setFamilyMembers(StorageService.getFamilyMembers(bId));
    }
    refreshData(user, false);
    // Force immediate clean reload to guarantee zero white screen
    window.location.reload();
  };

  // Logout Request Handler
  const handleLogout = async () => {
    try {
      realtimeSync.disconnect();
      StorageService.logout(true);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('darla_current_user');
        sessionStorage.clear();
      }
      localStorage.setItem('darla_explicit_logout', 'true');
      await appwriteSignOut().catch(() => {});
    } catch (error) {
      console.error("Erro ao encerrar sessão:", error);
    } finally {
      setCurrentUser(null);
      setTransactions([]);
      setAccounts([]);
      setGoals([]);
      setFamilyMembers([]);
      setBudgets([]);      window.location.href = '/';      setTimeout(() => window.location.reload(), 100);    }
  };

  const handleResetBudgetToZero = async () => {
    if (currentUser) {
      const isTitular = StorageService.isBudgetOwner(currentUser, effectiveBudgetId);
      if (!isTitular) {
        setGlobalAlert({
          isOpen: true,
          title: 'Ação Bloqueada: Apenas Titular',
          message: 'Apenas o titular da conta pode zerar os lançamentos e o orçamento. Membros e colaboradores não possuem esta permissão.',
          type: 'error'
        });
        return;
      }
      if (isReadOnly) {
        setGlobalAlert({
          isOpen: true,
          title: 'Permissão Negada',
          message: 'Você possui permissão apenas de leitura neste orçamento.',
          type: 'error'
        });
        return;
      }
      
      // 1. Marca flag permanente de reset no sessionStorage para sobreviver ao reload
      sessionStorage.setItem('IS_PERFORMING_RESET', 'true');
      (window as any).__KILL_AUTOSAVE__ = true;
      (window as any).__IS_RESETTING__ = true;
      isResettingRef.current = true;
      isSyncingRemoteRef.current = true;

      // 2. Coleta as chaves reais
      const targetDocId = effectiveBudgetId || currentUser?.budgetId || currentUser?.id || currentUser?.$id;

      // Dedo-duro de identificação
      if (!targetDocId) {
        setGlobalAlert({
          isOpen: true,
          title: 'Erro de Sessão',
          message: 'ID do orçamento/documento é NULO ou INDEFINIDO! Verifique a sessão.',
          type: 'error'
        });
        console.error('[Reset Error] ID do orçamento/documento é NULO ou INDEFINIDO! Verifique a sessão.');
        sessionStorage.removeItem('IS_PERFORMING_RESET');
        (window as any).__KILL_AUTOSAVE__ = false;
        (window as any).__IS_RESETTING__ = false;
        return;
      }

      // Limpeza imediata local para refletir zero na UI instantaneamente
      const authKeys = ['cookie', 'session', 'appwrite'];
      Object.keys(localStorage).forEach(key => {
        if (!authKeys.some(k => key.toLowerCase().includes(k))) {
          localStorage.removeItem(key);
        }
      });

      setTransactions([]);
      setAccounts([{ id: 'default', userId: targetDocId, name: 'Conta Principal', initialBalance: 0, color: '#4F46E5', icon: 'Wallet', type: 'checking' }]);
      setGoals([]);

      try {
        console.log('[DEDO-DURO] Iniciando reset de fábrica completo para Doc ID:', targetDocId);

        // Re-criação física (Delete + Create) no servidor como novo usuário
        await StorageService.resetUserBudgetToZero(targetDocId, currentUser);

        console.log('[DEDO-DURO SUCESSO] Documento recriado no Appwrite com estado zerado:', targetDocId);

        setGlobalAlert({
          isOpen: true,
          title: 'Orçamento Zerado',
          message: 'Orçamento zerado e reiniciado como novo usuário com sucesso no Appwrite!',
          type: 'success',
          onConfirm: () => {
            window.location.reload();
          }
        });

        // Permite reativação do autosave e sincronização após o reset concluído com sucesso
        setTimeout(() => {
          sessionStorage.removeItem('IS_PERFORMING_RESET');
          (window as any).__KILL_AUTOSAVE__ = false;
          (window as any).__IS_RESETTING__ = false;
          isResettingRef.current = false;
          isSyncingRemoteRef.current = false;
        }, 2000);

      } catch (err: any) {
        sessionStorage.removeItem('IS_PERFORMING_RESET');
        (window as any).__KILL_AUTOSAVE__ = false;
        (window as any).__IS_RESETTING__ = false;
        isResettingRef.current = false;
        isSyncingRemoteRef.current = false;
        console.error('[DEDO-DURO ERRO EXCEÇÃO]:', err);
        setGlobalAlert({
          isOpen: true,
          title: 'Erro ao Zerar',
          message: `Falha ao zerar orçamento no Appwrite!\nCódigo: ${err.code || 'Desconhecido'}\nMensagem: ${err.message || JSON.stringify(err)}\nDoc ID: ${targetDocId}`,
          type: 'error'
        });
      }
    }
  };

  const handleDeleteUserAccount = async () => {
    if (currentUser) {
      const isTitular = StorageService.isBudgetOwner(currentUser, effectiveBudgetId);
      if (!isTitular) {
        setGlobalAlert({
          isOpen: true,
          title: 'Ação Bloqueada: Apenas Titular',
          message: 'Apenas o titular da conta pode excluir a conta. Em modo membro ou orçamento compartilhado, esta ação está bloqueada.',
          type: 'error'
        });
        return;
      }
      if (isReadOnly) {
        setGlobalAlert({
          isOpen: true,
          title: 'Permissão Negada',
          message: 'Apenas o titular da conta pode excluir a conta.',
          type: 'error'
        });
        return;
      }
      realtimeSync.disconnect();
      try {
        console.log('[DEDO-DURO] Iniciando exclusão de sessões de auth...');
        await account.deleteSessions();
      } catch (e) {
        console.warn('Sessões já invalidadas:', e);
      }
      try {
        console.log('[DEDO-DURO] Iniciando remoção da conta do usuário:', currentUser.id);
        await StorageService.deleteUserAccount(currentUser.id, currentUser);
        setGlobalAlert({
          isOpen: true,
          title: 'Conta Excluída',
          message: 'Conta e todos os dados foram excluídos com sucesso do servidor!',
          type: 'success',
          onConfirm: () => {
            setCurrentUser(null);
            localStorage.clear();
            sessionStorage.clear();
            sessionStorage.setItem('FORCE_LOGIN_VIEW', 'true');
            window.location.replace(window.location.origin);
          }
        });
      } catch (delErr: any) {
        console.error('[DEDO-DURO ERRO AO EXCLUIR CONTA]:', delErr);
        setGlobalAlert({
          isOpen: true,
          title: 'Erro ao Excluir',
          message: `Falha ao excluir conta no servidor!\nMensagem: ${delErr.message || JSON.stringify(delErr)}`,
          type: 'error'
        });
      }
    }
  };

  if (isAuthLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="text-center font-bold">Carregando...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const effectiveBudgetId = StorageService.getEffectiveBudgetId(currentUser);

  // Calculated Summaries
  const monthSummary = calculateMonthSummary(currentYear, currentMonth, transactions, accounts);
  const accountBalances = calculateAccountBalances(accounts, transactions);

  // Read-Only Guard Helper
  const checkReadOnlyPermission = (silent: boolean = false): boolean => {
    if (!currentUser) return false;
    const effectiveBudgetId = StorageService.getEffectiveBudgetId(currentUser);
    const myEmail = String(currentUser.email || '').toLowerCase().trim();
    const myId = String(currentUser.id || '').toLowerCase().trim();
    const personalBudgetId = StorageService.getCanonicalUserId(currentUser.id || currentUser.email || 'default');
    const isOwnBudget = effectiveBudgetId === personalBudgetId;

    if (isOwnBudget) return false; // Titular sempre pode lançar

    const readOnly = StorageService.isCurrentUserReadOnly(currentUser);
    if (readOnly && !silent) {
      window.dispatchEvent(new CustomEvent('app-alert', { detail: { message: "Ação bloqueada: Você possui apenas permissão de LEITURA neste orçamento." } }));
    }
    return readOnly;
  };
  const isReadOnly = checkReadOnlyPermission(true);



  const buildAppFinancialState = (
    overrideTxs?: Transaction[],
    overrideAccounts?: Account[],
    overrideFinancialGoals?: Goal[],
    overrideFamily?: FamilyMember[],
    overrideCategories?: Category[],
    overrideInvestmentGoals?: any[]
  ) => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    const currentTxs = overrideTxs || StorageService.getTransactions(budgetId);
    const currentAccounts = overrideAccounts || StorageService.getAccounts(budgetId);
    const currentFinancialGoals = overrideFinancialGoals || financialGoals || StorageService.getGoals(budgetId);
    const currentFamily = overrideFamily || StorageService.getFamilyMembers(budgetId);
    const currentCategories = overrideCategories || StorageService.getCategories(budgetId);
    const budgets = StorageService.deduplicateSharedBudgets();

    const familyBudget = [
      ...currentFinancialGoals,
      ...currentFamily,
      ...budgets
    ];

    const portfolioUserId = currentUser?.email || currentUser?.id || budgetId;
    const investorPortfolio = PortfolioStorageService.getAssets(portfolioUserId);
    const invTxs = PortfolioStorageService.getTransactions(portfolioUserId);
    const divs = PortfolioStorageService.getDividends(portfolioUserId);
    const investmentTransactions = [...invTxs, ...divs];
    const investorGoals = overrideInvestmentGoals || investmentGoals || PortfolioStorageService.getGoals(portfolioUserId);

    return {
      transactions: currentTxs,
      familyBudget: familyBudget,
      accounts: currentAccounts,
      categories: currentCategories,
      investments: investmentTransactions,
      investorPortfolio: investorPortfolio,
      investmentTransactions: investmentTransactions,
      investmentGoals: investorGoals,
      investorGoals: investorGoals,
      financialGoals: currentFinancialGoals,
      assets: investorPortfolio,
      goals: currentFinancialGoals,
      updatedAt: new Date().toISOString()
    };
  };

  const syncCurrentStateToCloud = async (overrideTxs?: Transaction[], overrideAccounts?: Account[]) => {
    try {
      const fullState = buildAppFinancialState(overrideTxs, overrideAccounts);
      const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
      const userIdentifier = budgetId || currentUser?.email || currentUser?.id || 'default';
      await saveAppData(userIdentifier, fullState);
    } catch (e) {
      console.error('Erro ao sincronizar estado com Appwrite:', e);
    }
  };

  const handleOpenNewTransaction = () => {
    if (checkReadOnlyPermission()) return;
    setEditingTx(null);
    setIsTxModalOpen(true);
  };

  const handleEditTransaction = (tx: Transaction) => {
    if (checkReadOnlyPermission()) return;
    setEditingTx(tx);
    setIsTxModalOpen(true);
  };

  const handleSaveSingleTransaction = async (txData: Omit<Transaction, 'id' | 'createdAt'>, keepOpen: boolean = false): Promise<boolean> => {
    if (checkReadOnlyPermission()) return false;
    let nextTransactions = transactions;
    if (editingTx) {
      const series = editingTx.parentInstallmentId
        ? transactions.filter((t) => t.parentInstallmentId === editingTx.parentInstallmentId)
        : [];

      let choice: 'single' | 'all' | 'from_this' | 'exit' = 'single';
      if (series.length > 1) {
        choice = await promptInstallmentAction(
          'Gerenciar Lançamento Parcelado',
          'Este lançamento faz parte de uma série de parcelamentos. Escolha a ação desejada:',
          true
        );
      }

      if (choice === 'exit') {
        setIsTxModalOpen(false);
        setEditingTx(null);
        return false;
      }

      const updateAll = choice === 'all';
      const updateFromThis = choice === 'from_this';

      if ((updateAll || updateFromThis) && editingTx.parentInstallmentId) {
        const targetIndex = updateFromThis ? editingTx.installmentIndex : 1;
        const updatedSeries = series.map((t) => {
          if (t.installmentIndex < targetIndex) return t;
          const baseName = txData.description.replace(/\s*\[\d+\/\d+\]$/, '');
          return {
            ...t,
            ...txData,
            id: t.id,
            createdAt: t.createdAt,
            date: t.date,
            installmentIndex: t.installmentIndex,
            installmentTotal: t.installmentTotal,
            parentInstallmentId: t.parentInstallmentId,
            description: `${baseName} [${t.installmentIndex}/${t.installmentTotal}]`,
          };
        });
        updatedSeries.forEach((upd) => StorageService.updateTransaction(upd));
        const updatedMap = new Map(updatedSeries.map((u) => [u.id, u]));
        nextTransactions = transactions.map((t) => updatedMap.get(t.id) || t);
      } else {
        const updated: Transaction = {
          ...txData,
          id: editingTx.id,
          createdAt: editingTx.createdAt,
        };
        StorageService.updateTransaction(updated);
        nextTransactions = transactions.map((t) => (t.id === updated.id ? updated : t));
      }
    } else {
      const saved = StorageService.addTransaction(txData);
      nextTransactions = [saved, ...transactions];
      if (currentUser) {
        GamificationService.recordAction(currentUser.id, 'launches');
      }
    }

    await persistAllData(accounts, nextTransactions);
    if (!keepOpen) {
      setIsTxModalOpen(false);
      setEditingTx(null);
    }
    refreshData(currentUser, false);
    return true;
  };

  const handleSaveMultipleTransactions = async (txList: Omit<Transaction, 'id' | 'createdAt'>[], keepOpen: boolean = false): Promise<boolean> => {
    if (checkReadOnlyPermission()) return false;
    const added = StorageService.addMultipleTransactions(txList);
    const nextTransactions = [...added, ...transactions];
    if (currentUser) {
      GamificationService.recordAction(currentUser.id, 'launches', txList.length);
    }

    const success = await persistAllData(accounts, nextTransactions);
    if (success) {
      if (!keepOpen) {
        setIsTxModalOpen(false);
      }
      refreshData(currentUser, false);
    }
    return success;
  };

  const handleDeleteTransaction = async (id: string): Promise<boolean> => {
    if (checkReadOnlyPermission()) return false;
    const target = transactions.find((t) => t.id === id);
    const series = target?.parentInstallmentId
      ? transactions.filter((t) => t.parentInstallmentId === target.parentInstallmentId)
      : [];

    let idsToDelete = [id];
    if (series.length > 1) {
      const choice = await promptInstallmentAction(
        'Excluir Lançamento Parcelado',
        'Este lançamento faz parte de uma série de parcelamentos. Escolha a ação desejada:',
        true,
        'delete'
      );
      if (choice === 'exit') {
        return false;
      }
      if (choice === 'all') {
        idsToDelete = series.map((t) => t.id);
      } else if (choice === 'from_this' && target) {
        idsToDelete = series.filter((t) => t.installmentIndex >= target.installmentIndex).map((t) => t.id);
      }
    }

    idsToDelete.forEach((txId) => StorageService.deleteTransaction(txId));
    const nextTransactions = transactions.filter((t) => !idsToDelete.includes(t.id));

    const success = await persistAllData(accounts, nextTransactions);
    if (success) {
      refreshData(currentUser, false);
    }
    return success;
  };

  const handleToggleConsolidated = async (id: string): Promise<boolean> => {
    if (checkReadOnlyPermission()) return false;
    StorageService.toggleConsolidated(id);
    const nextTransactions = transactions.map((t) => (t.id === id ? { ...t, isConsolidated: !t.isConsolidated } : t));
    if (currentUser) {
      GamificationService.recordAction(currentUser.id, 'consolidation');
    }

    const success = await persistAllData(accounts, nextTransactions);
    if (success) {
      refreshData(currentUser, false);
    }
    return success;
  };

  const handleUpdateSingleTransaction = async (tx: Transaction): Promise<boolean> => {
    if (checkReadOnlyPermission()) return false;
    StorageService.updateTransaction(tx);
    const nextTransactions = transactions.map((t) => (t.id === tx.id ? tx : t));

    const success = await persistAllData(accounts, nextTransactions);
    if (success) {
      refreshData(currentUser, false);
    }
    return success;
  };

  // Investment Transaction Handlers
  const saveInvestmentTransaction = async (newTx: any) => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    const portfolioUserId = budgetId;
    const tempId = newTx.id || `tx_inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const txItem = {
      id: tempId,
      userId: portfolioUserId,
      assetTicker: (newTx.assetTicker || newTx.ticker || '').toUpperCase().trim(),
      assetCategory: newTx.assetCategory || newTx.category || 'acoes',
      type: newTx.type || 'buy',
      quantity: Number(newTx.quantity) || 0,
      unitPrice: Number(newTx.unitPrice) || Number(newTx.price) || 0,
      totalAmount: Number(newTx.totalAmount) || Number(newTx.totalValue) || (Number(newTx.quantity) * Number(newTx.unitPrice || newTx.price)) || 0,
      broker: newTx.broker || newTx.institution || 'RICO INVESTIMENTOS',
      date: newTx.date || new Date().toISOString().split('T')[0],
      notes: newTx.notes || '',
      createdAt: newTx.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Snapshot previous state for rollback in case of network failure
    const previousList = [...investmentTransactions];

    // 2. OPTIMISTIC UI: Update state immediately (0ms delay)
    setInvestmentTransactions(prev => {
      const exists = prev.some(t => t.id === txItem.id);
      const next = exists ? prev.map(t => (t.id === txItem.id ? txItem : t)) : [txItem, ...prev];
      (PortfolioStorageService as any).saveToAllAliasKeys('darla_portfolio_transactions', portfolioUserId, next);
      return next;
    });

    if (newTx.id) {
      PortfolioStorageService.updateTransaction(txItem, portfolioUserId);
    } else {
      PortfolioStorageService.addTransaction(txItem, portfolioUserId);
    }

    // Persist full state to cloud (same as accounts/categories in Orçamento Familiar)
    try {
      await syncCurrentStateToCloud();
      console.log('[SYNC-INVESTIMENTOS] Transação de ativo persistida com sucesso no Appwrite:', txItem);
    } catch (e) {
      console.warn('[SYNC-INVESTIMENTOS] Erro ao persistir transação no Appwrite:', e);
    }

    // Trigger instant visual recalculations across components
    window.dispatchEvent(new Event('portfolio_updated'));
    window.dispatchEvent(new Event('remote_data_updated'));
    window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId: portfolioUserId } }));

    // 3. Process cloud sync in background (non-blocking, no rollback)
    (async () => {
      try {
        const action = newTx.id ? 'updateInvestmentTransaction' : 'addInvestmentTransaction';
        const result = await executeTransactionalInvestmentTransaction(portfolioUserId, action, {
          transactionData: txItem,
          transactionId: txItem.id,
        });

        if (result.success && result.investmentTransactions) {
          const merged = mergeRemoteInvestmentTransactionsWithOptimistic(result.investmentTransactions);
          setInvestmentTransactions(merged);
          (PortfolioStorageService as any).saveToAllAliasKeys('darla_portfolio_transactions', portfolioUserId, merged);
        }
      } catch (error: any) {
        console.warn('Falha na sincronização em background (salvo localmente):', error);
      }
    })();

    return true;
  };

  // Investment Goal Handlers (Robust optimistic UI + background sync)
  const handleSaveInvestmentGoal = async (newGoalData: any) => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';

    const newGoal = {
      id: newGoalData.id || `inv_goal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: (newGoalData.title || '').trim(),
      targetAmount: Number(newGoalData.targetAmount) || 0,
      currentAmount: 0,
      startDate: newGoalData.startDate || new Date().toISOString().split('T')[0],
      deadline: newGoalData.deadline || '',
      category: newGoalData.category || 'Patrimônio Total',
      createdAt: newGoalData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const previousList = [...investmentGoals];
    const updatedGoals = [newGoal, ...investmentGoals.filter(g => String(g.id) !== String(newGoal.id))];

    // 1. Optimistic UI update (immediate)
    setInvestmentGoals(updatedGoals);
    PortfolioStorageService.saveGoals(updatedGoals, budgetId);

    window.dispatchEvent(new Event('portfolio_updated'));
    window.dispatchEvent(new Event('remote_data_updated'));
    window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId: budgetId } }));
    window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Meta salva com sucesso!' }));

    // 2. Background Sync
    (async () => {
      try {
        await executeTransactionalInvestmentGoal(budgetId, 'saveGoal', {
          goalData: newGoal,
          goalId: newGoal.id,
        });
        const fullState = {
          investmentGoals: updatedGoals,
          investmentTransactions,
          accounts,
          updatedAt: new Date().toISOString()
        };
        await saveAppData(budgetId, fullState);
      } catch (err: any) {
        console.warn('[Background Goal Save Notice]', err);
      }
    })();
  };

  const handleDeleteInvestmentGoal = async (goalIdOrIndex: string | number) => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';

    const previousList = [...investmentGoals];
    const updatedGoals = investmentGoals.filter((g, idx) => {
      if (typeof goalIdOrIndex === 'number') return idx !== goalIdOrIndex;
      return String(g.id || g.$id) !== String(goalIdOrIndex);
    });

    // 1. Optimistic UI update (immediate)
    setInvestmentGoals(updatedGoals);
    PortfolioStorageService.saveGoals(updatedGoals, budgetId);
    if (typeof goalIdOrIndex === 'string') {
      PortfolioStorageService.deleteGoal(goalIdOrIndex, budgetId);
    }

    window.dispatchEvent(new Event('portfolio_updated'));
    window.dispatchEvent(new Event('remote_data_updated'));
    window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId: budgetId } }));
    window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Meta excluída com sucesso!' }));

    // 2. Background Sync
    (async () => {
      try {
        if (typeof goalIdOrIndex === 'string') {
          await executeTransactionalInvestmentGoal(budgetId, 'deleteGoal', {
            goalId: String(goalIdOrIndex),
          });
        }
        const fullState = {
          investmentGoals: updatedGoals,
          investmentTransactions,
          accounts,
          updatedAt: new Date().toISOString()
        };
        await saveAppData(budgetId, fullState);
      } catch (err: any) {
        console.warn('[Background Goal Delete Notice]', err);
      }
    })();
  };

  const saveFinancialData = async (_data: any) => {
    await syncCurrentStateToCloud();
  };

  const deleteInvestmentTransaction = async (idOrIndex: string | number) => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';

    const previousList = [...investmentTransactions];

    // 1. Filtragem da lista
    const updatedList = investmentTransactions.filter((tx: any, idx: number) => {
      if (typeof idOrIndex === 'number') return idx !== idOrIndex;
      const currentId = String(tx.id || tx.$id || tx._id);
      return currentId !== String(idOrIndex);
    });

    // Atualização otimista local imediata
    setInvestmentTransactions(updatedList);
    (PortfolioStorageService as any).saveToAllAliasKeys('darla_portfolio_transactions', budgetId, updatedList);
    localStorage.setItem('dsf_investments_cache', JSON.stringify(updatedList));
    try {
      localStorage.setItem(`dsf_investments_cache_${budgetId}`, JSON.stringify(updatedList));
    } catch (e) {}

    if (typeof idOrIndex === 'string') {
      PortfolioStorageService.deleteTransaction(idOrIndex, budgetId);
      PortfolioStorageService.markPortfolioItemAsDeleted(idOrIndex, 'transactions', budgetId);
    }

    window.dispatchEvent(new Event('portfolio_updated'));
    window.dispatchEvent(new Event('remote_data_updated'));
    window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId: budgetId } }));
    window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Transação excluída com sucesso!' }));

    // 2. Background Sync (non-blocking)
    (async () => {
      try {
        if (typeof idOrIndex === 'string') {
          await executeTransactionalInvestmentTransaction(budgetId, 'deleteInvestmentTransaction', {
            transactionId: String(idOrIndex),
          });
        }
        await syncCurrentStateToCloud();
      } catch (err: any) {
        console.warn('[Background Investment Transaction Delete Notice]', err);
      }
    })();

    return true;
  };

  // Account Handlers
  const persistAllData = async (updatedAccounts?: any[], updatedTransactions?: any[], updatedInvestmentTransactions?: any[]) => {
    if ((window as any).__PAUSE_ALL_SYNCS__) {
      console.warn('[DEDO-DURO] Sincronização bloqueada: Reset em andamento.');
      return false;
    }
    if ((window as any).__KILL_AUTOSAVE__ || (window as any).__IS_RESETTING__) {
      console.warn('[Autosave Blocked] Reset in progress.');
      return false;
    }

    const accountsToPersist = updatedAccounts || accounts;
    const transactionsToPersist = updatedTransactions || transactions;
    
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';

    // 1. Instant React state update
    setAccounts(accountsToPersist);
    StorageService.setAccounts(accountsToPersist, budgetId);
    setTransactions(transactionsToPersist);
    StorageService.setTransactions(transactionsToPersist, budgetId);

    if (updatedInvestmentTransactions) {
      setInvestmentTransactions(updatedInvestmentTransactions);
    }

    // 2. Cloud Persistence to Appwrite using canonical userIdentifier (Non-blocking / Best-effort)
    try {
      const fullState = buildAppFinancialState(transactionsToPersist, accountsToPersist);
      const userIdentifier = budgetId || currentUser?.email || currentUser?.id || 'default';
      const success = await saveAppData(userIdentifier, fullState);
      if (!success) {
        console.warn('[Appwrite Sync Warning] Cloud sync returned false, saving locally and continuing.');
      } else {
        console.log('[Appwrite Sync] Dados e contas sincronizados na nuvem para:', userIdentifier);
      }
    } catch (appwriteErr: any) {
      console.warn('[Appwrite Sync Non-Blocking Notice]', appwriteErr?.message || appwriteErr);
    }

    // 3. Server-side / Firestore sync
    try {
      await StorageService.syncUserMutationToServer(budgetId);
      console.log('[Sync] Dados e transações sincronizados online com sucesso!');
    } catch (error: any) {
      console.warn('[Sync Notice] Salvo localmente. A sincronização online ocorrerá em segundo plano.', error?.message || error);
    }

    // 4. Dispatch events for instant UI reactivity
    window.dispatchEvent(new Event('portfolio_updated'));
    window.dispatchEvent(new Event('remote_data_updated'));
    window.dispatchEvent(new CustomEvent('financial_data_mutated'));

    return true;
  };

  const handleSaveAccount = async (acc: Account, updatedAccounts?: Account[]): Promise<boolean> => {
    if (checkReadOnlyPermission()) return false;
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    const accWithBudget = { ...acc, userId: budgetId };
    
    // 1. Instant local optimistic update & storage
    StorageService.saveAccount(accWithBudget);
    const accountsList = updatedAccounts || StorageService.getAccounts(budgetId);
    setAccounts(accountsList);

    // 2. Dispatch events for instant UI reactivity across components
    window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId: budgetId } }));

    // 3. Process cloud sync in background (non-blocking)
    (async () => {
      try {
        const fullState = buildAppFinancialState(transactions, accountsList);
        await saveAppData(budgetId, fullState);
        await StorageService.syncUserMutationToServer(budgetId);
        console.log('[Account Sync] Conta sincronizada na nuvem para orçamento:', budgetId);
      } catch (err) {
        console.warn('[Account Sync Notice] Salvo localmente.', err);
      }
    })();

    return true;
  };

  const handleDeleteAccount = async (id: string): Promise<boolean> => {
    if (checkReadOnlyPermission()) return false;
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    
    StorageService.deleteAccount(id);
    const accountsList = StorageService.getAccounts(budgetId);
    setAccounts(accountsList);

    window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId: budgetId } }));

    (async () => {
      try {
        const fullState = buildAppFinancialState(transactions, accountsList);
        await saveAppData(budgetId, fullState);
        await StorageService.syncUserMutationToServer(budgetId);
        console.log('[Account Delete Sync] Conta excluída e sincronizada na nuvem para orçamento:', budgetId);
      } catch (err) {
        console.warn('[Account Delete Sync Notice] Salvo localmente.', err);
      }
    })();

    return true;
  };

  // Category Handlers (Identical Configuration to Accounts: Instant Local + Background Cloud Sync)
  const handleSaveCategory = async (cat: Category, updatedCategoriesList?: Category[]): Promise<boolean> => {
    if (checkReadOnlyPermission()) return false;
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    const canonicalBudget = StorageService.getCanonicalUserId(budgetId);
    const catWithBudget = { ...cat, userId: canonicalBudget, updatedAt: new Date().toISOString() };
    
    // 1. Instant local optimistic update & storage
    recordPendingCategoryMutation(catWithBudget.id, 'updateCategory', catWithBudget);
    StorageService.saveCategory(catWithBudget, canonicalBudget);
    const freshCats = updatedCategoriesList || StorageService.getCategories(canonicalBudget);
    setCategories(freshCats);

    // 2. Dispatch event for local UI widgets reactivity across components
    window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId: canonicalBudget } }));

    // 3. Process cloud sync & multi-device broadcast in background (non-blocking)
    (async () => {
      try {
        const fullState = buildAppFinancialState(transactions, accounts, goals, familyMembers, freshCats);
        await saveAppData(canonicalBudget, fullState);
        executeTransactionalStructure(canonicalBudget, 'updateCategory', {
          categoryId: catWithBudget.id,
          categoryData: catWithBudget,
          categoriesList: freshCats,
        }).catch(() => {});
        await StorageService.syncUserMutationToServer(canonicalBudget);
        console.log('[Category Sync] Categoria e subcategorias sincronizadas na nuvem para orçamento:', canonicalBudget);
      } catch (err) {
        console.warn('[Category Sync Notice] Salvo localmente.', err);
      }
    })();

    return true;
  };

  const handleDeleteCategory = async (id: string): Promise<boolean> => {
    if (checkReadOnlyPermission()) return false;
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    const canonicalBudget = StorageService.getCanonicalUserId(budgetId);
    
    // 1. Instant local optimistic update & deletion guard
    recordCategoryDeletion(id);
    StorageService.deleteCategory(id, canonicalBudget);
    const freshCats = StorageService.getCategories(canonicalBudget).filter((c) => c.id !== id);
    StorageService.setCategories(freshCats, canonicalBudget);
    setCategories(freshCats);

    // 2. Dispatch event for local UI widgets reactivity
    window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId: canonicalBudget } }));

    // 3. Process cloud sync in background (non-blocking)
    (async () => {
      try {
        const fullState = buildAppFinancialState(transactions, accounts, goals, familyMembers, freshCats);
        await saveAppData(canonicalBudget, fullState);
        executeTransactionalStructure(canonicalBudget, 'deleteCategory', {
          categoryId: id,
          categoriesList: freshCats,
        }).catch(() => {});
        await StorageService.syncUserMutationToServer(canonicalBudget);
        console.log('[Category Delete Sync] Categoria excluída e sincronizada na nuvem:', canonicalBudget);
      } catch (err) {
        console.warn('[Category Delete Sync Notice] Salvo localmente.', err);
      }
    })();

    return true;
  };

  const handleAddSubcategory = async (cat: Category, parentSubId: string | null, name: string, explicitSubId?: string) => {
    if (checkReadOnlyPermission()) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    const canonicalBudget = StorageService.getCanonicalUserId(budgetId);

    const subId = explicitSubId || `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newSub: Subcategory = {
      id: subId,
      categoryId: cat.id,
      parentId: parentSubId || undefined,
      name: trimmedName,
      subcategories: [],
    };
    const updatedSubcategories = addSubcategoryToTree(cat.subcategories || [], parentSubId, newSub);
    const updatedCat: Category = { ...cat, userId: canonicalBudget, subcategories: updatedSubcategories, updatedAt: new Date().toISOString() };

    recordPendingCategoryMutation(cat.id, 'addSubcategory', updatedCat);
    await handleSaveCategory(updatedCat);

    executeTransactionalStructure(canonicalBudget, 'addSubcategory', {
      categoryId: cat.id,
      categoryData: updatedCat,
      parentSubId: parentSubId || undefined,
      subData: newSub,
    }).catch(() => {});
  };

  const handleRenameSubcategory = async (cat: Category, subId: string, newName: string) => {
    if (checkReadOnlyPermission()) return;
    const trimmed = newName.trim();
    if (!trimmed) return;

    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    const canonicalBudget = StorageService.getCanonicalUserId(budgetId);

    const updatedSubcategories = renameSubcategoryInTree(cat.subcategories || [], subId, trimmed);
    const updatedCat: Category = { ...cat, userId: canonicalBudget, subcategories: updatedSubcategories, updatedAt: new Date().toISOString() };

    recordPendingCategoryMutation(cat.id, 'updateSubcategory', updatedCat);
    await handleSaveCategory(updatedCat);

    executeTransactionalStructure(canonicalBudget, 'updateSubcategory', {
      categoryId: cat.id,
      categoryData: updatedCat,
      subId,
      newSubName: trimmed,
    }).catch(() => {});
  };

  const handleDeleteSubcategory = async (cat: Category, subId: string) => {
    if (checkReadOnlyPermission()) return;

    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    const canonicalBudget = StorageService.getCanonicalUserId(budgetId);

    const updatedSubcategories = deleteSubcategoryFromTree(cat.subcategories || [], subId);
    const updatedCat: Category = { ...cat, userId: canonicalBudget, subcategories: updatedSubcategories, updatedAt: new Date().toISOString() };

    recordPendingCategoryMutation(cat.id, 'deleteSubcategory', updatedCat);
    await handleSaveCategory(updatedCat);

    executeTransactionalStructure(canonicalBudget, 'deleteSubcategory', {
      categoryId: cat.id,
      categoryData: updatedCat,
      subId,
    }).catch(() => {});
  };

  const handleMoveSubcategory = async (sub: Subcategory, sourceCat: Category, targetCat: Category) => {
    if (checkReadOnlyPermission()) return;
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    const canonicalBudget = StorageService.getCanonicalUserId(budgetId);

    const updatedSourceSubs = deleteSubcategoryFromTree(sourceCat.subcategories || [], sub.id);
    const updatedSourceCat = { ...sourceCat, userId: canonicalBudget, subcategories: updatedSourceSubs, updatedAt: new Date().toISOString() };

    const movedSub = { ...sub, categoryId: targetCat.id, parentId: undefined };
    const updatedTargetSubs = [...(targetCat.subcategories || []), movedSub];
    const updatedTargetCat = { ...targetCat, userId: canonicalBudget, subcategories: updatedTargetSubs, updatedAt: new Date().toISOString() };

    recordPendingCategoryMutation(sourceCat.id, 'updateCategory', updatedSourceCat);
    recordPendingCategoryMutation(targetCat.id, 'updateCategory', updatedTargetCat);

    await handleSaveCategory(updatedSourceCat);
    await handleSaveCategory(updatedTargetCat);

    executeTransactionalStructure(canonicalBudget, 'moveSubcategory', {
      sourceCatId: sourceCat.id,
      targetCatId: targetCat.id,
      subId: sub.id,
      subData: movedSub,
    }).catch(() => {});
  };

  const handleRestoreDefaultCategories = async () => {
    if (checkReadOnlyPermission()) return;
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    const restored = SEED_CATEGORIES.map((c) => ({ ...c, userId: budgetId }));

    // 1. Instant local optimistic update
    StorageService.setCategories(restored, budgetId);
    setCategories(restored);

    // 2. Dispatch event for local UI widgets reactivity
    window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId: budgetId } }));

    // 3. Background cloud sync
    (async () => {
      try {
        const fullState = buildAppFinancialState(transactions, accounts, goals, familyMembers, restored);
        await saveAppData(budgetId, fullState);
        await StorageService.syncUserMutationToServer(budgetId);
      } catch (err) {
        console.warn('[Restore Default Categories Sync Notice] Salvo localmente.', err);
      }
    })();
  };

  // Family Member Handlers (Identical Configuration to Accounts: Instant Local + Background Cloud Sync)
  const handleSaveFamilyMember = async (member: FamilyMember) => {
    if (checkReadOnlyPermission()) return;
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    const memberWithBudget = { ...member, userId: budgetId };
    
    // 1. Instant local optimistic update
    StorageService.saveFamilyMember(memberWithBudget);
    const freshMembers = StorageService.getFamilyMembers(budgetId);
    setFamilyMembers(freshMembers);

    // 2. Dispatch event for local UI widgets reactivity
    window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId: budgetId } }));

    // 3. Background cloud sync
    (async () => {
      try {
        const fullState = buildAppFinancialState(transactions, accounts, goals, freshMembers, categories);
        await saveAppData(budgetId, fullState);
        await StorageService.syncUserMutationToServer(budgetId);
        console.log('[Member Sync] Membro familiar sincronizado na nuvem para orçamento:', budgetId);
      } catch (err) {
        console.warn('[Member Sync Notice] Salvo localmente.', err);
      }
    })();
  };

  const handleDeleteFamilyMember = async (id: string) => {
    if (checkReadOnlyPermission()) return;
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    
    // 1. Instant local optimistic update & deletion guard
    recordMemberDeletion(id);
    StorageService.deleteFamilyMember(id);
    const freshMembers = StorageService.getFamilyMembers(budgetId).filter((f) => f.id !== id);
    StorageService.setFamilyMembers(freshMembers, budgetId);
    setFamilyMembers(freshMembers);

    // 2. Dispatch event for local UI widgets reactivity
    window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId: budgetId } }));

    // 3. Background cloud sync
    (async () => {
      try {
        const fullState = buildAppFinancialState(transactions, accounts, goals, freshMembers, categories);
        await saveAppData(budgetId, fullState);
        await StorageService.syncUserMutationToServer(budgetId);
        console.log('[Member Delete Sync] Membro familiar excluído e sincronizado na nuvem:', budgetId);
      } catch (err) {
        console.warn('[Member Delete Sync Notice] Salvo localmente.', err);
      }
    })();
  };

  // Goal Handlers (Atomic Transactions + Zero Latency)
  const handleSaveGoal = async (goal: Goal) => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    
    // 1. Instant local optimistic update
    StorageService.saveGoal(goal);
    const freshGoals = StorageService.getGoals(budgetId);
    setFinancialGoals(freshGoals);

    // 2. Atomic server transaction & Appwrite direct propagation
    const isEditing = financialGoals.some((g) => g.id === goal.id);
    await executeTransactionalGoal(budgetId, isEditing ? 'updateGoal' : 'addGoal', {
      goalData: goal,
      goalId: goal.id,
    });

    refreshData(currentUser, false);
  };

  const handleUpdateGoalProgress = async (goalId: string, addedAmount: number) => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    
    // 1. Instant local optimistic update
    StorageService.updateGoalProgress(goalId, addedAmount);
    const freshGoals = StorageService.getGoals(budgetId);
    setFinancialGoals(freshGoals);

    // 2. Atomic server transaction & Appwrite direct propagation
    await executeTransactionalGoal(budgetId, 'updateGoalProgress', {
      goalId,
      addedAmount,
    });

    refreshData(currentUser, false);
  };

  const handleDeleteGoal = async (id: string) => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    
    // 1. Instant local optimistic update & deletion guard
    recordGoalDeletion(id);
    StorageService.deleteGoal(id, budgetId);
    const freshGoals = StorageService.getGoals(budgetId).filter((g) => g.id !== id);
    setFinancialGoals(freshGoals);

    // 2. Atomic server transaction & Appwrite direct propagation (non-blocking)
    try {
      await executeTransactionalGoal(budgetId, 'deleteGoal', {
        goalId: id,
      });
    } catch (e) {
      console.warn('Erro ao excluir objetivo/sonho na nuvem (excluído localmente):', e);
    }

    refreshData(currentUser, false);
  };



  const handleSaveUserName = (newName: string, avatarUrl?: string) => {
    if (!currentUser) return;
    const updated = StorageService.updateUserProfile(currentUser.id, newName, avatarUrl);
    if (updated) {
      setCurrentUser(updated);
    } else {
      setCurrentUser({ 
        ...currentUser, 
        name: newName, 
        avatarUrl
      });
    }
  };

  const handleTabChange = (tab: string) => {
    if (tab.startsWith('portfolio') || tab === 'portfolio') {
      if (!StorageService.isFeatureAllowed(currentUser, 'portfolio')) {
        setFeatureLockTitle('Carteira do Investidor');
        setFeatureLockDesc('A Carteira do Investidor é um recurso exclusivo dos nossos planos VIP. Faça o upgrade agora para ter acesso completo a análises de patrimônio, rentabilidade, proventos e ativos!');
        setIsFeatureLockModalOpen(true);
        return;
      }
    }
    setActiveTab(tab);
    localStorage.setItem('app_active_tab', tab);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col font-sans text-[#121212]">
      {/* Header (scrolls naturally with page) */}
      <Header
        user={currentUser}
        syncProgress={syncProgress}
        syncStatus={syncStatus}
        currentYear={currentYear}
        currentMonth={currentMonth}
        onYearMonthChange={(year, month) => {
          setCurrentYear(year);
          setCurrentMonth(month);
        }}
        onOpenNewTransaction={handleOpenNewTransaction}
        onOpenSharedBudget={() => setIsSharedBudgetModalOpen(true)}
        pendingInvitesCount={persistentInvites.length}
        onOpenEditProfile={() => {
          setIsEditProfileModalOpen(true);
        }}
        onOpenCriticalActionsModal={() => setIsCriticalActionsModalOpen(true)}
        onUpdateUserName={handleSaveUserName}
        onResetBudgetToZero={handleResetBudgetToZero}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        zoomLevel={zoomLevel}
        onZoomChange={handleZoomChange}
        onForceSync={() => refreshData(currentUser)}
        onOpenAppwriteSettings={() => setIsAppwriteModalOpen(true)}
      />



      {/* Slim Sticky Navigation Bar (takes only ~48px height on mobile sticky top-0) */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-xs border-b border-gray-200" id="fixed-top-menu-bar">
        <Navigation
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          zoomLevel={zoomLevel}
          onZoomChange={handleZoomChange}
          onOpenAppwriteSettings={() => setIsAppwriteModalOpen(true)}
        />
      </div>

      {/* Main Content Body */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-2 sm:px-4 lg:px-8 pt-2 pb-6 min-w-0 transition-[zoom] duration-150" style={{ zoom: `${zoomLevel}%` }}>
        {/* Trial Countdown Graphic (Requirement 15: Highlighted on all pages when free trial active) */}
        <TrialCountdownWidget user={currentUser} onGoToPlans={() => handleTabChange('plans')} />

        {/* Sub-Navigation Pills for Orçamento Familiar (matching Carteira do Investidor structure) */}
        <BudgetSubNav activeTab={activeTab} setActiveTab={handleTabChange} />

        {activeTab === 'dashboard' && (
          <DashboardView
            summary={monthSummary}
            accounts={accounts}
            accountBalances={accountBalances}
            categories={categories}
            transactions={transactions}
            goals={goals}
            familyMembers={familyMembers}
            currentYear={currentYear}
            currentMonth={currentMonth}
            onOpenNewTransaction={handleOpenNewTransaction}
            onToggleConsolidated={handleToggleConsolidated}
            setActiveTab={handleTabChange}
            user={currentUser}
            onEditTransaction={handleEditTransaction}
            onUpdateSingleTransaction={handleUpdateSingleTransaction}
            pendingInvites={persistentInvites}
            onAcceptInvite={handleAcceptInvite}
            onRejectInvite={handleRejectInvite}
            loadingInviteId={loadingInviteId}
            onUserUpdated={(updatedUser) => {
              setCurrentUser(updatedUser);
              refreshData(updatedUser);
            }}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsView
            transactions={transactions}
            accounts={accounts}
            categories={categories}
            familyMembers={familyMembers}
            currentYear={currentYear}
            currentMonth={currentMonth}
            onOpenNewTransaction={handleOpenNewTransaction}
            onEditTransaction={handleEditTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onToggleConsolidated={handleToggleConsolidated}
            onUpdateTransaction={handleUpdateSingleTransaction}
            isReadOnly={isReadOnly}
          />
        )}

        {activeTab === 'calculator' && (
          <FinancialCalculatorView />
        )}

        {activeTab === 'accounts' && (
          <AccountsView
            accounts={accounts}
            accountBalances={accountBalances}
            onSaveAccount={handleSaveAccount}
            onDeleteAccount={handleDeleteAccount}
            userId={effectiveBudgetId}
            isReadOnly={isReadOnly}
          />
        )}

        {activeTab === 'categories' && (
          <CategoriesView
            categories={categories}
            onSaveCategory={handleSaveCategory}
            onDeleteCategory={handleDeleteCategory}
            familyMembers={familyMembers}
            onSaveFamilyMember={handleSaveFamilyMember}
            onDeleteFamilyMember={handleDeleteFamilyMember}
            onAddSubcategory={handleAddSubcategory}
            onRenameSubcategory={handleRenameSubcategory}
            onDeleteSubcategory={handleDeleteSubcategory}
            onMoveSubcategory={handleMoveSubcategory}
            onRestoreDefaultCategories={handleRestoreDefaultCategories}
            userId={effectiveBudgetId}
            isReadOnly={isReadOnly}
          />
        )}

        {activeTab === 'goals' && (
          <GoalsView
            goals={financialGoals}
            onSaveGoal={handleSaveGoal}
            onUpdateGoalProgress={handleUpdateGoalProgress}
            onDeleteGoal={handleDeleteGoal}
            userId={effectiveBudgetId}
            isReadOnly={isReadOnly}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            summary={monthSummary}
            transactions={transactions}
            accounts={accounts}
            categories={categories}
            familyMembers={familyMembers}
            currentYear={currentYear}
            currentMonth={currentMonth}
            user={currentUser}
          />
        )}

        {activeTab === 'gamification' && (
          <GamificationView userId={currentUser.id} />
        )}

        {(activeTab === 'ai-tips' || activeTab.startsWith('ai-tips:')) && (
          <AiTipsView
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            summary={monthSummary}
            transactions={transactions}
            categories={categories}
            currentYear={currentYear}
            currentMonth={currentMonth}
            user={currentUser}
            userId={effectiveBudgetId}
          />
        )}

        {(activeTab === 'portfolio' || activeTab.startsWith('portfolio:')) && (
          StorageService.isFeatureAllowed(currentUser, 'portfolio') ? (
            <ErrorBoundary>
              <PortfolioView
                key={activeTab}
                userId={effectiveBudgetId}
                initialSubTab={activeTab.includes(':') ? (activeTab.split(':')[1] as any) : 'dashboard'}
                onSubTabChange={(subTab) => handleTabChange(`portfolio:${subTab}`)}
                investmentTransactions={investmentTransactions}
                onSaveInvestmentTransaction={saveInvestmentTransaction}
                onDeleteInvestmentTransaction={deleteInvestmentTransaction}
                investmentGoals={investmentGoals}
                onSaveInvestmentGoal={handleSaveInvestmentGoal}
                onDeleteInvestmentGoal={handleDeleteInvestmentGoal}
                isReadOnly={isReadOnly}
                onDataChanged={async () => {
                  await persistAllData(accounts, transactions, investmentTransactions);
                }}
              />
            </ErrorBoundary>
          ) : (
            <div className="p-8 bg-[#18181B] border-2 border-[#D4AF37] rounded-3xl text-center space-y-4 my-8 shadow-2xl">
              <h2 className="text-xl font-black text-white font-serif">Recurso Bloqueado — Carteira do Investidor</h2>
              <p className="text-sm text-gray-300 max-w-md mx-auto">
                A Carteira do Investidor é um recurso exclusivo dos nossos planos VIP. Faça a assinatura para ter acesso completo a análises de patrimônio, proventos, rentabilidade e composição de carteira.
              </p>
              <button
                onClick={() => handleTabChange('plans')}
                className="px-6 py-3 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-sm rounded-xl cursor-pointer shadow-lg transition"
              >
                Conhecer Planos VIP
              </button>
            </div>
          )
        )}

        {activeTab === 'plans' && (
          <PlansAndPricingView
            user={currentUser}
            onUserUpdated={(updatedUser) => {
              setCurrentUser(updatedUser);
              refreshData(updatedUser);
            }}
          />
        )}
      </main>

      {/* Transaction Entry Modal */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        onSaveSingle={handleSaveSingleTransaction}
        onSaveMultiple={handleSaveMultipleTransactions}
        accounts={accounts}
        categories={categories}
        familyMembers={familyMembers}
        userId={effectiveBudgetId}
        initialTransaction={editingTx}
        onSaveAccount={handleSaveAccount}
        onSaveCategory={handleSaveCategory}
        onAddSubcategory={handleAddSubcategory}
        onSaveFamilyMember={handleSaveFamilyMember}
      />

      {/* Edit Profile Modal */}
      {currentUser && (
        <EditProfileModal
          isOpen={isEditProfileModalOpen}
          onClose={() => setIsEditProfileModalOpen(false)}
          user={currentUser}
          onSaveName={handleSaveUserName}
          onUserUpdated={(updatedUser) => {
            setCurrentUser(updatedUser);
            refreshData(updatedUser);
          }}
          onLogout={handleLogout}
        />
      )}

      {/* Shared Budget Modal */}
      {currentUser && (
        <SharedBudgetModal
          isOpen={isSharedBudgetModalOpen}
          onClose={() => setIsSharedBudgetModalOpen(false)}
          user={currentUser}
          onUserUpdated={(updatedUser) => {
            setCurrentUser(updatedUser);
            refreshData(updatedUser);
          }}
          pendingInvites={persistentInvites}
          onAcceptInvite={handleAcceptInvite}
          onRejectInvite={handleRejectInvite}
          loadingInviteId={loadingInviteId}
        />
      )}

      {/* Critical Actions Dedicated Menu Modal */}
      {currentUser && (
        <CriticalActionsModal
          isOpen={isCriticalActionsModalOpen}
          onClose={() => setIsCriticalActionsModalOpen(false)}
          user={currentUser}
          activeBudgetId={effectiveBudgetId}
          setTransactions={setTransactions}
          setAccounts={setAccounts}
          onResetBudgetToZero={handleResetBudgetToZero}
          onDeleteAccount={handleDeleteUserAccount}
        />
      )}

      {/* Feature Lock Modal for Day 91+ Free Users */}
      <FeatureLockModal
        isOpen={isFeatureLockModalOpen}
        onClose={() => setIsFeatureLockModalOpen(false)}
        onOpenPlans={() => {
          setIsFeatureLockModalOpen(false);
          setActiveTab('plans');
        }}
        featureTitle={featureLockTitle}
        featureDescription={featureLockDesc}
      />

      {/* Single-Device Concurrency Revocation Modal */}
      {sessionRevokedModalOpen && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border-2 border-amber-500 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <ShieldAlert className="w-9 h-9 stroke-[2.5]" />
            </div>
            <h3 className="text-lg sm:text-xl font-serif font-black text-[#121212]">
              Sessão Conectada em Outro Dispositivo
            </h3>
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
              Sua conta foi acessada em outro dispositivo ou navegador. Por motivos de segurança e consistência dos seus dados financeiros, este dispositivo foi desconectado automaticamente.
            </p>
            <div className="pt-2">
              <button
                onClick={() => {
                  setSessionRevokedModalOpen(false);
                  realtimeSync.disconnect();
                  StorageService.logout();
                  setCurrentUser(null);
                }}
                className="w-full py-3.5 px-6 bg-[#D4AF37] hover:bg-[#b8972e] text-[#121212] font-black rounded-2xl transition shadow-md text-sm cursor-pointer uppercase tracking-wider"
              >
                Entendi, Fazer Login Novamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Appwrite Cloud Sync & Connection Settings Modal */}
      <AppwriteSettingsModal
        isOpen={isAppwriteModalOpen}
        onClose={() => setIsAppwriteModalOpen(false)}
        userId={currentUser ? currentUser.email || currentUser.id : 'default'}
        onSyncComplete={() => refreshData(currentUser, false)}
      />

      {/* Sync Error Popup Modal */}
      {syncErrorPopupMessage && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border-2 border-red-500 text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner animate-bounce">
              <AlertTriangle className="w-9 h-9 stroke-[2.5]" />
            </div>
            <h3 className="text-lg sm:text-xl font-serif font-black text-[#121212]">
              Erro de Sincronização
            </h3>
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
              {syncErrorPopupMessage}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={() => setSyncErrorPopupMessage(null)}
                className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-black rounded-xl transition text-xs cursor-pointer"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  setSyncErrorPopupMessage(null);
                  if (currentUser) {
                    refreshData(currentUser, true);
                  }
                }}
                className="flex-1 py-3 px-4 bg-[#D4AF37] hover:bg-[#b8972e] text-[#121212] font-black rounded-xl transition shadow-md text-xs cursor-pointer"
              >
                Tentar Novamente
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Sync Completion Floating Toast Notification */}
      {syncToastMessage && (
        <div className="fixed bottom-6 right-6 z-[99999] flex items-center gap-3 bg-[#121212] text-white px-5 py-3.5 rounded-2xl shadow-2xl border-2 border-[#D4AF37] animate-in slide-in-from-bottom-5 duration-300">
          <div className="w-8 h-8 rounded-full bg-[#00C853] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Check className="w-5 h-5 stroke-[3]" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-black text-[#D4AF37] uppercase tracking-wider">Sincronização Concluída</span>
          </div>
          <button
            onClick={() => setSyncToastMessage(null)}
            className="ml-2 text-gray-400 hover:text-white transition cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-6 text-xs text-gray-700 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <p className="font-serif font-black text-[#9E7253] text-sm tracking-wide">DINHEIRO SEM FILTRO</p>
            <p className="text-[11px] text-[#D4AF37] font-black uppercase tracking-wider mt-0.5">DOMINE SEU DINHEIRO ANTES QUE ELE DOMINE VOCÊ!</p>
          </div>
          <div className="flex flex-col items-center sm:items-end text-center sm:text-right">
            <p className="font-serif font-bold text-[#9E7253] text-xs">DINHEIRO SEM FILTRO &copy; {new Date().getFullYear()}</p>
          </div>
        </div>
      </footer>

      {isResetPasswordOpen && recoveryTokens && (
        <ResetPasswordModal
          userId={recoveryTokens.userId}
          secret={recoveryTokens.secret}
          onSuccess={() => {
            setIsResetPasswordOpen(false);
            setRecoveryTokens(null);
          }}
          onClose={() => {
            setIsResetPasswordOpen(false);
            setRecoveryTokens(null);
          }}
        />
      )}

      {installmentPrompt && (
        <CustomAlertModal
          isOpen={installmentPrompt.isOpen}
          title={installmentPrompt.title}
          message={installmentPrompt.message}
          type={installmentPrompt.type || 'warning'}
          buttons={installmentPrompt.buttons}
          onClose={() => setInstallmentPrompt(null)}
        />
      )}

      <CustomAlertModal
        isOpen={!!globalAlert?.isOpen}
        message={globalAlert?.message || ''}
        title={globalAlert?.title}
        type={globalAlert?.type || 'info'}
        confirmText={globalAlert?.confirmText}
        cancelText={globalAlert?.cancelText}
        onConfirm={globalAlert?.onConfirm}
        onClose={() => {
          setGlobalAlert(null);
          refreshData(currentUser, false);
          window.dispatchEvent(new Event('portfolio_updated'));
          window.dispatchEvent(new Event('remote_data_updated'));
          window.dispatchEvent(new CustomEvent('financial_data_mutated'));
        }}
      />
    </div>
  );
}
