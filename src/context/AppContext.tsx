import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { Account, Transaction, Category, Goal, FamilyMember, User } from '../types';
import { StorageService } from '../services/storage';
import { PortfolioStorageService } from '../services/portfolioStorage';
import { GamificationService } from '../services/gamification';
import { calculateAccountBalances, calculateAccountBalancesMap } from '../utils/finance';
import { saveAppData, loadFromCloud } from '../lib/appwriteSync';
import { appwriteDatabases } from '../lib/appwrite';

export interface AppContextType {
  // Global State Collections
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  goals: Goal[];
  familyMembers: FamilyMember[];
  investmentTransactions: any[];
  currentUser: User | null;

  // Derived Reactive Account Balances
  accountBalances: Record<string, { currentBalance: number; consolidatedBalance: number }>;
  accountBalancesMap: Record<string, number>;

  // State Setters
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  setGoals: React.Dispatch<React.SetStateAction<Goal[]>>;
  setFamilyMembers: React.Dispatch<React.SetStateAction<FamilyMember[]>>;
  setInvestmentTransactions: React.Dispatch<React.SetStateAction<any[]>>;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;

  // Mutation and Sync Actions
  saveSingleTransaction: (txData: Omit<Transaction, 'id' | 'createdAt'>, editingTxId?: string) => Promise<boolean>;
  saveMultipleTransactions: (txList: Omit<Transaction, 'id' | 'createdAt'>[]) => Promise<boolean>;
  deleteTransaction: (id: string) => Promise<boolean>;
  toggleConsolidated: (id: string) => Promise<boolean>;
  updateSingleTransaction: (tx: Transaction) => Promise<boolean>;
  saveAccount: (account: Account, updatedAccounts?: Account[]) => Promise<boolean>;
  deleteAccount: (id: string) => Promise<boolean>;
  persistAllData: (
    updatedAccounts?: Account[],
    updatedTransactions?: Transaction[],
    updatedInvestmentTransactions?: any[]
  ) => Promise<boolean>;
  refreshData: (user: User | null, forceRemote?: boolean) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{
  children: ReactNode;
  initialUser?: User | null;
}> = ({ children, initialUser = null }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => initialUser || StorageService.getCurrentUser());

  const getBudgetId = useCallback(() => {
    return currentUser ? StorageService.getEffectiveBudgetId(currentUser) : 'default';
  }, [currentUser]);

  // Synchronous initial read from storage
  const [accounts, setAccounts] = useState<Account[]>(() => {
    const user = initialUser || StorageService.getCurrentUser();
    const bId = user ? StorageService.getEffectiveBudgetId(user) : '';
    return bId ? StorageService.getAccounts(bId) : [];
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    const user = initialUser || StorageService.getCurrentUser();
    const bId = user ? StorageService.getEffectiveBudgetId(user) : '';
    return bId ? StorageService.getCategories(bId) : [];
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const user = initialUser || StorageService.getCurrentUser();
    const bId = user ? StorageService.getEffectiveBudgetId(user) : '';
    return bId ? StorageService.getTransactions(bId) : [];
  });

  const [investmentTransactions, setInvestmentTransactions] = useState<any[]>(() => {
    const user = initialUser || StorageService.getCurrentUser();
    const bId = user ? StorageService.getEffectiveBudgetId(user) : 'default';
    return PortfolioStorageService.getTransactions(bId);
  });

  const [goals, setGoals] = useState<Goal[]>(() => {
    const user = initialUser || StorageService.getCurrentUser();
    const bId = user ? StorageService.getEffectiveBudgetId(user) : '';
    return bId ? StorageService.getGoals(bId) : [];
  });

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(() => {
    const user = initialUser || StorageService.getCurrentUser();
    const bId = user ? StorageService.getEffectiveBudgetId(user) : '';
    return bId ? StorageService.getFamilyMembers(bId) : [];
  });

  // Derived Reactive Account Balances (Dynamically recalculates on any change to transactions or accounts)
  const accountBalances = useMemo(() => {
    return calculateAccountBalances(transactions, accounts);
  }, [transactions, accounts]);

