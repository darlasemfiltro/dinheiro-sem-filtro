import React, { useState, useEffect, useRef } from 'react';
// Last deployment sync: 2026-08-25T17:05:00Z - anti-crash and decoupled auth enforced
import { User, Account, Category, Transaction, Goal, FamilyMember, Subcategory } from './types';
import { StorageService, SEED_CATEGORIES } from './services/storage';
import { PortfolioStorageService } from './services/portfolioStorage';
import { realtimeSync } from './services/websocket';
import { subscribeToAppwriteRealtime, getAppwriteUser, appwriteCompleteOAuthSession, appwriteSignOut, appwriteDatabases as databases, appwriteClient as client, getAppwriteConfig } from './lib/appwrite';
import { Query } from 'appwrite';
import {
  saveAppData,
  persistCurrentStateToAppwrite,
  loadFromCloud,
  executeTransactionalGoal,
  mergeRemoteGoalsWithOptimistic,
  recordGoalDeletion,
  executeTransactionalStructure,
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
import { Heart, CheckCircle2, RefreshCw, ShieldAlert, AlertTriangle, Check, X, Cloud } from 'lucide-react';

export default function App() {
  const isPrivacyActive = usePrivacyMode();
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem('app_active_tab') || 'dashboard';
  });
  const [permissionVersion, setPermissionVersion] = useState<number>(() => {
    return Number(localStorage.getItem('app_permission_version') || '0');
  });

  // App Zoom State
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
    (document.documentElement.style as any).zoom = '100%';
  }, []);

  // Modal States
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
  } | null>(null);

  const now = new Date();
  const [currentYear, setCurrentYear] = useState<number>(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(now.getMonth() + 1);

  // Data Collections
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investmentTransactions, setInvestmentTransactions] = useState<any[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [persistentInvites, setPersistentInvites] = useState<any[]>([]);
  const [loadingInviteId, setLoadingInviteId] = useState<string | null>(null);

  // Transaction Modal State
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Sync Progress State
  const [syncProgress, setSyncProgress] = useState<number | null>(null);
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);
  const [syncErrorPopupMessage, setSyncErrorPopupMessage] = useState<string | null>(null);

  const [sessionRevokedModalOpen, setSessionRevokedModalOpen] = useState(false);
  const [isAppwriteModalOpen, setIsAppwriteModalOpen] = useState(false);

  const isSyncingRemoteRef = useRef(false);
  const hasPendingRefreshRef = useRef(false);

  // AUTHENTICATION & LOGIN FLOW (RESOLUÇÃO DO GOOGLE E TELA BRANCA)
  useEffect(() => {
    let mounted = true;

    const savedUserInitial = StorageService.getCurrentUser();
    const isExplicitLogout = localStorage.getItem('darla_explicit_logout') === 'true';
    
    const urlParams = new URLSearchParams(window.location.search);
    const oauthUserId = urlParams.get('userId');
    const oauthSecret = urlParams.get('secret') || urlParams.get('code');
    const isOAuthReturn = urlParams.has('project') || urlParams.has('domain') || urlParams.has('success') || urlParams.has('userId') || urlParams.has('secret');

    if (isExplicitLogout && !isOAuthReturn) {
      setCurrentUser(null);
      setIsAuthLoading(false);
      return;
    }

    const initAuthBackground = async () => {
      try {
        let appwriteUserActive: any = null;

        if (isOAuthReturn) {
          // Atraso seguro para navegadores processarem o cookie do Google
          await new Promise(r => setTimeout(r, 1000));
        }

        if (oauthUserId && oauthSecret) {
          await appwriteCompleteOAuthSession(oauthUserId, oauthSecret).catch(() => {});
        }

        try {
          appwriteUserActive = await getAppwriteUser();
        } catch (err) {
          console.warn('[Appwrite User Fetch Error]', err);
        }

        if (appwriteUserActive && appwriteUserActive.email) {
          const email = appwriteUserActive.email.trim().toLowerCase();
          const name = appwriteUserActive.name || email.split('@')[0];
          const avatar = appwriteUserActive?.prefs?.avatar;

          window.history.replaceState({}, document.title, window.location.pathname);
          localStorage.removeItem('darla_explicit_logout');
          localStorage.removeItem('darla_oauth_pending');

          const synced = await StorageService.ensureUserAndDataSyncedAsync(
            email, undefined, name, avatar, 'google'
          );

          if (synced && mounted) {
            localStorage.setItem('darla_current_user', JSON.stringify(synced));
            setCurrentUser(synced);
            setIsAuthLoading(false);
            refreshData(synced, true);
          }
        } else if (savedUserInitial && savedUserInitial.email) {
          // BLINDAGEM: Se a internet/Google falhar, resgata a sessão salva localmente (offline fallback)
          setCurrentUser(savedUserInitial);
          setIsAuthLoading(false);
          refreshData(savedUserInitial, false);
        } else {
          // Falso retorno ou bloqueio rígido de Cookies
          if (mounted) {
            setCurrentUser(null);
            setIsAuthLoading(false);
            if (isOAuthReturn) {
              alert("Não foi possível conectar ao Google. Se estiver usando uma ABA ANÔNIMA, o navegador bloqueia o login por segurança. Use uma aba normal.");
            }
          }
        }
      } catch (e) {
        if (mounted) {
          if (savedUserInitial && savedUserInitial.email) {
            setCurrentUser(savedUserInitial);
            refreshData(savedUserInitial, false);
          } else {
            setCurrentUser(null);
          }
          setIsAuthLoading(false);
        }
      }
    };

    initAuthBackground();

    return () => {
      mounted = false;
    };
  }, []);

  // Preenchimento instantâneo local
  useEffect(() => {
    if (currentUser) {
      const bId = StorageService.getEffectiveBudgetId(currentUser);
      if (bId) {
        setAccounts(StorageService.getAccounts(bId));
        setCategories(StorageService.getCategories(bId));
        setTransactions(StorageService.getTransactions(bId));
        setGoals(StorageService.getGoals(bId));
        setFamilyMembers(StorageService.getFamilyMembers(bId));
        setInvestmentTransactions(PortfolioStorageService.getTransactions(bId));
      }
    }
  }, [currentUser?.id]);

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

    const handleSharedBudgetsUpdated = () => {
      if (currentUser) refreshData(currentUser, false);
    };
    window.addEventListener('shared_budgets_updated', handleSharedBudgetsUpdated);

    const sharedBudgetSyncInterval = setInterval(async () => {
      if (currentUser?.email) {
        try {
          await StorageService.syncSharedBudgetsWithServer(currentUser.email);
          refreshData(currentUser, false);
          const newVer = Date.now();
          localStorage.setItem('app_permission_version', String(newVer));
          setPermissionVersion(newVer);
        } catch (e) {}
      }
    }, 4000);

    return () => {
      window.removeEventListener('sync-error', handleSyncError);
      window.removeEventListener('app-toast', handleAppToast);
      window.removeEventListener('shared_budgets_updated', handleSharedBudgetsUpdated);
      clearInterval(sharedBudgetSyncInterval);
    };
  }, [currentUser]);

  const loadInvites = async () => {
    try {
      const userEmail = currentUser?.email?.toLowerCase()?.trim();
      if (!userEmail) return;
      const cfg = getAppwriteConfig();
      
      let pending: any[] = [];
      try {
        const res = await databases.listDocuments(
          cfg.databaseId,
          'user_financials',
          [Query.equal('userId', userEmail)]
        );
        if (res.documents.length > 0 && res.documents[0].data) {
          const parsed = typeof res.documents[0].data === 'string' ? JSON.parse(res.documents[0].data) : res.documents[0].data;
          pending = parsed.pedidos_acesso || parsed.pending_invites || [];
        }
      } catch (e1) {
        const docId = getCanonicalAppwriteDocId(userEmail);
        const doc = await databases.getDocument(cfg.databaseId, 'user_financials', docId);
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
      const emailLimpo = String(currentUser.email).toLowerCase().trim();
      const docIdCorreto = getCanonicalAppwriteDocId(currentUser.email);
      const inviteType = invite.type || 'INVITE';

      if (inviteType === 'INVITE') {
        const docAtualizado = await databases.getDocument(cfg.databaseId, 'user_financials', docIdCorreto);
        let parsed = docAtualizado && docAtualizado.data ? (typeof docAtualizado.data === 'string' ? JSON.parse(docAtualizado.data) : docAtualizado.data) : {};

        parsed.active_budget_owner = invite.owner_budget_id;
        const existingInvites = parsed.pedidos_acesso || parsed.pending_invites || [];
        parsed.pedidos_acesso = existingInvites.filter((inv: any) => inv.id !== invite.id && inv.budget_owner_id !== invite.budget_owner_id);

        await databases.updateDocument(
          cfg.databaseId,
          'user_financials',
          docIdCorreto,
          { userId: currentUser.email, data: JSON.stringify(parsed) }
        );

        try {
          const ownerDocId = invite.owner_budget_id;
          const ownerDoc = await databases.getDocument(cfg.databaseId, 'user_financials', ownerDocId);
          let ownerParsed = ownerDoc && ownerDoc.data ? (typeof ownerDoc.data === 'string' ? JSON.parse(ownerDoc.data) : ownerDoc.data) : {};
          if (!Array.isArray(ownerParsed.shared_members)) ownerParsed.shared_members = [];
          if (!ownerParsed.shared_members.some((m: string) => m.toLowerCase() === currentUser.email.toLowerCase())) {
            ownerParsed.shared_members.push(currentUser.email.toLowerCase().trim());
          }
          if (!Array.isArray(ownerParsed.allowed_users)) ownerParsed.allowed_users = [];
          if (!ownerParsed.allowed_users.some((m: string) => m.toLowerCase() === currentUser.email.toLowerCase())) {
            ownerParsed.allowed_users.push(currentUser.email.toLowerCase().trim());
          }
          await databases.updateDocument(cfg.databaseId, 'user_financials', ownerDocId, { userId: ownerDoc.userId || ownerDocId, data: JSON.stringify(ownerParsed) });
        } catch (ownerErr) {}

        setPersistentInvites(prev => prev.filter(i => i.id !== invite.id && i.budget_owner_id !== invite.budget_owner_id));
        const updatedUser: User = { ...currentUser, budgetId: invite.owner_budget_id };
        localStorage.setItem('darla_current_user', JSON.stringify(updatedUser));
        setCurrentUser(updatedUser);
        refreshData(updatedUser);
        alert('Convite aceito com sucesso! O orçamento compartilhado foi ativado.');
        window.location.reload();
      } else {
        const emailMembro = (invite.emailRemetente || invite.from || invite.email || invite.remetente || invite.from_email || '').toLowerCase().trim();
        if (!emailMembro) return alert("[ERRO] Falha ao extrair e-mail do convite.");

        const doc = await databases.getDocument(cfg.databaseId, 'user_financials', docIdCorreto);
        const json = doc.data ? (typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data) : {};

        let membrosAtivos = Array.isArray(json.allowed_users) ? [...json.allowed_users] : [];
        if (!membrosAtivos.includes(emailMembro)) membrosAtivos.push(emailMembro);
        json.allowed_users = membrosAtivos;

        let sharedMembers = Array.isArray(json.shared_members) ? [...json.shared_members] : [];
        if (!sharedMembers.includes(emailMembro)) sharedMembers.push(emailMembro);
        json.shared_members = sharedMembers;

        json.pedidos_acesso = (json.pedidos_acesso || json.pending_invites || []).filter((p: any) => {
            const mail = (p.emailRemetente || p.from || p.email || p.remetente || p.from_email || '').toLowerCase().trim();
            return mail !== emailMembro && p.id !== invite.id;
        });

        await databases.updateDocument(cfg.databaseId, 'user_financials', docIdCorreto, { userId: currentUser.email, data: JSON.stringify(json) });

        const docIdConvidado = getCanonicalAppwriteDocId(emailMembro);
        try {
            const docConvidado = await databases.getDocument(cfg.databaseId, 'user_financials', docIdConvidado);
            const jsonConvidado = docConvidado.data ? (typeof docConvidado.data === 'string' ? JSON.parse(docConvidado.data) : docConvidado.data) : {};
            const orcamentosConectados = Array.isArray(jsonConvidado.shared_with_me) ? [...jsonConvidado.shared_with_me] : [];
            if (!orcamentosConectados.includes(currentUser.email)) orcamentosConectados.push(currentUser.email);
            jsonConvidado.shared_with_me = orcamentosConectados;
            await databases.updateDocument(cfg.databaseId, 'user_financials', docIdConvidado, { userId: emailMembro, data: JSON.stringify(jsonConvidado) });
        } catch (err) {}

        alert(`Sucesso! ${emailMembro} agora tem acesso ao seu orçamento.`);
        window.location.reload();
      }
    } catch (error: any) {
      alert(`[ERRO NO ACEITE] ${error.message || error}`);
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
      const docId = getCanonicalAppwriteDocId(currentUser.email);
      const doc = await databases.getDocument(cfg.databaseId, 'user_financials', docId);
      let parsed = doc && doc.data ? (typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data) : {};
      const existingInvites = parsed.pedidos_acesso || parsed.pending_invites || [];
      parsed.pedidos_acesso = existingInvites.filter((inv: any) => inv.id !== invite.id && inv.budget_owner_id !== invite.budget_owner_id && inv.from_email !== invite.from_email && inv.emailRemetente !== invite.emailRemetente);

      await databases.updateDocument(cfg.databaseId, 'user_financials', docId, { userId: currentUser.email, data: JSON.stringify(parsed) });
      setPersistentInvites(prev => prev.filter(i => i.id !== invite.id && i.budget_owner_id !== invite.budget_owner_id && i.from_email !== invite.from_email && i.emailRemetente !== invite.emailRemetente));
      alert('Solicitação/convite recusado com sucesso.');
    } catch (err: any) {
      console.error('Erro ao recusar:', err);
    } finally {
      setLoadingInviteId(null);
    }
  };

  const refreshData = async (user: User | null, forceRemote: boolean = true) => {
    if (!user) return;
    const budgetId = StorageService.getEffectiveBudgetId(user);
    if (!budgetId) return;

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

    if (isSyncingRemoteRef.current) {
      hasPendingRefreshRef.current = true;
      return;
    }
    isSyncingRemoteRef.current = true;
    hasPendingRefreshRef.current = false;

    try {
      if (forceRemote) {
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
        setSyncToastMessage('Todas as atualizações foram concluídas!');
        setTimeout(() => setSyncToastMessage(prev => (prev === 'Todas as atualizações foram concluídas!' ? null : prev)), 3500);
        setTimeout(() => setSyncProgress(null), 1000);
      }
    } catch (e) {
      if (forceRemote) setSyncProgress(null);
    } finally {
      isSyncingRemoteRef.current = false;
      if (forceRemote) setPendingSyncCount(0);

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

      if (hasPendingRefreshRef.current) {
        hasPendingRefreshRef.current = false;
        setTimeout(() => refreshData(user, false), 100);
      }
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    const syncFn = async () => {
      const budgetId = StorageService.getEffectiveBudgetId(currentUser);
      if (budgetId) refreshData(currentUser, false);
      syncUserEmailToDatabase(currentUser).catch(() => {});
    };
    syncFn();

    const activeBudgetId = StorageService.getEffectiveBudgetId(currentUser);
    realtimeSync.connect(currentUser.email, activeBudgetId);

    const handleFocus = () => {
      syncFn();
      refreshData(currentUser, true);
    };

    const handleRemoteUpdate = () => refreshData(currentUser, false);
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('remote_data_updated', handleRemoteUpdate);
    window.addEventListener('portfolio_updated', handleRemoteUpdate);
    window.addEventListener('shared_budgets_updated', handleRemoteUpdate);
    window.addEventListener('financial_data_mutated', handleRemoteUpdate);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('remote_data_updated', handleRemoteUpdate);
      window.removeEventListener('portfolio_updated', handleRemoteUpdate);
      window.removeEventListener('shared_budgets_updated', handleRemoteUpdate);
      window.removeEventListener('financial_data_mutated', handleRemoteUpdate);
    };
  }, [currentUser?.id]);

  const handleLoginSuccess = (user: User) => {
    localStorage.removeItem('darla_explicit_logout');
    setCurrentUser(user);
    try { localStorage.setItem('darla_current_user', JSON.stringify(user)); } catch (e) {}
    refreshData(user, false);
    window.location.reload();
  };

  const handleLogout = async () => {
    try {
      realtimeSync.disconnect();
      StorageService.logout(true);
      localStorage.setItem('darla_explicit_logout', 'true');
      await appwriteSignOut().catch(() => {});
    } catch (error) {} finally {
      setCurrentUser(null);
      window.location.href = '/';
    }
  };

  const handleResetBudgetToZero = () => {
    if (currentUser) {
      StorageService.resetUserBudgetToZero(effectiveBudgetId);
      refreshData(currentUser);
    }
  };

  const handleDeleteUserAccount = async () => {
    if (currentUser) {
      realtimeSync.disconnect();
      await StorageService.deleteUserAccount(currentUser.id);
      setCurrentUser(null);
    }
  };

  if (isAuthLoading && !currentUser) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-gray-700 tracking-wide">Abrindo o aplicativo...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const effectiveBudgetId = StorageService.getEffectiveBudgetId(currentUser);
  const monthSummary = calculateMonthSummary(currentYear, currentMonth, transactions, accounts);
  const accountBalances = calculateAccountBalances(accounts, transactions);

  const checkReadOnlyPermission = (): boolean => {
    if (currentUser && StorageService.isCurrentUserReadOnly(currentUser)) {
      alert("Ação bloqueada: Você possui apenas permissão de LEITURA neste orçamento.");
      return true;
    }
    return false;
  };

  const buildAppFinancialState = (overrideTxs?: Transaction[], overrideAccounts?: Account[]) => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    const currentTxs = overrideTxs || StorageService.getTransactions(budgetId);
    const currentAccounts = overrideAccounts || StorageService.getAccounts(budgetId);
    const currentGoals = StorageService.getGoals(budgetId);
    const currentFamily = StorageService.getFamilyMembers(budgetId);
    const budgets = StorageService.deduplicateSharedBudgets();
    const familyBudget = [...currentGoals, ...currentFamily, ...budgets];
    const investorPortfolio = PortfolioStorageService.getAssets(budgetId);
    const invTxs = PortfolioStorageService.getTransactions(budgetId);
    const divs = PortfolioStorageService.getDividends(budgetId);
    const investmentTransactions = [...invTxs, ...divs];

    return {
      transactions: currentTxs,
      familyBudget: familyBudget,
      accounts: currentAccounts,
      investorPortfolio: investorPortfolio,
      investmentTransactions: investmentTransactions,
      goals: currentGoals,
      updatedAt: new Date().toISOString()
    };
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

  const persistAllData = async (updatedAccounts?: any[], updatedTransactions?: any[], updatedInvestmentTransactions?: any[]) => {
    const accountsToPersist = updatedAccounts || accounts;
    const transactionsToPersist = updatedTransactions || transactions;
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';

    setAccounts(accountsToPersist);
    StorageService.setAccounts(accountsToPersist);
    setTransactions(transactionsToPersist);
    StorageService.setTransactions(transactionsToPersist);

    if (updatedInvestmentTransactions) {
      setInvestmentTransactions(updatedInvestmentTransactions);
    }

    try {
      const fullState = buildAppFinancialState(transactionsToPersist, accountsToPersist);
      await saveAppData(fullState);
    } catch (appwriteErr) {}

    try {
      await StorageService.syncUserMutationToServer(budgetId);
    } catch (error: any) {}

    window.dispatchEvent(new Event('portfolio_updated'));
    window.dispatchEvent(new Event('remote_data_updated'));
    window.dispatchEvent(new CustomEvent('financial_data_mutated'));

    return true;
  };

  const handleSaveSingleTransaction = async (txData: Omit<Transaction, 'id' | 'createdAt'>): Promise<boolean> => {
    if (checkReadOnlyPermission()) return false;
    let nextTransactions = transactions;
    if (editingTx) {
      const updated: Transaction = { ...txData, id: editingTx.id, createdAt: editingTx.createdAt };
      StorageService.updateTransaction(updated);
      nextTransactions = transactions.map((t) => (t.id === updated.id ? updated : t));
    } else {
      const saved = StorageService.addTransaction(txData);
      nextTransactions = [saved, ...transactions];
      if (currentUser) GamificationService.recordAction(currentUser.id, 'launches');
    }

    const success = await persistAllData(accounts, nextTransactions);
    if (success) {
      setIsTxModalOpen(false);
      setEditingTx(null);
      refreshData(currentUser, false);
    }
    return success;
  };

  const handleSaveMultipleTransactions = async (txList: Omit<Transaction, 'id' | 'createdAt'>[]): Promise<boolean> => {
    if (checkReadOnlyPermission()) return false;
    const added = StorageService.addMultipleTransactions(txList);
    const nextTransactions = [...added, ...transactions];
    if (currentUser) GamificationService.recordAction(currentUser.id, 'launches', txList.length);

    const success = await persistAllData(accounts, nextTransactions);
    if (success) {
      setIsTxModalOpen(false);
      refreshData(currentUser, false);
    }
    return success;
  };

  const handleDeleteTransaction = async (id: string): Promise<boolean> => {
    if (checkReadOnlyPermission()) return false;
    StorageService.deleteTransaction(id);
    const nextTransactions = transactions.filter((t) => t.id !== id);
    const success = await persistAllData(accounts, nextTransactions);
    if (success) refreshData(currentUser, false);
    return success;
  };

  const handleToggleConsolidated = async (id: string): Promise<boolean> => {
    if (checkReadOnlyPermission()) return false;
    StorageService.toggleConsolidated(id);
    const nextTransactions = transactions.map((t) => (t.id === id ? { ...t, isConsolidated: !t.isConsolidated } : t));
    if (currentUser) GamificationService.recordAction(currentUser.id, 'consolidation');
    const success = await persistAllData(accounts, nextTransactions);
    if (success) refreshData(currentUser, false);
    return success;
  };

  const handleUpdateSingleTransaction = async (tx: Transaction): Promise<boolean> => {
    if (checkReadOnlyPermission()) return false;
    StorageService.updateTransaction(tx);
    const nextTransactions = transactions.map((t) => (t.id === tx.id ? tx : t));
    const success = await persistAllData(accounts, nextTransactions);
    if (success) refreshData(currentUser, false);
    return success;
  };

  const saveInvestmentTransaction = async (newTx: any) => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    const tempId = newTx.id || `tx_inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const txItem = {
      id: tempId,
      userId: budgetId,
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

    const previousList = [...investmentTransactions];
    setInvestmentTransactions(prev => {
      const exists = prev.some(t => t.id === txItem.id);
      const next = exists ? prev.map(t => (t.id === txItem.id ? txItem : t)) : [txItem, ...prev];
      (PortfolioStorageService as any).saveToAllAliasKeys('darla_portfolio_transactions', budgetId, next);
      return next;
    });

    if (newTx.id) {
      PortfolioStorageService.updateTransaction(txItem, budgetId);
    } else {
      PortfolioStorageService.addTransaction(txItem, budgetId);
    }

    window.dispatchEvent(new Event('portfolio_updated'));
    window.dispatchEvent(new Event('remote_data_updated'));
    window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId: budgetId } }));

    (async () => {
      try {
        const action = newTx.id ? 'updateInvestmentTransaction' : 'addInvestmentTransaction';
        const result = await executeTransactionalInvestmentTransaction(budgetId, action, { transactionData: txItem, transactionId: txItem.id });
        if (result.success && result.investmentTransactions) {
          const merged = mergeRemoteInvestmentTransactionsWithOptimistic(result.investmentTransactions);
          setInvestmentTransactions(merged);
          (PortfolioStorageService as any).saveToAllAliasKeys('darla_portfolio_transactions', budgetId, merged);
        }
      } catch (error: any) {
        setInvestmentTransactions(previousList);
        (PortfolioStorageService as any).saveToAllAliasKeys('darla_portfolio_transactions', budgetId, previousList);
        setGlobalAlert({ isOpen: true, message: 'Erro ao salvar transação de investimento na nuvem. Verifique sua conexão.', type: 'error' });
      }
    })();
    return true;
  };

  const deleteInvestmentTransaction = async (txId: string) => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    const previousList = [...investmentTransactions];

    recordInvestmentTxDeletion(txId);
    PortfolioStorageService.deleteTransaction(txId, budgetId);
    setInvestmentTransactions(prev => {
      const next = prev.filter(t => t.id !== txId);
      (PortfolioStorageService as any).saveToAllAliasKeys('darla_portfolio_transactions', budgetId, next);
      return next;
    });

    window.dispatchEvent(new Event('portfolio_updated'));
    window.dispatchEvent(new Event('remote_data_updated'));
    window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId: budgetId } }));

    (async () => {
      try {
        const result = await executeTransactionalInvestmentTransaction(budgetId, 'deleteInvestmentTransaction', { transactionId: txId });
        if (result.success && result.investmentTransactions) {
          const merged = mergeRemoteInvestmentTransactionsWithOptimistic(result.investmentTransactions);
          setInvestmentTransactions(merged);
          (PortfolioStorageService as any).saveToAllAliasKeys('darla_portfolio_transactions', budgetId, merged);
        }
      } catch (error: any) {
        setInvestmentTransactions(previousList);
        (PortfolioStorageService as any).saveToAllAliasKeys('darla_portfolio_transactions', budgetId, previousList);
        setGlobalAlert({ isOpen: true, message: 'Erro ao excluir transação na nuvem. Verifique sua conexão.', type: 'error' });
      }
    })();
    return true;
  };

  const handleSaveAccount = async (acc: Account, updatedAccounts?: Account[]): Promise<boolean> => {
    if (checkReadOnlyPermission()) return false;
    StorageService.saveAccount(acc);
    const accountsList = updatedAccounts || (accounts.some(a => a.id === acc.id) ? accounts.map(a => a.id === acc.id ? acc : a) : [...accounts, acc]);
    const success = await persistAllData(accountsList);
    refreshData(currentUser, false);
    return success;
  };

  const handleDeleteAccount = async (id: string): Promise<boolean> => {
    if (checkReadOnlyPermission()) return false;
    StorageService.deleteAccount(id);
    const accountsList = accounts.filter(a => a.id !== id);
    const success = await persistAllData(accountsList);
    refreshData(currentUser, false);
    return success;
  };

  const handleSaveCategory = async (cat: Category) => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    StorageService.saveCategory(cat);
    setCategories(StorageService.getCategories(budgetId));
    const isEditing = categories.some((c) => c.id === cat.id);
    await executeTransactionalStructure(budgetId, isEditing ? 'updateCategory' : 'addCategory', { categoryData: cat, categoryId: cat.id });
    refreshData(currentUser, false);
  };

  const handleDeleteCategory = async (id: string) => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    recordCategoryDeletion(id);
    StorageService.deleteCategory(id);
    setCategories(StorageService.getCategories(budgetId).filter((c) => c.id !== id));
    await executeTransactionalStructure(budgetId, 'deleteCategory', { categoryId: id });
    refreshData(currentUser, false);
  };

  const handleAddSubcategory = async (cat: Category, parentSubId: string | null, name: string) => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    const newSub: Subcategory = { id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, categoryId: cat.id, parentId: parentSubId || undefined, name: name.trim(), subcategories: [] };
    const updatedCat: Category = { ...cat, subcategories: addSubcategoryToTree(cat.subcategories || [], parentSubId, newSub) };
    StorageService.saveCategory(updatedCat);
    setCategories(StorageService.getCategories(budgetId));
    await executeTransactionalStructure(budgetId, 'addSubcategory', { categoryId: cat.id, parentSubId, subData: newSub });
    refreshData(currentUser, false);
  };

  const handleRenameSubcategory = async (cat: Category, subId: string, newName: string) => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    const updatedCat: Category = { ...cat, subcategories: renameSubcategoryInTree(cat.subcategories || [], subId, newName.trim()) };
    StorageService.saveCategory(updatedCat);
    setCategories(StorageService.getCategories(budgetId));
    await executeTransactionalStructure(budgetId, 'renameSubcategory', { categoryId: cat.id, subId, newSubName: newName.trim() });
    refreshData(currentUser, false);
  };

  const handleDeleteSubcategory = async (cat: Category, subId: string) => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    const updatedCat: Category = { ...cat, subcategories: deleteSubcategoryFromTree(cat.subcategories || [], subId) };
    StorageService.saveCategory(updatedCat);
    setCategories(StorageService.getCategories(budgetId));
    await executeTransactionalStructure(budgetId, 'deleteSubcategory', { categoryId: cat.id, subId });
    refreshData(currentUser, false);
  };

  const handleMoveSubcategory = async (sub: Subcategory, sourceCat: Category, targetCat: Category) => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    const updatedSourceCat = { ...sourceCat, subcategories: deleteSubcategoryFromTree(sourceCat.subcategories || [], sub.id) };
    const updatedTargetCat = { ...targetCat, subcategories: [...(targetCat.subcategories || []), { ...sub, categoryId: targetCat.id, parentId: undefined }] };
    StorageService.saveCategory(updatedSourceCat);
    StorageService.saveCategory(updatedTargetCat);
    setCategories(StorageService.getCategories(budgetId));
    await executeTransactionalStructure(budgetId, 'moveSubcategory', { sourceCatId: sourceCat.id, targetCatId: targetCat.id, subData: sub });
    refreshData(currentUser, false);
  };

  const handleRestoreDefaultCategories = async () => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    const restored = SEED_CATEGORIES.map((c) => ({ ...c, userId: budgetId }));
    StorageService.setCategories(restored);
    setCategories(restored);
    await executeTransactionalStructure(budgetId, 'restoreDefaultCategories', { categoriesList: restored });
    refreshData(currentUser, false);
  };

  const handleSaveFamilyMember = async (member: FamilyMember) => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    StorageService.saveFamilyMember(member);
    setFamilyMembers(StorageService.getFamilyMembers(budgetId));
    const isEditing = familyMembers.some((f) => f.id === member.id);
    await executeTransactionalStructure(budgetId, isEditing ? 'updateMember' : 'addMember', { memberData: member, memberId: member.id });
    refreshData(currentUser, false);
  };

  const handleDeleteFamilyMember = async (id: string) => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    recordMemberDeletion(id);
    StorageService.deleteFamilyMember(id);
    setFamilyMembers(StorageService.getFamilyMembers(budgetId).filter((f) => f.id !== id));
    await executeTransactionalStructure(budgetId, 'deleteMember', { memberId: id });
    refreshData(currentUser, false);
  };

  const handleSaveGoal = async (goal: Goal) => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    StorageService.saveGoal(goal);
    PortfolioStorageService.addGoal(goal as any, budgetId);
    setGoals(StorageService.getGoals(budgetId));
    const isEditing = goals.some((g) => g.id === goal.id);
    await executeTransactionalGoal(budgetId, isEditing ? 'updateGoal' : 'addGoal', { goalData: goal, goalId: goal.id });
    refreshData(currentUser, false);
  };

  const handleUpdateGoalProgress = async (goalId: string, addedAmount: number) => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    StorageService.updateGoalProgress(goalId, addedAmount);
    setGoals(StorageService.getGoals(budgetId));
    await executeTransactionalGoal(budgetId, 'updateGoalProgress', { goalId, addedAmount });
    refreshData(currentUser, false);
  };

  const handleDeleteGoal = async (id: string) => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    recordGoalDeletion(id);
    StorageService.deleteGoal(id);
    PortfolioStorageService.deleteGoal(id, budgetId);
    setGoals(StorageService.getGoals(budgetId).filter((g) => g.id !== id));
    await executeTransactionalGoal(budgetId, 'deleteGoal', { goalId: id });
    refreshData(currentUser, false);
  };

  const handleSaveUserName = (newName: string, avatarUrl?: string) => {
    if (!currentUser) return;
    const updated = StorageService.updateUserProfile(currentUser.id, newName, avatarUrl);
    setCurrentUser(updated ? updated : { ...currentUser, name: newName, avatarUrl });
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
      <Header
        user={currentUser}
        syncProgress={syncProgress}
        currentYear={currentYear}
        currentMonth={currentMonth}
        onYearMonthChange={(year, month) => { setCurrentYear(year); setCurrentMonth(month); }}
        onOpenNewTransaction={handleOpenNewTransaction}
        onOpenEditProfile={() => setIsEditProfileModalOpen(true)}
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

      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-xs border-b border-gray-200" id="fixed-top-menu-bar">
        <Navigation activeTab={activeTab} setActiveTab={handleTabChange} zoomLevel={zoomLevel} onZoomChange={handleZoomChange} onOpenAppwriteSettings={() => setIsAppwriteModalOpen(true)} />
      </div>

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-2 sm:px-4 lg:px-8 pt-2 pb-6 min-w-0 transition-[zoom] duration-150" style={{ zoom: `${zoomLevel}%` }}>
        <TrialCountdownWidget user={currentUser} onGoToPlans={() => handleTabChange('plans')} />
        <BudgetSubNav activeTab={activeTab} setActiveTab={handleTabChange} />

        {activeTab === 'dashboard' && (
          <DashboardView
            summary={monthSummary} accounts={accounts} accountBalances={accountBalances} categories={categories} transactions={transactions}
            goals={goals} familyMembers={familyMembers} currentYear={currentYear} currentMonth={currentMonth}
            onOpenNewTransaction={handleOpenNewTransaction} onToggleConsolidated={handleToggleConsolidated} setActiveTab={handleTabChange}
            user={currentUser} onEditTransaction={handleEditTransaction} onUpdateSingleTransaction={handleUpdateSingleTransaction}
            pendingInvites={persistentInvites} onAcceptInvite={handleAcceptInvite} onRejectInvite={handleRejectInvite} loadingInviteId={loadingInviteId}
            onUserUpdated={(updatedUser) => { setCurrentUser(updatedUser); refreshData(updatedUser); }}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsView transactions={transactions} accounts={accounts} categories={categories} familyMembers={familyMembers} currentYear={currentYear} currentMonth={currentMonth} onOpenNewTransaction={handleOpenNewTransaction} onEditTransaction={handleEditTransaction} onDeleteTransaction={handleDeleteTransaction} onToggleConsolidated={handleToggleConsolidated} onUpdateTransaction={handleUpdateSingleTransaction} />
        )}

        {activeTab === 'calculator' && <FinancialCalculatorView />}

        {activeTab === 'accounts' && (
          <AccountsView accounts={accounts} accountBalances={accountBalances} onSaveAccount={handleSaveAccount} onDeleteAccount={handleDeleteAccount} userId={effectiveBudgetId} />
        )}

        {activeTab === 'categories' && (
          <CategoriesView categories={categories} onSaveCategory={handleSaveCategory} onDeleteCategory={handleDeleteCategory} familyMembers={familyMembers} onSaveFamilyMember={handleSaveFamilyMember} onDeleteFamilyMember={handleDeleteFamilyMember} onAddSubcategory={handleAddSubcategory} onRenameSubcategory={handleRenameSubcategory} onDeleteSubcategory={handleDeleteSubcategory} onMoveSubcategory={handleMoveSubcategory} onRestoreDefaultCategories={handleRestoreDefaultCategories} userId={effectiveBudgetId} />
        )}

        {activeTab === 'goals' && (
          <GoalsView goals={goals} onSaveGoal={handleSaveGoal} onUpdateGoalProgress={handleUpdateGoalProgress} onDeleteGoal={handleDeleteGoal} userId={effectiveBudgetId} />
        )}

        {activeTab === 'reports' && (
          <ReportsView summary={monthSummary} transactions={transactions} accounts={accounts} categories={categories} familyMembers={familyMembers} currentYear={currentYear} currentMonth={currentMonth} user={currentUser} />
        )}

        {activeTab === 'gamification' && <GamificationView userId={currentUser.id} />}

        {(activeTab === 'ai-tips' || activeTab.startsWith('ai-tips:')) && (
          <AiTipsView activeTab={activeTab} setActiveTab={handleTabChange} summary={monthSummary} transactions={transactions} categories={categories} currentYear={currentYear} currentMonth={currentMonth} user={currentUser} userId={effectiveBudgetId} />
        )}

        {(activeTab === 'portfolio' || activeTab.startsWith('portfolio:')) && (
          StorageService.isFeatureAllowed(currentUser, 'portfolio') ? (
            <ErrorBoundary>
              <PortfolioView key={activeTab} userId={effectiveBudgetId} initialSubTab={activeTab.includes(':') ? (activeTab.split(':')[1] as any) : 'dashboard'} onSubTabChange={(subTab) => handleTabChange(`portfolio:${subTab}`)} investmentTransactions={investmentTransactions} onSaveInvestmentTransaction={saveInvestmentTransaction} onDeleteInvestmentTransaction={deleteInvestmentTransaction} onDataChanged={async () => { await persistAllData(accounts, transactions, investmentTransactions); }} />
            </ErrorBoundary>
          ) : (
            <div className="p-8 bg-[#18181B] border-2 border-[#D4AF37] rounded-3xl text-center space-y-4 my-8 shadow-2xl">
              <h2 className="text-xl font-black text-white font-serif">Recurso Bloqueado — Carteira do Investidor</h2>
              <p className="text-sm text-gray-300 max-w-md mx-auto">A Carteira do Investidor é um recurso exclusivo dos nossos planos VIP. Faça a assinatura para ter acesso completo a análises de patrimônio, proventos, rentabilidade e composição de carteira.</p>
              <button onClick={() => handleTabChange('plans')} className="px-6 py-3 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-sm rounded-xl cursor-pointer shadow-lg transition">Conhecer Planos VIP</button>
            </div>
          )
        )}

        {activeTab === 'plans' && <PlansAndPricingView user={currentUser} onUserUpdated={(updatedUser) => { setCurrentUser(updatedUser); refreshData(updatedUser); }} />}
      </main>

      <TransactionModal isOpen={isTxModalOpen} onClose={() => setIsTxModalOpen(false)} onSaveSingle={handleSaveSingleTransaction} onSaveMultiple={handleSaveMultipleTransactions} accounts={accounts} categories={categories} familyMembers={familyMembers} userId={effectiveBudgetId} initialTransaction={editingTx} onSaveAccount={handleSaveAccount} onSaveCategory={handleSaveCategory} onSaveFamilyMember={handleSaveFamilyMember} />

      {currentUser && <EditProfileModal isOpen={isEditProfileModalOpen} onClose={() => setIsEditProfileModalOpen(false)} user={currentUser} onSaveName={handleSaveUserName} onUserUpdated={(updatedUser) => { setCurrentUser(updatedUser); refreshData(updatedUser); }} onLogout={handleLogout} />}

      {currentUser && <CriticalActionsModal isOpen={isCriticalActionsModalOpen} onClose={() => setIsCriticalActionsModalOpen(false)} user={currentUser} onResetBudgetToZero={handleResetBudgetToZero} onDeleteAccount={handleDeleteUserAccount} />}

      <FeatureLockModal isOpen={isFeatureLockModalOpen} onClose={() => setIsFeatureLockModalOpen(false)} onOpenPlans={() => { setIsFeatureLockModalOpen(false); setActiveTab('plans'); }} featureTitle={featureLockTitle} featureDescription={featureLockDesc} />

      {sessionRevokedModalOpen && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border-2 border-amber-500 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-inner"><ShieldAlert className="w-9 h-9 stroke-[2.5]" /></div>
            <h3 className="text-lg sm:text-xl font-serif font-black text-[#121212]">Sessão Conectada em Outro Dispositivo</h3>
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">Sua conta foi acessada em outro dispositivo ou navegador. Por motivos de segurança e consistência dos seus dados financeiros, este dispositivo foi desconectado automaticamente.</p>
            <div className="pt-2"><button onClick={() => { setSessionRevokedModalOpen(false); realtimeSync.disconnect(); StorageService.logout(); setCurrentUser(null); }} className="w-full py-3.5 px-6 bg-[#D4AF37] hover:bg-[#b8972e] text-[#121212] font-black rounded-2xl transition shadow-md text-sm cursor-pointer uppercase tracking-wider">Entendi, Fazer Login Novamente</button></div>
          </div>
        </div>
      )}

      <AppwriteSettingsModal isOpen={isAppwriteModalOpen} onClose={() => setIsAppwriteModalOpen(false)} userId={currentUser ? currentUser.email || currentUser.id : 'default'} onSyncComplete={() => refreshData(currentUser, false)} />

      {syncErrorPopupMessage && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border-2 border-red-500 text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner animate-bounce"><AlertTriangle className="w-9 h-9 stroke-[2.5]" /></div>
            <h3 className="text-lg sm:text-xl font-serif font-black text-[#121212]">Erro de Sincronização</h3>
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">{syncErrorPopupMessage}</p>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button onClick={() => setSyncErrorPopupMessage(null)} className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-black rounded-xl transition text-xs cursor-pointer">Fechar</button>
              <button onClick={() => { setSyncErrorPopupMessage(null); if (currentUser) { refreshData(currentUser, true); } }} className="flex-1 py-3 px-4 bg-[#D4AF37] hover:bg-[#b8972e] text-[#121212] font-black rounded-xl transition shadow-md text-xs cursor-pointer">Tentar Novamente</button>
            </div>
          </div>
        </div>
      )}

      {syncToastMessage && (
        <div className="fixed bottom-6 right-6 z-[99999] flex items-center gap-3 bg-[#121212] text-white px-5 py-3.5 rounded-2xl shadow-2xl border-2 border-[#D4AF37] animate-in slide-in-from-bottom-5 duration-300">
          <div className="w-8 h-8 rounded-full bg-[#00C853] text-white flex items-center justify-center shrink-0 shadow-xs"><Check className="w-5 h-5 stroke-[3]" /></div>
          <div className="flex flex-col"><span className="text-xs font-black text-[#D4AF37] uppercase tracking-wider">Sincronização Concluída</span></div>
          <button onClick={() => setSyncToastMessage(null)} className="ml-2 text-gray-400 hover:text-white transition cursor-pointer p-1"><X className="w-4 h-4" /></button>
        </div>
      )}

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

      <CustomAlertModal isOpen={!!globalAlert?.isOpen} message={globalAlert?.message || ''} title={globalAlert?.title} type={globalAlert?.type || 'info'} onClose={() => { setGlobalAlert(null); refreshData(currentUser, false); window.dispatchEvent(new Event('portfolio_updated')); window.dispatchEvent(new Event('remote_data_updated')); window.dispatchEvent(new CustomEvent('financial_data_mutated')); }} />
    </div>
  );
}
