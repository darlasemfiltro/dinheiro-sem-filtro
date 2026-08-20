import React, { useState, useEffect, useRef } from 'react';
import { User, Account, Category, Transaction, Goal, FamilyMember } from './types';
import { StorageService } from './services/storage';
import { PortfolioStorageService } from './services/portfolioStorage';
import { realtimeSync } from './services/websocket';
import { auth, onAuthStateChanged, firebaseSignOut, subscribeToUserFirestoreChanges } from './lib/firebase';
import { subscribeToAppwriteRealtime, getAppwriteUser, appwriteSignOut, appwriteDatabases as databases, appwriteClient as client } from './lib/appwrite';
import { saveAppData, persistCurrentStateToAppwrite, loadFromCloud } from './lib/appwriteSync';
import { calculateMonthSummary, calculateAccountBalances, usePrivacyMode } from './utils/finance';
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
import { AiTipsView } from './components/AiTipsView';
import { GamificationService } from './services/gamification';
import { TransactionModal } from './components/TransactionModal';
import { SharedBudgetModal } from './components/SharedBudgetModal';
import { EditProfileModal } from './components/EditProfileModal';
import { CriticalActionsModal } from './components/CriticalActionsModal';
import { FeatureLockModal } from './components/FeatureLockModal';
import { TrialCountdownWidget } from './components/TrialCountdownWidget';
import { BudgetSubNav } from './components/BudgetSubNav';
import { AppwriteSettingsModal } from './components/AppwriteSettingsModal';
import { Heart, CheckCircle2, RefreshCw, ShieldAlert, AlertTriangle, Check, X, Cloud } from 'lucide-react';

