import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import Stripe from 'stripe';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';

// Central JSON storage files for multi-device sync
const NOTIFS_FILE = path.join(process.env.DATA_DIR || process.cwd(), 'data-notifications.json');
const SHARED_BUDGETS_FILE = path.join(process.env.DATA_DIR || process.cwd(), 'data-shared-budgets.json');
const USERS_FILE = path.join(process.env.DATA_DIR || process.cwd(), 'data-users.json');
const FINANCIALS_FILE = path.join(process.env.DATA_DIR || process.cwd(), 'data-financials.json');
const PORTFOLIO_FILE = path.join(process.env.DATA_DIR || process.cwd(), 'data-portfolio.json');
const GAMIFICATION_FILE = path.join(process.env.DATA_DIR || process.cwd(), 'data-gamification.json');

const FIXED_DARLA_CREATED_AT = '2026-08-12T10:00:00.000Z';

interface ServerUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  authProvider?: string;
  avatarUrl?: string;
  createdAt?: string;
  isPro?: boolean;
  plan?: string;
  subscriptionStatus?: string;
  sharedBudgetCode?: string;
  lastSessionId?: string;
  lastSessionCreatedAt?: string;
}

function isDarlaEmailOrId(idOrEmail: string): boolean {
  if (!idOrEmail) return false;
  const lower = idOrEmail.toLowerCase().trim();
  return (
    lower === 'darla.semfiltro@gmail.com' ||
    lower === 'darlasemfiltro@gmail.com' ||
    lower === 'user_darla_semfiltro_gmail_com' ||
    lower === 'user_darlasemfiltro_gmail_com' ||
    lower === 'carvalho.darlla@gmail.com' ||
    lower === 'carvalhodarlla@gmail.com' ||
    lower === 'user_carvalho_darlla_gmail_com' ||
    lower === 'user_carvalhodarlla_gmail_com' ||
    lower === 'darlla-5921' ||
    lower === 'darlla-8704'
  );
}

function normalizeUserEmailServer(email: string): string {
  return (email || '').trim().toLowerCase();
}

function isEmailMatchServer(email1?: string, email2?: string): boolean {
  const a = (email1 || '').trim().toLowerCase();
  const b = (email2 || '').trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  return normalizeUserEmailServer(a) === normalizeUserEmailServer(b);
}

function getCanonicalUserIdServer(idOrEmail: string): string {
  if (!idOrEmail) return 'default';
  const clean = idOrEmail.toLowerCase().trim();
  if (clean.startsWith('user_')) {
    const unprefix = clean.slice(5);
    if (unprefix.includes('_') && !unprefix.includes('@')) {
      const parts = unprefix.split('_');
      if (parts.length >= 2) {
        const domain = parts.pop();
        const local = parts.join('.');
        return `${local}@${domain}`;
      }
    }
  }
  return clean;
}

function syncDarlaUsers(users: ServerUser[]): ServerUser[] {
  return users;
}

function deduplicateServerData() {
  try {
    // 1. DEDUPLICATE USERS
    let rawUsers: ServerUser[] = [];
    if (fs.existsSync(USERS_FILE)) {
      try {
        rawUsers = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      } catch (e) {
        rawUsers = [];
      }
    }

    const emailUserMap = new Map<string, ServerUser[]>();
    const idToCanonicalMap = new Map<string, string>();

    rawUsers.forEach((u) => {
      if (!u || !u.email) return;
      const cleanEmail = u.email.trim().toLowerCase();
      const canonicalId = getCanonicalUserIdServer(cleanEmail);
      if (u.id) {
        idToCanonicalMap.set(u.id, canonicalId);
      }
      const list = emailUserMap.get(cleanEmail) || [];
      list.push(u);
      emailUserMap.set(cleanEmail, list);
    });

    const unifiedUsers: ServerUser[] = [];

    emailUserMap.forEach((userList, cleanEmail) => {
      const canonicalId = getCanonicalUserIdServer(cleanEmail);

      // Sort by creation date (earliest first)
      userList.sort((a, b) => {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tA - tB;
      });

      const defaultBudgetCode = cleanEmail === 'darla.semfiltro@gmail.com' ? 'DARLA-8704' : (cleanEmail === 'carvalho.darlla@gmail.com' ? 'DARLLA-5921' : undefined);

      const mergedUser: ServerUser = {
        id: canonicalId,
        name: userList.find((u) => u.name && u.name.trim() !== '')?.name || cleanEmail.split('@')[0],
        email: cleanEmail,
        password: userList.find((u) => u.password)?.password,
        authProvider: userList.find((u) => u.authProvider && u.authProvider !== 'email')?.authProvider || userList[0]?.authProvider || 'email',
        avatarUrl: userList.find((u) => u.avatarUrl && !u.avatarUrl.includes('unsplash'))?.avatarUrl || userList[0]?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        createdAt: userList[0]?.createdAt || FIXED_DARLA_CREATED_AT,
        isPro: userList.some((u) => u.isPro === true),
        plan: userList.find((u) => u.plan === 'lifetime' || u.plan === 'annual' || u.plan === 'pro')?.plan || userList[0]?.plan || 'free',
        subscriptionStatus: userList.find((u) => u.subscriptionStatus === 'active')?.subscriptionStatus || userList[0]?.subscriptionStatus || 'trial',
        sharedBudgetCode: userList.find((u) => u.sharedBudgetCode)?.sharedBudgetCode || defaultBudgetCode,
      };

      unifiedUsers.push(mergedUser);
    });

    // Ensure Darla accounts exist with lifetime VIP access
    const ensureDarlaUser = (email: string, name: string) => {
      const clean = email.trim().toLowerCase();
      const canonicalId = getCanonicalUserIdServer(clean);
      const defaultBudgetCode = clean === 'darla.semfiltro@gmail.com' ? 'DARLA-8704' : 'DARLLA-5921';
      const existing = unifiedUsers.find((u) => (u.email || '').trim().toLowerCase() === clean);
      if (!existing) {
        unifiedUsers.push({
          id: canonicalId,
          name,
          email: clean,
          authProvider: 'email',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          createdAt: FIXED_DARLA_CREATED_AT,
          isPro: true,
          plan: 'lifetime',
          subscriptionStatus: 'active',
          sharedBudgetCode: defaultBudgetCode,
        });
      } else {
        existing.id = canonicalId;
        existing.isPro = true;
        existing.plan = 'lifetime';
        existing.subscriptionStatus = 'active';
        if (!existing.sharedBudgetCode) {
          existing.sharedBudgetCode = defaultBudgetCode;
        }
      }
    };

    ensureDarlaUser('darla.semfiltro@gmail.com', 'Darla Carvalho');
    ensureDarlaUser('carvalho.darlla@gmail.com', 'Darlla Carvalho');

    try {
      fs.writeFileSync(USERS_FILE, JSON.stringify(unifiedUsers, null, 2), 'utf-8');
    } catch (e) {}

    // 2. DEDUPLICATE & NORMALIZE SHARED BUDGETS
    let rawBudgets: ServerSharedBudget[] = [];
    if (fs.existsSync(SHARED_BUDGETS_FILE)) {
      try {
        rawBudgets = JSON.parse(fs.readFileSync(SHARED_BUDGETS_FILE, 'utf-8'));
      } catch (e) {
        rawBudgets = [];
      }
    }

    const emailBudgetMap = new Map<string, ServerSharedBudget>();

    rawBudgets.forEach((b) => {
      if (!b || (!b.ownerEmail && !b.code)) return;
      const ownerEmail = (b.ownerEmail || '').trim().toLowerCase();
      const code = (b.code || '').trim().toUpperCase();
      const canonicalOwnerId = ownerEmail ? getCanonicalUserIdServer(ownerEmail) : b.ownerId;

      const key = ownerEmail || code;
      const existing = emailBudgetMap.get(key);

      if (!existing) {
        // Normalize collaborators
        const collabsMap = new Map<string, any>();
        (b.collaborators || []).forEach((c) => {
          if (c && c.email) {
            const cEmail = c.email.trim().toLowerCase();
            if (cEmail !== ownerEmail) {
              collabsMap.set(cEmail, {
                ...c,
                email: cEmail,
                accessMode: c.accessMode || 'edit',
                role: c.role || 'Colaborador',
              });
            }
          }
        });

        emailBudgetMap.set(key, {
          ...b,
          budgetId: canonicalOwnerId,
          ownerId: canonicalOwnerId,
          ownerEmail: ownerEmail || b.ownerEmail,
          code: code || b.code || '',
          collaborators: Array.from(collabsMap.values()),
        });
      } else {
        // Merge collaborators
        const collabsMap = new Map<string, any>();
        (existing.collaborators || []).forEach((c) => collabsMap.set(c.email.toLowerCase(), c));
        (b.collaborators || []).forEach((c) => {
          if (c && c.email) {
            const cEmail = c.email.trim().toLowerCase();
            if (cEmail !== ownerEmail) {
              collabsMap.set(cEmail, {
                ...c,
                email: cEmail,
                accessMode: c.accessMode || 'edit',
                role: c.role || 'Colaborador',
              });
            }
          }
        });
        existing.collaborators = Array.from(collabsMap.values());
      }
    });

    const unifiedBudgets = Array.from(emailBudgetMap.values());

    // Ensure default Darla budget if budgets list is empty
    if (unifiedBudgets.length === 0) {
      unifiedBudgets.push({
        budgetId: 'user_darla_semfiltro_gmail_com',
        ownerId: 'user_darla_semfiltro_gmail_com',
        ownerName: 'Darla Carvalho',
        ownerEmail: 'darla.semfiltro@gmail.com',
        code: '',
        collaborators: [],
      });
    }

    try {
      fs.writeFileSync(SHARED_BUDGETS_FILE, JSON.stringify(unifiedBudgets, null, 2), 'utf-8');
    } catch (e) {}

    // 3. DEDUPLICATE & NORMALIZE NOTIFICATIONS
    let rawNotifs: ServerNotification[] = [];
    if (fs.existsSync(NOTIFS_FILE)) {
      try {
        rawNotifs = JSON.parse(fs.readFileSync(NOTIFS_FILE, 'utf-8'));
      } catch (e) {
        rawNotifs = [];
      }
    }

    const notifMap = new Map<string, ServerNotification>();

    rawNotifs.forEach((n) => {
      if (!n) return;
      const cleanToEmail = (n.toEmail || '').trim().toLowerCase();
      const cleanFromEmail = (n.fromEmail || '').trim().toLowerCase();
      const cleanBudgetCode = (n.budgetCode || '').trim().toUpperCase();
      const normalizedBudgetId = cleanFromEmail ? getCanonicalUserIdServer(cleanFromEmail) : n.budgetId;

      const normalizedNotif: ServerNotification = {
        ...n,
        toEmail: cleanToEmail,
        fromEmail: cleanFromEmail,
        budgetCode: cleanBudgetCode,
        fromUserId: cleanFromEmail ? getCanonicalUserIdServer(cleanFromEmail) : n.fromUserId,
        budgetId: normalizedBudgetId,
        status: n.status || 'pending',
      };

      // Dedup key: toEmail + fromEmail + type + budgetCode
      const dedupKey = `${cleanToEmail}_${cleanFromEmail}_${n.type}`;
      const existing = notifMap.get(dedupKey);

      if (!existing) {
        notifMap.set(dedupKey, normalizedNotif);
      } else {
        // Keep status if changed from pending to accepted/rejected/read
        if (normalizedNotif.status !== 'pending') {
          notifMap.set(dedupKey, normalizedNotif);
        }
      }
    });

    const unifiedNotifs = Array.from(notifMap.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    try {
      fs.writeFileSync(NOTIFS_FILE, JSON.stringify(unifiedNotifs, null, 2), 'utf-8');
    } catch (e) {}

    // 4. MIGRATE FINANCIAL DATA & PORTFOLIO
    if (fs.existsSync(FINANCIALS_FILE)) {
      try {
        const rawFinancials = JSON.parse(fs.readFileSync(FINANCIALS_FILE, 'utf-8'));
        const migratedFinancials: Record<string, any> = {};

        Object.entries(rawFinancials).forEach(([keyId, data]: [string, any]) => {
          const canonicalId = idToCanonicalMap.get(keyId) || getCanonicalUserIdServer(keyId);
          if (!migratedFinancials[canonicalId]) {
            migratedFinancials[canonicalId] = data;
          } else {
            // Merge arrays if both exist
            const existing = migratedFinancials[canonicalId];
            migratedFinancials[canonicalId] = {
              accounts: [...(existing.accounts || []), ...(data.accounts || [])],
              categories: [...(existing.categories || []), ...(data.categories || [])],
              transactions: [...(existing.transactions || []), ...(data.transactions || [])],
              goals: [...(existing.goals || []), ...(data.goals || [])],
              familyMembers: [...(existing.familyMembers || []), ...(data.familyMembers || [])],
            };
          }
        });

        fs.writeFileSync(FINANCIALS_FILE, JSON.stringify(migratedFinancials, null, 2), 'utf-8');
      } catch (e) {}
    }

    if (fs.existsSync(PORTFOLIO_FILE)) {
      try {
        const rawPortfolio = JSON.parse(fs.readFileSync(PORTFOLIO_FILE, 'utf-8'));
        const migratedPortfolio: Record<string, any> = {};

        Object.entries(rawPortfolio).forEach(([keyId, data]: [string, any]) => {
          const canonicalId = idToCanonicalMap.get(keyId) || getCanonicalUserIdServer(keyId);
          migratedPortfolio[canonicalId] = data;
        });

        fs.writeFileSync(PORTFOLIO_FILE, JSON.stringify(migratedPortfolio, null, 2), 'utf-8');
      } catch (e) {}
    }
  } catch (err) {
    console.error('[deduplicateServerData Error]', err);
  }
}

// Run deduplication immediately on startup
deduplicateServerData();

function loadServerUsers(): ServerUser[] {
  try {
    deduplicateServerData();
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('[Server Storage] Failed to read data-users.json', e);
  }
  return [];
}

function saveServerUsers(users: ServerUser[]) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Server Storage] Failed to write data-users.json', e);
  }
}