  const accountBalancesMap = useMemo(() => {
    return calculateAccountBalancesMap(transactions, accounts);
  }, [transactions, accounts]);

  // Build full payload for Appwrite Document '6a849358002db9e638ce'
  const buildAppFinancialState = useCallback(
    (overrideTxs?: Transaction[], overrideAccounts?: Account[]) => {
      const budgetId = getBudgetId();
      const currentTxs = overrideTxs || transactions;
      const currentAccounts = overrideAccounts || accounts;
      const currentGoals = goals;
      const currentFamily = familyMembers;
      const budgets = StorageService.deduplicateSharedBudgets();

      const familyBudget = [...currentGoals, ...currentFamily, ...budgets];
      const investorPortfolio = PortfolioStorageService.getAssets(budgetId);
      const invTxs = PortfolioStorageService.getTransactions(budgetId);
      const divs = PortfolioStorageService.getDividends(budgetId);
      const allInvestmentTxs = [...invTxs, ...divs];

      return {
        transactions: currentTxs,
        familyBudget: familyBudget,
        accounts: currentAccounts,
        investorPortfolio: investorPortfolio,
        investmentTransactions: allInvestmentTxs,
        goals: currentGoals,
        updatedAt: new Date().toISOString(),
      };
    },
    [getBudgetId, transactions, accounts, goals, familyMembers]
  );

  // Central Persistence Function with immediate reactive update & Appwrite Document ID '6a849358002db9e638ce'
  const persistAllData = useCallback(
    async (
      updatedAccounts?: Account[],
      updatedTransactions?: Transaction[],
      updatedInvestmentTransactions?: any[]
    ): Promise<boolean> => {
      const accountsToPersist = updatedAccounts || accounts;
      const transactionsToPersist = updatedTransactions || transactions;
      const budgetId = getBudgetId();

      // 1. Instant React Context state update
      setAccounts(accountsToPersist);
      setTransactions(transactionsToPersist);
      if (updatedInvestmentTransactions) {
        setInvestmentTransactions(updatedInvestmentTransactions);
      }

      // 2. Local Storage update
      StorageService.setAccounts(accountsToPersist);
      StorageService.setTransactions(transactionsToPersist);

      // 3. Persist to Appwrite Cloud document '6a849358002db9e638ce'
      try {
        const fullPayload = buildAppFinancialState(transactionsToPersist, accountsToPersist);
        await saveAppData(fullPayload);
      } catch (e) {
        console.warn('[AppContext Appwrite Sync Warning]', e);
      }

      // 4. Background server sync
      try {
        await StorageService.syncUserMutationToServer(budgetId);
      } catch (e) {}

      // 5. Dispatch global mutation events for UI updates
      window.dispatchEvent(new Event('portfolio_updated'));
      window.dispatchEvent(new Event('remote_data_updated'));
      window.dispatchEvent(new CustomEvent('financial_data_mutated'));

      return true;
    },
    [accounts, transactions, getBudgetId, buildAppFinancialState]
  );