export default function App() {
  const isPrivacyActive = usePrivacyMode();
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    return StorageService.getCurrentUser();
  });
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem('app_active_tab') || 'dashboard';
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
  const [isSharedBudgetModalOpen, setIsSharedBudgetModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isCriticalActionsModalOpen, setIsCriticalActionsModalOpen] = useState(false);
  const [isFeatureLockModalOpen, setIsFeatureLockModalOpen] = useState(false);
  const [featureLockTitle, setFeatureLockTitle] = useState('');
  const [featureLockDesc, setFeatureLockDesc] = useState('');
  const [editProfileInitialTab, setEditProfileInitialTab] = useState<'profile' | 'request_access' | 'give_access'>('profile');

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
    const bId = user ? StorageService.getEffectiveBudgetId(user) : 'default';
    return PortfolioStorageService.getTransactions(bId);
  });
  const [goals, setGoals] = useState<Goal[]>(() => {
    const user = StorageService.getCurrentUser();
    const bId = user ? StorageService.getEffectiveBudgetId(user) : '';
    return bId ? StorageService.getGoals(bId) : [];
  });
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(() => {
    const user = StorageService.getCurrentUser();
    const bId = user ? StorageService.getEffectiveBudgetId(user) : '';
    return bId ? StorageService.getFamilyMembers(bId) : [];
  });

  const [budgets, setBudgets] = useState<any[]>(() => StorageService.deduplicateSharedBudgets());

  const DATABASE_ID = '6a83aa8d0038331e040f';
  const COLLECTION_ID = 'user_financials';
  const DOCUMENT_ID = '6a849358002db9e638ce';

  useEffect(() => {
    // Carga inicial
    async function fetchInitialData() {
      try {
        const remoteData = await loadFromCloud();
        if (remoteData) {
          if (remoteData.transactions) {
            setTransactions(remoteData.transactions);
            StorageService.setTransactions(remoteData.transactions);
          } else {
            setTransactions([]);
            StorageService.setTransactions([]);
          }
          if (remoteData.accounts) {
            setAccounts(remoteData.accounts);
            StorageService.setAccounts(remoteData.accounts);
          } else {
            setAccounts([]);
            StorageService.setAccounts([]);
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
          const user = StorageService.getCurrentUser();
          const bId = user ? StorageService.getEffectiveBudgetId(user) : 'default';
          if (remoteData.investorPortfolio) {
            PortfolioStorageService.saveAssets(remoteData.investorPortfolio, bId);
          }
          if (remoteData.investmentTransactions) {
            setInvestmentTransactions(remoteData.investmentTransactions);
            (PortfolioStorageService as any).saveToAllAliasKeys('darla_portfolio_transactions', bId, remoteData.investmentTransactions);
          } else {
            setInvestmentTransactions([]);
            (PortfolioStorageService as any).saveToAllAliasKeys('darla_portfolio_transactions', bId, []);
          }
          window.dispatchEvent(new Event('portfolio_updated'));
        }
      } catch (err: any) {
        const isNetworkError = err?.message?.includes('Failed to fetch') || err?.name === 'TypeError';
        if (!isNetworkError) {
          console.warn('[Initial Load Notice]', err?.message || err);
        }
      }
    }
    fetchInitialData();

    // Inscrição Realtime
    let unsubscribe = () => {};
    try {
      unsubscribe = client.subscribe(
        `databases.${DATABASE_ID}.collections.${COLLECTION_ID}.documents.${DOCUMENT_ID}`,
        (response: any) => {
          if (response.payload?.data) {
            const remote = JSON.parse(response.payload.data);
            if (remote.transactions) {
              setTransactions(remote.transactions);
              StorageService.setTransactions(remote.transactions);
            } else {
              setTransactions([]);
              StorageService.setTransactions([]);
            }
            if (remote.accounts) {
              setAccounts(remote.accounts);
              StorageService.setAccounts(remote.accounts);
            } else {
              setAccounts([]);
              StorageService.setAccounts([]);
            }
            if (remote.budgets) {
              setBudgets(remote.budgets);
            }
            if (remote.familyBudget) {
              const goalsList = remote.familyBudget.filter((item: any) => item.targetAmount !== undefined || item.targetDate !== undefined);
              const familyList = remote.familyBudget.filter((item: any) => item.relationship !== undefined || (item.name && item.color && !item.targetAmount));
              if (goalsList.length > 0) {
                setGoals(goalsList);
              }
              if (familyList.length > 0) {
                setFamilyMembers(familyList);
              }
            }
            const user = StorageService.getCurrentUser();
            const bId = user ? StorageService.getEffectiveBudgetId(user) : 'default';
            if (remote.investorPortfolio) {
              PortfolioStorageService.saveAssets(remote.investorPortfolio, bId);
            }
            if (remote.investmentTransactions) {
              setInvestmentTransactions(remote.investmentTransactions);
              (PortfolioStorageService as any).saveToAllAliasKeys('darla_portfolio_transactions', bId, remote.investmentTransactions);
            } else {
              setInvestmentTransactions([]);
              (PortfolioStorageService as any).saveToAllAliasKeys('darla_portfolio_transactions', bId, []);
            }
            window.dispatchEvent(new Event('portfolio_updated'));
          }
        }
      );
    } catch (e) {}

    return () => {
      try {
        unsubscribe();
      } catch {}
    };
  }, []);

  // Transaction Modal State
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Sync Progress State & Notifications
  const [syncProgress, setSyncProgress] = useState<number | null>(null);
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);
  const [syncErrorPopupMessage, setSyncErrorPopupMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleSyncError = (e: any) => {
      const msg = e?.detail || 'Não foi possível sincronizar os dados no momento. Verifique sua conexão.';
      setSyncErrorPopupMessage(msg);
    };
    window.addEventListener('sync-error', handleSyncError);

    // Auto-sync interval for multi-device real-time updates (every 6 seconds)
    const syncInterval = setInterval(() => {
      const user = StorageService.getCurrentUser();
      if (user) {
        refreshData(user, false);
      }
    }, 6000);

    return () => {
      window.removeEventListener('sync-error', handleSyncError);
      clearInterval(syncInterval);
    };
  }, []);

  // Security Concurrency & Logout Safety Modals
  const [sessionRevokedModalOpen, setSessionRevokedModalOpen] = useState(false);
  const [isAppwriteModalOpen, setIsAppwriteModalOpen] = useState(false);

  const isSyncingRemoteRef = useRef(false);
  const hasPendingRefreshRef = useRef(false);

  // Load User Data & Synchronize with Remote
  const refreshData = async (user: User | null, forceRemote: boolean = true) => {
    if (!user) return;
    const budgetId = StorageService.getEffectiveBudgetId(user);
    if (!budgetId) return;

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

    if (isSyncingRemoteRef.current) {
      hasPendingRefreshRef.current = true;
      return;
    }
    isSyncingRemoteRef.current = true;
    hasPendingRefreshRef.current = false;

    // 2. Synchronize with remote server with clean progress tracking
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
        // Show completion toast
        setSyncProgress(100);
        setSyncMessage('Tudo atualizado!');
        setSyncToastMessage('Todas as atualizações foram concluídas!');

        setTimeout(() => {
          setSyncToastMessage(prev => (prev === 'Todas as atualizações foram concluídas!' ? null : prev));
        }, 3500);

        setTimeout(() => {
          setSyncProgress(null);
        }, 1000);
      }
    } catch (e) {
      console.warn('[refreshData sync remote error]', e);
      if (forceRemote) setSyncProgress(null);
    } finally {
      isSyncingRemoteRef.current = false;
      if (forceRemote) setPendingSyncCount(0);

      // Re-read storage once remote sync finishes to capture any inbound changes
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
        setTimeout(() => {
          refreshData(user, false);
        }, 100);
      }
    }

    // Automate weekly check-in upon login and refresh gamification criteria for active users
    if (user?.id) {
      GamificationService.performWeeklyCheckIn(user.id);
      GamificationService.refreshAllActiveUsersGamification();
    }
  };

  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const hasOAuthParams = urlParams.has('code') || urlParams.has('secret') || urlParams.has('userId') || window.location.hash.includes('secret') || window.location.hash.includes('code');
      if (hasOAuthParams) {
        localStorage.removeItem('darla_explicit_logout');
      }

      const explicitLogout = !hasOAuthParams && localStorage.getItem('darla_explicit_logout') === 'true';
      if (explicitLogout) {
        if (mounted) {
          setIsAuthLoading(false);
        }
        return;
      }

      // Load remote state from Appwrite Cloud on start
      try {
        const remoteState = await loadFromCloud();
        if (remoteState && mounted) {
          if (remoteState.transactions && remoteState.transactions.length > 0) {
            setTransactions(remoteState.transactions);
          }
          if (remoteState.accounts && remoteState.accounts.length > 0) {
            setAccounts(remoteState.accounts);
          }
          if (remoteState.categories && remoteState.categories.length > 0) {
            setCategories(remoteState.categories);
          }
          if (remoteState.goals && remoteState.goals.length > 0) {
            setGoals(remoteState.goals);
          }
        }
      } catch (e) {}

      // 1. Check saved user first for instant load
      const savedUser = StorageService.getCurrentUser();
      if (savedUser) {
        if (mounted) {
          setCurrentUser(savedUser);
          refreshData(savedUser, false);
          setIsAuthLoading(false);
        }
        StorageService.ensureUserAndDataSyncedAsync(
          savedUser.email,
          savedUser.password,
          savedUser.name,
          savedUser.avatarUrl,
          savedUser.authProvider
        )
          .then((syncedUser) => {
            if (mounted) {
              setCurrentUser(syncedUser);
              refreshData(syncedUser, false);
            }
          })
          .catch(() => {});
      }

      // 2. Check Appwrite Auth session on mount (OAuth return)
      try {
        const appwriteUser = await getAppwriteUser();
        if (appwriteUser && appwriteUser.email && mounted) {
          const cleanEmail = appwriteUser.email.trim().toLowerCase();
          const user = await StorageService.ensureUserAndDataSyncedAsync(
            cleanEmail,
            undefined,
            appwriteUser.name || cleanEmail.split('@')[0],
            undefined,
            'email'
          );
          setCurrentUser(user);
          refreshData(user, false);
          setIsAuthLoading(false);
          return;
        }
      } catch (e) {}

      // 3. Check Firebase Auth session on mount
      let unsubscribeAuth: (() => void) | null = null;
      if (auth) {
        unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser?.email && mounted) {
            const cleanEmail = firebaseUser.email.trim().toLowerCase();
            try {
              const user = await StorageService.ensureUserAndDataSyncedAsync(
                cleanEmail,
                undefined,
                firebaseUser.displayName || cleanEmail.split('@')[0],
                firebaseUser.photoURL || undefined,
                'google'
              );
              setCurrentUser(user);
              refreshData(user, false);
            } catch (e) {}
          }
          if (mounted) {
            setIsAuthLoading(false);
          }
        });
      } else {
        if (mounted && !savedUser) {
          setIsAuthLoading(false);
        }
      }

      return () => {
        if (unsubscribeAuth) unsubscribeAuth();
      };
    };

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);



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

    // Initialize Firebase Firestore Real-Time Changes subscription
    const unsubscribeFirestore = subscribeToUserFirestoreChanges(activeBudgetId, () => {
      refreshData(currentUser, false);
    });

    // Initialize Cloud Appwrite Real-Time subscription
    const unsubscribeAppwrite = subscribeToAppwriteRealtime(activeBudgetId, (remoteData) => {
      if (remoteData) {
        if (remoteData.transactions) {
          setTransactions(remoteData.transactions);
          StorageService.setTransactions(remoteData.transactions);
        }
        if (remoteData.accounts) {
          setAccounts(remoteData.accounts);
          StorageService.setAccounts(remoteData.accounts);
        }
        if (remoteData.investmentTransactions) {
          setInvestmentTransactions(remoteData.investmentTransactions);
          const budgetId = StorageService.getEffectiveBudgetId(currentUser);
          (PortfolioStorageService as any).saveToAllAliasKeys('darla_portfolio_transactions', budgetId, remoteData.investmentTransactions);
        }
        if (remoteData.investorPortfolio) {
          const budgetId = StorageService.getEffectiveBudgetId(currentUser);
          (PortfolioStorageService as any).saveToAllAliasKeys('darla_portfolio_assets', budgetId, remoteData.investorPortfolio);
        }
      }
      refreshData(currentUser, false);
      window.dispatchEvent(new Event('portfolio_updated'));
      window.dispatchEvent(new Event('remote_data_updated'));
      window.dispatchEvent(new CustomEvent('financial_data_mutated'));
    });

    const handleFocus = () => {
      syncFn();
      refreshData(currentUser, true);
    };

    const handleRemoteUpdate = () => {
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
    window.addEventListener('storage', handleFocus);
    window.addEventListener('remote_data_updated', handleRemoteUpdate);
    window.addEventListener('portfolio_updated', handleRemoteUpdate);
    window.addEventListener('shared_budget_updated', handleRemoteUpdate);
    window.addEventListener('user_profile_updated', handleRemoteUpdate);
    window.addEventListener('financial_data_mutated', handleRemoteUpdate);
    window.addEventListener('session_revoked_event', handleSessionRevoked);
    window.addEventListener('user_deleted_event', handleUserDeleted);

    const pollInterval = setInterval(() => {
      refreshData(currentUser, false);
    }, 5000);

    return () => {
      unsubscribeFirestore();
      unsubscribeAppwrite();
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('pageshow', handleFocus);
      window.removeEventListener('online', handleFocus);
      window.removeEventListener('storage', handleFocus);
      window.removeEventListener('remote_data_updated', handleRemoteUpdate);
      window.removeEventListener('portfolio_updated', handleRemoteUpdate);
      window.removeEventListener('shared_budget_updated', handleRemoteUpdate);
      window.removeEventListener('user_profile_updated', handleRemoteUpdate);
      window.removeEventListener('financial_data_mutated', handleRemoteUpdate);
      window.removeEventListener('session_revoked_event', handleSessionRevoked);
      window.removeEventListener('user_deleted_event', handleUserDeleted);
    };
  }, [currentUser]);

  // Login Handler
  const handleLoginSuccess = (user: User) => {
    localStorage.removeItem('darla_explicit_logout');
    setCurrentUser(user);
    refreshData(user, false);
  };

  // Logout Request Handler
  const handleLogout = () => {
    performLogout();
  };

  const performLogout = () => {
    realtimeSync.disconnect();
    StorageService.logout(false);
    localStorage.setItem('darla_explicit_logout', 'true');
    if (auth) {
      firebaseSignOut(auth).catch(() => {});
    }
    appwriteSignOut().catch(() => {});
    setCurrentUser(null);
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

  // Calculated Summaries
  const monthSummary = calculateMonthSummary(currentYear, currentMonth, transactions, accounts);
  const accountBalances = calculateAccountBalances(accounts, transactions);

  // Read-Only Guard Helper
  const checkReadOnlyPermission = (): boolean => {
    if (currentUser && StorageService.isCurrentUserReadOnly(currentUser)) {
      alert('🔒 Você está no Modo Leitura (Apenas Visualização) neste orçamento compartilhado e não tem permissão para fazer alterações.');
      return true;
    }
    return false;
  };

  const buildAppFinancialState = (overrideTxs?: Transaction[]) => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    const currentTxs = overrideTxs || transactions;
    const currentAccounts = accounts;
    const currentGoals = goals;
    const currentFamily = familyMembers;
    const budgets = StorageService.deduplicateSharedBudgets();

    const familyBudget = [
      ...currentGoals,
      ...currentFamily,
      ...budgets
    ];

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
      updatedAt: new Date().toISOString()
    };
  };

  const syncCurrentStateToCloud = async (overrideTxs?: Transaction[]) => {
    try {
      const fullState = buildAppFinancialState(overrideTxs);
      await saveAppData(fullState);
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

  const handleSaveSingleTransaction = async (txData: Omit<Transaction, 'id' | 'createdAt'>): Promise<boolean> => {
    if (checkReadOnlyPermission()) return false;
    let nextTransactions = transactions;
    if (editingTx) {
      const updated: Transaction = {
        ...txData,
        id: editingTx.id,
        createdAt: editingTx.createdAt,
      };
      StorageService.updateTransaction(updated);
      nextTransactions = transactions.map((t) => (t.id === updated.id ? updated : t));
    } else {
      const saved = StorageService.addTransaction(txData);
      nextTransactions = [saved, ...transactions];
      if (currentUser) {
        GamificationService.recordAction(currentUser.id, 'launches');
      }
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
    if (currentUser) {
      GamificationService.recordAction(currentUser.id, 'launches', txList.length);
    }

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
    const txItem = {
      id: newTx.id || `tx_inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: budgetId,
      assetTicker: (newTx.assetTicker || newTx.ticker || '').toUpperCase(),
      assetCategory: newTx.assetCategory || newTx.category || 'acoes',
      type: newTx.type || 'buy',
      quantity: Number(newTx.quantity) || 0,
      unitPrice: Number(newTx.unitPrice) || Number(newTx.price) || 0,
      totalAmount: Number(newTx.totalAmount) || (Number(newTx.quantity) * Number(newTx.unitPrice || newTx.price)) || 0,
      broker: newTx.broker || 'RICO INVESTIMENTOS',
      date: newTx.date || new Date().toISOString().split('T')[0],
      notes: newTx.notes || '',
      createdAt: newTx.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (newTx.id) {
      PortfolioStorageService.updateTransaction(txItem, budgetId);
    } else {
      PortfolioStorageService.addTransaction(txItem, budgetId);
    }

    const updatedList = [txItem, ...investmentTransactions.filter(t => t.id !== txItem.id)];
    setInvestmentTransactions(updatedList);
    (PortfolioStorageService as any).saveToAllAliasKeys('darla_portfolio_transactions', budgetId, updatedList);

    const fullPayload = {
      transactions: transactions,
      accounts: accounts,
      familyBudget: [...goals, ...familyMembers, ...StorageService.deduplicateSharedBudgets()],
      investorPortfolio: PortfolioStorageService.getAssets(budgetId),
      investmentTransactions: updatedList,
      updatedAt: new Date().toISOString()
    };

    try {
      await databases.updateDocument(
        '6a83aa8d0038331e040f',
        'user_financials',
        '6a849358002db9e638ce',
        {
          userId: '6a83b38ed065c08efa49',
          data: JSON.stringify(fullPayload)
        }
      );
      console.log('[Investimentos] Gravado com sucesso no Appwrite!');
      alert('Transação de investimento salva no banco!');
      window.dispatchEvent(new Event('portfolio_updated'));
      window.dispatchEvent(new Event('remote_data_updated'));
      window.dispatchEvent(new CustomEvent('financial_data_mutated'));
      return true;
    } catch (error: any) {
      console.error('Erro ao salvar no Appwrite:', error);
      alert('Erro ao sincronizar investimento: ' + (error?.message || JSON.stringify(error)));
      return false;
    }
  };

  const deleteInvestmentTransaction = async (txId: string) => {
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    PortfolioStorageService.deleteTransaction(txId, budgetId);

    const updatedList = investmentTransactions.filter(t => t.id !== txId);
    setInvestmentTransactions(updatedList);
    (PortfolioStorageService as any).saveToAllAliasKeys('darla_portfolio_transactions', budgetId, updatedList);

    const fullPayload = {
      transactions: transactions,
      accounts: accounts,
      familyBudget: [...goals, ...familyMembers, ...StorageService.deduplicateSharedBudgets()],
      investorPortfolio: PortfolioStorageService.getAssets(budgetId),
      investmentTransactions: updatedList,
      updatedAt: new Date().toISOString()
    };

    try {
      await databases.updateDocument(
        '6a83aa8d0038331e040f',
        'user_financials',
        '6a849358002db9e638ce',
        {
          userId: '6a83b38ed065c08efa49',
          data: JSON.stringify(fullPayload)
        }
      );
      alert('Transação de investimento excluída com sucesso!');
      window.dispatchEvent(new Event('portfolio_updated'));
      window.dispatchEvent(new Event('remote_data_updated'));
      window.dispatchEvent(new CustomEvent('financial_data_mutated'));
      return true;
    } catch (error: any) {
      console.error('Erro ao deletar no Appwrite:', error);
      return false;
    }
  };

  // Account Handlers
  const persistAllData = async (updatedAccounts?: any[], updatedTransactions?: any[], updatedInvestmentTransactions?: any[]) => {
    const accountsToPersist = updatedAccounts || accounts;
    const transactionsToPersist = updatedTransactions || transactions;
    
    const budgetId = currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
    const currentGoals = goals;
    const currentFamily = familyMembers;
    const currentBudgets = StorageService.deduplicateSharedBudgets();
    const familyBudget = [...currentGoals, ...currentFamily, ...currentBudgets];
    const investorPortfolio = PortfolioStorageService.getAssets(budgetId);
    const invTxs = updatedInvestmentTransactions || PortfolioStorageService.getTransactions(budgetId);
    const divs = PortfolioStorageService.getDividends(budgetId);
    const investmentTransactionsToPersist = updatedInvestmentTransactions || [...invTxs, ...divs];
    setInvestmentTransactions(investmentTransactionsToPersist);

    const fullPayload = {
      transactions: transactionsToPersist,
      accounts: accountsToPersist,
      familyBudget: familyBudget,
      investorPortfolio: investorPortfolio,
      investmentTransactions: investmentTransactionsToPersist,
      updatedAt: new Date().toISOString()
    };

    try {
      await databases.updateDocument(
        '6a83aa8d0038331e040f',
        'user_financials',
        '6a849358002db9e638ce',
        {
          userId: '6a83b38ed065c08efa49',
          data: JSON.stringify(fullPayload)
        }
      );
      console.log('[Appwrite] Dados e transações sincronizados com sucesso na nuvem!');
      setAccounts(accountsToPersist);
      StorageService.setAccounts(accountsToPersist);
      setTransactions(transactionsToPersist);
      StorageService.setTransactions(transactionsToPersist);
      return true;
    } catch (error: any) {
      if (error?.code === 404 || error?.message?.includes('not found') || error?.type === 'document_not_found') {
        try {
          await databases.createDocument(
            '6a83aa8d0038331e040f',
            'user_financials',
            '6a849358002db9e638ce',
            {
              userId: '6a83b38ed065c08efa49',
              data: JSON.stringify(fullPayload)
            }
          );
          console.log('[Appwrite] Dados e transações criados com sucesso na nuvem!');
          setAccounts(accountsToPersist);
          StorageService.setAccounts(accountsToPersist);
          setTransactions(transactionsToPersist);
          StorageService.setTransactions(transactionsToPersist);
          return true;
        } catch (createErr) {
          console.error('[Appwrite Error ao criar documento de finanças]', createErr);
        }
      }
      console.error('[Appwrite Error ao salvar transações]', error);
      alert('Erro ao sincronizar transações na nuvem: ' + JSON.stringify(error));
      return false;
    }
  };

  const handleSaveAccount = async (acc: Account, updatedAccounts?: Account[]): Promise<boolean> => {
    if (checkReadOnlyPermission()) return false;
    StorageService.saveAccount(acc);
    const accountsList = updatedAccounts || (
      accounts.some(a => a.id === acc.id)
        ? accounts.map(a => a.id === acc.id ? acc : a)
        : [...accounts, acc]
    );
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

  // Category Handlers
  const handleSaveCategory = (cat: Category) => {
    StorageService.saveCategory(cat);
    refreshData(currentUser, false);
  };

  const handleDeleteCategory = (id: string) => {
    StorageService.deleteCategory(id);
    refreshData(currentUser, false);
  };

  // Family Member Handlers
  const handleSaveFamilyMember = async (member: FamilyMember) => {
    StorageService.saveFamilyMember(member);
    await saveAppData(buildAppFinancialState());
    refreshData(currentUser, false);
  };

  const handleDeleteFamilyMember = async (id: string) => {
    StorageService.deleteFamilyMember(id);
    await saveAppData(buildAppFinancialState());
    refreshData(currentUser, false);
  };

  // Goal Handlers
  const handleSaveGoal = async (goal: Goal) => {
    StorageService.saveGoal(goal);
    await saveAppData(buildAppFinancialState());
    refreshData(currentUser, false);
  };

  const handleUpdateGoalProgress = async (goalId: string, addedAmount: number) => {
    StorageService.updateGoalProgress(goalId, addedAmount);
    await saveAppData(buildAppFinancialState());
    refreshData(currentUser, false);
  };

  const handleDeleteGoal = async (id: string) => {
    StorageService.deleteGoal(id);
    await saveAppData(buildAppFinancialState());
    refreshData(currentUser, false);
  };

  const handleSaveUserName = (newName: string, avatarUrl?: string) => {
    if (!currentUser) return;
    const updated = StorageService.updateUserProfile(currentUser.id, newName, avatarUrl);
    if (updated) {
      setCurrentUser(updated);
    } else {
      setCurrentUser({ ...currentUser, name: newName, avatarUrl });
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
        currentYear={currentYear}
        currentMonth={currentMonth}
        onYearMonthChange={(year, month) => {
          setCurrentYear(year);
          setCurrentMonth(month);
        }}
        onOpenNewTransaction={handleOpenNewTransaction}
        onOpenSharedBudgetModal={() => {
          if (StorageService.isFeatureAllowed(currentUser, 'shared_budget')) {
            setIsSharedBudgetModalOpen(true);
          } else {
            setFeatureLockTitle('Orçamento Compartilhado Bloqueado');
            setFeatureLockDesc('Seus 90 dias de teste grátis terminaram. O recurso de Orçamento Compartilhado em Família é exclusivo para assinantes dos planos Pro (a partir de R$ 6,90/mês).');
            setIsFeatureLockModalOpen(true);
          }
        }}
        onOpenEditProfile={(tab) => {
          const validTab = tab === 'request_access' || tab === 'give_access' ? tab : 'profile';
          setEditProfileInitialTab(validTab);
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
            userId={effectiveBudgetId}
          />
        )}

        {activeTab === 'goals' && (
          <GoalsView
            goals={goals}
            onSaveGoal={handleSaveGoal}
            onUpdateGoalProgress={handleUpdateGoalProgress}
            onDeleteGoal={handleDeleteGoal}
            userId={effectiveBudgetId}
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
            <PortfolioView
              key={activeTab}
              userId={effectiveBudgetId}
              initialSubTab={activeTab.includes(':') ? (activeTab.split(':')[1] as any) : 'dashboard'}
              onSubTabChange={(subTab) => handleTabChange(`portfolio:${subTab}`)}
              investmentTransactions={investmentTransactions}
              onSaveInvestmentTransaction={saveInvestmentTransaction}
              onDeleteInvestmentTransaction={deleteInvestmentTransaction}
              onDataChanged={async () => {
                await persistAllData(accounts, transactions, investmentTransactions);
              }}
            />
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
        onSaveFamilyMember={handleSaveFamilyMember}
      />

      {/* Shared Budget Access Modal */}
      <SharedBudgetModal
        user={currentUser}
        isOpen={isSharedBudgetModalOpen}
        onClose={() => setIsSharedBudgetModalOpen(false)}
        onUserUpdated={(updatedUser) => {
          setCurrentUser(updatedUser);
          refreshData(updatedUser);
        }}
      />

      {/* Edit Profile Modal */}
      {currentUser && (
        <EditProfileModal
          isOpen={isEditProfileModalOpen}
          onClose={() => setIsEditProfileModalOpen(false)}
          user={currentUser}
          onSaveName={handleSaveUserName}
          onOpenSharedBudgetModal={() => setIsSharedBudgetModalOpen(true)}
          onUserUpdated={(updatedUser) => {
            setCurrentUser(updatedUser);
            refreshData(updatedUser);
          }}
          onLogout={handleLogout}
          initialTab={editProfileInitialTab}
        />
      )}

      {/* Critical Actions Dedicated Menu Modal */}
      {currentUser && (
        <CriticalActionsModal
          isOpen={isCriticalActionsModalOpen}
          onClose={() => setIsCriticalActionsModalOpen(false)}
          user={currentUser}
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
            <span className="text-xs font-bold text-gray-100">{syncToastMessage}</span>
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
            <p className="font-serif font-black text-[#121212] text-sm tracking-wide">DINHEIRO SEM FILTRO</p>
            <p className="text-[11px] text-[#D4AF37] font-black uppercase tracking-wider mt-0.5">DOMINE SEU DINHEIRO ANTES QUE ELE DOMINE VOCÊ!</p>
          </div>
          <div className="flex flex-col items-center sm:items-end text-center sm:text-right">
            <p className="font-serif font-bold text-[#121212] text-xs">DINHEIRO SEM FILTRO &copy; {new Date().getFullYear()}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