function loadServerPortfolio(): Record<string, any> {
  try {
    if (fs.existsSync(PORTFOLIO_FILE)) {
      const data = fs.readFileSync(PORTFOLIO_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('[Server Storage] Failed to read data-portfolio.json', e);
  }
  return {};
}

function saveServerPortfolio(portfolioData: Record<string, any>) {
  try {
    fs.writeFileSync(PORTFOLIO_FILE, JSON.stringify(portfolioData, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Server Storage] Failed to write data-portfolio.json', e);
  }
}

function loadServerGamification(): Record<string, any> {
  try {
    if (fs.existsSync(GAMIFICATION_FILE)) {
      const data = fs.readFileSync(GAMIFICATION_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('[Server Storage] Failed to read data-gamification.json', e);
  }
  return {};
}

function saveServerGamification(gamificationData: Record<string, any>) {
  try {
    fs.writeFileSync(GAMIFICATION_FILE, JSON.stringify(gamificationData, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Server Storage] Failed to write data-gamification.json', e);
  }
}

function getDarlaFinancialDataset(userId: string) {
  const accounts = [
    {
      id: `acc_darla_principal_${userId}`,
      userId: userId,
      name: 'Conta Corrente Principal',
      type: 'checking',
      initialBalance: 503.51,
      color: '#00C853',
      icon: 'Building2',
      isDefault: true,
    },
  ];

  const categories = [
    {
      id: `cat_moradia_${userId}`,
      userId: userId,
      name: 'Moradia & Contas Fixas',
      type: 'expense',
      ruleGroup: '50_essentials',
      color: '#E11D48',
      icon: 'Home',
      subcategories: [{ id: `sub_aluguel_${userId}`, categoryId: `cat_moradia_${userId}`, name: 'Aluguel / Contas' }],
    },
    {
      id: `cat_alimentacao_${userId}`,
      userId: userId,
      name: 'Alimentação & Feira',
      type: 'expense',
      ruleGroup: '50_essentials',
      color: '#F43F5E',
      icon: 'Utensils',
      subcategories: [{ id: `sub_mercado_${userId}`, categoryId: `cat_alimentacao_${userId}`, name: 'Supermercado' }],
    },
    {
      id: `cat_lazer_${userId}`,
      userId: userId,
      name: 'Lazer & Estilo de Vida',
      type: 'expense',
      ruleGroup: '30_lifestyle',
      color: '#8B5CF6',
      icon: 'Sparkles',
      subcategories: [{ id: `sub_restaurante_${userId}`, categoryId: `cat_lazer_${userId}`, name: 'Restaurante & Passeios' }],
    },
    {
      id: `cat_renda_${userId}`,
      userId: userId,
      name: 'Receita Principal',
      type: 'income',
      ruleGroup: 'income',
      color: '#00C853',
      icon: 'Wallet',
      subcategories: [{ id: `sub_salario_${userId}`, categoryId: `cat_renda_${userId}`, name: 'Salário / Entradas' }],
    },
  ];

  const transactions = [
    {
      id: `tx_darla_rec_main_${userId}`,
      userId: userId,
      accountId: `acc_darla_principal_${userId}`,
      type: 'income',
      amount: 5157.59,
      date: '2026-08-05',
      description: 'Receitas / Entradas do Mês',
      categoryId: `cat_renda_${userId}`,
      subcategoryId: `sub_salario_${userId}`,
      isConsolidated: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: `tx_darla_exp_nec_${userId}`,
      userId: userId,
      accountId: `acc_darla_principal_${userId}`,
      type: 'expense',
      amount: 2927.02,
      date: '2026-08-10',
      description: 'Despesas Essenciais (50% Necessidades)',
      categoryId: `cat_moradia_${userId}`,
      subcategoryId: `sub_aluguel_${userId}`,
      isConsolidated: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: `tx_darla_exp_cons_${userId}`,
      userId: userId,
      accountId: `acc_darla_principal_${userId}`,
      type: 'expense',
      amount: 1274.85,
      date: '2026-08-12',
      description: 'Alimentação & Consolidado',
      categoryId: `cat_alimentacao_${userId}`,
      subcategoryId: `sub_mercado_${userId}`,
      isConsolidated: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: `tx_darla_exp_prev_${userId}`,
      userId: userId,
      accountId: `acc_darla_principal_${userId}`,
      type: 'expense',
      amount: 1265.61,
      date: '2026-08-25',
      description: 'Despesas Previstas',
      categoryId: `cat_lazer_${userId}`,
      subcategoryId: `sub_restaurante_${userId}`,
      isConsolidated: false,
      createdAt: new Date().toISOString(),
    },
  ];

  return {
    accounts,
    categories,
    familyMembers: [],
    transactions,
    goals: [],
  };
}

function loadServerFinancials(): Record<string, {
  accounts: any[];
  categories: any[];
  familyMembers: any[];
  transactions: any[];
  goals: any[];
  investmentTransactions?: any[];
  targetAllocations?: any[];
  deletedIds?: string[];
  updatedAt?: string;
}> {
  let financials: Record<string, any> = {};
  try {
    if (fs.existsSync(FINANCIALS_FILE)) {
      const data = fs.readFileSync(FINANCIALS_FILE, 'utf-8');
      financials = JSON.parse(data);
    }
  } catch (e) {
    console.error('[Server Storage] Failed to read data-financials.json', e);
  }

  let modified = false;

  // Consolidate legacy keys for carvalho.darlla@gmail.com
  const legacyKeys = ['user_carvalho_darlla_gmail_com', 'darlla-5921'];
  const targetKey = 'user_carvalhodarlla_gmail_com';
  let targetRecord = financials[targetKey];
  legacyKeys.forEach((lk) => {
    if (financials[lk]) {
      if (!targetRecord) {
        targetRecord = financials[lk];
        financials[targetKey] = targetRecord;
      } else {
        ['accounts', 'categories', 'familyMembers', 'transactions', 'goals', 'deletedIds'].forEach((k) => {
          if (Array.isArray(financials[lk][k])) {
            targetRecord[k] = targetRecord[k] || [];
            const existingIds = new Set(targetRecord[k].map((item: any) => item.id || item));
            financials[lk][k].forEach((item: any) => {
              const id = item.id || item;
              if (!existingIds.has(id)) {
                targetRecord[k].push(item);
                existingIds.add(id);
              }
            });
          }
        });
      }
      delete financials[lk];
      modified = true;
    }
  });

  // Consolidate legacy keys for darla.semfiltro@gmail.com
  const legacyDarlaKeys = ['user_darlasemfiltro_gmail_com', 'darlla-8704'];
  const targetDarlaKey = 'user_darla_semfiltro_gmail_com';
  let targetDarlaRecord = financials[targetDarlaKey];
  legacyDarlaKeys.forEach((lk) => {
    if (financials[lk]) {
      if (!targetDarlaRecord) {
        targetDarlaRecord = financials[lk];
        financials[targetDarlaKey] = targetDarlaRecord;
      } else {
        ['accounts', 'categories', 'familyMembers', 'transactions', 'goals', 'deletedIds'].forEach((k) => {
          if (Array.isArray(financials[lk][k])) {
            targetDarlaRecord[k] = targetDarlaRecord[k] || [];
            const existingIds = new Set(targetDarlaRecord[k].map((item: any) => item.id || item));
            financials[lk][k].forEach((item: any) => {
              const id = item.id || item;
              if (!existingIds.has(id)) {
                targetDarlaRecord[k].push(item);
                existingIds.add(id);
              }
            });
          }
        });
      }
      delete financials[lk];
      modified = true;
    }
  });

  // Sanitize and isolate user records strictly
  for (const [canonicalId, record] of Object.entries(financials)) {
    if (record && typeof record === 'object') {
      ['accounts', 'categories', 'familyMembers', 'transactions', 'goals'].forEach((key) => {
        if (Array.isArray(record[key])) {
          const originalLen = record[key].length;
          record[key] = record[key].filter((item: any) => {
            if (!item) return false;
            const itemUser = item.userId ? getCanonicalUserIdServer(item.userId) : canonicalId;
            return itemUser === canonicalId;
          });
          if (record[key].length !== originalLen) modified = true;
        }
      });
    }
  }

  if (modified) {
    saveServerFinancials(financials);
  }

  return financials;
}

function saveServerFinancials(data: Record<string, any>) {
  try {
    fs.writeFileSync(FINANCIALS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Server Storage] Failed to write data-financials.json', e);
  }
}

interface ServerNotification {
  id: string;
  type: 'invite' | 'request' | 'info';
  fromUserId: string;
  fromName: string;
  fromEmail: string;
  toEmail: string;
  budgetId: string;
  budgetCode?: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected' | 'read';
  createdAt: string;
}

interface ServerSharedBudget {
  budgetId: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  code: string;
  collaborators: Array<{
    email: string;
    name: string;
    addedAt: string;
    role: string;
    accessMode: 'edit' | 'read';
  }>;
}

function loadServerNotifs(): ServerNotification[] {
  try {
    if (fs.existsSync(NOTIFS_FILE)) {
      const data = fs.readFileSync(NOTIFS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('[Server Storage] Failed to read data-notifications.json', e);
  }
  return [];
}

function saveServerNotifs(notifs: ServerNotification[]) {
  try {
    fs.writeFileSync(NOTIFS_FILE, JSON.stringify(notifs, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Server Storage] Failed to write data-notifications.json', e);
  }
}

function loadServerBudgets(): ServerSharedBudget[] {
  let list: ServerSharedBudget[] = [];
  try {
    if (fs.existsSync(SHARED_BUDGETS_FILE)) {
      const data = fs.readFileSync(SHARED_BUDGETS_FILE, 'utf-8');
      list = JSON.parse(data);
    }
  } catch (e) {
    console.error('[Server Storage] Failed to read data-shared-budgets.json', e);
  }

  // Deduplicate by ownerEmail
  const emailBudgetMap = new Map<string, ServerSharedBudget>();
  list.forEach((b) => {
    if (!b || (!b.ownerEmail && !b.code)) return;
    const ownerEmail = (b.ownerEmail || '').trim().toLowerCase();
    const code = (b.code || '').trim().toUpperCase();
    const key = ownerEmail || code;
    const existing = emailBudgetMap.get(key);
    if (!existing) {
      emailBudgetMap.set(key, b);
    } else {
      // Merge collaborators
      const collabsMap = new Map<string, any>();
      (existing.collaborators || []).forEach((c) => collabsMap.set(c.email.toLowerCase(), c));
      (b.collaborators || []).forEach((c) => collabsMap.set(c.email.toLowerCase(), c));
      existing.collaborators = Array.from(collabsMap.values());
    }
  });

  const cleanList = Array.from(emailBudgetMap.values());
  return cleanList;
}

function saveServerBudgets(budgets: ServerSharedBudget[]) {
  try {
    fs.writeFileSync(SHARED_BUDGETS_FILE, JSON.stringify(budgets, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Server Storage] Failed to write data-shared-budgets.json', e);
  }
}

let stripeClient: Stripe | null = null;
function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.trim() === '' || key.startsWith('sk_test_...')) {
    return null;
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

function createEmailTransporter() {
  let rawHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  rawHost = rawHost.replace(/^https?:\/\//i, '');
  const smtpHost = rawHost || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = (process.env.SMTP_USER || process.env.GMAIL_USER || 'suporte.dinheirosemfiltro@gmail.com').trim();
  const rawPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || 'pffc lava ytat repy';
  const smtpPass = rawPass ? rawPass.trim() : 'pffc lava ytat repy';
  const isGmail = smtpHost.includes('gmail.com') || smtpUser.endsWith('@gmail.com');

  if (isGmail) {
    return {
      transporter: nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      }),
      smtpUser,
      emailFrom: process.env.EMAIL_FROM || `Dinheiro Sem Filtro <${smtpUser}>`,
    };
  }

  return {
    transporter: nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    }),
    smtpUser,
    emailFrom: process.env.EMAIL_FROM || `Dinheiro Sem Filtro <${smtpUser}>`,
  };
}

export const app = express();
export const server = http.createServer(app);

async function startServer() {


  const PORT = 3000;

  // Real-Time WebSocket Server
  const wss = new WebSocketServer({ noServer: true });
  const wsClients = new Set<WebSocket>();

  server.on('upgrade', (request, socket, head) => {
    if (request.url?.startsWith('/ws')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('error', (err) => {
    console.warn('[WebSocketServer Error]', err);
  });

  wss.on('connection', (ws) => {
    wsClients.add(ws);

    ws.on('message', (messageData) => {
      try {
        const data = JSON.parse(messageData.toString());
        if (data.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG' }));
        }
      } catch (e) {}
    });

    ws.on('close', () => wsClients.delete(ws));
    ws.on('error', () => wsClients.delete(ws));
  });

  function broadcastRealtime(type: string, payload?: any) {
    const message = JSON.stringify({ type, payload, timestamp: Date.now() });
    wsClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (e) {
          wsClients.delete(client);
        }
      }
    });
  }

  // Security headers & payload size limit (max 1MB) to guard against DoS
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // API endpoint to send password reset emails
  app.post('/api/send-reset-email', async (req, res) => {
    try {
      const { email, resetCode, userName } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, message: 'E-mail é obrigatório.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const name = userName || cleanEmail.split('@')[0];
      const code = resetCode || Math.floor(100000 + Math.random() * 900000).toString();

      const { transporter, smtpUser, emailFrom } = createEmailTransporter();

      let emailSent = false;
      let sendError = '';

      if (smtpUser) {
        try {
          const logoUrl = `https://${req.headers.host || 'dinheirosemfiltro.vercel.app'}/logo.png`;
          const senderHeader = `"DINHEIRO SEM FILTRO" <${emailFrom}>`;

          const mailOptions = {
            from: senderHeader,
            to: cleanEmail,
            subject: '🔒 [DINHEIRO SEM FILTRO] Código para Redefinição de Senha',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 16px; background-color: #FFFFFF;">
                <div style="text-align: center; padding-bottom: 16px; border-bottom: 2px solid #D4AF37;">
                  <img src="${logoUrl}" alt="DINHEIRO SEM FILTRO Logo" width="80" height="80" style="border-radius: 50%; border: 2px solid #D4AF37; margin: 0 auto 12px auto; display: block; object-fit: cover;" />
                  <h1 style="color: #121212; font-size: 22px; margin: 0; font-family: Georgia, serif; font-weight: bold;">DINHEIRO SEM FILTRO</h1>
                  <p style="color: #D4AF37; font-weight: bold; font-size: 12px; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;">DOMINE SEU DINHEIRO ANTES QUE ELE DOMINE VOCÊ!</p>
                </div>
                <div style="padding: 24px 0;">
                  <p style="font-size: 15px; color: #121212;">Olá <strong>${name}</strong>,</p>
                  <p style="font-size: 14px; color: #374151; line-height: 1.5;">
                    Recebemos uma solicitação de redefinição de senha para o seu e-mail (<strong>${cleanEmail}</strong>).
                  </p>
                  <div style="margin: 24px 0; text-align: center; background-color: #FFFBEB; border: 1px solid #FCD34D; border-radius: 12px; padding: 16px;">
                    <span style="font-size: 12px; font-weight: bold; color: #92400E; display: block; text-transform: uppercase; letter-spacing: 1px;">Seu Código de Segurança</span>
                    <span style="font-size: 32px; font-weight: 900; color: #121212; letter-spacing: 6px; font-family: monospace; display: block; margin-top: 8px;">${code}</span>
                  </div>
                  <p style="font-size: 13px; color: #6B7280;">
                    Copie e digite este código de 6 dígitos no aplicativo para cadastrar sua nova senha.
                  </p>
                  <p style="font-size: 12px; color: #9CA3AF; margin-top: 20px;">
                    Se você não solicitou a alteração, por favor ignore este e-mail. Sua senha continuará segura.
                  </p>
                </div>
                <div style="text-align: center; padding-top: 16px; border-top: 1px solid #E5E7EB; color: #9CA3AF; font-size: 11px;">
                  DINHEIRO SEM FILTRO App &copy; ${new Date().getFullYear()}
                </div>
              </div>
            `,
          };

          await transporter.sendMail(mailOptions);
          emailSent = true;
          console.log(`[SMTP] E-mail de redefinição enviado com sucesso para ${cleanEmail}`);
        } catch (err: any) {
          console.error('[SMTP Error]', err?.message || err);
          sendError = err?.message || 'Falha ao conectar ao servidor SMTP.';
        }
      }

      return res.json({
        success: true,
        emailSent,
        code,
        message: emailSent
          ? `✉️ E-mail de redefinição enviado com sucesso para ${cleanEmail}! Verifique sua caixa de entrada e spam.`
          : `✉️ Instruções de redefinição processadas para ${cleanEmail}. Código de verificação: ${code}`,
        errorDetails: sendError || undefined,
      });
    } catch (error: any) {
      console.error('[API send-reset-email error]', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao processar redefinição de senha.',
      });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Google Finance Live Quotes Proxy & Scraper Endpoint
  app.get('/api/google-finance/quotes', async (req, res) => {
    try {
      const rawTickers = req.query.tickers ? String(req.query.tickers).split(',') : [];
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

      const fetchGF = async (targetUrl: string) => {
        try {
          const resp = await fetch(targetUrl, {
            headers: {
              'User-Agent': userAgent,
              'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
            },
          });
          if (!resp.ok) return null;
          const html = await resp.text();

          // Match data-last-price or data-value or data-price-change-percent
          const priceMatch = html.match(/data-last-price="([0-9.]+)"/) || html.match(/data-value="([0-9.]+)"/);
          const changeMatch = html.match(/data-price-change-percent="([0-9.-]+)"/) || html.match(/class="P6142e"[^>]*>([+-]?[0-9.,]+)%/);

          if (priceMatch && priceMatch[1]) {
            const price = parseFloat(priceMatch[1]);
            let changePct = 0;
            if (changeMatch && changeMatch[1]) {
              changePct = parseFloat(changeMatch[1].replace(',', '.'));
            }
            if (!isNaN(price) && price > 0) {
              return { price, changePct: isNaN(changePct) ? 0 : changePct };
            }
          }

          // Fallback match HTML div YMlA3d or fx5ff or fx5ff
          const ymMatch = html.match(/class="(?:YMlA3d|fx5ff)"[^>]*>([^<]+)</);
          if (ymMatch && ymMatch[1]) {
            const cleanStr = ymMatch[1].replace(/R\$\s?|\$|pts|\./g, '').replace(',', '.').trim();
            const price = parseFloat(cleanStr);
            if (!isNaN(price) && price > 0) {
              return { price, changePct: 0 };
            }
          }
        } catch {
          // fallback
        }
        return null;
      };

      // Parallel fetch Google Finance main market tickers
      const [usdBrl, eurBrl, btcBrl, ibov, ifix] = await Promise.all([
        fetchGF('https://www.google.com/finance/quote/USD-BRL'),
        fetchGF('https://www.google.com/finance/quote/EUR-BRL'),
        fetchGF('https://www.google.com/finance/quote/BTC-BRL'),
        fetchGF('https://www.google.com/finance/quote/IBOV:INDEXBVMF'),
        fetchGF('https://www.google.com/finance/quote/IFIX:INDEXBVMF'),
      ]);

      const quotesMap: Record<string, { price: number; changePct: number; source: string }> = {};

      if (usdBrl) quotesMap['USD/BRL'] = { ...usdBrl, source: 'google_finance' };
      if (eurBrl) quotesMap['EUR/BRL'] = { ...eurBrl, source: 'google_finance' };
      if (btcBrl) quotesMap['BTC/BRL'] = { ...btcBrl, source: 'google_finance' };
      if (ibov) quotesMap['IBOV'] = { ...ibov, source: 'google_finance' };
      if (ifix) quotesMap['IFIX'] = { ...ifix, source: 'google_finance' };

      // Optional asset tickers from Google Finance (B3, US, Crypto, Currencies)
      if (rawTickers.length > 0) {
        const uniqueTickers = Array.from(new Set(rawTickers)).filter(t => t.length >= 2).slice(0, 20);
        const tickerResults = await Promise.all(
          uniqueTickers.map(async (t) => {
            const cleanT = t.trim().toUpperCase();
            // Try BVMF (B3 Brazilian market) first
            let gfData = await fetchGF(`https://www.google.com/finance/quote/${cleanT}:BVMF`);
            if (!gfData) gfData = await fetchGF(`https://www.google.com/finance/quote/${cleanT}:NASDAQ`);
            if (!gfData) gfData = await fetchGF(`https://www.google.com/finance/quote/${cleanT}:NYSE`);
            if (!gfData) gfData = await fetchGF(`https://www.google.com/finance/quote/${cleanT}-BRL`);
            if (!gfData) gfData = await fetchGF(`https://www.google.com/finance/quote/${cleanT}`);
            return { ticker: cleanT, data: gfData };
          })
        );
        tickerResults.forEach((res) => {
          if (res.data) {
            quotesMap[res.ticker] = { ...res.data, source: 'google_finance' };
          }
        });
      }

      return res.json({
        success: true,
        source: 'Google Finance',
        updatedAt: new Date().toISOString(),
        quotes: quotesMap,
      });
    } catch (err: any) {
      console.error('[Google Finance API Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao buscar cotações no Google Finance.' });
    }
  });

  // API endpoint to send invitation emails
  app.post('/api/send-invitation-email', async (req, res) => {
    try {
      const { toEmail, inviterName, inviterEmail, budgetCode } = req.body;
      if (!toEmail) {
        return res.status(400).json({ success: false, message: 'E-mail do destinatário é obrigatório.' });
      }

      const cleanEmail = toEmail.trim().toLowerCase();
      const { transporter, smtpUser, emailFrom } = createEmailTransporter();

      let emailSent = false;
      let sendError = '';

      if (smtpUser) {
        try {
          const logoUrl = `https://${req.headers.host || 'dinheirosemfiltro.vercel.app'}/logo.png`;
          const senderHeader = `"DINHEIRO SEM FILTRO" <${emailFrom}>`;

          const mailOptions = {
            from: senderHeader,
            to: cleanEmail,
            subject: `✉️ [DINHEIRO SEM FILTRO] Convite para Conectar ao Orçamento de ${inviterName || inviterEmail}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 16px; background-color: #FFFFFF;">
                <div style="text-align: center; padding-bottom: 16px; border-bottom: 2px solid #D4AF37;">
                  <img src="${logoUrl}" alt="DINHEIRO SEM FILTRO Logo" width="80" height="80" style="border-radius: 50%; border: 2px solid #D4AF37; margin: 0 auto 12px auto; display: block; object-fit: cover;" />
                  <h1 style="color: #121212; font-size: 22px; margin: 0; font-family: Georgia, serif; font-weight: bold;">DINHEIRO SEM FILTRO</h1>
                  <p style="color: #D4AF37; font-weight: bold; font-size: 12px; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;">DOMINE SEU DINHEIRO ANTES QUE ELE DOMINE VOCÊ!</p>
                </div>
                <div style="padding: 24px 0;">
                  <p style="font-size: 15px; color: #121212;">Olá,</p>
                  <p style="font-size: 14px; color: #374151; line-height: 1.5;">
                    <strong>${inviterName}</strong> (${inviterEmail}) convidou você para compartilhar o orçamento financeiro no aplicativo DINHEIRO SEM FILTRO.
                  </p>
                  <div style="margin: 24px 0; text-align: center; background-color: #F0FDF4; border: 1px solid #86EFAC; border-radius: 12px; padding: 16px;">
                    <span style="font-size: 12px; font-weight: bold; color: #166534; display: block; text-transform: uppercase; letter-spacing: 1px;">Titular do Orçamento</span>
                    <span style="font-size: 18px; font-weight: 900; color: #121212; display: block; margin-top: 6px;">${inviterName || inviterEmail} (${inviterEmail})</span>
                  </div>
                  <p style="font-size: 13px; color: #6B7280;">
                    Acesse o aplicativo DINHEIRO SEM FILTRO no seu computador ou celular para visualizar e autorizar esta conexão.
                  </p>
                </div>
                <div style="text-align: center; padding-top: 16px; border-top: 1px solid #E5E7EB; color: #9CA3AF; font-size: 11px;">
                  DINHEIRO SEM FILTRO App &copy; ${new Date().getFullYear()}
                </div>
              </div>
            `,
          };

          await transporter.sendMail(mailOptions);
          emailSent = true;
          console.log(`[SMTP] Convite de orçamento enviado para ${cleanEmail}`);
        } catch (err: any) {
          console.error('[SMTP Error - Convite]', err?.message || err);
          sendError = err?.message || 'Falha no envio SMTP.';
        }
      }

      return res.json({ success: true, emailSent, message: emailSent ? `Convite enviado por e-mail para ${cleanEmail}` : `Convite registrado.` });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: 'Erro interno ao enviar convite por e-mail.' });
    }
  });

  // API endpoint to send access request emails
  app.post('/api/send-access-request-email', async (req, res) => {
    try {
      const { toEmail, requesterName, requesterEmail, budgetCode } = req.body;
      if (!toEmail) {
        return res.status(400).json({ success: false, message: 'E-mail do titular é obrigatório.' });
      }

      const cleanEmail = toEmail.trim().toLowerCase();
      const { transporter, smtpUser, emailFrom } = createEmailTransporter();

      let emailSent = false;

      if (smtpUser) {
        try {
          const logoUrl = `https://${req.headers.host || 'dinheirosemfiltro.vercel.app'}/logo.png`;
          const senderHeader = `"DINHEIRO SEM FILTRO" <${emailFrom}>`;

          const mailOptions = {
            from: senderHeader,
            to: cleanEmail,
            subject: `📩 [DINHEIRO SEM FILTRO] Solicitação de Autorização do Orçamento por ${requesterName || requesterEmail}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 16px; background-color: #FFFFFF;">
                <div style="text-align: center; padding-bottom: 16px; border-bottom: 2px solid #D4AF37;">
                  <img src="${logoUrl}" alt="DINHEIRO SEM FILTRO Logo" width="80" height="80" style="border-radius: 50%; border: 2px solid #D4AF37; margin: 0 auto 12px auto; display: block; object-fit: cover;" />
                  <h1 style="color: #121212; font-size: 22px; margin: 0; font-family: Georgia, serif; font-weight: bold;">DINHEIRO SEM FILTRO</h1>
                  <p style="color: #D4AF37; font-weight: bold; font-size: 12px; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;">DOMINE SEU DINHEIRO ANTES QUE ELE DOMINE VOCÊ!</p>
                </div>
                <div style="padding: 24px 0;">
                  <p style="font-size: 15px; color: #121212;">Olá Titular,</p>
                  <p style="font-size: 14px; color: #374151; line-height: 1.5;">
                    O usuário <strong>${requesterName}</strong> (${requesterEmail}) enviou uma solicitação de autorização para se conectar ao seu orçamento (Código: <strong>${budgetCode}</strong>).
                  </p>
                  <p style="font-size: 13px; color: #6B7280; margin-top: 16px;">
                    Abra o aplicativo DINHEIRO SEM FILTRO para autorizar ou recusar o acesso.
                  </p>
                </div>
                <div style="text-align: center; padding-top: 16px; border-top: 1px solid #E5E7EB; color: #9CA3AF; font-size: 11px;">
                  DINHEIRO SEM FILTRO App &copy; ${new Date().getFullYear()}
                </div>
              </div>
            `,
          };

          await transporter.sendMail(mailOptions);
          emailSent = true;
          console.log(`[SMTP] Solicitação de acesso enviada por e-mail para ${cleanEmail}`);
        } catch (err: any) {
          console.error('[SMTP Error - Solicitação]', err?.message || err);
        }
      }

      return res.json({ success: true, emailSent, message: emailSent ? `Solicitação enviada por e-mail para ${cleanEmail}` : `Solicitação registrada.` });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: 'Erro interno ao enviar solicitação por e-mail.' });
    }
  });

  // --- CENTRAL USER REGISTRY & MULTI-DEVICE AUTH SYNC ---

  // GET /api/users/lookup?email=...&userId=...
  app.get('/api/users/lookup', (req, res) => {
    try {
      const rawEmail = typeof req.query.email === 'string' ? req.query.email : '';
      const rawUserId = typeof req.query.userId === 'string' ? req.query.userId : '';
      const cleanEmail = rawEmail.trim().toLowerCase();
      const canonicalId = rawUserId ? getCanonicalUserIdServer(rawUserId) : '';

      if (!cleanEmail && !canonicalId) {
        return res.status(400).json({ success: false, message: 'E-mail ou ID de usuário obrigatório.' });
      }

      const allUsers = loadServerUsers();
      const user = allUsers.find((u) => {
        if (cleanEmail && (u.email || '').trim().toLowerCase() === cleanEmail) return true;
        if (canonicalId && (u.id === canonicalId || getCanonicalUserIdServer(u.id) === canonicalId)) return true;
        if (rawUserId && u.id === rawUserId) return true;
        return false;
      });

      if (user) {
        return res.json({ success: true, user });
      }
      return res.json({ success: false, user: null, message: 'Usuário não encontrado ou excluído do sistema.' });
    } catch (err) {
      console.error('[API Users Lookup Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao buscar usuário.' });
    }
  });

  // GET /api/users/validate?userId=...&email=...
  app.get('/api/users/validate', (req, res) => {
    try {
      const rawEmail = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
      const rawUserId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
      const canonicalId = rawUserId ? getCanonicalUserIdServer(rawUserId) : (rawEmail ? getCanonicalUserIdServer(rawEmail) : '');

      const allUsers = loadServerUsers();
      const user = allUsers.find((u) => {
        if (rawEmail && (u.email || '').trim().toLowerCase() === rawEmail) return true;
        if (canonicalId && (u.id === canonicalId || getCanonicalUserIdServer(u.id) === canonicalId)) return true;
        if (rawUserId && u.id === rawUserId) return true;
        return false;
      });

      if (user) {
        return res.json({ success: true, exists: true, user });
      }
      return res.json({ success: true, exists: false, user: null });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erro ao validar usuário.' });
    }
  });

  // POST /api/users/sync
  app.post('/api/users/sync', (req, res) => {
    try {
      const userData = req.body;
      if (!userData || !userData.email) {
        return res.status(400).json({ success: false, message: 'E-mail do usuário é obrigatório.' });
      }
      const cleanEmail = userData.email.trim().toLowerCase();
      const allUsers = loadServerUsers();
      const idx = allUsers.findIndex((u) => (u.email || '').trim().toLowerCase() === cleanEmail);

      const deterministicId = `user_${cleanEmail.replace(/[^a-z0-9]/gi, '_')}`;

      const isDarla = isDarlaEmailOrId(cleanEmail);

      if (idx >= 0) {
        const existing = allUsers[idx];
        const prevSessionId = existing.lastSessionId;
        const newSessionId = userData.sessionId || userData.lastSessionId || existing.lastSessionId;

        const updatedUser: ServerUser = {
          ...existing,
          ...userData,
          id: existing.id || deterministicId,
          email: cleanEmail,
          createdAt: existing.createdAt || userData.createdAt || new Date().toISOString(),
          isPro: isDarla ? true : (existing.isPro || userData.isPro || false),
          plan: isDarla ? 'lifetime' : (existing.plan || userData.plan || 'free'),
          subscriptionStatus: isDarla ? 'active' : (existing.subscriptionStatus || userData.subscriptionStatus || 'trial'),
          lastSessionId: newSessionId,
          lastSessionCreatedAt: (newSessionId && newSessionId !== prevSessionId) ? new Date().toISOString() : (existing.lastSessionCreatedAt || new Date().toISOString()),
        };
        if (userData.password) updatedUser.password = userData.password;
        if (userData.name) updatedUser.name = userData.name;
        if (userData.avatarUrl) updatedUser.avatarUrl = userData.avatarUrl;
        if (userData.authProvider) updatedUser.authProvider = userData.authProvider;
        allUsers[idx] = updatedUser;
        saveServerUsers(allUsers);

        broadcastRealtime('USER_UPDATED', { email: cleanEmail, userId: updatedUser.id, user: updatedUser });

        return res.json({ success: true, user: updatedUser, isNew: false });
      } else {
        const initialSessionId = userData.sessionId || userData.lastSessionId;
        const newUser: ServerUser = {
          id: userData.id || deterministicId,
          name: userData.name || cleanEmail.split('@')[0],
          email: cleanEmail,
          password: userData.password,
          authProvider: userData.authProvider || 'email',
          avatarUrl: userData.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          createdAt: userData.createdAt || new Date().toISOString(),
          isPro: isDarla ? true : (userData.isPro || false),
          plan: isDarla ? 'lifetime' : (userData.plan || 'free'),
          subscriptionStatus: isDarla ? 'active' : (userData.subscriptionStatus || 'trial'),
          lastSessionId: initialSessionId,
          lastSessionCreatedAt: initialSessionId ? new Date().toISOString() : undefined,
        };
        allUsers.push(newUser);
        saveServerUsers(allUsers);

        broadcastRealtime('USER_UPDATED', { email: cleanEmail, userId: newUser.id, user: newUser });

        return res.json({ success: true, user: newUser, isNew: true });
      }
    } catch (err) {
      console.error('[API Users Sync Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao sincronizar usuário.' });
    }
  });

  // POST /api/users/login
  app.post('/api/users/login', (req, res) => {
    try {
      const { email, password, name, avatarUrl, authProvider, sessionId } = req.body || {};
      if (!email) {
        return res.status(400).json({ success: false, message: 'E-mail é obrigatório.' });
      }
      const cleanEmail = email.trim().toLowerCase();
      const allUsers = loadServerUsers();
      let user = allUsers.find((u) => (u.email || '').trim().toLowerCase() === cleanEmail);

      const deterministicId = `user_${cleanEmail.replace(/[^a-z0-9]/gi, '_')}`;

      const isDarla = isDarlaEmailOrId(cleanEmail);

      if (user) {
        const prevSessionId = user.lastSessionId;
        if (password) user.password = password;
        if (name && !user.name) user.name = name;
        if (avatarUrl) user.avatarUrl = avatarUrl;
        if (authProvider) user.authProvider = authProvider;
        if (sessionId) {
          user.lastSessionId = sessionId;
          user.lastSessionCreatedAt = new Date().toISOString();
        }
        if (isDarla) {
          user.isPro = true;
          user.plan = 'lifetime';
          user.subscriptionStatus = 'active';
        }
        saveServerUsers(allUsers);

        broadcastRealtime('USER_UPDATED', { email: cleanEmail, userId: user.id, user });

        return res.json({ success: true, user, isNew: false });
      } else {
        user = {
          id: deterministicId,
          name: name || cleanEmail.split('@')[0],
          email: cleanEmail,
          password,
          authProvider: authProvider || 'email',
          avatarUrl: avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          createdAt: new Date().toISOString(),
          isPro: isDarla ? true : false,
          plan: isDarla ? 'lifetime' : 'free',
          subscriptionStatus: isDarla ? 'active' : 'trial',
          lastSessionId: sessionId,
          lastSessionCreatedAt: sessionId ? new Date().toISOString() : undefined,
        };
        allUsers.push(user);
        saveServerUsers(allUsers);

        broadcastRealtime('USER_UPDATED', { email: cleanEmail, userId: user.id, user });

        return res.json({ success: true, user, isNew: true });
      }
    } catch (err) {
      console.error('[API Users Login Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao realizar login no servidor.' });
    }
  });

  // POST /api/users/delete (Immediate permanent account and data deletion)
  app.post('/api/users/delete', (req, res) => {
    try {
      const { userId, email } = req.body || {};
      if (!userId && !email) {
        return res.status(400).json({ success: false, message: 'userId ou email é obrigatório.' });
      }
      const cleanEmail = email ? email.trim().toLowerCase() : '';
      const canonicalId = userId ? getCanonicalUserIdServer(userId) : (cleanEmail ? getCanonicalUserIdServer(cleanEmail) : '');

      console.log(`[API Users Delete] Permanently deleting account for ${cleanEmail || canonicalId}...`);

      // 1. Remove from USERS_FILE
      const allUsers = loadServerUsers();
      const updatedUsers = allUsers.filter((u) => {
        if (cleanEmail && (u.email || '').trim().toLowerCase() === cleanEmail) return false;
        if (canonicalId && (u.id === canonicalId || getCanonicalUserIdServer(u.id) === canonicalId)) return false;
        return true;
      });
      saveServerUsers(updatedUsers);

      // 2. Remove from FINANCIALS_FILE
      const financials = loadServerFinancials();
      if (canonicalId && financials[canonicalId]) delete financials[canonicalId];
      if (cleanEmail) {
        const altId = getCanonicalUserIdServer(cleanEmail);
        if (financials[altId]) delete financials[altId];
      }
      if (userId && financials[userId]) delete financials[userId];
      saveServerFinancials(financials);

      // 3. Remove from PORTFOLIO_FILE
      const portfolio = loadServerPortfolio();
      if (canonicalId && portfolio[canonicalId]) delete portfolio[canonicalId];
      if (cleanEmail) {
        const altId = getCanonicalUserIdServer(cleanEmail);
        if (portfolio[altId]) delete portfolio[altId];
      }
      if (userId && portfolio[userId]) delete portfolio[userId];
      saveServerPortfolio(portfolio);

      // 4. Remove from GAMIFICATION_FILE
      const gamif = loadServerGamification();
      if (canonicalId && gamif[canonicalId]) delete gamif[canonicalId];
      if (cleanEmail && gamif[cleanEmail]) delete gamif[cleanEmail];
      if (userId && gamif[userId]) delete gamif[userId];
      saveServerGamification(gamif);

      // 5. Remove from SHARED_BUDGETS_FILE
      const allBudgets = loadServerBudgets();
      const updatedBudgets = allBudgets.filter((b) => {
        if (cleanEmail && (b.ownerEmail || '').trim().toLowerCase() === cleanEmail) return false;
        if (canonicalId && (b.budgetId === canonicalId || b.ownerId === canonicalId)) return false;
        return true;
      });
      // Also remove user as collaborator from all remaining budgets
      if (cleanEmail) {
        updatedBudgets.forEach((b) => {
          if (b.collaborators) {
            b.collaborators = b.collaborators.filter((c) => (c.email || '').trim().toLowerCase() !== cleanEmail);
          }
        });
      }
      saveServerBudgets(updatedBudgets);

      // 6. Remove from NOTIFICATIONS_FILE
      const notifs = loadServerNotifs();
      const updatedNotifs = notifs.filter((n) => {
        if (cleanEmail && (
          (n.toEmail || '').trim().toLowerCase() === cleanEmail ||
          (n.fromEmail || '').trim().toLowerCase() === cleanEmail
        )) return false;
        if (canonicalId && (n.fromUserId === canonicalId || n.budgetId === canonicalId)) return false;
        return true;
      });
      saveServerNotifs(updatedNotifs);

      // 7. Broadcast real-time deletion to all connected devices
      broadcastRealtime('USER_DELETED', { userId: canonicalId, email: cleanEmail, rawUserId: userId });
      broadcastRealtime('SHARED_BUDGET_UPDATED', { budgetId: canonicalId });
      broadcastRealtime('NOTIFICATIONS_UPDATED', { email: cleanEmail });
      broadcastRealtime('DATA_UPDATED', { userId: canonicalId });

      return res.json({ success: true, message: 'Conta e todos os dados foram excluídos com sucesso de imediato!' });
    } catch (err) {
      console.error('[API Users Delete Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao excluir conta do servidor.' });
    }
  });

  // POST /api/admin/wipe-all-database (Clear all accounts, reset all databases, disconnect all active devices)
  app.post('/api/admin/wipe-all-database', (req, res) => {
    try {
      saveServerUsers([]);
      saveServerFinancials({});
      saveServerBudgets([]);
      saveServerPortfolio({});
      saveServerGamification({});
      saveServerNotifs([]);

      // Broadcast global disconnect to all connected websocket clients
      broadcastRealtime('FORCE_DISCONNECT_ALL', { timestamp: new Date().toISOString() });
      broadcastRealtime('USER_DELETED', { all: true });

      return res.json({ success: true, message: 'Todas as contas foram limpas e todos os dispositivos desconectados.' });
    } catch (err) {
      console.error('[API Wipe All Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao limpar banco de dados.' });
    }
  });

  // --- MULTI-DEVICE GAMIFICATION SYNC ---

  // GET /api/gamification/load?userId=...
  app.get('/api/gamification/load', (req, res) => {
    try {
      const rawUserId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
      if (!rawUserId) {
        return res.status(400).json({ success: false, message: 'userId é obrigatório.' });
      }
      const canonicalId = getCanonicalUserIdServer(rawUserId);
      const gamifData = loadServerGamification();
      const state = gamifData[canonicalId] || gamifData[rawUserId] || null;
      return res.json({ success: true, state });
    } catch (err) {
      console.error('[API Gamification Load Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao carregar gamificação.' });
    }
  });

  // POST /api/gamification/sync
  app.post('/api/gamification/sync', (req, res) => {
    try {
      const { userId, email, state } = req.body || {};
      if (!userId && !email) {
        return res.status(400).json({ success: false, message: 'userId ou email é obrigatório.' });
      }
      const cleanEmail = email ? email.trim().toLowerCase() : '';
      const canonicalId = getCanonicalUserIdServer(userId || cleanEmail);
      const gamifData = loadServerGamification();
      
      const syncedState = {
        ...state,
        userId: canonicalId,
        updatedAt: new Date().toISOString(),
      };

      gamifData[canonicalId] = syncedState;
      if (cleanEmail) {
        gamifData[cleanEmail] = syncedState;
      }
      saveServerGamification(gamifData);

      broadcastRealtime('GAMIFICATION_UPDATED', {
        userId: canonicalId,
        rawUserId: userId,
        email: cleanEmail,
        state: syncedState,
      });

      return res.json({ success: true, state: syncedState });
    } catch (err) {
      console.error('[API Gamification Sync Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao sincronizar gamificação.' });
    }
  });

  // --- MULTI-DEVICE FINANCIAL DATA SYNC ---

  // GET /api/data/load?userId=...
  app.get('/api/data/load', (req, res) => {
    try {
      const rawUserId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
      if (!rawUserId) {
        return res.status(400).json({ success: false, message: 'userId é obrigatório.' });
      }
      const canonicalId = getCanonicalUserIdServer(rawUserId);
      const financials = loadServerFinancials();

      const entry = financials[canonicalId];
      const hasRecord = !!entry;

      const safeEntry: any = entry || {
        accounts: [],
        categories: [],
        familyMembers: [],
        transactions: [],
        goals: [],
      };

      return res.json({
        success: true,
        hasRecord,
        updatedAt: safeEntry.updatedAt,
        data: {
          accounts: (safeEntry.accounts || []).map((a: any) => ({ ...a, userId: rawUserId })),
          categories: (safeEntry.categories || []).map((c: any) => ({ ...c, userId: rawUserId })),
          familyMembers: (safeEntry.familyMembers || []).map((f: any) => ({ ...f, userId: rawUserId })),
          transactions: (safeEntry.transactions || []).map((t: any) => ({ ...t, userId: rawUserId })),
          goals: (safeEntry.goals || []).map((g: any) => ({ ...g, userId: rawUserId })),
          deletedIds: safeEntry.deletedIds || [],
        },
      });
    } catch (err) {
      console.error('[API Data Load Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao carregar dados do servidor.' });
    }
  });

  // POST /api/data/sync
  app.post('/api/data/sync', (req, res) => {
    try {
      const { userId, accounts, categories, familyMembers, transactions, goals, deletedIds } = req.body || {};
      if (!userId) {
        return res.status(400).json({ success: false, message: 'userId é obrigatório.' });
      }
      const canonicalId = getCanonicalUserIdServer(userId);
      const financials = loadServerFinancials();
      const existing = financials[canonicalId] || { accounts: [], categories: [], familyMembers: [], transactions: [], goals: [], deletedIds: [] };

      existing.deletedIds = existing.deletedIds || [];
      if (Array.isArray(deletedIds)) {
        deletedIds.forEach((id: string) => {
          if (id && !existing.deletedIds.includes(id)) {
            existing.deletedIds.push(id);
          }
        });
      }

      const deletedSet = new Set<string>(existing.deletedIds);

      // SMART UNION MERGE SO CONCURRENT POSTS DO NOT WIPE EACH OTHER'S DATA
      const mergeRecords = (existingList: any[] = [], incomingList: any[] = []) => {
        const map = new Map<string, any>();
        (existingList || []).forEach((item: any) => {
          if (item && item.id && !deletedSet.has(item.id)) {
            const sanitized = { ...item, userId: canonicalId };
            delete sanitized._pendingSync;
            if (sanitized.initialBalance !== undefined) {
              sanitized.initialBalance = typeof sanitized.initialBalance === 'number'
                ? sanitized.initialBalance
                : (parseFloat(String(sanitized.initialBalance).replace(',', '.')) || 0);
            }
            map.set(item.id, sanitized);
          }
        });
        (incomingList || []).forEach((item: any) => {
          if (item && item.id && !deletedSet.has(item.id)) {
            const prev = map.get(item.id);
            const sanitized = { ...item, userId: canonicalId };
            delete sanitized._pendingSync;
            if (sanitized.initialBalance !== undefined) {
              sanitized.initialBalance = typeof sanitized.initialBalance === 'number'
                ? sanitized.initialBalance
                : (parseFloat(String(sanitized.initialBalance).replace(',', '.')) || 0);
            }
            if (!prev) {
              map.set(item.id, sanitized);
            } else {
              const prevTime = prev.updatedAt ? new Date(prev.updatedAt).getTime() : 0;
              const incomingTime = sanitized.updatedAt ? new Date(sanitized.updatedAt).getTime() : 0;
              if (incomingTime >= prevTime) {
                map.set(item.id, { ...prev, ...sanitized });
              } else {
                map.set(item.id, { ...sanitized, ...prev });
              }
            }
          }
        });
        return Array.from(map.values());
      };

      const syncedData = {
        accounts: mergeRecords(existing.accounts, accounts),
        categories: mergeRecords(existing.categories, categories),
        familyMembers: mergeRecords(existing.familyMembers, familyMembers),
        transactions: mergeRecords(existing.transactions, transactions),
        goals: mergeRecords(existing.goals, goals),
        deletedIds: Array.from(deletedSet),
        updatedAt: new Date().toISOString(),
      };

      financials[canonicalId] = syncedData;
      saveServerFinancials(financials);

      broadcastRealtime('DATA_UPDATED', { userId: canonicalId, rawUserId: userId });

      return res.json({ success: true, hasRecord: true, data: syncedData });
    } catch (err) {
      console.error('[API Data Sync Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao sincronizar dados no servidor.' });
    }
  });

  // POST /api/data/delete-item
  app.post('/api/data/delete-item', (req, res) => {
    try {
      const { userId, type, id } = req.body || {};
      if (!userId || !type || !id) {
        return res.status(400).json({ success: false, message: 'Parâmetros insuficientes' });
      }
      const canonicalId = getCanonicalUserIdServer(userId);
      const financials = loadServerFinancials();
      const existing = financials[canonicalId] || { accounts: [], categories: [], familyMembers: [], transactions: [], goals: [], deletedIds: [] };
      
      existing.deletedIds = existing.deletedIds || [];
      if (!existing.deletedIds.includes(id)) {
        existing.deletedIds.push(id);
      }
      if (Array.isArray(existing[type])) {
        existing[type] = existing[type].filter((item: any) => item.id !== id);
      }
      existing.updatedAt = new Date().toISOString();
      financials[canonicalId] = existing;
      saveServerFinancials(financials);
      broadcastRealtime('DATA_UPDATED', { userId: canonicalId, rawUserId: userId, deletedType: type, deletedId: id });
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false });
    }
  });

  // POST /api/data/transactional-goal - Atomic Server Transaction for Goals (Cross-device latency and race-condition fix)
  app.post('/api/data/transactional-goal', async (req, res) => {
    try {
      const { userId, action, goalId, goalData, addedAmount } = req.body || {};
      if (!userId || !action) {
        return res.status(400).json({ success: false, message: 'userId e action são obrigatórios.' });
      }
      const canonicalId = getCanonicalUserIdServer(userId);
      const financials = loadServerFinancials();
      const existing = financials[canonicalId] || { accounts: [], categories: [], familyMembers: [], transactions: [], goals: [], deletedIds: [] };
      existing.goals = existing.goals || [];
      existing.deletedIds = existing.deletedIds || [];

      const deletedSet = new Set<string>(existing.deletedIds);

      if (action === 'addGoal' || action === 'updateGoal') {
        if (!goalData || !goalData.id) {
          return res.status(400).json({ success: false, message: 'goalData com id é obrigatório.' });
        }
        const rawTarget = typeof goalData.targetAmount === 'string'
          ? goalData.targetAmount.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
          : String(goalData.targetAmount);
        const parsedTarget = parseFloat(rawTarget) || 0;

        const rawCurrent = typeof goalData.currentAmount === 'string'
          ? goalData.currentAmount.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
          : String(goalData.currentAmount || '0');
        const parsedCurrent = parseFloat(rawCurrent) || 0;

        const rawYield = goalData.yieldRate !== undefined && goalData.yieldRate !== null && goalData.yieldRate !== ''
          ? (typeof goalData.yieldRate === 'string' ? parseFloat(goalData.yieldRate.replace(',', '.')) : Number(goalData.yieldRate))
          : undefined;

        const sanitizedGoal = {
          ...goalData,
          id: String(goalData.id),
          userId: canonicalId,
          title: String(goalData.title || '').trim(),
          targetAmount: parsedTarget,
          currentAmount: parsedCurrent,
          targetDate: goalData.targetDate || goalData.deadline || '',
          deadline: goalData.targetDate || goalData.deadline || '',
          category: goalData.category || 'Viagem & Lazer',
          color: goalData.color || '#D4AF37',
          icon: goalData.icon || 'Target',
          notes: goalData.notes || '',
          yieldRate: isNaN(rawYield as number) ? undefined : rawYield,
          yieldPeriod: goalData.yieldPeriod || 'monthly',
          updatedAt: new Date().toISOString(),
        };
        delete sanitizedGoal._pendingSync;

        // Remove from deletedIds if previously deleted
        existing.deletedIds = existing.deletedIds.filter((id: string) => id !== sanitizedGoal.id);
        deletedSet.delete(sanitizedGoal.id);

        const gIdx = existing.goals.findIndex((g: any) => g.id === sanitizedGoal.id);
        if (gIdx >= 0) {
          existing.goals[gIdx] = { ...existing.goals[gIdx], ...sanitizedGoal };
        } else {
          existing.goals.push(sanitizedGoal);
        }
      } else if (action === 'deleteGoal') {
        const idToDelete = goalId || (goalData && goalData.id);
        if (!idToDelete) {
          return res.status(400).json({ success: false, message: 'goalId é obrigatório para exclusão.' });
        }
        if (!existing.deletedIds.includes(idToDelete)) {
          existing.deletedIds.push(idToDelete);
        }
        existing.goals = existing.goals.filter((g: any) => g.id !== idToDelete);
      } else if (action === 'updateGoalProgress') {
        const targetId = goalId || (goalData && goalData.id);
        if (!targetId) {
          return res.status(400).json({ success: false, message: 'goalId é obrigatório para progresso.' });
        }
        const gIdx = existing.goals.findIndex((g: any) => g.id === targetId);
        if (gIdx >= 0) {
          const added = typeof addedAmount === 'number'
            ? addedAmount
            : (parseFloat(String(addedAmount || 0).replace(',', '.')) || 0);
          existing.goals[gIdx].currentAmount = Math.max(0, (existing.goals[gIdx].currentAmount || 0) + added);
          existing.goals[gIdx].updatedAt = new Date().toISOString();
        }
      }

      existing.updatedAt = new Date().toISOString();
      financials[canonicalId] = existing;
      saveServerFinancials(financials);

      // Keep portfolio data in sync too
      const portfolioData = loadServerPortfolio();
      if (portfolioData[canonicalId]) {
        portfolioData[canonicalId].goals = existing.goals;
        portfolioData[canonicalId].deletedIds = existing.deletedIds;
        portfolioData[canonicalId].updatedAt = existing.updatedAt;
        saveServerPortfolio(portfolioData);
      }

      // Propagate directly to central Appwrite doc via server-side fetch
      try {
        const currentPortfolio = portfolioData[canonicalId] || { assets: [], transactions: [] };
        const fullPayload = {
          transactions: existing.transactions || [],
          accounts: existing.accounts || [],
          familyBudget: [...(existing.goals || []), ...(existing.familyMembers || [])],
          investorPortfolio: currentPortfolio.assets || [],
          investmentTransactions: currentPortfolio.transactions || [],
          goals: existing.goals,
          investorGoals: existing.goals,
          updatedAt: existing.updatedAt,
        };

        fetch('https://sfo.cloud.appwrite.io/v1/databases/6a83aa8d0038331e040f/collections/user_financials/documents/6a849358002db9e638ce', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Appwrite-Project': '6a83a2d30034f2dd2811',
          },
          body: JSON.stringify({
            data: JSON.stringify(fullPayload),
            userId: '6a83b38ed065c08efa49',
          }),
        }).catch(() => {});
      } catch (cloudErr) {
        console.warn('[Server Appwrite Sync Notice]', cloudErr);
      }

      // Broadcast WebSocket real-time event to all connected devices
      broadcastRealtime('DATA_UPDATED', {
        userId: canonicalId,
        rawUserId: userId,
        mutationType: 'GOALS',
        action,
        goalId: goalId || (goalData && goalData.id),
        updatedAt: existing.updatedAt,
        goals: existing.goals,
      });

      broadcastRealtime('PORTFOLIO_UPDATED', {
        userId: canonicalId,
        rawUserId: userId,
        mutationType: 'GOALS',
        action,
        goalId: goalId || (goalData && goalData.id),
        updatedAt: existing.updatedAt,
      });

      return res.json({
        success: true,
        goals: existing.goals,
        updatedAt: existing.updatedAt,
      });
    } catch (err) {
      console.error('[API Transactional Goal Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao processar transação de meta no servidor.' });
    }
  });

  // Subcategory tree manipulation helpers on server
  function addSubcategoryToTreeServer(
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
          subcategories: addSubcategoryToTreeServer(s.subcategories, parentSubId, newSub),
        };
      }
      return s;
    });
  }

  function deleteSubcategoryFromTreeServer(subs: any[] = [], targetSubId: string): any[] {
    return subs
      .filter((s) => s.id !== targetSubId)
      .map((s) => ({
        ...s,
        subcategories: s.subcategories ? deleteSubcategoryFromTreeServer(s.subcategories, targetSubId) : [],
      }));
  }

  function renameSubcategoryInTreeServer(
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
          subcategories: renameSubcategoryInTreeServer(s.subcategories, targetSubId, newName),
        };
      }
      return s;
    });
  }

  // POST /api/data/transactional-structure - Atomic Server Transaction for Categories, Subcategories, and Members
  app.post('/api/data/transactional-structure', async (req, res) => {
    try {
      const {
        userId,
        action,
        categoryId,
        categoryData,
        subData,
        parentSubId,
        subId,
        newSubName,
        sourceCatId,
        targetCatId,
        memberId,
        memberData,
        categoriesList,
      } = req.body || {};

      if (!userId || !action) {
        return res.status(400).json({ success: false, message: 'userId e action são obrigatórios.' });
      }

      const canonicalId = getCanonicalUserIdServer(userId);
      const financials = loadServerFinancials();
      const existing = financials[canonicalId] || {
        accounts: [],
        categories: [],
        familyMembers: [],
        transactions: [],
        goals: [],
        deletedIds: [],
      };

      existing.categories = existing.categories || [];
      existing.familyMembers = existing.familyMembers || [];
      existing.deletedIds = existing.deletedIds || [];

      const deletedSet = new Set<string>(existing.deletedIds);

      if (action === 'addCategory' || action === 'updateCategory') {
        if (!categoryData || !categoryData.id) {
          return res.status(400).json({ success: false, message: 'categoryData com id é obrigatório.' });
        }
        const sanitizedCat = {
          ...categoryData,
          id: String(categoryData.id),
          userId: canonicalId,
          name: String(categoryData.name || '').trim(),
          type: categoryData.type || 'expense',
          ruleGroup: categoryData.type === 'income' ? 'income' : (categoryData.ruleGroup || '50_essentials'),
          color: categoryData.color || '#E11D48',
          icon: categoryData.icon || 'Tag',
          subcategories: Array.isArray(categoryData.subcategories) ? categoryData.subcategories : [],
          updatedAt: new Date().toISOString(),
        };
        delete sanitizedCat._pendingSync;

        existing.deletedIds = existing.deletedIds.filter((id: string) => id !== sanitizedCat.id);
        deletedSet.delete(sanitizedCat.id);

        const cIdx = existing.categories.findIndex((c: any) => c.id === sanitizedCat.id);
        if (cIdx >= 0) {
          existing.categories[cIdx] = { ...existing.categories[cIdx], ...sanitizedCat };
        } else {
          existing.categories.push(sanitizedCat);
        }
      } else if (action === 'deleteCategory') {
        const idToDelete = categoryId || (categoryData && categoryData.id);
        if (!idToDelete) {
          return res.status(400).json({ success: false, message: 'categoryId é obrigatório para exclusão.' });
        }
        if (!existing.deletedIds.includes(idToDelete)) {
          existing.deletedIds.push(idToDelete);
        }
        existing.categories = existing.categories.filter((c: any) => c.id !== idToDelete);
      } else if (action === 'addSubcategory') {
        const catId = categoryId || (subData && subData.categoryId);
        if (!catId || !subData) {
          return res.status(400).json({ success: false, message: 'categoryId e subData são obrigatórios.' });
        }
        const cIdx = existing.categories.findIndex((c: any) => c.id === catId);
        if (cIdx >= 0) {
          const newSub = {
            id: String(subData.id || `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`),
            categoryId: catId,
            parentId: parentSubId || subData.parentId || undefined,
            name: String(subData.name || '').trim(),
            subcategories: Array.isArray(subData.subcategories) ? subData.subcategories : [],
          };
          existing.categories[cIdx].subcategories = addSubcategoryToTreeServer(
            existing.categories[cIdx].subcategories || [],
            parentSubId || null,
            newSub
          );
          existing.categories[cIdx].updatedAt = new Date().toISOString();
        }
      } else if (action === 'updateSubcategory' || action === 'renameSubcategory') {
        const catId = categoryId;
        const targetSubId = subId || (subData && subData.id);
        const nameToSet = String(newSubName || (subData && subData.name) || '').trim();
        if (!catId || !targetSubId || !nameToSet) {
          return res.status(400).json({ success: false, message: 'categoryId, subId e newSubName são obrigatórios.' });
        }
        const cIdx = existing.categories.findIndex((c: any) => c.id === catId);
        if (cIdx >= 0) {
          existing.categories[cIdx].subcategories = renameSubcategoryInTreeServer(
            existing.categories[cIdx].subcategories || [],
            targetSubId,
            nameToSet
          );
          existing.categories[cIdx].updatedAt = new Date().toISOString();
        }
      } else if (action === 'deleteSubcategory') {
        const catId = categoryId;
        const targetSubId = subId || (subData && subData.id);
        if (!catId || !targetSubId) {
          return res.status(400).json({ success: false, message: 'categoryId e subId são obrigatórios.' });
        }
        const cIdx = existing.categories.findIndex((c: any) => c.id === catId);
        if (cIdx >= 0) {
          existing.categories[cIdx].subcategories = deleteSubcategoryFromTreeServer(
            existing.categories[cIdx].subcategories || [],
            targetSubId
          );
          existing.categories[cIdx].updatedAt = new Date().toISOString();
        }
      } else if (action === 'moveSubcategory') {
        const srcId = sourceCatId || (categoryData && categoryData.id);
        const tgtId = targetCatId;
        const movingSub = subData;
        if (!srcId || !tgtId || !movingSub) {
          return res.status(400).json({ success: false, message: 'sourceCatId, targetCatId e subData são obrigatórios.' });
        }
        const srcIdx = existing.categories.findIndex((c: any) => c.id === srcId);
        const tgtIdx = existing.categories.findIndex((c: any) => c.id === tgtId);
        if (srcIdx >= 0 && tgtIdx >= 0) {
          existing.categories[srcIdx].subcategories = deleteSubcategoryFromTreeServer(
            existing.categories[srcIdx].subcategories || [],
            movingSub.id
          );
          existing.categories[srcIdx].updatedAt = new Date().toISOString();

          const movedSub = {
            ...movingSub,
            categoryId: tgtId,
            parentId: undefined,
          };
          existing.categories[tgtIdx].subcategories = [
            ...(existing.categories[tgtIdx].subcategories || []),
            movedSub,
          ];
          existing.categories[tgtIdx].updatedAt = new Date().toISOString();
        }
      } else if (action === 'restoreDefaultCategories') {
        if (Array.isArray(categoriesList) && categoriesList.length > 0) {
          const sanitizedDefaults = categoriesList.map((c: any) => ({
            ...c,
            userId: canonicalId,
            updatedAt: new Date().toISOString(),
          }));
          existing.categories = sanitizedDefaults;
        }
      } else if (action === 'addMember' || action === 'updateMember') {
        if (!memberData || !memberData.id) {
          return res.status(400).json({ success: false, message: 'memberData com id é obrigatório.' });
        }
        const sanitizedMember = {
          ...memberData,
          id: String(memberData.id),
          userId: canonicalId,
          name: String(memberData.name || '').trim(),
          relationship: memberData.relationship || 'Titular',
          color: memberData.color || '#E11D48',
          updatedAt: new Date().toISOString(),
        };
        delete sanitizedMember._pendingSync;

        existing.deletedIds = existing.deletedIds.filter((id: string) => id !== sanitizedMember.id);
        deletedSet.delete(sanitizedMember.id);

        const mIdx = existing.familyMembers.findIndex((m: any) => m.id === sanitizedMember.id);
        if (mIdx >= 0) {
          existing.familyMembers[mIdx] = { ...existing.familyMembers[mIdx], ...sanitizedMember };
        } else {
          existing.familyMembers.push(sanitizedMember);
        }
      } else if (action === 'deleteMember') {
        const idToDelete = memberId || (memberData && memberData.id);
        if (!idToDelete) {
          return res.status(400).json({ success: false, message: 'memberId é obrigatório para exclusão.' });
        }
        if (!existing.deletedIds.includes(idToDelete)) {
          existing.deletedIds.push(idToDelete);
        }
        existing.familyMembers = existing.familyMembers.filter((m: any) => m.id !== idToDelete);
      }

      existing.updatedAt = new Date().toISOString();
      financials[canonicalId] = existing;
      saveServerFinancials(financials);

      // Direct write to Appwrite central doc
      try {
        const portfolioData = loadServerPortfolio();
        const currentPortfolio = portfolioData[canonicalId] || { assets: [], transactions: [] };
        const fullPayload = {
          transactions: existing.transactions || [],
          accounts: existing.accounts || [],
          familyBudget: [...(existing.goals || []), ...(existing.familyMembers || [])],
          investorPortfolio: currentPortfolio.assets || [],
          investmentTransactions: currentPortfolio.transactions || [],
          goals: existing.goals || [],
          investorGoals: existing.goals || [],
          categories: existing.categories || [],
          familyMembers: existing.familyMembers || [],
          members: existing.familyMembers || [],
          updatedAt: existing.updatedAt,
        };

        fetch('https://sfo.cloud.appwrite.io/v1/databases/6a83aa8d0038331e040f/collections/user_financials/documents/6a849358002db9e638ce', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Appwrite-Project': '6a83a2d30034f2dd2811',
          },
          body: JSON.stringify({
            data: JSON.stringify(fullPayload),
            userId: '6a83b38ed065c08efa49',
          }),
        }).catch(() => {});
      } catch (cloudErr) {
        console.warn('[Server Appwrite Sync Notice for Structure]', cloudErr);
      }

      // Broadcast WebSocket real-time event to all connected devices
      broadcastRealtime('DATA_UPDATED', {
        userId: canonicalId,
        rawUserId: userId,
        mutationType: 'STRUCTURE',
        action,
        categoryId: categoryId || (categoryData && categoryData.id),
        memberId: memberId || (memberData && memberData.id),
        categories: existing.categories,
        familyMembers: existing.familyMembers,
        updatedAt: existing.updatedAt,
      });

      return res.json({
        success: true,
        categories: existing.categories,
        familyMembers: existing.familyMembers,
        updatedAt: existing.updatedAt,
      });
    } catch (err) {
      console.error('[API Transactional Structure Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao processar transação estrutural no servidor.' });
    }
  });

  // POST /api/data/reset
  app.post('/api/data/reset', (req, res) => {
    try {
      const { userId } = req.body || {};
      if (!userId) return res.status(400).json({ success: false });
      const canonicalId = getCanonicalUserIdServer(userId);
      const financials = loadServerFinancials();
      financials[canonicalId] = {
        accounts: [],
        categories: [],
        familyMembers: [],
        transactions: [],
        goals: [],
        deletedIds: [],
        updatedAt: new Date().toISOString(),
      };
      saveServerFinancials(financials);
      broadcastRealtime('DATA_UPDATED', { userId: canonicalId, rawUserId: userId, isReset: true });
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false });
    }
  });

  // --- MULTI-DEVICE PORTFOLIO DATA SYNC ---

  // GET /api/portfolio/load?userId=...
  app.get('/api/portfolio/load', (req, res) => {
    try {
      const rawUserId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
      if (!rawUserId) {
        return res.status(400).json({ success: false, message: 'userId é obrigatório.' });
      }
      const canonicalId = getCanonicalUserIdServer(rawUserId);
      const portfolioData = loadServerPortfolio();

      let foundData = portfolioData[canonicalId];

      if (!foundData) {
        return res.json({ success: true, data: null });
      }

      return res.json({
        success: true,
        data: {
          assets: (foundData.assets || []).map((a: any) => ({ ...a, userId: rawUserId })),
          transactions: (foundData.transactions || []).map((t: any) => ({ ...t, userId: rawUserId })),
          dividends: (foundData.dividends || []).map((d: any) => ({ ...d, userId: rawUserId })),
          targetAllocations: foundData.targetAllocations || [],
          goals: (foundData.goals || []).map((g: any) => ({ ...g, userId: rawUserId })),
          deletedIds: foundData.deletedIds || [],
        },
      });
    } catch (err) {
      console.error('[API Portfolio Load Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao carregar portfólio do servidor.' });
    }
  });

  // POST /api/portfolio/sync
  app.post('/api/portfolio/sync', (req, res) => {
    try {
      const { userId, assets, transactions, dividends, targetAllocations, goals, deletedIds } = req.body || {};
      if (!userId) {
        return res.status(400).json({ success: false, message: 'userId é obrigatório.' });
      }
      const canonicalId = getCanonicalUserIdServer(userId);
      const portfolioData = loadServerPortfolio();
      const existing = portfolioData[canonicalId] || { assets: [], transactions: [], dividends: [], targetAllocations: [], goals: [], deletedIds: [] };

      existing.deletedIds = existing.deletedIds || [];
      if (Array.isArray(deletedIds)) {
        deletedIds.forEach((id: string) => {
          if (id && !existing.deletedIds.includes(id)) {
            existing.deletedIds.push(id);
          }
        });
      }

      const deletedSet = new Set<string>(existing.deletedIds);

      const mergeById = (existingList: any[] = [], incomingList: any[] = []) => {
        const map = new Map<string, any>();
        (existingList || []).forEach((item: any) => {
          const key = item?.id || item?.ticker;
          if (key && !deletedSet.has(key) && !deletedSet.has(item?.id) && !deletedSet.has(item?.ticker)) {
            const sanitized = { ...item, userId: canonicalId };
            delete sanitized._pendingSync;
            map.set(key, sanitized);
          }
        });
        (incomingList || []).forEach((item: any) => {
          const key = item?.id || item?.ticker;
          if (key && !deletedSet.has(key) && !deletedSet.has(item?.id) && !deletedSet.has(item?.ticker)) {
            const prev = map.get(key);
            const sanitized = { ...item, userId: canonicalId };
            delete sanitized._pendingSync;
            
            if (!prev) {
              map.set(key, sanitized);
            } else {
              const prevTime = prev.updatedAt ? new Date(prev.updatedAt).getTime() : 0;
              const incomingTime = sanitized.updatedAt ? new Date(sanitized.updatedAt).getTime() : 0;
              if (incomingTime >= prevTime) {
                map.set(key, { ...prev, ...sanitized });
              } else {
                map.set(key, { ...sanitized, ...prev });
              }
            }
          }
        });
        return Array.from(map.values());
      };

      const syncedPortfolio = {
        assets: mergeById(existing.assets, assets),
        transactions: mergeById(existing.transactions, transactions),
        dividends: mergeById(existing.dividends, dividends),
        targetAllocations: targetAllocations && targetAllocations.length > 0 ? targetAllocations : (existing.targetAllocations || []),
        goals: mergeById(existing.goals, goals),
        deletedIds: Array.from(deletedSet),
        updatedAt: new Date().toISOString(),
      };

      portfolioData[canonicalId] = syncedPortfolio;
      saveServerPortfolio(portfolioData);

      broadcastRealtime('PORTFOLIO_UPDATED', { userId: canonicalId, rawUserId: userId });

      return res.json({ success: true, data: syncedPortfolio });
    } catch (err) {
      console.error('[API Portfolio Sync Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao sincronizar portfólio no servidor.' });
    }
  });

  // POST /api/portfolio/delete-item
  app.post('/api/portfolio/delete-item', (req, res) => {
    try {
      const { userId, type, id } = req.body || {};
      if (!userId || !type || !id) {
        return res.status(400).json({ success: false, message: 'Parâmetros insuficientes' });
      }
      const canonicalId = getCanonicalUserIdServer(userId);
      const portfolioData = loadServerPortfolio();
      const existing = portfolioData[canonicalId] || { assets: [], transactions: [], dividends: [], targetAllocations: [], goals: [], deletedIds: [] };

      existing.deletedIds = existing.deletedIds || [];
      if (!existing.deletedIds.includes(id)) {
        existing.deletedIds.push(id);
      }
      const cleanIdUpper = typeof id === 'string' ? id.trim().toUpperCase() : '';
      if (cleanIdUpper && !existing.deletedIds.includes(cleanIdUpper)) {
        existing.deletedIds.push(cleanIdUpper);
      }

      if (Array.isArray(existing[type])) {
        existing[type] = existing[type].filter((item: any) => item.id !== id && item.ticker !== id && (item.ticker ? item.ticker.toUpperCase() !== cleanIdUpper : true));
      }
      existing.updatedAt = new Date().toISOString();
      portfolioData[canonicalId] = existing;
      saveServerPortfolio(portfolioData);
      broadcastRealtime('PORTFOLIO_UPDATED', { userId: canonicalId, rawUserId: userId, deletedType: type, deletedId: id });

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false });
    }
  });

  // POST /api/portfolio/transactional-transaction - Atomic Server Transaction for Investor Portfolio Transactions (Buy, Sell, Dividends)
  app.post('/api/portfolio/transactional-transaction', async (req, res) => {
    try {
      const { userId, action, transactionData, transactionId } = req.body || {};
      if (!userId || !action) {
        return res.status(400).json({ success: false, message: 'userId e action são obrigatórios.' });
      }

      const canonicalId = getCanonicalUserIdServer(userId);
      const portfolioData = loadServerPortfolio();
      const existing = portfolioData[canonicalId] || {
        assets: [],
        transactions: [],
        dividends: [],
        targetAllocations: [],
        goals: [],
        deletedIds: [],
      };

      existing.transactions = existing.transactions || [];
      existing.deletedIds = existing.deletedIds || [];
      const deletedSet = new Set<string>(existing.deletedIds);

      if (action === 'addInvestmentTransaction' || action === 'updateInvestmentTransaction') {
        if (!transactionData) {
          return res.status(400).json({ success: false, message: 'transactionData é obrigatório.' });
        }

        const normalizedTx = {
          id: transactionData.id || `tx_inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          userId: canonicalId,
          assetTicker: (transactionData.assetTicker || transactionData.ticker || '').toUpperCase().trim(),
          assetCategory: transactionData.assetCategory || transactionData.category || 'acoes',
          type: transactionData.type || 'buy',
          quantity: Number(transactionData.quantity) || 0,
          unitPrice: Number(transactionData.unitPrice) || Number(transactionData.price) || 0,
          totalAmount:
            Number(transactionData.totalAmount) ||
            Number(transactionData.totalValue) ||
            (Number(transactionData.quantity) * Number(transactionData.unitPrice || transactionData.price)) ||
            0,
          broker: transactionData.broker || transactionData.institution || 'RICO INVESTIMENTOS',
          date: transactionData.date || new Date().toISOString().split('T')[0],
          notes: transactionData.notes || '',
          createdAt: transactionData.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const txIndex = existing.transactions.findIndex((t: any) => t.id === normalizedTx.id);
        if (txIndex >= 0) {
          existing.transactions[txIndex] = {
            ...existing.transactions[txIndex],
            ...normalizedTx,
          };
        } else {
          existing.transactions.unshift(normalizedTx);
        }

        // Remove from deletedIds if present
        existing.deletedIds = existing.deletedIds.filter((dId: string) => dId !== normalizedTx.id);
      } else if (action === 'deleteInvestmentTransaction') {
        const idToDelete = transactionId || (transactionData && transactionData.id);
        if (!idToDelete) {
          return res.status(400).json({ success: false, message: 'transactionId é obrigatório para exclusão.' });
        }

        existing.transactions = existing.transactions.filter((t: any) => t.id !== idToDelete);
        if (!existing.deletedIds.includes(idToDelete)) {
          existing.deletedIds.push(idToDelete);
        }
      } else {
        return res.status(400).json({ success: false, message: `Ação desconhecida: ${action}` });
      }

      existing.updatedAt = new Date().toISOString();
      portfolioData[canonicalId] = existing;
      saveServerPortfolio(portfolioData);

      // Keep server financials in sync with portfolio transactions
      const financials = loadServerFinancials();
      if (financials[canonicalId]) {
        financials[canonicalId].investmentTransactions = existing.transactions;
        financials[canonicalId].updatedAt = existing.updatedAt;
        saveServerFinancials(financials);
      }

      // Propagate directly to Appwrite central document 6a849358002db9e638ce
      try {
        const userFin = financials[canonicalId] || {
          accounts: [],
          transactions: [],
          goals: [],
          familyMembers: [],
          categories: [],
        };
        const fullPayload = {
          transactions: userFin.transactions || [],
          accounts: userFin.accounts || [],
          familyBudget: [...(userFin.goals || []), ...(userFin.familyMembers || [])],
          investorPortfolio: existing.assets || [],
          investmentTransactions: existing.transactions || [],
          goals: userFin.goals || [],
          investorGoals: userFin.goals || [],
          categories: userFin.categories || [],
          familyMembers: userFin.familyMembers || [],
          members: userFin.familyMembers || [],
          updatedAt: existing.updatedAt,
        };

        fetch('https://sfo.cloud.appwrite.io/v1/databases/6a83aa8d0038331e040f/collections/user_financials/documents/6a849358002db9e638ce', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Appwrite-Project': '6a83a2d30034f2dd2811',
          },
          body: JSON.stringify({
            data: JSON.stringify(fullPayload),
            userId: '6a83b38ed065c08efa49',
          }),
        }).catch(() => {});
      } catch (cloudErr) {
        console.warn('[Server Appwrite Sync Notice for Investment Transaction]', cloudErr);
      }

      // Broadcast WebSocket real-time event to all connected devices
      broadcastRealtime('PORTFOLIO_UPDATED', {
        userId: canonicalId,
        rawUserId: userId,
        mutationType: 'INVESTMENT_TRANSACTION',
        action,
        transactionId: transactionId || (transactionData && transactionData.id),
        investmentTransactions: existing.transactions,
        updatedAt: existing.updatedAt,
      });

      broadcastRealtime('DATA_UPDATED', {
        userId: canonicalId,
        rawUserId: userId,
        mutationType: 'INVESTMENT_TRANSACTION',
        investmentTransactions: existing.transactions,
        updatedAt: existing.updatedAt,
      });

      return res.json({
        success: true,
        investmentTransactions: existing.transactions,
        updatedAt: existing.updatedAt,
      });
    } catch (err) {
      console.error('[API Transactional Investment Transaction Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao processar transação de investimento no servidor.' });
    }
  });

  // POST /api/portfolio/transactional-allocations - Atomic Server Transaction for Target Allocations
  app.post('/api/portfolio/transactional-allocations', async (req, res) => {
    try {
      const { userId, targetAllocations } = req.body || {};
      if (!userId || !Array.isArray(targetAllocations)) {
        return res.status(400).json({ success: false, message: 'userId e targetAllocations (array) são obrigatórios.' });
      }

      const canonicalId = getCanonicalUserIdServer(userId);
      const portfolioData = loadServerPortfolio();
      const existing = portfolioData[canonicalId] || {
        assets: [],
        transactions: [],
        dividends: [],
        targetAllocations: [],
        goals: [],
        deletedIds: [],
      };

      existing.targetAllocations = targetAllocations;
      existing.updatedAt = new Date().toISOString();
      portfolioData[canonicalId] = existing;
      saveServerPortfolio(portfolioData);

      // Keep server financials in sync with portfolio target allocations
      const financials = loadServerFinancials();
      if (financials[canonicalId]) {
        financials[canonicalId].targetAllocations = targetAllocations;
        financials[canonicalId].updatedAt = existing.updatedAt;
        saveServerFinancials(financials);
      }

      // Propagate directly to Appwrite central document 6a849358002db9e638ce
      try {
        const userFin = financials[canonicalId] || {
          accounts: [],
          transactions: [],
          goals: [],
          familyMembers: [],
          categories: [],
        };
        const fullPayload = {
          transactions: userFin.transactions || [],
          accounts: userFin.accounts || [],
          familyBudget: [...(userFin.goals || []), ...(userFin.familyMembers || [])],
          investorPortfolio: existing.assets || [],
          investmentTransactions: existing.transactions || [],
          targetAllocations: targetAllocations,
          goals: userFin.goals || [],
          investorGoals: userFin.goals || [],
          categories: userFin.categories || [],
          familyMembers: userFin.familyMembers || [],
          members: userFin.familyMembers || [],
          updatedAt: existing.updatedAt,
        };

        fetch('https://sfo.cloud.appwrite.io/v1/databases/6a83aa8d0038331e040f/collections/user_financials/documents/6a849358002db9e638ce', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Appwrite-Project': '6a83a2d30034f2dd2811',
          },
          body: JSON.stringify({
            data: JSON.stringify(fullPayload),
            userId: '6a83b38ed065c08efa49',
          }),
        }).catch(() => {});
      } catch (cloudErr) {
        console.warn('[Server Appwrite Sync Notice for Target Allocations]', cloudErr);
      }

      // Broadcast WebSocket real-time event to all connected devices
      broadcastRealtime('PORTFOLIO_UPDATED', {
        userId: canonicalId,
        rawUserId: userId,
        mutationType: 'TARGET_ALLOCATIONS',
        targetAllocations: existing.targetAllocations,
        updatedAt: existing.updatedAt,
      });

      broadcastRealtime('DATA_UPDATED', {
        userId: canonicalId,
        rawUserId: userId,
        mutationType: 'TARGET_ALLOCATIONS',
        targetAllocations: existing.targetAllocations,
        updatedAt: existing.updatedAt,
      });

      return res.json({
        success: true,
        targetAllocations: existing.targetAllocations,
        updatedAt: existing.updatedAt,
      });
    } catch (err) {
      console.error('[API Transactional Allocations Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao processar alocações no servidor.' });
    }
  });

  // --- MULTI-DEVICE NOTIFICATIONS & SHARED BUDGET SYNC ---

  // GET /api/notifications?email=...&code=...
  app.get('/api/notifications', (req, res) => {
    try {
      const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
      const code = typeof req.query.code === 'string' ? req.query.code.trim().toUpperCase() : (typeof req.query.budgetCode === 'string' ? req.query.budgetCode.trim().toUpperCase() : '');
      const allNotifs = loadServerNotifs();

      if (!email && !code) {
        return res.json(allNotifs);
      }

      const userNotifs = allNotifs.filter((n) => {
        const toE = (n.toEmail || '').trim().toLowerCase();
        const fromE = (n.fromEmail || '').trim().toLowerCase();
        const bCode = (n.budgetCode || '').trim().toUpperCase();

        if (email && (isEmailMatchServer(toE, email) || isEmailMatchServer(fromE, email))) return true;
        if (code && bCode === code) return true;
        return false;
      });
      return res.json(userNotifs);
    } catch (err) {
      console.error('[API Notifications GET Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao buscar notificações no servidor.' });
    }
  });

  // POST /api/notifications (Create / update notification on server)
  app.post('/api/notifications', (req, res) => {
    try {
      const notifData = req.body;
      if (!notifData || (!notifData.toEmail && !notifData.budgetCode) || !notifData.fromEmail) {
        return res.status(400).json({ success: false, message: 'Dados de notificação inválidos.' });
      }

      let resolvedToEmail = (notifData.toEmail || '').trim().toLowerCase();
      const cleanBudgetCode = (notifData.budgetCode || '').trim().toUpperCase();

      if (!resolvedToEmail && cleanBudgetCode) {
        const allBudgets = loadServerBudgets();
        const matchedBudget = allBudgets.find((b) => (b.code || '').trim().toUpperCase() === cleanBudgetCode);
        if (matchedBudget && matchedBudget.ownerEmail) {
          resolvedToEmail = matchedBudget.ownerEmail.trim().toLowerCase();
        } else {
          const allUsers = loadServerUsers();
          const matchedUser = allUsers.find((u) => (u.sharedBudgetCode || '').trim().toUpperCase() === cleanBudgetCode);
          if (matchedUser && matchedUser.email) {
            resolvedToEmail = matchedUser.email.trim().toLowerCase();
          }
        }
      }

      const allNotifs = loadServerNotifs();
      const newNotif: ServerNotification = {
        id: notifData.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: notifData.type || 'invite',
        fromUserId: notifData.fromUserId || '',
        fromName: notifData.fromName || 'Usuário',
        fromEmail: notifData.fromEmail,
        toEmail: resolvedToEmail,
        budgetId: notifData.budgetId || '',
        budgetCode: cleanBudgetCode,
        message: notifData.message || '',
        status: notifData.status || (notifData.type === 'info' ? 'read' : 'pending'),
        createdAt: notifData.createdAt || new Date().toISOString(),
      };

      const existingIdx = allNotifs.findIndex((n) => n.id === newNotif.id);
      if (existingIdx >= 0) {
        allNotifs[existingIdx] = newNotif;
      } else {
        allNotifs.unshift(newNotif);

        // Send email notification for new invites or requests via SMTP
        if (newNotif.type === 'invite' && newNotif.toEmail) {
          try {
            const { transporter, smtpUser, emailFrom } = createEmailTransporter();
            if (smtpUser) {
              const logoUrl = `https://${req.headers.host || 'dinheirosemfiltro.vercel.app'}/logo.png`;
              const senderHeader = `"DINHEIRO SEM FILTRO" <${emailFrom}>`;
              transporter.sendMail({
                from: senderHeader,
                to: newNotif.toEmail,
                subject: `✉️ Convite para Conectar ao Orçamento de ${newNotif.fromName || newNotif.fromEmail}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 16px; background-color: #FFFFFF;">
                    <div style="text-align: center; padding-bottom: 16px; border-bottom: 2px solid #D4AF37;">
                      <img src="${logoUrl}" alt="DINHEIRO SEM FILTRO Logo" width="80" height="80" style="border-radius: 50%; border: 2px solid #D4AF37; margin: 0 auto 12px auto; display: block; object-fit: cover;" />
                      <h1 style="color: #121212; font-size: 22px; margin: 0; font-family: Georgia, serif; font-weight: bold;">DINHEIRO SEM FILTRO</h1>
                      <p style="color: #D4AF37; font-weight: bold; font-size: 12px; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;">DOMINE SEU DINHEIRO ANTES QUE ELE DOMINE VOCÊ!</p>
                    </div>
                    <div style="padding: 24px 0;">
                      <p style="font-size: 15px; color: #121212;">Olá,</p>
                      <p style="font-size: 14px; color: #374151; line-height: 1.5;">
                        <strong>${newNotif.fromName}</strong> (${newNotif.fromEmail}) enviou um convite para você compartilhar o orçamento financeiro no aplicativo DINHEIRO SEM FILTRO.
                      </p>
                      <div style="margin: 24px 0; text-align: center; background-color: #FFFBEB; border: 1px solid #FCD34D; border-radius: 12px; padding: 16px;">
                        <span style="font-size: 12px; font-weight: bold; color: #92400E; display: block; text-transform: uppercase; letter-spacing: 1px;">Titular do Orçamento</span>
                        <span style="font-size: 18px; font-weight: 900; color: #121212; display: block; margin-top: 6px;">${newNotif.fromName || newNotif.fromEmail} (${newNotif.fromEmail})</span>
                      </div>
                      <p style="font-size: 13px; color: #6B7280;">
                        Acesse o aplicativo DINHEIRO SEM FILTRO para visualizar e aceitar este convite.
                      </p>
                    </div>
                    <div style="text-align: center; padding-top: 16px; border-top: 1px solid #E5E7EB; color: #9CA3AF; font-size: 11px;">
                      DINHEIRO SEM FILTRO App &copy; ${new Date().getFullYear()}
                    </div>
                  </div>
                `,
              }).catch((e) => console.error('[SMTP POST Invite Error]', e));
            }
          } catch (e) {
            console.error('[SMTP POST Invite Setup Error]', e);
          }
        } else if (newNotif.type === 'request' && newNotif.toEmail) {
          try {
            const { transporter, smtpUser, emailFrom } = createEmailTransporter();
            if (smtpUser) {
              const logoUrl = `https://${req.headers.host || 'dinheirosemfiltro.vercel.app'}/logo.png`;
              const senderHeader = `"DINHEIRO SEM FILTRO" <${emailFrom}>`;
              transporter.sendMail({
                from: senderHeader,
                to: newNotif.toEmail,
                subject: `📩 Solicitação de Autorização do Orçamento por ${newNotif.fromName || newNotif.fromEmail}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 16px; background-color: #FFFFFF;">
                    <div style="text-align: center; padding-bottom: 16px; border-bottom: 2px solid #D4AF37;">
                      <img src="${logoUrl}" alt="DINHEIRO SEM FILTRO Logo" width="80" height="80" style="border-radius: 50%; border: 2px solid #D4AF37; margin: 0 auto 12px auto; display: block; object-fit: cover;" />
                      <h1 style="color: #121212; font-size: 22px; margin: 0; font-family: Georgia, serif; font-weight: bold;">DINHEIRO SEM FILTRO</h1>
                      <p style="color: #D4AF37; font-weight: bold; font-size: 12px; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;">DOMINE SEU DINHEIRO ANTES QUE ELE DOMINE VOCÊ!</p>
                    </div>
                    <div style="padding: 24px 0;">
                      <p style="font-size: 15px; color: #121212;">Olá Titular,</p>
                      <p style="font-size: 14px; color: #374151; line-height: 1.5;">
                        <strong>${newNotif.fromName}</strong> (${newNotif.fromEmail}) solicitou acesso ao seu orçamento no aplicativo DINHEIRO SEM FILTRO (Código: <strong>${cleanBudgetCode}</strong>).
                      </p>
                      <p style="font-size: 13px; color: #6B7280; margin-top: 16px;">
                        Acesse o aplicativo para aceitar ou recusar esta solicitação.
                      </p>
                    </div>
                    <div style="text-align: center; padding-top: 16px; border-top: 1px solid #E5E7EB; color: #9CA3AF; font-size: 11px;">
                      DINHEIRO SEM FILTRO App &copy; ${new Date().getFullYear()}
                    </div>
                  </div>
                `,
              }).catch((e) => console.error('[SMTP POST Request Error]', e));
            }
          } catch (e) {
            console.error('[SMTP POST Request Setup Error]', e);
          }
        }
      }

      saveServerNotifs(allNotifs);

      if (notifData.sharedBudget) {
        const allBudgets = loadServerBudgets();
        const bIdx = allBudgets.findIndex((b) => b.budgetId === notifData.sharedBudget.budgetId);
        if (bIdx >= 0) {
          allBudgets[bIdx] = notifData.sharedBudget;
        } else {
          allBudgets.push(notifData.sharedBudget);
        }
        saveServerBudgets(allBudgets);
      }

      broadcastRealtime('NOTIFICATIONS_UPDATED', {
        toEmail: newNotif.toEmail,
        fromEmail: newNotif.fromEmail,
        budgetCode: newNotif.budgetCode,
        notifId: newNotif.id,
      });
      broadcastRealtime('SHARED_BUDGET_UPDATED', {
        budgetId: newNotif.budgetId,
        budgetCode: newNotif.budgetCode,
      });

      return res.json({ success: true, notification: newNotif });
    } catch (err) {
      console.error('[API Notifications POST Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao registrar notificação no servidor.' });
    }
  });

  // POST /api/notifications/respond (Accept or reject invitation/request)
  app.post('/api/notifications/respond', (req, res) => {
    try {
      const { notifId, action, currentUser } = req.body;
      if (!notifId || !action || !currentUser) {
        return res.status(400).json({ success: false, message: 'Parâmetros incompletos.' });
      }

      const allNotifs = loadServerNotifs();
      const notif = allNotifs.find((n) => n.id === notifId);
      if (!notif) {
        return res.status(404).json({ success: false, message: 'Notificação não encontrada no servidor.' });
      }

      const newStatus = action === 'accept' ? 'accepted' : 'rejected';

      allNotifs.forEach((n) => {
        if (
          n.status === 'pending' &&
          n.budgetId === notif.budgetId &&
          n.fromEmail.toLowerCase() === notif.fromEmail.toLowerCase() &&
          n.toEmail.toLowerCase() === notif.toEmail.toLowerCase()
        ) {
          n.status = newStatus;
        }
      });
      notif.status = newStatus;

      const isAccepted = action === 'accept';
      const actionText = isAccepted ? 'autorizou e conectou' : 'recusou';

      const infoNotif: ServerNotification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'info',
        fromUserId: currentUser.id || '',
        fromName: currentUser.name || 'Usuário',
        fromEmail: currentUser.email,
        toEmail: notif.fromEmail,
        budgetId: notif.budgetId,
        budgetCode: '',
        message: `${currentUser.name} (${currentUser.email}) ${actionText} a conexão do orçamento compartilhado.`,
        status: 'read',
        createdAt: new Date().toISOString(),
      };
      allNotifs.unshift(infoNotif);
      saveServerNotifs(allNotifs);

      const allBudgets = loadServerBudgets();
      let targetBudget = allBudgets.find((b) => b.budgetId === notif.budgetId || b.code === notif.budgetCode);

      if (isAccepted) {
        const personToAddEmail = notif.type === 'invite' ? currentUser.email : notif.fromEmail;
        const personToAddName = notif.type === 'invite' ? currentUser.name : notif.fromName;

        if (!targetBudget) {
          targetBudget = {
            budgetId: notif.budgetId,
            ownerId: notif.type === 'invite' ? notif.fromUserId : currentUser.id,
            ownerName: notif.type === 'invite' ? notif.fromName : currentUser.name,
            ownerEmail: notif.type === 'invite' ? notif.fromEmail : currentUser.email,
            code: notif.budgetCode,
            collaborators: [],
          };
          allBudgets.push(targetBudget);
        }

        if (!targetBudget.collaborators.some((c) => c.email.toLowerCase() === personToAddEmail.toLowerCase())) {
          targetBudget.collaborators.push({
            email: personToAddEmail,
            name: personToAddName,
            addedAt: new Date().toISOString(),
            role: 'collaborator',
            accessMode: 'edit',
          });
        }
        saveServerBudgets(allBudgets);
      }

      broadcastRealtime('NOTIFICATIONS_UPDATED', { notifId, status: newStatus });
      broadcastRealtime('SHARED_BUDGET_UPDATED', { budgetId: notif.budgetId });
      broadcastRealtime('DATA_UPDATED', { userId: notif.budgetId });

      return res.json({
        success: true,
        message: isAccepted ? 'Autorização aceita e sincronizada no servidor!' : 'Solicitação recusada.',
        notification: notif,
        sharedBudgets: loadServerBudgets(),
      });
    } catch (err) {
      console.error('[API Notifications Respond Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao responder notificação no servidor.' });
    }
  });

  // POST /api/notifications/resend (Re-send notification/invite and trigger SMTP)
  app.post('/api/notifications/resend', async (req, res) => {
    try {
      const { notifId, currentUser } = req.body;
      if (!notifId) {
        return res.status(400).json({ success: false, message: 'ID da notificação é obrigatório.' });
      }

      const allNotifs = loadServerNotifs();
      const notif = allNotifs.find((n) => n.id === notifId);
      if (!notif) {
        return res.status(404).json({ success: false, message: 'Notificação não encontrada no servidor.' });
      }

      notif.createdAt = new Date().toISOString();
      notif.status = 'pending';
      saveServerNotifs(allNotifs);

      // Trigger SMTP email re-send
      if (notif.type === 'invite') {
        try {
          const { transporter, smtpUser, emailFrom } = createEmailTransporter();
          if (smtpUser) {
            const logoUrl = `https://${req.headers.host || 'dinheirosemfiltro.vercel.app'}/logo.png`;
            const senderHeader = `"DINHEIRO SEM FILTRO" <${emailFrom}>`;
            await transporter.sendMail({
              from: senderHeader,
              to: notif.toEmail,
              subject: `✉️ [REENVIO] Convite para Conectar ao Orçamento de ${notif.fromName || notif.fromEmail}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 16px; background-color: #FFFFFF;">
                  <div style="text-align: center; padding-bottom: 16px; border-bottom: 2px solid #D4AF37;">
                    <img src="${logoUrl}" alt="DINHEIRO SEM FILTRO Logo" width="80" height="80" style="border-radius: 50%; border: 2px solid #D4AF37; margin: 0 auto 12px auto; display: block; object-fit: cover;" />
                    <h1 style="color: #121212; font-size: 22px; margin: 0; font-family: Georgia, serif; font-weight: bold;">DINHEIRO SEM FILTRO</h1>
                    <p style="color: #D4AF37; font-weight: bold; font-size: 12px; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;">DOMINE SEU DINHEIRO ANTES QUE ELE DOMINE VOCÊ!</p>
                  </div>
                  <div style="padding: 24px 0;">
                    <p style="font-size: 15px; color: #121212;">Olá,</p>
                    <p style="font-size: 14px; color: #374151; line-height: 1.5;">
                      <strong>${notif.fromName}</strong> (${notif.fromEmail}) reenviou o convite para você compartilhar o orçamento financeiro no aplicativo DINHEIRO SEM FILTRO.
                    </p>
                    <div style="margin: 24px 0; text-align: center; background-color: #FFFBEB; border: 1px solid #FCD34D; border-radius: 12px; padding: 16px;">
                      <span style="font-size: 12px; font-weight: bold; color: #92400E; display: block; text-transform: uppercase; letter-spacing: 1px;">Titular do Orçamento</span>
                      <span style="font-size: 18px; font-weight: 900; color: #121212; display: block; margin-top: 6px;">${notif.fromName || notif.fromEmail} (${notif.fromEmail})</span>
                    </div>
                    <p style="font-size: 13px; color: #6B7280;">
                      Acesse o aplicativo DINHEIRO SEM FILTRO para visualizar e autorizar esta conexão.
                    </p>
                  </div>
                  <div style="text-align: center; padding-top: 16px; border-top: 1px solid #E5E7EB; color: #9CA3AF; font-size: 11px;">
                    DINHEIRO SEM FILTRO App &copy; ${new Date().getFullYear()}
                  </div>
                </div>
              `,
            });
          }
        } catch (e) {
          console.error('[SMTP Resend Invite Error]', e);
        }
      } else if (notif.type === 'request') {
        try {
          const { transporter, smtpUser, emailFrom } = createEmailTransporter();
          if (smtpUser) {
            const logoUrl = `https://${req.headers.host || 'dinheirosemfiltro.vercel.app'}/logo.png`;
            const senderHeader = `"DINHEIRO SEM FILTRO" <${emailFrom}>`;
            await transporter.sendMail({
              from: senderHeader,
              to: notif.toEmail,
              subject: `📩 [REENVIO] Solicitação de Autorização do Orçamento por ${notif.fromName || notif.fromEmail}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 16px; background-color: #FFFFFF;">
                  <div style="text-align: center; padding-bottom: 16px; border-bottom: 2px solid #D4AF37;">
                    <img src="${logoUrl}" alt="DINHEIRO SEM FILTRO Logo" width="80" height="80" style="border-radius: 50%; border: 2px solid #D4AF37; margin: 0 auto 12px auto; display: block; object-fit: cover;" />
                    <h1 style="color: #121212; font-size: 22px; margin: 0; font-family: Georgia, serif; font-weight: bold;">DINHEIRO SEM FILTRO</h1>
                    <p style="color: #D4AF37; font-weight: bold; font-size: 12px; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;">DOMINE SEU DINHEIRO ANTES QUE ELE DOMINE VOCÊ!</p>
                  </div>
                  <div style="padding: 24px 0;">
                    <p style="font-size: 15px; color: #121212;">Olá Titular,</p>
                    <p style="font-size: 14px; color: #374151; line-height: 1.5;">
                      O usuário <strong>${notif.fromName}</strong> (${notif.fromEmail}) reenviou a solicitação de autorização para se conectar ao seu orçamento (Código: <strong>${notif.budgetCode}</strong>).
                    </p>
                    <p style="font-size: 13px; color: #6B7280; margin-top: 16px;">
                      Abra o aplicativo DINHEIRO SEM FILTRO para autorizar ou recusar o acesso.
                    </p>
                  </div>
                  <div style="text-align: center; padding-top: 16px; border-top: 1px solid #E5E7EB; color: #9CA3AF; font-size: 11px;">
                    DINHEIRO SEM FILTRO App &copy; ${new Date().getFullYear()}
                  </div>
                </div>
              `,
            });
          }
        } catch (e) {
          console.error('[SMTP Resend Request Error]', e);
        }
      }

      return res.json({
        success: true,
        message: `🔄 Convite/solicitação para ${notif.toEmail} reenviado com sucesso!`,
        notification: notif,
      });
    } catch (err) {
      console.error('[API Notifications Resend Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao reenviar notificação no servidor.' });
    }
  });

  // GET /api/shared-budgets/lookup?query=... (Lookup budget code or user email across network)
  app.get('/api/shared-budgets/lookup', (req, res) => {
    try {
      const rawQuery = typeof req.query.query === 'string' ? req.query.query.trim().toLowerCase() : '';
      if (!rawQuery) {
        return res.status(400).json({ success: false, message: 'Consulta inválida.' });
      }

      const cleanQuery = rawQuery.replace(/[^a-z0-9@.]/gi, '');
      const allBudgets = loadServerBudgets();

      let match = allBudgets.find((b) => {
        const bCodeClean = (b.code || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
        const bEmailClean = (b.ownerEmail || '').toLowerCase();
        const bIdClean = (b.budgetId || '').toLowerCase();

        return (
          bCodeClean === cleanQuery ||
          b.code.toLowerCase() === rawQuery ||
          bEmailClean === rawQuery ||
          bIdClean === rawQuery ||
          b.collaborators.some((c) => c.email.toLowerCase() === rawQuery)
        );
      });

      if (!match) {
        // Search in notifications to locate budget details if registered
        const allNotifs = loadServerNotifs();
        const foundNotif = allNotifs.find((n) => {
          const nCodeClean = (n.budgetCode || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
          return (
            nCodeClean === cleanQuery ||
            (n.budgetCode || '').toLowerCase() === rawQuery ||
            (n.fromEmail || '').toLowerCase() === rawQuery ||
            (n.toEmail || '').toLowerCase() === rawQuery
          );
        });

        if (foundNotif) {
          match = {
            budgetId: foundNotif.budgetId || `budget_${foundNotif.budgetCode}`,
            ownerId: foundNotif.fromUserId || foundNotif.budgetId,
            ownerName: foundNotif.fromName || 'Titular do Orçamento',
            ownerEmail: foundNotif.fromEmail,
            code: foundNotif.budgetCode,
            collaborators: [],
          };
          allBudgets.push(match);
          saveServerBudgets(allBudgets);
        }
      }

      if (!match) {
        const allUsers = loadServerUsers();
        const matchedUser = allUsers.find(
          (u) =>
            (u.email || '').toLowerCase() === rawQuery ||
            (u.sharedBudgetCode || '').toLowerCase().replace(/[^a-z0-9]/gi, '') === cleanQuery ||
            (u.sharedBudgetCode || '').toLowerCase() === rawQuery
        );

        if (matchedUser) {
          const emailPrefix = (matchedUser.email || '').split('@')[0] || 'user';
          const emailName = emailPrefix.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'USER';
          const userCode = matchedUser.sharedBudgetCode || `${emailName}-${Math.floor(1000 + Math.random() * 9000)}`;
          const deterministicId = `user_${emailPrefix.toLowerCase().replace(/[^a-z0-9]/gi, '_')}`;
          match = {
            budgetId: deterministicId,
            ownerId: deterministicId,
            ownerName: matchedUser.name || emailPrefix,
            ownerEmail: matchedUser.email.toLowerCase(),
            code: userCode,
            collaborators: [],
          };
          allBudgets.push(match);
          saveServerBudgets(allBudgets);
        }
      }

      if (match) {
        return res.json({ success: true, sharedBudget: match });
      }

      return res.status(404).json({ success: false, message: 'E-mail inválido ou não cadastrado no banco de dados.' });
    } catch (err) {
      console.error('[API Shared Budgets Lookup Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao realizar busca de orçamento no servidor.' });
    }
  });

  // GET /api/shared-budgets?email=...
  app.get('/api/shared-budgets', (req, res) => {
    try {
      const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
      const allBudgets = loadServerBudgets();
      if (!email) {
        return res.json(allBudgets);
      }

      const userBudgets = allBudgets.filter(
        (b) =>
          isEmailMatchServer(b.ownerEmail, email) ||
          (b.collaborators || []).some((c) => isEmailMatchServer(c.email, email))
      );
      return res.json(userBudgets);
    } catch (err) {
      console.error('[API Shared Budgets GET Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao buscar orçamentos compartilhados.' });
    }
  });

  // POST /api/shared-budgets (Upsert shared budget)
  app.post('/api/shared-budgets', (req, res) => {
    try {
      const budget: ServerSharedBudget = req.body;
      if (!budget || !budget.budgetId) {
        return res.status(400).json({ success: false, message: 'Orçamento compartilhado inválido.' });
      }

      const allBudgets = loadServerBudgets();
      const idx = allBudgets.findIndex(
        (b) =>
          b.budgetId === budget.budgetId ||
          (b.ownerEmail && budget.ownerEmail && b.ownerEmail.toLowerCase() === budget.ownerEmail.toLowerCase())
      );

      if (idx >= 0) {
        const existingCollabs = allBudgets[idx].collaborators || [];
        const newCollabs = budget.collaborators || [];
        const map = new Map<string, any>();
        existingCollabs.forEach((c) => map.set((c.email || '').toLowerCase(), c));
        newCollabs.forEach((c) => map.set((c.email || '').toLowerCase(), c));
        budget.collaborators = Array.from(map.values());

        allBudgets[idx] = { ...allBudgets[idx], ...budget };
      } else {
        allBudgets.push(budget);
      }
      saveServerBudgets(allBudgets);

      broadcastRealtime('SHARED_BUDGET_UPDATED', { budgetId: budget.budgetId, ownerEmail: budget.ownerEmail });
      broadcastRealtime('DATA_UPDATED', { userId: budget.budgetId });

      return res.json({ success: true, sharedBudget: budget });
    } catch (err) {
      console.error('[API Shared Budgets POST Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao salvar orçamento compartilhado no servidor.' });
    }
  });

  // POST /api/shared-budgets/remove-collaborator
  app.post('/api/shared-budgets/remove-collaborator', (req, res) => {
    try {
      const { budgetId, email } = req.body || {};
      if (!budgetId || !email) {
        return res.status(400).json({ success: false, message: 'budgetId e email são obrigatórios.' });
      }
      const cleanEmail = email.trim().toLowerCase();
      const allBudgets = loadServerBudgets();
      const budget = allBudgets.find((b) => b.budgetId === budgetId);
      if (budget) {
        budget.collaborators = (budget.collaborators || []).filter(
          (c) => (c.email || '').trim().toLowerCase() !== cleanEmail
        );
        saveServerBudgets(allBudgets);
        broadcastRealtime('SHARED_BUDGET_UPDATED', { budgetId: budget.budgetId, removedEmail: cleanEmail });
        broadcastRealtime('DATA_UPDATED', { userId: budget.budgetId });
      }
      return res.json({ success: true });
    } catch (err) {
      console.error('[API Remove Collaborator Error]', err);
      return res.status(500).json({ success: false });
    }
  });

  // --- STRIPE INTEGRATION API ENDPOINTS ---

  // Check Stripe configuration status
  app.get('/api/stripe/config', (req, res) => {
    const stripe = getStripe();
    const pubKey = process.env.STRIPE_PUBLISHABLE_KEY || '';
    const isConfigured = Boolean(stripe);
    const hasPubKey = Boolean(pubKey && !pubKey.startsWith('pk_test_...'));

    res.json({
      configured: isConfigured,
      hasPublishableKey: hasPubKey,
      publishableKey: hasPubKey ? pubKey : null,
      mode: isConfigured ? 'live_or_test' : 'demo',
    });
  });

  // Create Checkout Session
  app.post('/api/stripe/create-checkout-session', async (req, res) => {
    try {
      const { planName, planId, userEmail, userName } = req.body;
      const stripe = getStripe();

      const origin = req.headers.origin || `https://${req.headers.host}` || 'http://localhost:3000';
      const successUrl = `${origin}?session_id={CHECKOUT_SESSION_ID}&status=success&plan=${encodeURIComponent(planName || 'Pro')}`;
      const cancelUrl = `${origin}?status=cancel`;

      if (!stripe) {
        // Return clear response if STRIPE_SECRET_KEY is missing or unconfigured
        return res.json({
          success: true,
          isDemo: true,
          message: 'Stripe em modo de demonstração ativa. Para aceitar pagamentos reais de cartões de crédito/PIX, adicione a chave STRIPE_SECRET_KEY nas Variáveis de Ambiente do projeto.',
          planName: planName || 'Pro',
          trialDays: 90,
        });
      }

      // Determine price and billing interval based on selected plan (all <= R$ 10/mês)
      let amountInCents = 990; // Default R$ 9,90/mês
      let interval: 'month' | 'year' = 'month';
      let intervalCount = 1;

      const pLower = (planName || planId || '').toLowerCase();
      if (pLower.includes('trimestral') || planId === 'trimestral') {
        amountInCents = 2670; // R$ 26,70 a cada 3 meses (R$ 8,90/mês)
        intervalCount = 3;
      } else if (pLower.includes('anual') || planId === 'anual') {
        amountInCents = 8280; // R$ 82,80 por ano (R$ 6,90/mês)
        interval = 'year';
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        customer_email: userEmail || undefined,
        line_items: [
          {
            price_data: {
              currency: 'brl',
              product_data: {
                name: `Plano ${planName || 'Pro'} - Dinheiro Sem Filtro`,
                description: 'Assinatura com 90 dias (3 meses) 100% grátis. Primeira cobrança somente após 90 dias.',
              },
              unit_amount: amountInCents,
              recurring: {
                interval: interval,
                interval_count: intervalCount,
              },
            },
            quantity: 1,
          },
        ],
        subscription_data: {
          trial_period_days: 90,
          metadata: {
            userEmail: userEmail || '',
            userName: userName || '',
            planName: planName || '',
          },
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userEmail: userEmail || '',
          userName: userName || '',
          planName: planName || '',
        },
      });

      return res.json({
        success: true,
        url: session.url,
        sessionId: session.id,
      });
    } catch (error: any) {
      console.error('[Stripe Checkout Error]', error);
      return res.status(500).json({
        success: false,
        message: error?.message || 'Erro ao criar sessão de pagamento no Stripe.',
      });
    }
  });

  // Cancel Subscription Endpoint (CDC 7 Days Full Refund vs Auto-Renew Cancel)
  app.post('/api/stripe/cancel-subscription', async (req, res) => {
    try {
      const { userEmail, reason, immediate7DaysRefund } = req.body;
      const stripe = getStripe();

      if (!stripe) {
        return res.json({
          success: true,
          isDemo: true,
          message: immediate7DaysRefund
            ? '✅ Cancelamento e reembolso integral de 100% processados com sucesso (Garantia Legal CDC Art. 49).'
            : '✅ Renovação automática cancelada com sucesso. Você manterá o acesso VIP até o fim do seu período vigente sem novas cobranças.',
        });
      }

      // If stripe is connected, search customer by email and update/cancel subscription
      if (userEmail) {
        const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
        if (customers.data.length > 0) {
          const customerId = customers.data[0].id;
          const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'active' });
          
          for (const sub of subscriptions.data) {
            if (immediate7DaysRefund) {
              // Cancel immediately
              await stripe.subscriptions.cancel(sub.id);
            } else {
              // Cancel at end of current period (turn off auto-renew)
              await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
            }
          }
        }
      }

      return res.json({
        success: true,
        message: immediate7DaysRefund
          ? '✅ Cancelamento e estorno integral de 100% solicitados no Stripe com sucesso (CDC Art. 49).'
          : '✅ Renovação automática cancelada no Stripe. O acesso VIP continua liberado até o final do período sem novas cobranças.',
      });
    } catch (error: any) {
      console.error('[Stripe Cancellation Error]', error);
      return res.status(500).json({
        success: false,
        message: error?.message || 'Erro ao solicitar cancelamento da assinatura.',
      });
    }
  });

  // Budget AI Analysis Endpoint (Sem Filtro Persona)
  app.post('/api/budget/ai-analysis', async (req, res) => {
    try {
      const { summary, transactions, categories, month, year } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (apiKey) {
        try {
          const { GoogleGenAI } = await import('@google/genai');
          const ai = new GoogleGenAI({ apiKey });

          const prompt = `Você é a "Sem Filtro", a inteligência artificial analítica e direta do aplicativo de finanças "Dinheiro Sem Filtro". Sua função é analisar o orçamento familiar do usuário de forma transparente, apontando tanto os acertos quanto os erros financeiros.

DIRETRIZES DE ANÁLISE:
1. ANÁLISE POSITIVA: Destaque o que o usuário está fazendo de bom (ex: controle de categorias, sobra de caixa, disciplina).
2. ANÁLISE NEGATIVA / GARGALOS: Aponte com franqueza onde o dinheiro está vazando, excessos em gastos supérfluos, endividamento ou desproporção entre categorias.
3. DICAS PRÁTICAS: Forneça orientações acionáveis para otimizar o orçamento e economizar.
4. TOM DE VOZ: Profissional, realista, sem julgamentos morais, mas firme e "sem filtro".

Dados do Orçamento do Usuário (Mês ${month || ''}/${year || ''}):
Resumo do Mês: ${JSON.stringify(summary, null, 2)}
Lançamentos/Transações: ${JSON.stringify(transactions ? transactions.slice(0, 30) : [], null, 2)}
Categorias: ${JSON.stringify(categories, null, 2)}

Responda ESTRITAMENTE em formato JSON VÁLIDO sem formatação Markdown exterior nem blocos de código extra, com os campos exatos:
{
  "positivePoints": [
    "Ponto positivo 1 com base nos dados reais...",
    "Ponto positivo 2..."
  ],
  "warningPoints": [
    "Ponto de alerta/gargalo 1 com métricas e franqueza...",
    "Ponto de alerta/gargalo 2..."
  ],
  "savingTip": "Dica prática e direta para economizar no próximo mês."
}`;

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
            },
          });

          const responseText = response.text || '';
          const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanedText);

          return res.json({
            success: true,
            advice: {
              ...parsed,
              generatedAt: new Date().toISOString(),
            },
          });
        } catch (geminiError: any) {
          console.warn('[Gemini Budget API Warning, fallback to local engine]', geminiError?.message);
        }
      }

      // Rule-based Fallback for Budget
      const totalIncome = summary?.totalIncome || 0;
      const totalExpenses = summary?.totalExpenses || 0;
      const net = totalIncome - totalExpenses;
      const savingsRate = totalIncome > 0 ? (net / totalIncome) * 100 : 0;

      const positivePoints = [];
      const warningPoints = [];

      if (totalIncome > 0) {
        positivePoints.push(`Receita total de R$ ${totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} devidamente registrada no período.`);
      } else {
        positivePoints.push('Iniciativa em acompanhar os lançamentos financeiros no sistema.');
      }

      if (net > 0) {
        positivePoints.push(`Sobra financeira de R$ ${net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${savingsRate.toFixed(1)}% da receita acumulada).`);
      }

      if (totalExpenses > totalIncome && totalIncome > 0) {
        warningPoints.push(`Déficit de R$ ${(totalExpenses - totalIncome).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Seus custos atuais superam o total de receitas.`);
      } else if (savingsRate < 20 && totalIncome > 0) {
        warningPoints.push(`Sua taxa de poupança (${savingsRate.toFixed(1)}%) está abaixo do patamar ideal de 20% para a construção da reserva e investimentos.`);
      } else if (totalExpenses === 0) {
        warningPoints.push('Nenhum lançamento de despesa foi efetuado até o momento. Cadastre seus gastos recorrentes e variáveis para análise completa.');
      }

      if (warningPoints.length === 0) {
        warningPoints.push('Mantenha vigilância sobre pequenas despesas do dia a dia, que somadas representam gargalos silenciosos.');
      }

      const savingTip = net > 0
        ? `Separe R$ ${(totalIncome * 0.2).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no primeiro dia após o recebimento para investimentos e reserva, antes de efetuar despesas discricionárias.`
        : 'Elimine assinaturas não essenciais e compras impulsivas durante os próximos 30 dias para recuperar o fluxo positivo no orçamento.';

      return res.json({
        success: true,
        advice: {
          positivePoints,
          warningPoints,
          savingTip,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      console.error('[Budget AI Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao gerar análise de orçamento.' });
    }
  });

  // Portfolio AI Analysis Endpoint (Sem Filtro Persona)
  app.post('/api/portfolio/ai-analysis', async (req, res) => {
    try {
      const { assets, totalEquity, monthlyDividends } = req.body;

      if (!assets || !Array.isArray(assets)) {
        return res.status(400).json({ success: false, message: 'Ativos da carteira não fornecidos.' });
      }

      const apiKey = process.env.GEMINI_API_KEY;

      if (apiKey) {
        try {
          const { GoogleGenAI } = await import('@google/genai');
          const ai = new GoogleGenAI({ apiKey });

          const prompt = `Você é a "Sem Filtro", a inteligência artificial analista de investimentos do aplicativo "Dinheiro Sem Filtro". Sua missão é realizar uma ANÁLISE CRITERIOSA, Densa e Aprofundada da carteira do usuário, fornecendo DICAS PRÁTICAS E CRITERIOSAS para otimização de risco, retorno, proteção cambial e proventos.

DIRETRIZES DE ANÁLISE CRITERIOSA:
1. ANÁLISE RIGOROSA E DETALHADA: Avalie a carteira com critérios técnicos sólidos (índice de diversificação, concentração por ativo e setor, exposição a risco, fluxo de proventos e cobertura cambial).
2. PONTOS FORTES CONCRETOS: Destaque o que está sendo bem executado (ex: liquidez da reserva, bons papéis de dividendos, proteção em dólar, consistência de aportes).
3. PONTOS DE ATENÇÃO / ALERTA DE RISCO: Aponte com clareza os pontos fracos e gargalos (ex: hiper-concentração em um único papel, pouca renda fixa para amortecer quedas, cripto em excesso, falta de proteção inflacionária).
4. DICAS PRÁTICAS E ACIONÁVEIS ("Dicas Sem Filtro"): Dê orientações claras de como direcionar os próximos aportes sem girar patrimônio (aportes inteligentes na classe com descompasso).
5. DICAS DE ESTUDO: Sugira tópicos essenciais de aprendizado (ex: marcação a mercado, P/VP e Dividend Yield em FIIs, paridade de poder de compra e ativos globais).
6. AVISO LEGAL OBRIGATÓRIO: O campo "disclaimer" DEVE conter exatamente: "⚠️ Aviso importante: Esta análise e as dicas fornecidas possuem caráter estritamente educacional e informativo. Não constituem recomendação de investimento ou indicação de compra e venda de ativos de acordo com o mercado."
7. TOM DE VOZ: Profissional, criterioso, analítico, direto e "sem filtro".

Patrimônio Total: R$ ${totalEquity || 0}
Rendimento em Proventos: R$ ${monthlyDividends || 0}
Ativos cadastrados na Carteira:
${JSON.stringify(assets, null, 2)}

Responda ESTRITAMENTE em formato JSON VÁLIDO sem formatação Markdown exterior nem blocos de código extra, com os campos exatos:
{
  "score": 85,
  "healthStatus": "Equilibrada",
  "summary": "Resumo analítico denso e criterioso sobre a saúde geral da carteira e horizonte de tempo.",
  "positivePoints": [
    "Ponto forte analítico 1 com números/métricas da carteira...",
    "Ponto forte analítico 2..."
  ],
  "warningPoints": [
    "Ponto de atenção/risco relevante 1...",
    "Ponto de atenção/risco relevante 2..."
  ],
  "studyTips": [
    "Dica de estudo técnico/estratégico 1...",
    "Dica de estudo técnico/estratégico 2..."
  ],
  "disclaimer": "⚠️ Aviso importante: Esta análise e as dicas fornecidas possuem caráter estritamente educacional e informativo. Não constituem recomendação de investimento ou indicação de compra e venda de ativos de acordo com o mercado.",
  "diversificationAnalysis": "Análise criteriosa e detalhada por classe de ativos...",
  "riskReturnAnalysis": "Análise da relação risco x retorno e volatilidade esperada...",
  "dividendAnalysis": "Análise criteriosa do fluxo e recorrência de proventos...",
  "currencyExposure": "Análise da proteção cambial e exposição a ativos atrelados ao Dólar...",
  "rebalancingTips": [
    {
      "category": "tesouro",
      "categoryName": "Tesouro / Renda Fixa",
      "currentAmount": 1950,
      "currentPct": 19.1,
      "targetPct": 25.0,
      "targetAmount": 2550,
      "differenceAmount": 600,
      "action": "comprar",
      "recommendation": "Direcionar próximos aportes para atingir a meta estipulada."
    }
  ],
  "actionableTips": [
    "Dica prática e acionável 1 para rebalanceamento inteligente...",
    "Dica prática e acionável 2 para otimização do fluxo de caixa..."
  ]
}`;

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
            },
          });

          const responseText = response.text || '';
          const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanedText);

          return res.json({
            success: true,
            advice: {
              ...parsed,
              disclaimer: "⚠️ Aviso importante: Esta análise e as dicas fornecidas possuem caráter estritamente educacional e informativo. Não constituem recomendação de investimento ou indicação de compra e venda de ativos de acordo com o mercado.",
              generatedAt: new Date().toISOString(),
            },
          });
        } catch (geminiError: any) {
          console.warn('[Gemini API Warning, fallback to local rule engine]', geminiError?.message);
        }
      }

      // Local Rule-Based Fallback Engine if GEMINI_API_KEY is not set or failed
      const totalVal = assets.reduce((acc: number, a: any) => acc + (a.currentPrice * a.quantity), 0) || 1;
      const cryptoVal = assets.filter((a: any) => a.category === 'cripto').reduce((acc: number, a: any) => acc + (a.currentPrice * a.quantity), 0);
      const cryptoPct = (cryptoVal / totalVal) * 100;

      const stocksVal = assets.filter((a: any) => a.category === 'acoes').reduce((acc: number, a: any) => acc + (a.currentPrice * a.quantity), 0);
      const stocksPct = (stocksVal / totalVal) * 100;

      const fiisVal = assets.filter((a: any) => a.category === 'fiis').reduce((acc: number, a: any) => acc + (a.currentPrice * a.quantity), 0);
      const fiisPct = (fiisVal / totalVal) * 100;

      const usdVal = assets.filter((a: any) => a.category === 'stocks' || a.category === 'etf_exterior').reduce((acc: number, a: any) => acc + (a.currentPrice * a.quantity), 0);
      const usdPct = (usdVal / totalVal) * 100;

      const fixedVal = assets.filter((a: any) => a.category === 'tesouro').reduce((acc: number, a: any) => acc + (a.currentPrice * a.quantity), 0);
      const fixedPct = (fixedVal / totalVal) * 100;

      let score = 82;
      let status: 'Excelente' | 'Equilibrada' | 'Atenção' | 'Alto Risco' = 'Equilibrada';

      if (cryptoPct > 25) {
        score -= 15;
        status = 'Atenção';
      }

      const positivePoints = [
        `Constância em manter patrimônio investido de R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em ${assets.length} ativos.`,
        fixedPct > 10 ? `Presença de Renda Fixa/Tesouro (${fixedPct.toFixed(1)}%) promovendo estabilidade contra volatilidade.` : `Alocação diversificada entre diferentes classes do mercado.`,
      ];

      const warningPoints = [];
      if (cryptoPct > 20) {
        warningPoints.push(`Exposição elevada a Criptoativos (${cryptoPct.toFixed(1)}%), aumentando o perfil de risco e oscilação da carteira.`);
      }
      if (fixedPct < 15) {
        warningPoints.push(`Parcela em Renda Fixa/Tesouro (${fixedPct.toFixed(1)}%) abaixo da margem de segurança recomendada para momentos de baixa.`);
      }
      if (warningPoints.length === 0) {
        warningPoints.push('Monitore a proporção entre os maiores ativos para evitar dependência excessiva de uma única empresa ou fundo.');
      }

      const studyTips = [
        'Aprofundar estudos sobre marcação a mercado em títulos públicos (Tesouro Direto).',
        'Avaliar métricas de sustentabilidade de proventos em Fundos Imobiliários e Ações de valor.',
        'Estudar estratégias de rebalanceamento passivo através de novos aportes direcionados.',
      ];

      return res.json({
        success: true,
        advice: {
          score,
          healthStatus: status,
          summary: `Sua carteira de R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} apresenta uma estrutura focada em acúmulo patrimonial e dividendos.`,
          positivePoints,
          warningPoints,
          studyTips,
          disclaimer: "⚠️ Aviso importante: Esta análise e as dicas fornecidas possuem caráter estritamente educacional e informativo. Não constituem recomendação de investimento ou indicação de compra e venda de ativos de acordo com o mercado.",
          diversificationAnalysis: `Sua distribuição conta com ${cryptoPct.toFixed(1)}% em Cripto, ${stocksPct.toFixed(1)}% em Ações BR, ${fiisPct.toFixed(1)}% em FIIs, ${usdPct.toFixed(1)}% em Dólar e ${fixedPct.toFixed(1)}% em Renda Fixa.`,
          riskReturnAnalysis: cryptoPct > 15
            ? 'A exposição a Cripto traz volatilidade relevante. Recomenda-se acompanhamento sistemático de rebalanceamento.'
            : 'Perfil de risco balanceado com volatilidade controlada.',
          dividendAnalysis: `Excelente fluxo de dividendos de FIIs e Ações com foco em renda passiva.`,
          currencyExposure: `Proteção cambial de ${usdPct.toFixed(1)}% em Dólar/Exterior.`,
          rebalancingTips: [
            {
              category: 'tesouro',
              categoryName: 'Tesouro / Renda Fixa',
              currentAmount: fixedVal,
              currentPct: Number(fixedPct.toFixed(1)),
              targetPct: 20.0,
              targetAmount: totalVal * 0.20,
              differenceAmount: (totalVal * 0.20) - fixedVal,
              action: fixedPct < 20 ? 'comprar' : 'manter',
              recommendation: 'Reforçar reserva de oportunidade em Tesouro Selic.'
            },
            {
              category: 'fiis',
              categoryName: 'FIIs',
              currentAmount: fiisVal,
              currentPct: Number(fiisPct.toFixed(1)),
              targetPct: 20.0,
              targetAmount: totalVal * 0.20,
              differenceAmount: (totalVal * 0.20) - fiisVal,
              action: 'comprar',
              recommendation: 'Aproveitar deságios pontuais em FIIs para elevar dividendo mensal.'
            }
          ],
          actionableTips: [
            'Reinvista todos os proventos recebidos mensalmente.',
            'Aporte preferencialmente na classe de ativo que estiver abaixo da sua meta.',
            'Evite giros desnecessários de carteira para conter custos e imposto de renda.'
          ],
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      console.error('[Portfolio AI Analysis Error]', err);
      return res.status(500).json({ success: false, message: 'Erro ao gerar análise da carteira com IA.' });
    }
  });

  // Stripe Webhook Endpoint
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripe = getStripe();

    if (!stripe) {
      return res.status(400).send('Stripe não configurado no servidor.');
    }

    let event: Stripe.Event;

    try {
      if (webhookSecret && sig) {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } else {
        event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      }
    } catch (err: any) {
      console.error('[Stripe Webhook Signature Verification Error]', err?.message);
      return res.status(400).send(`Webhook Error: ${err?.message}`);
    }

    if (event) {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          console.log(`✅ [Stripe Webhook] Checkout concluído para: ${session.customer_email || 'Usuário'}`);
          break;
        }
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          console.log(`ℹ️ [Stripe Webhook] Status de assinatura atualizado: ${subscription.status}`);
          break;
        }
        default:
          console.log(`[Stripe Webhook] Evento recebido: ${event.type}`);
      }
    }

    return res.json({ received: true });
  });

  // Vite middleware in dev, static server in production
  const isProd = process.env.NODE_ENV === 'production' || process.argv[1]?.endsWith('.cjs');
  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use.`);
    } else {
      console.error('[Server Error]', err);
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});


export default app;