  // Transaction Mutations
  const saveSingleTransaction = useCallback(
    async (txData: Omit<Transaction, 'id' | 'createdAt'>, editingTxId?: string): Promise<boolean> => {
      let nextTransactions = transactions;
      if (editingTxId) {
        const existing = transactions.find((t) => t.id === editingTxId);
        const updated: Transaction = {
          ...txData,
          id: editingTxId,
          createdAt: existing?.createdAt || new Date().toISOString(),
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

      return await persistAllData(accounts, nextTransactions);
    },
    [transactions, accounts, currentUser, persistAllData]
  );

  const saveMultipleTransactions = useCallback(
    async (txList: Omit<Transaction, 'id' | 'createdAt'>[]): Promise<boolean> => {
      const added = StorageService.addMultipleTransactions(txList);
      const nextTransactions = [...added, ...transactions];
      if (currentUser) {
        GamificationService.recordAction(currentUser.id, 'launches', txList.length);
      }
      return await persistAllData(accounts, nextTransactions);
    },
    [transactions, accounts, currentUser, persistAllData]
  );

  const deleteTransaction = useCallback(
    async (id: string): Promise<boolean> => {
      StorageService.deleteTransaction(id);
      const nextTransactions = transactions.filter((t) => t.id !== id);
      return await persistAllData(accounts, nextTransactions);
    },
    [transactions, accounts, persistAllData]
  );

  const toggleConsolidated = useCallback(
    async (id: string): Promise<boolean> => {
      StorageService.toggleConsolidated(id);
      const nextTransactions = transactions.map((t) =>
        t.id === id ? { ...t, isConsolidated: !t.isConsolidated } : t
      );
      if (currentUser) {
        GamificationService.recordAction(currentUser.id, 'consolidation');
      }
      return await persistAllData(accounts, nextTransactions);
    },
    [transactions, accounts, currentUser, persistAllData]
  );

  const updateSingleTransaction = useCallback(
    async (tx: Transaction): Promise<boolean> => {
      StorageService.updateTransaction(tx);
      const nextTransactions = transactions.map((t) => (t.id === tx.id ? tx : t));
      return await persistAllData(accounts, nextTransactions);
    },
    [transactions, accounts, persistAllData]
  );

  // Account Mutations
  const saveAccount = useCallback(
    async (acc: Account, updatedAccountsList?: Account[]): Promise<boolean> => {
      StorageService.saveAccount(acc);
      const nextAccounts =
        updatedAccountsList ||
        (accounts.some((a) => a.id === acc.id)
          ? accounts.map((a) => (a.id === acc.id ? acc : a))
          : [...accounts, acc]);

      return await persistAllData(nextAccounts, transactions);
    },
    [accounts, transactions, persistAllData]
  );

  const deleteAccount = useCallback(
    async (id: string): Promise<boolean> => {
      StorageService.deleteAccount(id);
      const nextAccounts = accounts.filter((a) => a.id !== id);
      return await persistAllData(nextAccounts, transactions);
    },
    [accounts, transactions, persistAllData]
  );

  // Refresh and Cloud Hydration
  const refreshData = useCallback(
    async (user: User | null, forceRemote: boolean = false) => {
      if (!user) return;
      const budgetId = StorageService.getEffectiveBudgetId(user);
      if (!budgetId) return;

      // 1. Instant local read
      const localAccounts = StorageService.getAccounts(budgetId);
      const localCategories = StorageService.getCategories(budgetId);
      const localTransactions = StorageService.getTransactions(budgetId);
      const localGoals = StorageService.getGoals(budgetId);
      const localFamily = StorageService.getFamilyMembers(budgetId);

      setAccounts(localAccounts);
      setCategories(localCategories);
      setTransactions(localTransactions);
      setGoals(localGoals);
      setFamilyMembers(localFamily);

      // 2. Fetch remote if forced or requested
      if (forceRemote) {
        try {
          const remoteData = await loadFromCloud();
          if (remoteData) {
            if (remoteData.transactions) {
              setTransactions(remoteData.transactions);
              StorageService.setTransactions(remoteData.transactions);
            }
            if (remoteData.accounts) {
              setAccounts(remoteData.accounts);
              StorageService.setAccounts(remoteData.accounts);
            }
          }
        } catch (e) {
          console.warn('[AppContext refresh remote error]', e);
        }
      }
    },
    []
  );

  const value = useMemo(
    () => ({
      accounts,
      transactions,
      categories,
      goals,
      familyMembers,
      investmentTransactions,
      currentUser,
      accountBalances,
      accountBalancesMap,
      setAccounts,
      setTransactions,
      setCategories,
      setGoals,
      setFamilyMembers,
      setInvestmentTransactions,
      setCurrentUser,
      saveSingleTransaction,
      saveMultipleTransactions,
      deleteTransaction,
      toggleConsolidated,
      updateSingleTransaction,
      saveAccount,
      deleteAccount,
      persistAllData,
      refreshData,
    }),
    [
      accounts,
      transactions,
      categories,
      goals,
      familyMembers,
      investmentTransactions,
      currentUser,
      accountBalances,
      accountBalancesMap,
      saveSingleTransaction,
      saveMultipleTransactions,
      deleteTransaction,
      toggleConsolidated,
      updateSingleTransaction,
      saveAccount,
      deleteAccount,
      persistAllData,
      refreshData,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export const useAppContext = useApp;
