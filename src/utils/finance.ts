import { useState, useEffect } from 'react';
import { Account, Transaction, MonthSummary, Subcategory } from '../types';
import { StorageService } from '../services/storage';

export function usePrivacyMode(): boolean {
  const [isPrivacy, setIsPrivacy] = useState<boolean>(() => StorageService.getPrivacyMode());

  useEffect(() => {
    const handlePrivacy = () => {
      setIsPrivacy(StorageService.getPrivacyMode());
    };

    // 1. Custom event for current window
    window.addEventListener('privacy_mode_changed', handlePrivacy);

    // 2. Native 'storage' event for cross-tab updates on same browser
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'darla_privacy_mode') {
        setIsPrivacy(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. BroadcastChannel for instant cross-tab communication
    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel('darla_privacy_channel');
        channel.onmessage = (event) => {
          if (event.data && typeof event.data.active === 'boolean') {
            setIsPrivacy(event.data.active);
          } else {
            setIsPrivacy(StorageService.getPrivacyMode());
          }
        };
      } catch (err) {
        // BroadcastChannel fallback
      }
    }

    // 4. Polling fallback every 800ms for mobile Safari/PWA/Android WebViews where events might be throttled
    const interval = setInterval(() => {
      const current = StorageService.getPrivacyMode();
      setIsPrivacy((prev) => (prev !== current ? current : prev));
    }, 800);

    return () => {
      window.removeEventListener('privacy_mode_changed', handlePrivacy);
      window.removeEventListener('storage', handleStorage);
      if (channel) {
        channel.close();
      }
      clearInterval(interval);
    };
  }, []);

  return isPrivacy;
}

/**
 * Recursively flatten nested subcategories into a flat array with fullPath (e.g., "Pai › Filho › Neto")
 */
export function flattenSubcategories(
  subs: Subcategory[] = [],
  prefix = ''
): { id: string; name: string; fullPath: string; original: Subcategory }[] {
  let result: { id: string; name: string; fullPath: string; original: Subcategory }[] = [];
  subs.forEach((s) => {
    const fullPath = prefix ? `${prefix} › ${s.name}` : s.name;
    result.push({ id: s.id, name: s.name, fullPath, original: s });
    if (s.subcategories && s.subcategories.length > 0) {
      result = result.concat(flattenSubcategories(s.subcategories, fullPath));
    }
  });
  return result;
}

/**
 * Recursively search for a subcategory by ID in a nested tree
 */
export function findSubcategoryById(subs: Subcategory[] = [], targetId: string): Subcategory | undefined {
  for (const s of subs) {
    if (s.id === targetId) return s;
    if (s.subcategories && s.subcategories.length > 0) {
      const found = findSubcategoryById(s.subcategories, targetId);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Recursively collect all subcategory IDs within a subcategory subtree
 */
export function getSubcategoryIdsTree(sub: Subcategory): string[] {
  let ids = [sub.id];
  if (sub.subcategories && sub.subcategories.length > 0) {
    for (const child of sub.subcategories) {
      ids = ids.concat(getSubcategoryIdsTree(child));
    }
  }
  return ids;
}

/**
 * Helper to round financial values strictly to 2 decimal places
 */
export function roundMoney(val: number): number {
  if (isNaN(val) || !isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Format a number to Brazilian Real currency format strictly with 2 decimal places (e.g. R$ 1.250,50)
 */
export function formatCurrency(value: number, isPrivacyMode?: boolean): string {
  const activePrivacy = isPrivacyMode !== undefined ? isPrivacyMode : StorageService.getPrivacyMode();
  if (activePrivacy) {
    return 'R$ ••••••';
  }
  const rounded = roundMoney(value);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

/**
 * Parse Brazilian number format to float number
 */
export function parsePtBrNumber(val: string | number): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let cleaned = String(val).trim();
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      const dec = parts.pop();
      cleaned = parts.join('') + '.' + dec;
    }
  }
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatNumberToPtBr(val: number | string): string {
  if (val === null || val === undefined || val === '') return '';

  if (typeof val === 'number') {
    if (isNaN(val)) return '';
    const rounded = roundMoney(val);
    return rounded.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  const cleanStr = String(val).trim();
  if (!cleanStr) return '';

  const parsed = parsePtBrNumber(cleanStr);
  if (isNaN(parsed)) return cleanStr;
  return roundMoney(parsed).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDateBR(dateString: string): string {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Get name of month in Portuguese (e.g., "Julho de 2026")
 */
export function getMonthYearLabel(year: number, month: number): string {
  const date = new Date(year, month - 1, 1);
  const monthName = date.toLocaleDateString('pt-BR', { month: 'long' });
  return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${year}`;
}

/**
 * Get YYYY-MM string
 */
export function getYearMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Parse YYYY-MM-DD into year and month (1-indexed)
 */
export function parseDateComponents(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

/**
 * Calculate starting balance of all accounts combined (initial balance sum)
 */
export function getTotalAccountsInitialBalance(accounts: Account[]): number {
  return accounts.reduce((acc, a) => acc + (a.initialBalance || 0), 0);
}

/**
 * Calculate rolling balance for a specific target year and month.
 * Rolling balance carries over ending balance from all previous months.
 */
export function calculateMonthSummary(
  year: number,
  month: number,
  transactions: Transaction[],
  accounts: Account[]
): MonthSummary {
  const initialAccountsBalance = getTotalAccountsInitialBalance(accounts);

  // Target month key cutoff: transactions strictly before year-month
  const targetKey = getYearMonthKey(year, month);

  let startingBalance = initialAccountsBalance;
  let totalIncome = 0;
  let totalExpenses = 0;
  let consolidatedIncome = 0;
  let consolidatedExpenses = 0;
  let pendingIncome = 0;
  let pendingExpenses = 0;

  for (const t of transactions) {
    const { year: tYear, month: tMonth } = parseDateComponents(t.date);
    const tKey = getYearMonthKey(tYear, tMonth);

    if (tKey < targetKey) {
      // Prior months: calculate historical net impact (income adds, expense subtracts)
      if (t.type === 'income') {
        startingBalance += t.amount;
      } else if (t.type === 'expense') {
        startingBalance -= t.amount;
      }
    } else if (tKey === targetKey) {
      // Current month calculations
      if (t.type === 'income') {
        totalIncome += t.amount;
        if (t.isConsolidated) {
          consolidatedIncome += t.amount;
        } else {
          pendingIncome += t.amount;
        }
      } else if (t.type === 'expense') {
        totalExpenses += t.amount;
        if (t.isConsolidated) {
          consolidatedExpenses += t.amount;
        } else {
          pendingExpenses += t.amount;
        }
      }
    }
  }

  const endingBalance = startingBalance + totalIncome - totalExpenses;
  const consolidatedBalance = startingBalance + consolidatedIncome - consolidatedExpenses;

  return {
    year,
    month,
    startingBalance,
    totalIncome,
    totalExpenses,
    endingBalance,
    consolidatedIncome,
    consolidatedExpenses,
    consolidatedBalance,
    pendingIncome,
    pendingExpenses,
  };
}

/**
 * Calculate present actual balance per account
 */
export function calculateAccountBalances(
  accounts: Account[],
  transactions: Transaction[]
): Record<string, { currentBalance: number; consolidatedBalance: number }> {
  const balances: Record<string, { currentBalance: number; consolidatedBalance: number }> = {};

  for (const acc of accounts) {
    balances[acc.id] = {
      currentBalance: acc.initialBalance || 0,
      consolidatedBalance: acc.initialBalance || 0,
    };
  }

  for (const t of transactions) {
    if (t.type === 'transfer' && t.targetAccountId) {
      // Outflow from accountId
      if (balances[t.accountId]) {
        balances[t.accountId].currentBalance -= t.amount;
        if (t.isConsolidated) balances[t.accountId].consolidatedBalance -= t.amount;
      }
      // Inflow to targetAccountId
      if (balances[t.targetAccountId]) {
        balances[t.targetAccountId].currentBalance += t.amount;
        if (t.isConsolidated) balances[t.targetAccountId].consolidatedBalance += t.amount;
      }
    } else if (balances[t.accountId]) {
      if (t.type === 'income') {
        balances[t.accountId].currentBalance += t.amount;
        if (t.isConsolidated) balances[t.accountId].consolidatedBalance += t.amount;
      } else if (t.type === 'expense') {
        balances[t.accountId].currentBalance -= t.amount;
        if (t.isConsolidated) balances[t.accountId].consolidatedBalance -= t.amount;
      }
    }
  }

  return balances;
}

/**
 * Generate installment transactions array
 */
export function generateInstallmentTransactions(
  baseTransaction: Omit<Transaction, 'id' | 'createdAt'>,
  totalInstallments: number
): Omit<Transaction, 'id' | 'createdAt'>[] {
  const list: Omit<Transaction, 'id' | 'createdAt'>[] = [];
  const parentId = `inst_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  const [startYear, startMonth, startDay] = baseTransaction.date.split('-').map(Number);

  for (let i = 0; i < totalInstallments; i++) {
    // Add i months
    const dateObj = new Date(startYear, startMonth - 1 + i, startDay);
    // Handle month overflow gracefully
    const yearStr = dateObj.getFullYear();
    const monthStr = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dayStr = String(dateObj.getDate()).padStart(2, '0');
    const formattedDate = `${yearStr}-${monthStr}-${dayStr}`;

    const description = `${baseTransaction.description} [${i + 1}/${totalInstallments}]`;

    list.push({
      ...baseTransaction,
      description,
      date: formattedDate,
      installmentIndex: i + 1,
      installmentTotal: totalInstallments,
      parentInstallmentId: parentId,
      // First installment can inherit consolidation status, future defaults to false (pending)
      isConsolidated: i === 0 ? baseTransaction.isConsolidated : false,
    });
  }

  return list;
}

/**
 * Calculates required monthly contribution to reach a goal.
 * @param targetAmount Target goal amount (R$)
 * @param currentAmount Current saved balance (R$)
 * @param targetDate Goal target deadline (YYYY-MM-DD)
 * @param yieldRate Expected yield rate (%)
 * @param yieldPeriod 'monthly' or 'yearly'
 */
export function calculateMonthlyContribution(
  targetAmount: number,
  currentAmount: number,
  targetDate: string,
  yieldRate: number = 0,
  yieldPeriod: 'monthly' | 'yearly' = 'monthly'
): {
  monthlyPayment: number;
  remainingMonths: number;
  totalWithYield: number;
  yieldProfit: number;
} {
  const today = new Date();
  const target = targetDate ? new Date(targetDate) : new Date();

  // Calculate remaining months from now
  let months = (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth());
  if (months < 1) months = 1;

  const remainingNeeded = Math.max(0, targetAmount - currentAmount);

  // If rate <= 0, simple division
  if (!yieldRate || yieldRate <= 0) {
    const pmt = remainingNeeded / months;
    return {
      monthlyPayment: pmt,
      remainingMonths: months,
      totalWithYield: targetAmount,
      yieldProfit: 0,
    };
  }

  // Convert rate to decimal monthly interest rate
  const rateNum = yieldRate / 100;
  const r = yieldPeriod === 'yearly'
    ? Math.pow(1 + rateNum, 1 / 12) - 1 // effective monthly rate from annual rate
    : rateNum; // direct monthly rate

  // Current balance grown over `months`
  const futureValueOfCurrent = currentAmount * Math.pow(1 + r, months);

  // Remaining needed from future monthly contributions
  const targetFromPMT = targetAmount - futureValueOfCurrent;

  if (targetFromPMT <= 0) {
    return {
      monthlyPayment: 0,
      remainingMonths: months,
      totalWithYield: futureValueOfCurrent,
      yieldProfit: futureValueOfCurrent - currentAmount,
    };
  }

  // Annuity formula: PMT = targetFromPMT / [((1 + r)^n - 1) / r]
  const pmtFactor = (Math.pow(1 + r, months) - 1) / r;
  const monthlyPayment = targetFromPMT / pmtFactor;

  const totalInvestedByContributions = monthlyPayment * months;
  const totalOutsitePocket = currentAmount + totalInvestedByContributions;
  const yieldProfit = Math.max(0, targetAmount - totalOutsitePocket);

  return {
    monthlyPayment: Math.max(0, monthlyPayment),
    remainingMonths: months,
    totalWithYield: targetAmount,
    yieldProfit,
  };
}

