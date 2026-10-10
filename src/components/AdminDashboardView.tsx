import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { appwriteDatabases, getAppwriteConfig } from '../lib/appwrite';
import { ID, Permission, Role, Query } from 'appwrite';
import { 
  ShieldAlert, Users, TrendingUp, DollarSign, MapPin, Calendar, 
  Send, Award, BarChart3, PieChart, CheckCircle2, AlertCircle, 
  ArrowLeft, RefreshCw, Sparkles, Gift
} from 'lucide-react';
import { CustomAlertModal } from './CustomAlertModal';

const CATEGORY_LABELS_MAP: Record<string, string> = {
  acoes: 'Ações',
  acao: 'Ações',
  equity: 'Ações',
  fiis: 'Fundos Imobiliários',
  fii: 'Fundos Imobiliários',
  fundos_imobiliários: 'Fundos Imobiliários',
  tesouro: 'Tesouro Direto',
  tesouro_direto: 'Tesouro Direto',
  bdr: 'BDR',
  bdrs: 'BDR',
  etfs: 'ETF',
  etf: 'ETF',
  fiagro: 'Fiagros',
  fiagros: 'Fiagros',
  fundos: 'Fundos de Investimentos',
  fundos_investimento: 'Fundos de Investimentos',
  renda_fixa: 'Renda Fixa',
  rendafixa: 'Renda Fixa',
  rf: 'Renda Fixa',
  stocks: 'Stocks',
  stock: 'Stocks',
  reits: 'REITs',
  reit: 'REITs',
  etf_exterior: 'ETF (Exterior)',
  cripto: 'Criptomoedas',
  criptomoedas: 'Criptomoedas',
  crypto: 'Criptomoedas',
  fip: 'FIP',
  fia: 'FIA',
  fi_infra: 'FI-Infra',
  fidc: 'FIDC',
  exterior: 'Exterior',
  usa: 'Stocks',
  global: 'ETF (Exterior)'
};

const getAssetCategoryLabel = (rawCat: any, ticker?: string, name?: string) => {
  if (rawCat) {
    const clean = String(rawCat).toLowerCase().trim();
    if (CATEGORY_LABELS_MAP[clean]) return CATEGORY_LABELS_MAP[clean];
    
    if (clean.includes('acao') || clean.includes('ações') || clean.includes('equity')) return 'Ações';
    if (clean.includes('fii') || clean.includes('imobiliário') || clean.includes('imobiliario')) return 'Fundos Imobiliários';
    if (clean.includes('stock')) return 'Stocks';
    if (clean.includes('reit')) return 'REITs';
    if (clean.includes('cripto') || clean.includes('crypto') || clean.includes('bitcoin') || clean.includes('tether') || clean.includes('ethereum')) return 'Criptomoedas';
    if (clean.includes('renda fixa') || clean.includes('rendafixa') || clean.includes('tesouro') || clean.includes('cdb') || clean.includes('lci') || clean.includes('lca')) return 'Renda Fixa';
    if (clean.includes('bdr')) return 'BDR';
    if (clean.includes('etf')) return 'ETF';
    if (clean.includes('fundo')) return 'Fundos de Investimentos';
  }

  const text = `${ticker || ''} ${name || ''}`.toUpperCase();
  if (['BTC', 'ETH', 'USDT', 'ADA', 'BNB', 'XRP', 'PENDLE', 'AAVE', 'LINK'].some(t => text.includes(t))) return 'Criptomoedas';
  if (['AAPL', 'TSLA', 'MSFT', 'GOOGL', 'NVDA', 'AMZN', 'META', 'NFLX'].some(t => text.includes(t))) return 'Stocks';
  if (['PLD', 'O', 'AMT', 'EQIX', 'SPG', 'VNQ'].some(t => text.includes(t))) return 'REITs';
  if (['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'BBAS3', 'WEGE3'].some(t => text.includes(t))) return 'Ações';
  if (['HGLG11', 'XPLG11', 'KNRE11', 'MXRF11', 'VISC11', 'IRDM11'].some(t => text.includes(t))) return 'Fundos Imobiliários';

  return rawCat ? (String(rawCat).charAt(0).toUpperCase() + String(rawCat).slice(1)) : 'Investimentos';
};

const classifyCategoryToPillar = (tx: any, categories: any[] = []) => {
  const ruleGroup = tx.ruleGroup || tx.grupo || tx.pillar;
  if (ruleGroup === '50_essentials' || ruleGroup === 'essentials') return '50_essentials';
  if (ruleGroup === '30_lifestyle' || ruleGroup === 'lifestyle') return '30_lifestyle';
  if (ruleGroup === '20_investment' || ruleGroup === 'investment') return '20_investment';

  const catId = tx.categoryId || tx.category;
  const catObj = categories.find((c: any) => c.id === catId || c.name?.toLowerCase() === String(tx.resolvedCategory || tx.category || '').toLowerCase());
  if (catObj && catObj.ruleGroup) {
    return catObj.ruleGroup;
  }

  const combined = `${tx.resolvedCategory || tx.categoryName || tx.category || ''} ${tx.description || ''} ${tx.title || ''} ${tx.notes || ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (
    combined.includes('invest') ||
    combined.includes('reserva') ||
    combined.includes('poupanc') ||
    combined.includes('aporte') ||
    combined.includes('tesouro') ||
    combined.includes('acao') ||
    combined.includes('fii')
  ) {
    return '20_investment';
  }

  if (
    combined.includes('moradia') ||
    combined.includes('aluguel') ||
    combined.includes('condominio') ||
    combined.includes('aliment') ||
    combined.includes('mercado') ||
    combined.includes('supermercado') ||
    combined.includes('saude') ||
    combined.includes('farmacia') ||
    combined.includes('transporte') ||
    combined.includes('combustivel') ||
    combined.includes('educac') ||
    combined.includes('escola') ||
    combined.includes('conta') ||
    combined.includes('agua') ||
    combined.includes('luz') ||
    combined.includes('energia') ||
    combined.includes('internet')
  ) {
    return '50_essentials';
  }

  return '30_lifestyle';
};

const DEFAULT_CATEGORIES_MAP: Record<string, { name: string; ruleGroup: string }> = {
  'cat_moradia': { name: 'Moradia & Contas Fixas', ruleGroup: '50_essentials' },
  'cat_alimentacao': { name: 'Alimentação & Feira', ruleGroup: '50_essentials' },
  'cat_saude': { name: 'Saúde & Remédios', ruleGroup: '50_essentials' },
  'cat_transporte': { name: 'Transporte Essencial', ruleGroup: '50_essentials' },
  'cat_educacao': { name: 'Educação & Contas Básicas', ruleGroup: '50_essentials' },
  'cat_lazer': { name: 'Lazer & Gastronomia', ruleGroup: '30_lifestyle' },
  'cat_estetica': { name: 'Cuidados Pessoais & Estética', ruleGroup: '30_lifestyle' },
  'cat_compras': { name: 'Vestuário & Compras', ruleGroup: '30_lifestyle' },
  'cat_assinaturas': { name: 'Assinaturas & Hobbies', ruleGroup: '30_lifestyle' },
  'cat_reserva': { name: 'Reserva de Emergência', ruleGroup: '20_investment' },
  'cat_investimentos': { name: 'Investimentos & Futuro', ruleGroup: '20_investment' },
  'cat_renda': { name: 'Receita Principal', ruleGroup: 'income' },
  'cat_renda_extra': { name: 'Renda Extra & Negócios', ruleGroup: 'income' },
  'cat_rendimentos': { name: 'Rendimentos & Outros', ruleGroup: 'income' },
};

const extractUserTransactions = (doc: any, budgetId: string) => {
  const allTxs: any[] = [];
  const deletedIds = new Set<string>();
  const localDeleted = StorageService.getDeletedIds(budgetId);
  localDeleted.forEach(id => deletedIds.add(id));

  try {
    const localTxs = StorageService.getTransactions(budgetId);
    if (Array.isArray(localTxs)) {
      localTxs.forEach(t => {
        if (t && (t.id || (t as any)._id) && !deletedIds.has(String(t.id || (t as any)._id))) {
          allTxs.push(t);
        }
      });
    }
  } catch(e) {}

  let parsed: any = null;
  try {
    parsed = doc?.data;
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
  } catch(e) {}

  const remoteDeleted = doc?.deletedIds || parsed?.deletedIds || parsed?.deletedTransactionIds;
  if (Array.isArray(remoteDeleted)) {
    remoteDeleted.forEach(id => deletedIds.add(String(id)));
  }

  const userCategories = parsed?.categories || doc?.categories || StorageService.getCategories(budgetId);
  const catMap = new Map<string, string>();
  const catRuleMap = new Map<string, string>();
  try {
    const cats = userCategories;
    if (Array.isArray(cats)) {
      cats.forEach((c: any) => {
        if (c && c.id) {
          if (c.name) catMap.set(String(c.id), String(c.name));
          if (c.ruleGroup) {
            catRuleMap.set(String(c.id), String(c.ruleGroup));
            catRuleMap.set(String(c.name).toLowerCase(), String(c.ruleGroup));
          }
        }
      });
    }
  } catch(e) {}

  const remoteTxs: any[] = [];
  try {
    const targets = [parsed, parsed?.data, parsed?.user, doc];
    targets.forEach(t => {
      if (!t) return;
      ['transactions', 'lancamentos', 'despesas', 'gastos', 'entries'].forEach(prop => {
        const val = t[prop];
        if (Array.isArray(val)) {
          val.forEach(item => remoteTxs.push(item));
        } else if (val && typeof val === 'object') {
          Object.values(val).forEach(subVal => {
            if (Array.isArray(subVal)) {
              subVal.forEach(item => remoteTxs.push(item));
            }
          });
        }
      });
    });
  } catch(e) {}

  remoteTxs.forEach(t => {
    if (!t) return;
    const id = t.id || t._id;
    if (id && deletedIds.has(String(id))) return;
    if (id && allTxs.some(existing => String(existing.id || existing._id) === String(id))) return;
    allTxs.push(t);
  });

  return allTxs.map(t => {
    let catName = t.categoryName || t.categoriaName;
    let ruleGroup = t.ruleGroup || t.grupo || t.pillar;

    const catKey = String(t.category || t.categoryId || '').trim();

    // Prioritize user's category rules first
    if (!ruleGroup && catKey && catRuleMap.has(catKey)) {
      ruleGroup = catRuleMap.get(catKey);
    }
    if (!ruleGroup && catName && catRuleMap.has(catName.toLowerCase())) {
      ruleGroup = catRuleMap.get(catName.toLowerCase());
    }

    // Fallback to default categories if still no ruleGroup
    if (DEFAULT_CATEGORIES_MAP[catKey]) {
      if (!catName || catName === 'Outros' || catKey === catName) {
        catName = DEFAULT_CATEGORIES_MAP[catKey].name;
      }
      if (!ruleGroup) {
        ruleGroup = DEFAULT_CATEGORIES_MAP[catKey].ruleGroup;
      }
    } else if (!catName && catKey) {
      if (catMap.has(catKey)) {
        catName = catMap.get(catKey);
      } else {
        catName = catKey;
      }
    }
    if (!catName) catName = 'Outros';

    const resolvedPillar = classifyCategoryToPillar({
      ...t,
      resolvedCategory: catName,
      ruleGroup
    }, userCategories);

    return {
      ...t,
      resolvedCategory: catName,
      resolvedPillar
    };
  });
};

const collectAllUserInvestments = (doc: any, budgetId: string) => {
  const investmentsMap: Record<string, number> = {};
  
  const deletedIds = new Set<string>();
  const localDeleted = StorageService.getDeletedIds(budgetId);
  localDeleted.forEach(id => deletedIds.add(id));

  let parsed: any = null;
  try {
    parsed = doc?.data;
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
  } catch(e) {}

  const remoteDeleted = doc?.deletedIds || parsed?.deletedIds || parsed?.deletedTransactionIds || doc?.deletedTransactionIds;
  if (Array.isArray(remoteDeleted)) {
    remoteDeleted.forEach(id => deletedIds.add(String(id)));
  }

  let usdRate = 5.18;
  let quotes: any[] = [];
  try {
    quotes = parsed?.quotes || parsed?.data?.quotes || doc?.quotes || [];
    const usdQ = quotes.find((q: any) => q.symbol === 'USD/BRL' || q.id === 'quote_usd');
    if (usdQ && Number(usdQ.price) > 0) usdRate = Number(usdQ.price);
  } catch(e) {}

  const allTxs: any[] = [];
  const addTx = (t: any) => {
    if (!t) return;
    const id = t.id || t._id;
    if (id && deletedIds.has(String(id))) return;
    allTxs.push(t);
  };

  try {
    const targets = [parsed, parsed?.data, parsed?.user, doc];
    targets.forEach(t => {
      if (!t) return;
      ['transactions', 'investmentTransactions', 'lancamentos', 'despesas', 'gastos', 'portfolio', 'investorPortfolio', 'assets'].forEach(prop => {
        const val = t[prop];
        if (Array.isArray(val)) {
          val.forEach(addTx);
        } else if (val && typeof val === 'object') {
          Object.values(val).forEach(subVal => {
            if (Array.isArray(subVal)) {
              subVal.forEach(addTx);
            }
          });
          const sub = val.assets || val.items || val.transactions || val.portfolio || val.investorPortfolio;
          if (Array.isArray(sub)) sub.forEach(addTx);
        }
      });
    });
  } catch(e) {}

  try {
    const keysToCheck = [
      `darla_portfolio_transactions_${budgetId}`,
      `darla_portfolio_assets_${budgetId}`,
      `darla_transactions_${budgetId}`,
      `darla_assets_${budgetId}`,
      `darla_investments_${budgetId}`
    ];
    keysToCheck.forEach(k => {
      const val = localStorage.getItem(k);
      if (val) {
        try {
          const parsedVal = JSON.parse(val);
          if (Array.isArray(parsedVal)) parsedVal.forEach(addTx);
        } catch(e) {}
      }
    });
  } catch(e) {}

  allTxs.sort((a, b) => {
    const timeA = new Date(a.date || a.createdAt || 0).getTime();
    const timeB = new Date(b.date || b.createdAt || 0).getTime();
    return timeA - timeB;
  });

  const assetMap: Record<string, any> = {};
  allTxs.forEach((tx) => {
    if (!tx) return;
    const type = String(tx.type || tx.tipo || '').toUpperCase().trim();
    if (type === 'EXPENSE' || type === 'DESPESA' || type === 'REVENUE' || type === 'RECEITA') return;

    const qty = Number(tx.quantity || tx.qtd || 0);
    const price = Number(tx.unitPrice || tx.price || tx.currentPrice || tx.averagePrice || tx.valor || tx.amount || 0);
    const total = Number(tx.totalAmount || tx.totalValue || tx.value || tx.valor || tx.amount) || (qty * price) || 0;
    const ticker = String(tx.assetTicker || tx.ticker || tx.asset || tx.name || 'OUTRO').toUpperCase().trim();
    const rawCat = tx.assetCategory || tx.category || tx.categoria || tx.type || 'Ações';
    const catKey = getAssetCategoryLabel(rawCat, ticker, tx.name);

    if (!assetMap[ticker]) {
      assetMap[ticker] = {
        ticker,
        category: catKey,
        currency: tx.currency || (['Criptomoedas', 'Stocks', 'REITs', 'ETF (Exterior)'].includes(catKey) ? 'USD' : 'BRL'),
        quantity: 0,
        totalCost: 0,
        currentPrice: price > 0 ? price : 1
      };
    }

    if (type === 'BUY' || type === 'COMPRA' || type === 'INVESTMENT' || type === 'APLICACAO' || (!type && qty > 0)) {
      assetMap[ticker].quantity += qty || 1;
      assetMap[ticker].totalCost += total > 0 ? total : ((qty || 1) * price);
      if (price > 0) assetMap[ticker].currentPrice = price;
    } else if (type === 'SELL' || type === 'VENDA') {
      const avg = assetMap[ticker].quantity > 0 ? (assetMap[ticker].totalCost / assetMap[ticker].quantity) : 0;
      assetMap[ticker].quantity = Math.max(0, assetMap[ticker].quantity - qty);
      assetMap[ticker].totalCost = Math.max(0, assetMap[ticker].quantity * avg);
      if (price > 0) assetMap[ticker].currentPrice = price;
    } else {
      if (qty > 0 && assetMap[ticker].quantity === 0) {
        assetMap[ticker].quantity = qty;
        assetMap[ticker].totalCost = total > 0 ? total : (qty * price);
        if (price > 0) assetMap[ticker].currentPrice = price;
      }
    }
  });

  Object.values(assetMap).forEach((pos: any) => {
    if (pos.quantity > 0) {
      const curCost = Math.max(0, pos.totalCost);
      const curQty = pos.quantity;
      const cPrice = pos.currentPrice > 0 ? pos.currentPrice : (curQty > 0 ? curCost / curQty : 0);
      const valUsd = curQty * cPrice;
      const isForeign = ['Criptomoedas', 'Stocks', 'REITs', 'ETF (Exterior)'].includes(pos.category) || pos.currency === 'USD' || pos.currency === 'USDT';
      const valBrl = isForeign ? (valUsd * usdRate) : valUsd;

      if (valBrl > 0) {
        investmentsMap[pos.category] = (investmentsMap[pos.category] || 0) + valBrl;
      }
    }
  });

  return investmentsMap;
};

const normalizeCategoryKey = (cat: string) => {
  const norm = String(cat || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (norm.includes('acao') || norm.includes('acoes') || norm.includes('stocks')) return 'acoes';
  if (norm.includes('fii') || norm.includes('imobiliari')) return 'fiis';
  if (norm.includes('fiagro')) return 'fiagro';
  if (norm.includes('etf')) return 'etf_exterior';
  if (norm.includes('cripto')) return 'cripto';
  if (norm.includes('tesouro') || norm.includes('renda fixa')) return 'tesouro';
  return norm;
};

const collectGlobalLocalStorageInvestments = () => {
  let usdRate = 5.18;
  try {
    const qVal = localStorage.getItem('darla_portfolio_quotes');
    if (qVal) {
      const parsedQ = JSON.parse(qVal);
      if (Array.isArray(parsedQ)) {
        const usdQ = parsedQ.find((q: any) => q.symbol === 'USD/BRL' || q.id === 'quote_usd');
        if (usdQ && Number(usdQ.price) > 0) usdRate = Number(usdQ.price);
      }
    }
  } catch(e) {}

  let allTxs: any[] = [];
  try {
    [
      'darla_portfolio_assets', 'darla_portfolio_transactions', 
      'darla_assets', 'darla_investments', 'darla_transactions'
    ].forEach(gk => {
      const val = localStorage.getItem(gk);
      if (val) {
        try {
          const parsedVal = JSON.parse(val);
          if (Array.isArray(parsedVal)) {
            parsedVal.forEach(item => { if (item) allTxs.push(item); });
          }
        } catch(e) {}
      }
    });

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('darla_portfolio_transactions_') || key.startsWith('darla_transactions_') || key.startsWith('darla_investments_') || key.startsWith('darla_portfolio_assets_') || key.startsWith('darla_assets_'))) {
        const val = localStorage.getItem(key);
        if (val) {
          try {
            const parsedVal = JSON.parse(val);
            if (Array.isArray(parsedVal)) {
              parsedVal.forEach(item => { if (item) allTxs.push(item); });
            }
          } catch(e) {}
        }
      }
    }
  } catch(e) {}

  allTxs.sort((a, b) => {
    const timeA = new Date(a.date || a.createdAt || 0).getTime();
    const timeB = new Date(b.date || b.createdAt || 0).getTime();
    return timeA - timeB;
  });

  const assetMap: Record<string, any> = {};
  allTxs.forEach((tx) => {
    if (!tx) return;
    const type = String(tx.type || tx.tipo || '').toUpperCase().trim();
    if (type === 'EXPENSE' || type === 'DESPESA' || type === 'REVENUE' || type === 'RECEITA') return;

    const qty = Number(tx.quantity || tx.qtd || 0);
    const price = Number(tx.unitPrice || tx.price || tx.currentPrice || tx.averagePrice || tx.valor || tx.amount || 0);
    const total = Number(tx.totalAmount || tx.totalValue || tx.value || tx.valor || tx.amount) || (qty * price) || 0;
    const ticker = String(tx.assetTicker || tx.ticker || tx.asset || tx.name || 'OUTRO').toUpperCase().trim();
    const rawCat = tx.assetCategory || tx.category || tx.categoria || tx.type || 'Ações';
    const catKey = getAssetCategoryLabel(rawCat, ticker, tx.name);

    if (!assetMap[ticker]) {
      const catNorm = normalizeCategoryKey(rawCat);
      const isCrypto = catNorm === 'cripto';
      const isUsd = ['stocks', 'reits', 'etf_exterior'].includes(catNorm) || tx.currency === 'USD' || tx.currency === 'USDT';
      assetMap[ticker] = {
        ticker,
        category: catKey,
        currency: isCrypto || isUsd ? 'USD' : 'BRL',
        quantity: 0,
        totalCost: 0,
        currentPrice: price > 0 ? price : 1
      };
    }

    if (type === 'BUY' || type === 'COMPRA' || type === 'INVESTMENT' || type === 'APLICACAO' || (!type && qty > 0)) {
      assetMap[ticker].quantity += (qty > 0 ? qty : 1);
      assetMap[ticker].totalCost += total > 0 ? total : ((qty > 0 ? qty : 1) * price);
      if (price > 0) assetMap[ticker].currentPrice = price;
    } else if (type === 'SELL' || type === 'VENDA') {
      const avg = assetMap[ticker].quantity > 0 ? (assetMap[ticker].totalCost / assetMap[ticker].quantity) : 0;
      assetMap[ticker].quantity = Math.max(0, assetMap[ticker].quantity - qty);
      assetMap[ticker].totalCost = Math.max(0, assetMap[ticker].quantity * avg);
      if (price > 0) assetMap[ticker].currentPrice = price;
    } else {
      if (qty > 0 && assetMap[ticker].quantity === 0) {
        assetMap[ticker].quantity = qty;
        assetMap[ticker].totalCost = total > 0 ? total : (qty * price);
        if (price > 0) assetMap[ticker].currentPrice = price;
      }
    }
  });

  const globalMap: Record<string, number> = {};
  Object.values(assetMap).forEach((pos: any) => {
    if (pos.quantity > 0) {
      const curCost = Math.max(0, pos.totalCost);
      const curQty = pos.quantity;
      const cPrice = pos.currentPrice > 0 ? pos.currentPrice : (curQty > 0 ? curCost / curQty : 0);
      const valUsd = curQty * cPrice;
      const isForeign = ['Criptomoedas', 'Stocks', 'REITs', 'ETF (Exterior)'].includes(pos.category) || pos.currency === 'USD' || pos.currency === 'USDT';
      const valBrl = isForeign ? (valUsd * usdRate) : valUsd;

      if (valBrl > 0) {
        globalMap[pos.category] = (globalMap[pos.category] || 0) + valBrl;
      }
    }
  });

  return globalMap;
};

interface AdminDashboardProps {
  currentUser: any;
  onBack: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardProps> = ({ currentUser, onBack }) => {
  const [metrics, setMetrics] = useState<any>(null);
  const [birthdays, setBirthdays] = useState<any[]>([]);
  const [allUsersDocs, setAllUsersDocs] = useState<any[]>([]);
  const [selectedInactiveUser, setSelectedInactiveUser] = useState<any | null>(null);
  const [customInactiveMsg, setCustomInactiveMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Announcement form state
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [annLink, setAnnLink] = useState('');
  const [targetEmail, setTargetEmail] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  // UF and City multi-select filter states
  const [selectedUFs, setSelectedUFs] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [isUfDropdownOpen, setIsUfDropdownOpen] = useState(false);
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [ufSearchQuery, setUfSearchQuery] = useState('');
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [sentBirthdayEmails, setSentBirthdayEmails] = useState<string[]>(() => {
    try {
      const storedAll = JSON.parse(localStorage.getItem('darla_sent_birthdays_all_time') || '{}');
      const todayDateStr = new Date().toDateString();
      const todayEmails = storedAll[todayDateStr] || [];
      const persistentToday = JSON.parse(localStorage.getItem('darla_sent_birthdays_persistent_today') || '[]');
      const todayIso = new Date().toISOString().split('T')[0];
      const legacyStored = JSON.parse(localStorage.getItem(`darla_sent_birthdays_${todayIso}`) || '[]');
      return Array.from(new Set([...todayEmails, ...persistentToday, ...legacyStored])).map((e: any) => String(e).trim().toLowerCase());
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      const todayDateStr = new Date().toDateString();
      const storedAll = JSON.parse(localStorage.getItem('darla_sent_birthdays_all_time') || '{}');
      storedAll[todayDateStr] = Array.from(new Set([...(storedAll[todayDateStr] || []), ...sentBirthdayEmails])).map((e: any) => String(e).trim().toLowerCase());
      localStorage.setItem('darla_sent_birthdays_all_time', JSON.stringify(storedAll));
      
      const todayIso = new Date().toISOString().split('T')[0];
      localStorage.setItem(`darla_sent_birthdays_${todayIso}`, JSON.stringify(sentBirthdayEmails));
    } catch (e) {}
  }, [sentBirthdayEmails]);

  useEffect(() => {
    try {
      const notifs = JSON.parse(localStorage.getItem('darla_notifications') || '[]');
      const todayDateStr = new Date().toDateString();
      const sentToday = notifs
        .filter((n: any) => {
          const isBirthday = n.type === 'birthday' || (n.title || '').includes('Aniversário');
          const createdDate = n.createdAt ? new Date(n.createdAt).toDateString() : '';
          return isBirthday && createdDate === todayDateStr;
        })
        .map((n: any) => (n.targetEmail || n.toEmail || '').trim().toLowerCase())
        .filter(Boolean);
      
      if (sentToday.length > 0) {
        setSentBirthdayEmails(prev => Array.from(new Set([...prev, ...sentToday])).map(e => e.toLowerCase()));
      }
    } catch (e) {}
  }, []);
  const [alertInfo, setAlertInfo] = useState<{ isOpen: boolean; title?: string; message: string; type?: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  // Balance status period filter state & Manual Comparison state
  const [balancePeriod, setBalancePeriod] = useState<'today' | 'week' | 'month' | 'year' | 'all' | 'custom'>('month');
  const [customStartA, setCustomStartA] = useState('');
  const [customEndA, setCustomEndA] = useState('');
  const [customStartB, setCustomStartB] = useState('');
  const [customEndB, setCustomEndB] = useState('');
  const [inactiveFilter, setInactiveFilter] = useState<'all' | 'inactive30' | 'active'>('all');
  const [isInactiveCollapsed, setIsInactiveCollapsed] = useState(true);

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      try {
        const cfg = getAppwriteConfig();
        const dbId = cfg?.databaseId || '6a83aa8d0038331e040f';
        const notifRes = await appwriteDatabases.listDocuments(dbId, 'Notificacoes');
        if (notifRes && notifRes.documents) {
          const todayDateStr = new Date().toDateString();
          const sentTodayFromAppwrite = notifRes.documents
            .filter((doc: any) => {
              const isBirthday = doc.tipo === 'birthday' || (doc.mensagem || '').includes('Feliz Aniversário');
              const createdDate = doc.$createdAt ? new Date(doc.$createdAt).toDateString() : '';
              return isBirthday && createdDate === todayDateStr;
            })
            .map((doc: any) => (doc.userId || '').trim().toLowerCase())
            .filter(Boolean);

          if (sentTodayFromAppwrite.length > 0) {
            setSentBirthdayEmails(prev => Array.from(new Set([...prev, ...sentTodayFromAppwrite])).map(e => e.toLowerCase()));
          }
        }
      } catch (err) {
        console.warn('Error checking Appwrite Notificacoes for birthdays:', err);
      }

      let appwriteDocs: any[] = [];
      try {
        const cfg = getAppwriteConfig();
        const dbId = cfg?.databaseId || '6a83aa8d0038331e040f';
        
        const [finRes, portRes] = await Promise.allSettled([
          appwriteDatabases.listDocuments(dbId, 'user_financials', [Query.orderDesc('$updatedAt'), Query.limit(100)]),
          appwriteDatabases.listDocuments(dbId, 'user_portfolios', [Query.orderDesc('$updatedAt'), Query.limit(100)])
        ]);

        const finDocs = finRes.status === 'fulfilled' ? (finRes.value?.documents || []) : [];
        const portDocs = portRes.status === 'fulfilled' ? (portRes.value?.documents || []) : [];

        const docMap = new Map();
        finDocs.forEach(d => {
          const key = (d.userId || d.email || '').trim().toLowerCase();
          if (key) docMap.set(key, { ...d });
          else docMap.set(d.$id, { ...d });
        });

        portDocs.forEach(d => {
          const key = (d.userId || d.email || '').trim().toLowerCase();
          if (key && docMap.has(key)) {
            const existing = docMap.get(key);
            try {
              let existingData = existing.data;
              if (typeof existingData === 'string') existingData = JSON.parse(existingData);
              else if (!existingData) existingData = {};

              let portData = d.data;
              if (typeof portData === 'string') portData = JSON.parse(portData);
              else if (!portData) portData = {};

              existingData.investorPortfolio = portData.investorPortfolio || portData.assets || portData;
              existing.data = JSON.stringify(existingData);
            } catch(e) {}
            docMap.set(key, existing);
          } else if (key) {
            docMap.set(key, { ...d });
          } else {
            docMap.set(d.$id, { ...d });
          }
        });

        appwriteDocs = Array.from(docMap.values());

        const todayDateStr = new Date().toDateString();
        const sentFromUserFinancials: string[] = [];
        appwriteDocs.forEach(doc => {
          const email = (doc.userId || doc.email || '').trim().toLowerCase();
          try {
            let parsed = doc.data;
            if (typeof parsed === 'string') parsed = JSON.parse(parsed);
            if (parsed && (parsed.birthdaySentDate === todayDateStr || parsed.lastBirthdayGreetingSent === todayDateStr)) {
              if (email) sentFromUserFinancials.push(email);
            }
          } catch(e) {}
        });
        if (sentFromUserFinancials.length > 0) {
          setSentBirthdayEmails(prev => Array.from(new Set([...prev, ...sentFromUserFinancials])).map(e => e.toLowerCase()));
        }
      } catch (e) {
        console.warn('Direct Appwrite query error in Admin:', e);
      }

      if (appwriteDocs.length > 0) {
        const regularDocs = appwriteDocs.filter(doc => {
          const email = (doc.userId || doc.email || '').trim().toLowerCase();
          return email !== 'suporte.dinheirosemfiltro@gmail.com';
        });

        const totalUsers = regularDocs.length;
        const stateMap: Record<string, number> = {};
        const ageBrackets = { '18-25': 0, '26-35': 0, '36-50': 0, '50+': 0 };
        const incomeBrackets = { 'Até R$ 3.000': 0, 'R$ 3.000 - R$ 7.000': 0, 'Acima de R$ 7.000': 0 };
        const fetchedBirthdays: any[] = [];
        const nowYear = new Date().getFullYear();
        const today = new Date();
        const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
        const todayDay = String(today.getDate()).padStart(2, '0');
        const todayStr = `${todayMonth}-${todayDay}`;

        appwriteDocs.forEach(doc => {
          const email = (doc.userId || doc.email || '').trim().toLowerCase();
          let state = doc.state || doc.estado || 'DF';
          let birthDate = doc.birthDate || doc.data_nascimento || '';
          let monthlyIncome = Number(doc.monthlyIncome || doc.renda_mensal || 0);

          try {
            if (doc.data) {
              const parsed = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
              const uObj = parsed?.user || parsed;
              if (uObj?.state || uObj?.estado) state = uObj.state || uObj.estado;
              if (uObj?.birthDate || uObj?.data_nascimento) birthDate = uObj.birthDate || uObj.data_nascimento;
              if (uObj?.monthlyIncome || uObj?.renda_mensal) monthlyIncome = Number(uObj.monthlyIncome || uObj.renda_mensal);
            }
          } catch(e) {}

          if (email !== 'suporte.dinheirosemfiltro@gmail.com') {
            stateMap[state] = (stateMap[state] || 0) + 1;

            if (birthDate) {
              const bYear = new Date(birthDate).getFullYear();
              if (!isNaN(bYear)) {
                const age = nowYear - bYear;
                if (age >= 18 && age <= 25) ageBrackets['18-25']++;
                else if (age <= 35) ageBrackets['26-35']++;
                else if (age <= 50) ageBrackets['36-50']++;
                else ageBrackets['50+']++;
              }
            }

            if (monthlyIncome <= 3000) incomeBrackets['Até R$ 3.000']++;
            else if (monthlyIncome <= 7000) incomeBrackets['R$ 3.000 - R$ 7.000']++;
            else incomeBrackets['Acima de R$ 7.000']++;
          }

          if (birthDate) {
            const bDate = new Date(birthDate);
            if (!isNaN(bDate.getTime())) {
              const bMonth = String(bDate.getMonth() + 1).padStart(2, '0');
              const bDay = String(bDate.getDate()).padStart(2, '0');
              if (`${bMonth}-${bDay}` === todayStr) {
                fetchedBirthdays.push({
                  name: doc.name || email.split('@')[0],
                  email,
                  birthDate,
                  city: doc.city || doc.cidade || 'Brasília',
                  state
                });
              }
            }
          }
        });

        if (Object.values(ageBrackets).reduce((a, b) => a + b, 0) === 0) {
          ageBrackets['26-35'] = Math.max(1, totalUsers);
        }
        if (Object.values(incomeBrackets).reduce((a, b) => a + b, 0) === 0) {
          incomeBrackets['Até R$ 3.000'] = Math.max(1, totalUsers);
        }

        let expenseMap: Record<string, number> = {};
        let investmentMap: Record<string, number> = {};

        // 1. Extract expenses & use collectAllUserInvestments for all investments
        appwriteDocs.forEach(doc => {
          const email = (doc.userId || doc.email || '').trim().toLowerCase();
          if (email === 'suporte.dinheirosemfiltro@gmail.com') return;
          const budgetId = doc.userId || doc.email || 'default';

          const userTxs = extractUserTransactions(doc, budgetId);
          userTxs.forEach((tx: any) => {
            const type = String(tx.type || tx.tipo || '').toLowerCase();
            const amt = Number(tx.amount || tx.valor || 0);
            if (type === 'expense' || type === 'despesa' || amt < 0) {
              const cat = tx.resolvedCategory || 'Outros';
              const cleanAmt = Math.abs(amt);
              expenseMap[cat] = (expenseMap[cat] || 0) + cleanAmt;
            }
          });

          const userInvMap = collectAllUserInvestments(doc, budgetId);
          Object.entries(userInvMap).forEach(([cat, val]) => {
            investmentMap[cat] = (investmentMap[cat] || 0) + val;
          });
        });

        const globalInvMap = collectGlobalLocalStorageInvestments();
        Object.entries(globalInvMap).forEach(([cat, val]) => {
          investmentMap[cat] = (investmentMap[cat] || 0) + val;
        });



        const topExpenseCategories = Object.entries(expenseMap)
          .sort((a, b) => b[1] - a[1])
          .map(([category, total]) => ({ category, total }));

        const topInvestments = Object.entries(investmentMap)
          .sort((a, b) => b[1] - a[1])
          .map(([type, total]) => ({ type, total }));

        setMetrics({
          totalUsers,
          totalFinancialVolume: 12700,
          stateDistribution: Object.keys(stateMap).length > 0 ? stateMap : { 'DF': totalUsers },
          ageBrackets,
          incomeBrackets,
          topExpenseCategories,
          topInvestments
        });

        setAllUsersDocs(appwriteDocs);
        setBirthdays(fetchedBirthdays);
        setLoading(false);
        return;
      }

      const [mRes, bRes] = await Promise.all([
        fetch('/api/admin/metrics').catch(() => null),
        fetch('/api/admin/birthdays').catch(() => null)
      ]);

      let mData: any = null;
      let bData: any = null;

      if (mRes && mRes.ok) {
        try { mData = await mRes.json(); } catch (e) {}
      }
      if (bRes && bRes.ok) {
        try { bData = await bRes.json(); } catch (e) {}
      }

      if (mData && mData.success && mData.metrics) {
        setMetrics(mData.metrics);
        if (mData.allUsers && Array.isArray(mData.allUsers)) {
          try { localStorage.setItem('darla_users', JSON.stringify(mData.allUsers)); } catch(e) {}
        }
        if (mData.allTransactions && Array.isArray(mData.allTransactions)) {
          try { localStorage.setItem('darla_transactions', JSON.stringify(mData.allTransactions)); } catch(e) {}
        }
      } else {
        let allUsers: any[] = [];
        try { allUsers = JSON.parse(localStorage.getItem('darla_users') || '[]'); } catch(e) {}
        
        const stateMap: Record<string, number> = {};
        allUsers.forEach(u => {
          if (u.state) stateMap[u.state] = (stateMap[u.state] || 0) + 1;
        });

        setMetrics({
          totalUsers: Math.max(1, allUsers.length),
          totalFinancialVolume: 0,
          stateDistribution: Object.keys(stateMap).length > 0 ? stateMap : { 'DF': 3 },
          ageBrackets: { '18-25': 0, '26-35': Math.max(1, allUsers.length), '36-50': 0, '50+': 0 },
          incomeBrackets: { 'Até R$ 3.000': 0, 'R$ 3.000 - R$ 7.000': 0, 'Acima de R$ 7.000': 0 },
          topExpenseCategories: [],
          topInvestments: []
        });
      }

      if (bData && bData.success) {
        setBirthdays(bData.birthdays || []);
      } else {
        setBirthdays([]);
      }
    } catch (err: any) {
      setMetrics({
        totalUsers: 3,
        totalFinancialVolume: 0,
        stateDistribution: { 'DF': 3 },
        ageBrackets: { '18-25': 0, '26-35': 3, '36-50': 0, '50+': 0 },
        incomeBrackets: { 'Até R$ 3.000': 0, 'R$ 3.000 - R$ 7.000': 0, 'Acima de R$ 7.000': 0 },
        topExpenseCategories: [],
        topInvestments: []
      });
      setBirthdays([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    const handleMutated = () => {
      fetchAdminData();
    };
    window.addEventListener('financial_data_mutated', handleMutated);
    window.addEventListener('remote_data_updated', handleMutated);
    window.addEventListener('storage', handleMutated);

    let bc: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('darla_data_sync_channel');
        bc.onmessage = () => {
          fetchAdminData();
        };
      } catch (e) {}
    }

    const interval = setInterval(() => {
      fetchAdminData();
    }, 2000); // Auto-refresh admin metrics every 2 seconds to reflect Appwrite database changes in real time

    return () => {
      window.removeEventListener('financial_data_mutated', handleMutated);
      window.removeEventListener('remote_data_updated', handleMutated);
      window.removeEventListener('storage', handleMutated);
      if (bc) {
        try { bc.close(); } catch (e) {}
      }
      clearInterval(interval);
    };
  }, []);

  const handleSendAnnouncement = async (e: React.FormEvent, customTitle?: string, customMsg?: string, customEmail?: string, notifType: 'birthday' | 'inactivity' | 'announcement' = 'announcement') => {
    if (e) e.preventDefault();
    const titleToUse = customTitle || annTitle;
    const msgToUse = customMsg || annMessage;
    const emailToUse = customEmail || targetEmail || 'all';

    if (!titleToUse || !msgToUse) {
      setAlertInfo({ isOpen: true, title: 'Atenção', message: 'Preencha o título e a mensagem.', type: 'warning' });
      return;
    }

    setSending(true);
    setSendSuccess(null);
    try {
      // 1. Save directly to local storage notifications so recipient sees it instantly
      let notifs: any[] = [];
      try { notifs = JSON.parse(localStorage.getItem('darla_notifications') || '[]'); } catch(e) {}

      const newNotif = {
        id: `admin_notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: titleToUse,
        message: msgToUse,
        link: annLink || undefined,
        type: notifType as any,
        targetEmail: emailToUse,
        createdAt: new Date().toISOString(),
        read: false,
        status: 'unread'
      };

      notifs.unshift(newNotif);
      localStorage.setItem('darla_notifications', JSON.stringify(notifs));

      if (emailToUse && emailToUse !== 'all' && emailToUse !== 'todos') {
        const userKey = `darla_user_notifications_${emailToUse.toLowerCase().trim()}`;
        try {
          const userNotifs = JSON.parse(localStorage.getItem(userKey) || '[]');
          userNotifs.unshift(newNotif);
          localStorage.setItem(userKey, JSON.stringify(userNotifs));
        } catch (e) {}
      } else if (emailToUse === 'all' || emailToUse === 'todos') {
        try {
          const allKeys = Object.keys(localStorage);
          for (const key of allKeys) {
            if (key.startsWith('darla_user_notifications_')) {
              const userNotifs = JSON.parse(localStorage.getItem(key) || '[]');
              if (!userNotifs.some((n: any) => n.id === newNotif.id)) {
                userNotifs.unshift(newNotif);
                localStorage.setItem(key, JSON.stringify(userNotifs));
              }
            }
          }
        } catch (e) {}
      }

      window.dispatchEvent(new CustomEvent('notifications_updated'));
      window.dispatchEvent(new StorageEvent('storage', { key: 'darla_notifications', newValue: JSON.stringify(notifs) }));

      // 2. Persist to Appwrite Notificacoes collection and user_financials documents for 100% robust cross-device delivery
      try {
        const cfg = getAppwriteConfig();
        if (cfg && cfg.databaseId) {
          const targetUid = emailToUse === 'all' ? 'all' : emailToUse.trim().toLowerCase();
          
          await appwriteDatabases.createDocument(cfg.databaseId, 'Notificacoes', ID.unique(), {
            userId: targetUid,
            budgetId: titleToUse,
            mensagem: `${titleToUse}\n\n${msgToUse}`,
            tipo: notifType
          }, [
            Permission.read(Role.any()),
            Permission.write(Role.any()),
            Permission.update(Role.any()),
            Permission.delete(Role.any())
          ]).catch(e => console.warn('Notificacoes create warning:', e));

          // Also update user_financials records in Appwrite
          const allDocs = await appwriteDatabases.listDocuments(cfg.databaseId, 'user_financials');
          if (allDocs && allDocs.documents) {
            for (const doc of allDocs.documents) {
              const uEmail = (doc.userId || doc.email || '').trim().toLowerCase();
              if (emailToUse === 'all' || emailToUse === 'todos' || uEmail === targetUid) {
                try {
                  let parsed = doc.data ? JSON.parse(doc.data) : {};
                  parsed.notifications = parsed.notifications || [];
                  if (notifType === 'birthday') {
                    parsed.birthdaySentDate = new Date().toDateString();
                    parsed.lastBirthdayGreetingSent = new Date().toDateString();
                  }
                  let updated = false;
                  if (!parsed.notifications.some((n: any) => n.id === newNotif.id)) {
                    parsed.notifications.unshift(newNotif);
                    updated = true;
                  }
                  if (notifType === 'birthday') {
                    updated = true;
                  }
                  if (updated) {
                    await appwriteDatabases.updateDocument(cfg.databaseId, 'user_financials', doc.$id, {
                      data: JSON.stringify(parsed)
                    });
                  }
                } catch (eDoc) {
                  console.warn('Error updating user_financials for notification:', doc.$id, eDoc);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Appwrite database notification sync warning:', err);
      }

      // 3. Also try API endpoint
      await fetch('/api/admin/send-announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleToUse, message: msgToUse, link: annLink || undefined, targetEmail: emailToUse, type: notifType })
      }).catch(() => null);

      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newNotif.id,
          toEmail: emailToUse,
          fromEmail: 'suporte.dinheirosemfiltro@gmail.com',
          message: `${titleToUse}\n\n${msgToUse}`,
          type: notifType
        })
      }).catch(() => null);

      setSendSuccess(notifType === 'birthday' ? `Parabéns enviado para ${emailToUse} com sucesso! O usuário receberá a notificação ao abrir o aplicativo.` : 'Comunicado enviado com sucesso!');
      if (notifType === 'announcement') {
        setAnnTitle('');
        setAnnMessage('');
        setAnnLink('');
        setTargetEmail('');
      }
    } catch (err: any) {
      setAlertInfo({ isOpen: true, title: 'Erro', message: 'Erro ao enviar mensagem.', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const handleSendBirthdayGreeting = async (bUser: any) => {
    const title = '🎉 Feliz Aniversário do Dinheiro Sem Filtro!';
    const message = `Olá ${bUser.name || 'Usuário'}! A equipe do Dinheiro Sem Filtro deseja um dia incrível repleto de conquistas e prosperidade. Que seu novo ciclo seja de muita abundância financeira! 🥂✨`;
    const emailLower = (bUser.email || '').trim().toLowerCase();
    
    setSentBirthdayEmails(prev => {
      const updated = Array.from(new Set([...prev, emailLower])).map(e => e.toLowerCase());
      try {
        localStorage.setItem('darla_sent_birthdays_persistent_today', JSON.stringify(updated));
        const todayDateStr = new Date().toDateString();
        const storedAll = JSON.parse(localStorage.getItem('darla_sent_birthdays_all_time') || '{}');
        storedAll[todayDateStr] = updated;
        localStorage.setItem('darla_sent_birthdays_all_time', JSON.stringify(storedAll));
      } catch (e) {}
      return updated;
    });

    await handleSendAnnouncement(null as any, title, message, bUser.email, 'birthday');
    
    setSentBirthdayEmails(prev => {
      const updated = Array.from(new Set([...prev, emailLower])).map(e => e.toLowerCase());
      try {
        localStorage.setItem('darla_sent_birthdays_persistent_today', JSON.stringify(updated));
        const todayDateStr = new Date().toDateString();
        const storedAll = JSON.parse(localStorage.getItem('darla_sent_birthdays_all_time') || '{}');
        storedAll[todayDateStr] = updated;
        localStorage.setItem('darla_sent_birthdays_all_time', JSON.stringify(storedAll));
      } catch (e) {}
      return updated;
    });

    setAlertInfo({
      isOpen: true,
      title: 'Parabéns Enviado! 🎉',
      message: `Mensagem de parabéns enviada com sucesso para ${bUser.name} (${bUser.email})! O usuário receberá a notificação de feliz aniversário ao abrir o aplicativo.`,
      type: 'success'
    });
  };

  const currentUserObj = currentUser || StorageService.getCurrentUser();
  const isAdmin = (currentUserObj?.email === 'suporte.dinheirosemfiltro@gmail.com' || currentUserObj?.role === 'admin' || (currentUserObj as any)?.systemRole === 'admin') && currentUserObj?.email !== 'sisilajb@gmail.com';

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#121212] text-white flex items-center justify-center p-6">
        <div className="bg-[#1e1e1e] border border-red-500/30 p-8 rounded-3xl max-w-md text-center space-y-4 shadow-2xl">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto animate-bounce" />
          <h2 className="text-2xl font-black font-serif text-white">Acesso Restrito</h2>
          <p className="text-gray-400 text-sm">Esta área é exclusiva para administradores da plataforma Dinheiro Sem Filtro.</p>
          <button 
            onClick={onBack}
            className="w-full py-3 bg-[#D4AF37] hover:bg-[#c29f31] text-[#121212] font-black rounded-2xl transition-all shadow-lg"
          >
            Voltar ao Aplicativo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-gray-100 p-4 sm:p-8 space-y-8 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-800 pb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2.5 bg-[#1a1a1a] hover:bg-gray-800 text-[#D4AF37] border border-[#D4AF37]/30 rounded-2xl transition-all"
            title="Voltar ao App"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 rounded-full text-[10px] font-black uppercase tracking-widest">
                Painel Master BI & Administração
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white font-serif mt-1 flex items-center gap-2">
              Dinheiro Sem Filtro <span className="text-[#D4AF37]">Admin</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchAdminData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a1a] hover:bg-gray-800 text-gray-300 border border-gray-700 rounded-2xl text-xs font-bold transition-all shadow-md"
          >
            <RefreshCw className={`w-4 h-4 text-[#D4AF37] ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar Métricas</span>
          </button>
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-2xl">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-[#D4AF37]">Admin: {currentUser.name}</span>
          </div>
        </div>
      </div>

      {loading && !metrics ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 font-bold text-sm">Consolidando métricas e inteligência de mercado...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-950/30 border border-red-500/30 rounded-3xl text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <p className="text-red-300 font-bold">{error}</p>
          <button onClick={fetchAdminData} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold">Tentar Novamente</button>
        </div>
      ) : metrics && (() => {
        let allUsers: any[] = [];
        if (allUsersDocs && allUsersDocs.length > 0) {
          allUsers = allUsersDocs.map(doc => ({
            id: doc.$id,
            email: doc.userId || doc.email,
            state: doc.estado || doc.state
          }));
        } else {
          try { allUsers = JSON.parse(localStorage.getItem('darla_users') || '[]'); } catch(e) {}
        }
        let allTx: any[] = [];
        // Pull transactions from Appwrite database documents (allUsersDocs) and localStorage fallback backup keys
        if (allUsersDocs && allUsersDocs.length > 0) {
          allUsersDocs.forEach(doc => {
            try {
              let parsedData: any = {};
              if (doc.data) {
                parsedData = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
              }
              const txs = parsedData?.transactions || parsedData?.data?.transactions || parsedData?.user?.transactions || doc.transactions || [];
              const budgetId = doc.userId || doc.email || 'default';
              const deletedIds = StorageService.getDeletedIds(budgetId);
              if (Array.isArray(txs)) {
                txs.forEach((t: any) => {
                  if (t && (t.id || t._id) && !deletedIds.has(t.id || t._id)) {
                    const tid = t.id || t._id;
                    if (!allTx.some(existing => existing.id === tid)) {
                      allTx.push({
                        ...t,
                        id: tid,
                        userId: t.userId || doc.userId || doc.email
                      });
                    }
                  }
                });
              }
            } catch (e) {}
          });
        }

        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('darla_portfolio_transactions_') || key.startsWith('darla_transactions_') || key.startsWith('darla_investments_'))) {
              const localTxs = JSON.parse(localStorage.getItem(key) || '[]');
              if (Array.isArray(localTxs)) {
                localTxs.forEach((t: any) => {
                  if (t && (t.id || t._id)) {
                    const tid = t.id || t._id;
                    if (!allTx.some(existing => existing.id === tid)) {
                      allTx.push({
                        ...t,
                        id: tid,
                        userId: t.userId || key.replace('darla_portfolio_transactions_', '').replace('darla_transactions_', '').replace('darla_investments_', '')
                      });
                    }
                  }
                });
              }
            }
          }
          const globalTxs = JSON.parse(localStorage.getItem('darla_portfolio_transactions') || '[]');
          if (Array.isArray(globalTxs)) {
            globalTxs.forEach((t: any) => {
              if (t && (t.id || t._id)) {
                const tid = t.id || t._id;
                if (!allTx.some(existing => existing.id === tid)) {
                  allTx.push({
                    ...t,
                    id: tid
                  });
                }
              }
            });
          }
        } catch (e) {}

        const getUserLocation = (u: any) => {
          let state = u.state || u.estado || 'DF';
          let city = u.city || u.cidade || 'Brasília';
          try {
            const doc = allUsersDocs.find(d => (d.userId || d.email || '').trim().toLowerCase() === (u.email || '').trim().toLowerCase() || d.$id === u.id);
            if (doc) {
              if (doc.state || doc.estado) state = doc.state || doc.estado;
              if (doc.city || doc.cidade) city = doc.city || doc.cidade;
              if (doc.data) {
                const parsed = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
                const uObj = parsed?.user || parsed;
                if (uObj?.state || uObj?.estado) state = uObj.state || uObj.estado;
                if (uObj?.city || uObj?.cidade) city = uObj.city || uObj.cidade;
              }
            }
          } catch(e) {}
          return { state: String(state).trim().toUpperCase(), city: String(city).trim() };
        };

        const allAvailableUFs = Array.from(new Set(allUsers.map(u => getUserLocation(u).state))).sort();
        const allAvailableCities = Array.from(new Set(allUsers.map(u => getUserLocation(u).city))).sort();

        const filteredUsers = allUsers.filter(u => {
          if ((u.email || '').toLowerCase() === 'suporte.dinheirosemfiltro@gmail.com') return false;
          const { state, city } = getUserLocation(u);
          const matchUf = selectedUFs.length === 0 || selectedUFs.includes(state);
          const matchCity = selectedCities.length === 0 || selectedCities.includes(city);
          return matchUf && matchCity;
        });

        const filteredUserDocs = allUsersDocs.filter(doc => {
          const email = (doc.userId || doc.email || '').trim().toLowerCase();
          if (email === 'suporte.dinheirosemfiltro@gmail.com') return false;
          return filteredUsers.some(u => (u.email || '').trim().toLowerCase() === email || u.id === doc.$id);
        });

        const now = new Date();

        // Helper to filter tx by period
        const getFilteredTx = (period: string, start?: string, end?: string) => {
          if (period === 'custom' && start && end) {
            const startDate = new Date(start);
            const endDate = new Date(end);
            endDate.setHours(23, 59, 59, 999);
            return allTx.filter(tx => {
              const txDate = new Date(tx.date || tx.createdAt || Date.now());
              return txDate >= startDate && txDate <= endDate;
            });
          }
          return allTx.filter(tx => {
            const txDate = new Date(tx.date || tx.createdAt || Date.now());
            if (period === 'today') {
              return txDate.toDateString() === now.toDateString();
            } else if (period === 'week') {
              const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              return txDate >= weekAgo;
            } else if (period === 'month') {
              return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
            } else if (period === 'year') {
              return txDate.getFullYear() === now.getFullYear();
            }
            return true;
          });
        };

        const calcStatsForPeriod = (period: string, start?: string, end?: string) => {
          let pos = 0;
          let neg = 0;
          const targets = filteredUsers;

          targets.forEach(u => {
            const uDoc = filteredUserDocs.find(doc => {
              const docEmail = (doc.userId || doc.email || '').trim().toLowerCase();
              const uEmail = (u.email || '').trim().toLowerCase();
              const uId = (u.id || '').trim().toLowerCase();
              return docEmail === uEmail || docEmail === uId || doc.$id === uId;
            });

            let uTx: any[] = [];
            let initialBalance = 0;
            if (uDoc) {
              const budgetId = uDoc.userId || uDoc.email || 'default';
              uTx = extractUserTransactions(uDoc, budgetId);
              try {
                let parsed = uDoc.data;
                if (typeof parsed === 'string') parsed = JSON.parse(parsed);
                const accs = parsed?.accounts || parsed?.data?.accounts || uDoc.accounts || [];
                if (Array.isArray(accs)) {
                  accs.forEach((acc: any) => {
                    initialBalance += Number(acc.initialBalance || acc.saldoInicial || 0);
                  });
                }
              } catch (e) {}
            }

            const filteredTx = uTx.filter(tx => {
              const dateStr = tx.date || tx.createdAt || tx.data;
              if (!dateStr) return true;
              const txDate = new Date(dateStr);
              if (isNaN(txDate.getTime())) return true;
              const now = new Date();

              if (period === 'custom' && start && end) {
                const startDate = new Date(start);
                const endDate = new Date(end);
                endDate.setHours(23, 59, 59, 999);
                return txDate >= startDate && txDate <= endDate;
              } else if (period === 'today') {
                return txDate.toDateString() === now.toDateString();
              } else if (period === 'week') {
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return txDate >= weekAgo;
              } else if (period === 'month') {
                return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
              } else if (period === 'year') {
                return txDate.getFullYear() === now.getFullYear();
              }
              return true;
            });

            const netChange = filteredTx.reduce((acc, tx) => {
              const amt = Number(tx.amount || tx.valor || 0);
              const type = String(tx.type || tx.tipo || '').toLowerCase();
              const isInc = type === 'income' || type === 'receita' || type === 'revenue';
              const isExp = type === 'expense' || type === 'despesa';
              if (isInc) return acc + Math.abs(amt);
              if (isExp) return acc - Math.abs(amt);
              return amt >= 0 ? acc + amt : acc - Math.abs(amt);
            }, 0);

            const totalUserBalance = initialBalance + netChange;

            if (totalUserBalance >= 0) pos++;
            else neg++;
          });

          const tot = Math.max(1, pos + neg);
          const posPct = Math.round((pos / tot) * 100);
          const negPct = 100 - posPct;
          return { pos, neg, posPct, negPct };
        };

        const currentStats = calcStatsForPeriod(balancePeriod, customStartA, customEndA);

        // Period A vs B stats if custom
        const statsA = balancePeriod === 'custom' ? calcStatsForPeriod('custom', customStartA, customEndA) : currentStats;
        const statsB = balancePeriod === 'custom' ? calcStatsForPeriod('custom', customStartB, customEndB) : currentStats;

        // Filtered State Distribution (UFs)
        const filteredStateMap: Record<string, number> = {};
        filteredUserDocs.forEach(doc => {
          const { state } = getUserLocation(doc);
          filteredStateMap[state] = (filteredStateMap[state] || 0) + 1;
        });
        if (Object.keys(filteredStateMap).length === 0) {
          filteredStateMap['DF'] = Math.max(1, filteredUsers.length);
        }

        // Filtered Demographic Profile (Age, Income & Sex)
        const filteredAgeBrackets = { '18-25': 0, '26-35': 0, '36-50': 0, '50+': 0 };
        const filteredIncomeBrackets = { 'Até R$ 3.000': 0, 'R$ 3.000 - R$ 7.000': 0, 'Acima de R$ 7.000': 0 };
        const filteredSexCounts = { 'Masculino': 0, 'Feminino': 0, 'Outros': 0 };
        const nowYear = new Date().getFullYear();

        filteredUserDocs.forEach(doc => {
          let birthDate = doc.birthDate || doc.data_nascimento || '';
          let monthlyIncome = Number(doc.monthlyIncome || doc.renda_mensal || 0);
          let rawSex = doc.sexo || doc.sex || doc.gender || '';

          try {
            if (doc.data) {
              const parsed = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
              const uObj = parsed?.user || parsed;
              if (uObj?.birthDate || uObj?.data_nascimento) birthDate = uObj.birthDate || uObj.data_nascimento;
              if (uObj?.monthlyIncome || uObj?.renda_mensal) monthlyIncome = Number(uObj.monthlyIncome || uObj.renda_mensal);
              if (uObj?.sexo || uObj?.sex || uObj?.gender) rawSex = uObj.sexo || uObj.sex || uObj.gender;
            }
          } catch(e) {}

          if (birthDate) {
            const bYear = new Date(birthDate).getFullYear();
            if (!isNaN(bYear)) {
              const age = nowYear - bYear;
              if (age <= 25) filteredAgeBrackets['18-25']++;
              else if (age <= 35) filteredAgeBrackets['26-35']++;
              else if (age <= 50) filteredAgeBrackets['36-50']++;
              else filteredAgeBrackets['50+']++;
            }
          } else {
            filteredAgeBrackets['26-35']++;
          }

          if (monthlyIncome <= 3000) filteredIncomeBrackets['Até R$ 3.000']++;
          else if (monthlyIncome <= 7000) filteredIncomeBrackets['R$ 3.000 - R$ 7.000']++;
          else filteredIncomeBrackets['Acima de R$ 7.000']++;

          const s = String(rawSex).toLowerCase().trim();
          if (s.includes('masc') || s === 'm' || s === 'masculino') filteredSexCounts['Masculino']++;
          else if (s.includes('fem') || s === 'f' || s === 'feminino') filteredSexCounts['Feminino']++;
          else filteredSexCounts['Outros']++;
        });

        if (Object.values(filteredAgeBrackets).reduce((a, b) => a + b, 0) === 0) {
          filteredAgeBrackets['26-35'] = Math.max(1, filteredUsers.length);
        }
        if (Object.values(filteredIncomeBrackets).reduce((a, b) => a + b, 0) === 0) {
          filteredIncomeBrackets['Até R$ 3.000'] = Math.max(1, filteredUsers.length);
        }
        if (Object.values(filteredSexCounts).reduce((a, b) => a + b, 0) === 0) {
          filteredSexCounts['Masculino'] = Math.max(1, filteredUsers.length);
        }
        const totalSex = Object.values(filteredSexCounts).reduce((a, b) => a + b, 0) || 1;

        const pillarMap = {
          essentials: { name: '50% - Necessidades', subtitle: 'Essenciais & Contas Fixas', targetPct: 50, itemsMap: {} as Record<string, number>, total: 0 },
          lifestyle: { name: '30% - Estilo de Vida', subtitle: 'Lazer, Hobbies & Compras', targetPct: 30, itemsMap: {} as Record<string, number>, total: 0 },
          investment: { name: '20% - Investimentos', subtitle: 'Aportes, Poupança & Futuro', targetPct: 20, itemsMap: {} as Record<string, number>, total: 0 },
        };
        const filteredInvestmentsMap: Record<string, number> = {};

        filteredUserDocs.forEach(doc => {
          const budgetId = doc.userId || doc.email || 'default';
          let parsedDoc: any = null;
          try {
            parsedDoc = doc.data;
            if (typeof parsedDoc === 'string') parsedDoc = JSON.parse(parsedDoc);
          } catch(e) {}
          const userCategories = parsedDoc?.categories || doc?.categories || StorageService.getCategories(budgetId);
          const userTxs = extractUserTransactions(doc, budgetId);

          userTxs.forEach((tx: any) => {
            const type = String(tx.type || tx.tipo || '').toLowerCase();
            const amt = Math.abs(Number(tx.amount || tx.valor || 0));
            if (type === 'expense' || type === 'despesa' || Number(tx.amount || tx.valor || 0) < 0) {
              const catName = tx.resolvedCategory || 'Outros';
              const pillar = tx.resolvedPillar || classifyCategoryToPillar(tx, userCategories);

              if (pillar === '50_essentials') {
                pillarMap.essentials.itemsMap[catName] = (pillarMap.essentials.itemsMap[catName] || 0) + amt;
                pillarMap.essentials.total += amt;
              } else if (pillar === '20_investment') {
                pillarMap.investment.itemsMap[catName] = (pillarMap.investment.itemsMap[catName] || 0) + amt;
                pillarMap.investment.total += amt;
              } else {
                pillarMap.lifestyle.itemsMap[catName] = (pillarMap.lifestyle.itemsMap[catName] || 0) + amt;
                pillarMap.lifestyle.total += amt;
              }
            }
          });

          const userInvMap = collectAllUserInvestments(doc, budgetId);
          Object.entries(userInvMap).forEach(([cat, val]) => {
            filteredInvestmentsMap[cat] = (filteredInvestmentsMap[cat] || 0) + val;
          });
        });

        const globalInvMap = collectGlobalLocalStorageInvestments();
        Object.entries(globalInvMap).forEach(([cat, val]) => {
          filteredInvestmentsMap[cat] = (filteredInvestmentsMap[cat] || 0) + val;
        });

        const convertItemsMap = (itemsMap: Record<string, number>) => {
          return Object.entries(itemsMap)
            .sort((a, b) => b[1] - a[1])
            .map(([category, total]) => ({ category, total }));
        };

        const pillarEssentialsItems = convertItemsMap(pillarMap.essentials.itemsMap);
        const pillarLifestyleItems = convertItemsMap(pillarMap.lifestyle.itemsMap);
        const pillarInvestmentItems = convertItemsMap(pillarMap.investment.itemsMap);

        const totalAllExpenses = pillarMap.essentials.total + pillarMap.lifestyle.total + pillarMap.investment.total || 1;

        const getPillarStats = (pTotal: number, target: number) => {
          const pct = totalAllExpenses > 0 ? (pTotal / totalAllExpenses) * 100 : 0;
          const isOver = pct > target;
          return { pct, isOver, target };
        };

        const essentialsStats = getPillarStats(pillarMap.essentials.total, 50);
        const lifestyleStats = getPillarStats(pillarMap.lifestyle.total, 30);
        const investmentStats = getPillarStats(pillarMap.investment.total, 20);

        const filteredTopInvestments = Object.entries(filteredInvestmentsMap)
          .sort((a, b) => b[1] - a[1])
          .map(([type, total]) => ({ type, total }));
        const totalInvestment = filteredTopInvestments.reduce((acc, item) => acc + item.total, 0) || 1;

        return (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#161616] border border-gray-800 p-6 rounded-3xl shadow-xl space-y-2 relative overflow-hidden group hover:border-[#D4AF37]/50 transition-all">
                <div className="absolute top-0 right-0 p-6 opacity-10 text-[#D4AF37] group-hover:opacity-20 transition-all">
                  <Users className="w-16 h-16" />
                </div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Usuários Ativos (Base Comum)</p>
                <h3 className="text-3xl font-black text-white">{filteredUsers.length}</h3>
                <p className="text-[11px] text-emerald-400 font-bold">Excluindo contas admin (isolado)</p>
              </div>

              <div className="bg-[#161616] border border-gray-800 p-6 rounded-3xl shadow-xl space-y-2 relative overflow-hidden group hover:border-emerald-500/50 transition-all">
                <div className="absolute top-0 right-0 p-6 opacity-10 text-emerald-500 group-hover:opacity-20 transition-all">
                  <TrendingUp className="w-16 h-16" />
                </div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Usuários Saldo Positivo</p>
                <h3 className="text-2xl sm:text-3xl font-black text-emerald-400">
                  {currentStats.posPct}% <span className="text-xs font-normal text-gray-400">({currentStats.pos})</span>
                </h3>
                <p className="text-[11px] text-emerald-400 font-bold">Saúde financeira estável</p>
              </div>

              <div className="bg-[#161616] border border-gray-800 p-6 rounded-3xl shadow-xl space-y-2 relative overflow-hidden group hover:border-red-500/50 transition-all">
                <div className="absolute top-0 right-0 p-6 opacity-10 text-red-500 group-hover:opacity-20 transition-all">
                  <ShieldAlert className="w-16 h-16" />
                </div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Usuários Saldo Negativo</p>
                <h3 className="text-2xl sm:text-3xl font-black text-red-400">
                  {currentStats.negPct}% <span className="text-xs font-normal text-gray-400">({currentStats.neg})</span>
                </h3>
                <p className="text-[11px] text-red-400 font-bold">Atenção orçamentária</p>
              </div>

              <div className="bg-[#161616] border border-gray-800 p-6 rounded-3xl shadow-xl space-y-2 relative overflow-hidden group hover:border-[#D4AF37]/50 transition-all">
                <div className="absolute top-0 right-0 p-6 opacity-10 text-[#D4AF37] group-hover:opacity-20 transition-all">
                  <Gift className="w-16 h-16" />
                </div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Aniversariantes Hoje</p>
                <h3 className="text-3xl font-black text-emerald-400">{birthdays.length}</h3>
                <p className="text-[11px] text-gray-400 font-bold">Prontos para felicitações</p>
              </div>
            </div>

            {/* Birthday Module & Quick Greeting */}
            <div className="bg-[#161616] border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4 border-b border-gray-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400">
                    <Gift className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white font-serif">Aniversariantes do Dia</h2>
                    <p className="text-xs text-gray-400">Usuários que completam ano na data de hoje ({new Date().toLocaleDateString('pt-BR')})</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold">
                  {birthdays.length} encontrados
                </span>
              </div>

              {birthdays.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm font-medium">
                  Nenhum usuário faz aniversário na data de hoje.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {birthdays.map((bUser, idx) => (
                    <div key={idx} className="p-4 bg-[#1f1f1f] border border-gray-700 rounded-2xl flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-black text-white">{bUser.name}</h4>
                        <p className="text-xs text-gray-400">{bUser.email}</p>
                        <p className="text-[11px] text-[#D4AF37] font-bold mt-1">📍 {bUser.city || 'Cidade não informada'} - {bUser.state || 'UF'}</p>
                      </div>
                      <button
                        onClick={() => handleSendBirthdayGreeting(bUser)}
                        disabled={sentBirthdayEmails.includes(bUser.email)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all shrink-0 ${
                          sentBirthdayEmails.includes(bUser.email)
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{sentBirthdayEmails.includes(bUser.email) ? 'Enviado! ✓' : 'Enviar Parabéns'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Inactive Users (> 30 days) & Reengagement Module */}
            <div className="bg-[#161616] border border-gray-800 rounded-3xl p-4 sm:p-8 shadow-xl space-y-4">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-gray-800 pb-4">
                <div className="flex items-start sm:items-center gap-3 cursor-pointer select-none w-full md:w-auto" onClick={() => setIsInactiveCollapsed(!isInactiveCollapsed)}>
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400 shrink-0">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between md:justify-start gap-3">
                      <h2 className="text-base sm:text-lg font-black text-white font-serif truncate">Usuários Inativos (+30d)</h2>
                      <span className="text-xs text-[#D4AF37] font-bold shrink-0">({isInactiveCollapsed ? 'Expandir ▾' : 'Recolher ▴'})</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Usuários sem atividade recente na plataforma</p>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto flex-wrap">
                  {/* Custom App Layout Filter Buttons */}
                  <div className="flex items-center gap-1 bg-[#222] p-1 rounded-2xl border border-gray-800 overflow-x-auto max-w-full">
                    <button
                      onClick={() => setInactiveFilter('all')}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${inactiveFilter === 'all' ? 'bg-[#D4AF37] text-[#121212] shadow-md' : 'text-gray-400 hover:text-white'}`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setInactiveFilter('inactive30')}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${inactiveFilter === 'inactive30' ? 'bg-[#D4AF37] text-[#121212] shadow-md' : 'text-gray-400 hover:text-white'}`}
                    >
                      Inativos (+30d)
                    </button>
                    <button
                      onClick={() => setInactiveFilter('active')}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${inactiveFilter === 'active' ? 'bg-[#D4AF37] text-[#121212] shadow-md' : 'text-gray-400 hover:text-white'}`}
                    >
                      Ativos (&lt;30d)
                    </button>
                  </div>
                  <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full text-xs font-bold shrink-0">
                    {allUsersDocs.filter(doc => {
                      const email = (doc.userId || doc.email || '').trim().toLowerCase();
                      if (email === 'suporte.dinheirosemfiltro@gmail.com') return false;
                      const lastUpdate = new Date(doc.$updatedAt || doc.updatedAt || doc.data?.updatedAt || doc.$createdAt || 0).getTime();
                      const days = Math.floor((Date.now() - lastUpdate) / (1000 * 60 * 60 * 24));
                      return days >= 30;
                    }).length} inativos
                  </span>
                </div>
              </div>

              {!isInactiveCollapsed && (
                <>
                  {allUsersDocs.filter(doc => (doc.userId || doc.email || '').trim().toLowerCase() !== 'suporte.dinheirosemfiltro@gmail.com').length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm font-medium">
                      Nenhum usuário cadastrado além do administrador.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {allUsersDocs
                        .filter(doc => (doc.userId || doc.email || '').trim().toLowerCase() !== 'suporte.dinheirosemfiltro@gmail.com')
                        .filter(doc => {
                          const lastUpdate = new Date(doc.$updatedAt || doc.updatedAt || doc.data?.updatedAt || doc.$createdAt || 0).getTime();
                          const daysInactive = Math.max(0, Math.floor((Date.now() - lastUpdate) / (1000 * 60 * 60 * 24)));
                          if (inactiveFilter === 'inactive30') return daysInactive >= 30;
                          if (inactiveFilter === 'active') return daysInactive < 30;
                          return true;
                        })
                        .map((doc, idx) => {
                          const email = (doc.userId || doc.email || '').trim().toLowerCase();
                          const lastUpdate = new Date(doc.$updatedAt || doc.updatedAt || doc.data?.updatedAt || doc.$createdAt || 0).getTime();
                          const daysInactive = Math.max(0, Math.floor((Date.now() - lastUpdate) / (1000 * 60 * 60 * 24)));
                          const isInactive30 = daysInactive >= 30;
                          const userName = doc.name || email.split('@')[0];

                          return (
                            <div key={idx} className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${isInactive30 ? 'bg-amber-950/20 border-amber-500/30' : 'bg-[#1f1f1f] border-gray-700'}`}>
                              <div>
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="text-sm font-black text-white">{userName}</h4>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isInactive30 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'}`}>
                                    {daysInactive} dias sem acesso
                                  </span>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">{email}</p>
                                <p className="text-[11px] text-[#D4AF37] font-bold mt-1">📍 {doc.city || doc.cidade || 'Brasília'} - {doc.state || doc.estado || 'DF'}</p>
                              </div>
                              <button
                                onClick={() => {
                                  const defMsg = `Olá ${userName}! Notamos que você está há ${daysInactive} dias sem acessar o Dinheiro Sem Filtro. Que tal retomar o controle das suas finanças e alcançar suas metas hoje? Estamos aqui para te apoiar! 🚀✨`;
                                  setSelectedInactiveUser({ email, name: userName, daysInactive });
                                  setCustomInactiveMsg(defMsg);
                                }}
                                className="w-full py-2 bg-gradient-to-r from-[#D4AF37] to-[#c29f31] hover:opacity-90 text-[#121212] font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Enviar Mensagem Personalizada</span>
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal for Custom Inactive User Message */}
            {selectedInactiveUser && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-[#161616] border border-gray-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                    <div>
                      <h3 className="text-lg font-black text-white font-serif">Enviar Mensagem para {selectedInactiveUser.name}</h3>
                      <p className="text-xs text-gray-400">{selectedInactiveUser.email} • Inativo há {selectedInactiveUser.daysInactive} dias</p>
                    </div>
                    <button
                      onClick={() => setSelectedInactiveUser(null)}
                      className="p-2 bg-[#222] hover:bg-[#333] rounded-full text-gray-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mensagem de Reengajamento</label>
                    <textarea
                      value={customInactiveMsg}
                      onChange={(e) => setCustomInactiveMsg(e.target.value)}
                      placeholder={`Olá ${selectedInactiveUser.name}! Notamos sua ausência no app. Que tal retomar o controle das suas finanças hoje?`}
                      rows={5}
                      className="w-full px-4 py-3 bg-[#222] border border-gray-700 rounded-xl text-white text-xs focus:outline-none focus:border-[#D4AF37] resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedInactiveUser(null)}
                      className="px-4 py-2.5 bg-[#222] hover:bg-[#333] text-gray-300 rounded-xl text-xs font-bold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const defaultMsg = `Olá ${selectedInactiveUser.name}! Notamos que você está há ${selectedInactiveUser.daysInactive} dias sem acessar o Dinheiro Sem Filtro. Que tal retomar o controle das suas finanças e alcançar suas metas hoje? Estamos aqui para te apoiar! 🚀✨`;
                        const finalMsg = customInactiveMsg || defaultMsg;
                        const title = '💤 Sentimos sua falta no Dinheiro Sem Filtro!';

                        try {
                          StorageService.addNotification({
                            type: 'inactivity',
                            fromUserId: currentUser?.id || 'admin',
                            fromName: currentUser?.name || 'Suporte',
                            fromEmail: currentUser?.email || 'suporte.dinheirosemfiltro@gmail.com',
                            toEmail: selectedInactiveUser.email,
                            budgetId: '',
                            budgetCode: '',
                            message: finalMsg
                          });
                        } catch (e) {}

                        handleSendAnnouncement(null as any, title, finalMsg, selectedInactiveUser.email, 'inactivity');
                        setSelectedInactiveUser(null);
                        setCustomInactiveMsg('');
                        setAlertInfo({
                          isOpen: true,
                          title: 'Notificação Enviada',
                          message: `Notificação enviada com sucesso para ${selectedInactiveUser.email}!`,
                          type: 'success'
                        });
                      }}
                      className="px-6 py-2.5 bg-[#D4AF37] hover:bg-[#c29f31] text-[#121212] font-black rounded-xl text-xs uppercase tracking-wider shadow-lg"
                    >
                      Enviar Mensagem
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* UF & City Multi-Select Filter Bar */}
            <div className="bg-[#161616] border border-gray-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#D4AF37]" />
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Filtro Geográfico (UF & Cidade)</h3>
                    <p className="text-xs text-gray-400">Filtre os dados do painel por Estados e Cidades com múltipla escolha e pesquisa</p>
                  </div>
                </div>
                {(selectedUFs.length > 0 || selectedCities.length > 0) && (
                  <button
                    onClick={() => { setSelectedUFs([]); setSelectedCities([]); }}
                    className="px-3 py-1 bg-red-950/40 border border-red-500/30 text-red-400 hover:bg-red-900/40 rounded-xl text-xs font-bold transition-all"
                  >
                    Limpar Filtros ({selectedUFs.length + selectedCities.length})
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* UF Dropdown */}
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-400 mb-1">Estados (UFs)</label>
                  <div
                    onClick={() => setIsUfDropdownOpen(!isUfDropdownOpen)}
                    className="w-full bg-[#222] border border-gray-700 rounded-2xl px-4 py-2.5 text-xs text-white flex items-center justify-between cursor-pointer hover:border-[#D4AF37] transition-all"
                  >
                    <span className="truncate">
                      {selectedUFs.length === 0 ? 'Todos os Estados (UFs)' : `${selectedUFs.length} UF(s): ${selectedUFs.join(', ')}`}
                    </span>
                    <span className="text-gray-400 text-xs">▼</span>
                  </div>

                  {isUfDropdownOpen && (
                    <div className="absolute z-50 mt-2 w-full bg-[#1e1e1e] border border-gray-700 rounded-2xl shadow-2xl p-3 space-y-2 max-h-60 overflow-y-auto">
                      <input
                        type="text"
                        placeholder="Pesquisar UF..."
                        value={ufSearchQuery}
                        onChange={(e) => setUfSearchQuery(e.target.value)}
                        className="w-full bg-[#121212] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:border-[#D4AF37] outline-none"
                      />
                      <div className="flex items-center justify-between px-1 text-[11px] text-[#D4AF37] font-bold">
                        <button onClick={() => setSelectedUFs(allAvailableUFs)} className="hover:underline">Selecionar Todos</button>
                        <button onClick={() => setSelectedUFs([])} className="hover:underline">Limpar</button>
                      </div>
                      <div className="space-y-1">
                        {allAvailableUFs
                          .filter(uf => uf.toLowerCase().includes(ufSearchQuery.toLowerCase()))
                          .map(uf => (
                            <label key={uf} className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#2a2a2a] rounded-xl cursor-pointer text-xs text-gray-300">
                              <input
                                type="checkbox"
                                checked={selectedUFs.includes(uf)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedUFs([...selectedUFs, uf]);
                                  else setSelectedUFs(selectedUFs.filter(item => item !== uf));
                                }}
                                className="rounded text-[#D4AF37] focus:ring-0 bg-[#121212] border-gray-600"
                              />
                              <span>{uf}</span>
                            </label>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* City Dropdown */}
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-400 mb-1">Cidades</label>
                  <div
                    onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
                    className="w-full bg-[#222] border border-gray-700 rounded-2xl px-4 py-2.5 text-xs text-white flex items-center justify-between cursor-pointer hover:border-[#D4AF37] transition-all"
                  >
                    <span className="truncate">
                      {selectedCities.length === 0 ? 'Todas as Cidades' : `${selectedCities.length} Cidade(s): ${selectedCities.join(', ')}`}
                    </span>
                    <span className="text-gray-400 text-xs">▼</span>
                  </div>

                  {isCityDropdownOpen && (
                    <div className="absolute z-50 mt-2 w-full bg-[#1e1e1e] border border-gray-700 rounded-2xl shadow-2xl p-3 space-y-2 max-h-60 overflow-y-auto">
                      <input
                        type="text"
                        placeholder="Pesquisar Cidade..."
                        value={citySearchQuery}
                        onChange={(e) => setCitySearchQuery(e.target.value)}
                        className="w-full bg-[#121212] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:border-[#D4AF37] outline-none"
                      />
                      <div className="flex items-center justify-between px-1 text-[11px] text-[#D4AF37] font-bold">
                        <button onClick={() => setSelectedCities(allAvailableCities)} className="hover:underline">Selecionar Todos</button>
                        <button onClick={() => setSelectedCities([])} className="hover:underline">Limpar</button>
                      </div>
                      <div className="space-y-1">
                        {allAvailableCities
                          .filter(c => c.toLowerCase().includes(citySearchQuery.toLowerCase()))
                          .map(city => (
                            <label key={city} className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#2a2a2a] rounded-xl cursor-pointer text-xs text-gray-300">
                              <input
                                type="checkbox"
                                checked={selectedCities.includes(city)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedCities([...selectedCities, city]);
                                  else setSelectedCities(selectedCities.filter(item => item !== city));
                                }}
                                className="rounded text-[#D4AF37] focus:ring-0 bg-[#121212] border-gray-600"
                              />
                              <span>{city}</span>
                            </label>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Balance Progression & Manual Period A vs B Comparison */}
            <div className="bg-[#161616] border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
                <div>
                  <h2 className="text-lg font-black text-white font-serif">Progressão e Comparativo de Períodos (A vs B)</h2>
                  <p className="text-xs text-gray-400">Selecione períodos predefinidos ou faça o comparativo manual entre Período A e Período B</p>
                </div>
                <div className="flex items-center gap-1.5 bg-[#222] p-1 rounded-2xl border border-gray-700 flex-wrap">
                  {[
                    { id: 'today', label: 'Hoje' },
                    { id: 'week', label: 'Semana' },
                    { id: 'month', label: 'Mês' },
                    { id: 'year', label: 'Ano' },
                    { id: 'all', label: 'Todo Período' },
                    { id: 'custom', label: 'Manual A vs B' },
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => setBalancePeriod(p.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${balancePeriod === p.id ? 'bg-[#D4AF37] text-[#121212] shadow-md' : 'text-gray-400 hover:text-white'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {balancePeriod === 'custom' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-[#1f1f1f] border border-gray-700 rounded-2xl">
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-[#D4AF37] uppercase tracking-wider">📅 Período A (Base Comparativa)</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase">Início A</label>
                        <input type="date" value={customStartA} onChange={(e) => setCustomStartA(e.target.value)} className="w-full px-3 py-2 bg-[#121212] border border-gray-700 rounded-xl text-white text-xs" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase">Fim A</label>
                        <input type="date" value={customEndA} onChange={(e) => setCustomEndA(e.target.value)} className="w-full px-3 py-2 bg-[#121212] border border-gray-700 rounded-xl text-white text-xs" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider">📅 Período B (Período Recente / Alvo)</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase">Início B</label>
                        <input type="date" value={customStartB} onChange={(e) => setCustomStartB(e.target.value)} className="w-full px-3 py-2 bg-[#121212] border border-gray-700 rounded-xl text-white text-xs" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase">Fim B</label>
                        <input type="date" value={customEndB} onChange={(e) => setCustomEndB(e.target.value)} className="w-full px-3 py-2 bg-[#121212] border border-gray-700 rounded-xl text-white text-xs" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {balancePeriod === 'custom' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Período A */}
                  <div className="p-5 bg-[#1f1f1f] border border-gray-700 rounded-2xl space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                      <span className="text-xs font-black text-[#D4AF37] uppercase">Período A</span>
                      <span className="text-xs font-bold text-gray-300">{statsA.posPct}% Positivos ({statsA.pos})</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-emerald-400">Positivos</span>
                        <span>{statsA.posPct}%</span>
                      </div>
                      <div className="w-full bg-[#222] h-2.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${statsA.posPct}%` }}></div>
                      </div>
                      <div className="flex justify-between text-xs font-bold pt-2">
                        <span className="text-red-400">Negativos</span>
                        <span>{statsA.negPct}%</span>
                      </div>
                      <div className="w-full bg-[#222] h-2.5 rounded-full overflow-hidden">
                        <div className="bg-red-500 h-full rounded-full" style={{ width: `${statsA.negPct}%` }}></div>
                      </div>
                    </div>
                  </div>

                  {/* Período B */}
                  <div className="p-5 bg-[#1f1f1f] border border-gray-700 rounded-2xl space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                      <span className="text-xs font-black text-emerald-400 uppercase">Período B</span>
                      <span className="text-xs font-bold text-gray-300">{statsB.posPct}% Positivos ({statsB.pos})</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-emerald-400">Positivos</span>
                        <span>{statsB.posPct}%</span>
                      </div>
                      <div className="w-full bg-[#222] h-2.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${statsB.posPct}%` }}></div>
                      </div>
                      <div className="flex justify-between text-xs font-bold pt-2">
                        <span className="text-red-400">Negativos</span>
                        <span>{statsB.negPct}%</span>
                      </div>
                      <div className="w-full bg-[#222] h-2.5 rounded-full overflow-hidden">
                        <div className="bg-red-500 h-full rounded-full" style={{ width: `${statsB.negPct}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 max-w-2xl mx-auto py-2">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-emerald-400">🟢 Usuários Positivos ({currentStats.posPct}%)</span>
                      <span className="text-white">{currentStats.pos} usuários</span>
                    </div>
                    <div className="w-full bg-[#222] h-4 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${currentStats.posPct}%` }}></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-red-400">🔴 Usuários Negativos ({currentStats.negPct}%)</span>
                      <span className="text-white">{currentStats.neg} usuários</span>
                    </div>
                    <div className="w-full bg-[#222] h-4 rounded-full overflow-hidden">
                      <div className="bg-red-500 h-full rounded-full transition-all duration-500" style={{ width: `${currentStats.negPct}%` }}></div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 pt-2 text-center">
                    * Período selecionado: <span className="text-[#D4AF37] font-bold uppercase">{balancePeriod === 'today' ? 'Hoje' : balancePeriod === 'week' ? 'Esta Semana' : balancePeriod === 'month' ? 'Este Mês' : balancePeriod === 'year' ? 'Este Ano' : 'Todo o Período'}</span>.
                  </p>
                </div>
              )}
            </div>

            {/* Regional Distribution Chart (Clean Bar Layout without pie circle) */}
            <div className="bg-[#161616] border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
                <div className="p-3 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-2xl text-[#D4AF37]">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white font-serif">Distribuição Regional (UFs)</h2>
                  <p className="text-xs text-gray-400">Percentual de usuários por estado federativo</p>
                </div>
              </div>

              <div className="space-y-3">
                {Object.entries(filteredStateMap || {}).map(([uf, count]: [string, any], idx) => {
                  const totalUfUsers = Object.values(filteredStateMap || { 1: 1 }).reduce((a: any, b: any) => a + b, 0) as number;
                  const pct = Math.round((count / Math.max(totalUfUsers, 1)) * 100);
                  const colors = ['bg-[#D4AF37]', 'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-amber-500'];
                  const colorClass = colors[idx % colors.length];
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-gray-300 flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${colorClass}`}></span>
                          Estado: {uf}
                        </span>
                        <span className="text-[#D4AF37]">{count} usuários ({pct}%)</span>
                      </div>
                      <div className="w-full bg-[#222] h-2.5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${Math.max(pct, 6)}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>





          {/* Demographics & Income Distribution Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Age, Income & Sex Brackets Card */}
            <div className="bg-[#161616] border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
                <div className="p-3 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-2xl text-[#D4AF37]">
                  <PieChart className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white font-serif">Perfil Demográfico (Idade, Renda & Sexo)</h2>
                  <p className="text-xs text-gray-400">Distribuição por faixa etária, renda declarada e gênero</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Distribuição por Faixa Etária</h4>
                  <div className="space-y-2">
                    {(() => {
                      const totalAgeCount = Object.values(filteredAgeBrackets || { 1: 1 }).reduce((a: any, b: any) => a + b, 0) as number;
                      return Object.entries(filteredAgeBrackets || {}).map(([bracket, count]: [string, any], idx) => {
                        const pct = Math.round((count / Math.max(totalAgeCount, 1)) * 100);
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-xs font-bold">
                              <span className="text-gray-300">{bracket} anos</span>
                              <span className="text-[#D4AF37]">{count} usuários ({pct}%)</span>
                            </div>
                            <div className="w-full bg-[#222] h-2.5 rounded-full overflow-hidden">
                              <div className="bg-[#D4AF37] h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 6)}%` }}></div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                <div className="border-t border-gray-800 pt-6">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Faixas de Renda Mensal Declarada</h4>
                  <div className="space-y-2">
                    {(() => {
                      const totalIncomeCount = Object.values(filteredIncomeBrackets || { 1: 1 }).reduce((a: any, b: any) => a + b, 0) as number;
                      return Object.entries(filteredIncomeBrackets || {}).map(([bracket, count]: [string, any], idx) => {
                        const pct = Math.round((count / Math.max(totalIncomeCount, 1)) * 100);
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-xs font-bold">
                              <span className="text-gray-300">{bracket}</span>
                              <span className="text-emerald-400">{count} usuários ({pct}%)</span>
                            </div>
                            <div className="w-full bg-[#222] h-2.5 rounded-full overflow-hidden">
                              <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 6)}%` }}></div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                <div className="border-t border-gray-800 pt-6">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Distribuição por Sexo</h4>
                  <div className="space-y-2">
                    {Object.entries(filteredSexCounts).map(([sex, count]: [string, any], idx) => {
                      const totalSex = Object.values(filteredSexCounts).reduce((a, b) => a + b, 0) || 1;
                      const pct = Math.round((count / Math.max(totalSex, 1)) * 100);
                      const colors = ['bg-blue-500', 'bg-pink-500', 'bg-purple-500'];
                      const colorClass = colors[idx % colors.length];
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-gray-300 flex items-center gap-2">
                              <span className={`w-3 h-3 rounded-full ${colorClass}`}></span>
                              {sex}
                            </span>
                            <span className="text-blue-400">{count} usuários ({pct}%)</span>
                          </div>
                          <div className="w-full bg-[#222] h-2.5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${Math.max(pct, 6)}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Market Intelligence: 50/30/20 Expense Categories Structure */}
            <div className="bg-[#161616] border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
                <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-2xl text-purple-400">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white font-serif">Análise de Todas as Despesas por Categoria (Método 50/30/20)</h2>
                  <p className="text-xs text-gray-400">Distribuição estruturada das despesas da base por pilares orçamentários</p>
                </div>
              </div>

              <div>
                {pillarEssentialsItems.length === 0 && pillarLifestyleItems.length === 0 && pillarInvestmentItems.length === 0 ? (
                  <p className="text-xs text-gray-500">Nenhuma despesa registrada na base ainda.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Pillar 1: 50% Necessidades */}
                    <div className={`p-4 sm:p-5 rounded-2xl border transition space-y-3 bg-[#18181B] ${essentialsStats.isOver ? 'border-[#FF5252]/40' : 'border-[#00E676]/40'}`}>
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <span className={`text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded-full uppercase ${essentialsStats.isOver ? 'bg-[#FF5252] text-white' : 'bg-[#00E676] text-[#121212]'}`}>
                          {essentialsStats.isOver ? 'Excedido' : 'Dentro do Limite'}
                        </span>
                        <span className="w-3 h-3 rounded-full bg-[#3B82F6]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase font-serif text-white">50% - Necessidades</h3>
                        <p className="text-[11px] text-gray-400 font-semibold">(Essenciais & Contas Fixas)</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 items-start pt-1">
                        <div>
                          <span className="text-[10px] text-gray-400 font-black uppercase">Atual</span>
                          <p className="text-xl font-black font-serif text-white">{essentialsStats.pct.toFixed(1).replace('.', ',')}%</p>
                          <p className="text-xs font-bold text-gray-200">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pillarMap.essentials.total)}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 font-black uppercase">Desejado</span>
                          <p className="text-lg font-black font-serif text-gray-300">50%</p>
                        </div>
                      </div>
                      <div className="w-full bg-white/15 rounded-full h-2.5 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${essentialsStats.isOver ? 'bg-[#FF5252]' : 'bg-[#00E676]'}`} style={{ width: `${Math.min(100, (essentialsStats.pct / 50) * 100)}%` }} />
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-white/10">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Categorias:</span>
                        {pillarEssentialsItems.length === 0 ? (
                          <p className="text-[11px] text-gray-500 italic">Nenhuma despesa nesta categoria</p>
                        ) : (
                          pillarEssentialsItems.map((it, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="text-gray-300 font-medium">{it.category}</span>
                              <span className="font-bold text-[#D4AF37]">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(it.total)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Pillar 2: 30% Estilo de Vida */}
                    <div className={`p-4 sm:p-5 rounded-2xl border transition space-y-3 bg-[#18181B] ${lifestyleStats.isOver ? 'border-[#FF5252]/40' : 'border-[#00E676]/40'}`}>
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <span className={`text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded-full uppercase ${lifestyleStats.isOver ? 'bg-[#FF5252] text-white' : 'bg-[#00E676] text-[#121212]'}`}>
                          {lifestyleStats.isOver ? 'Excedido' : 'Dentro do Limite'}
                        </span>
                        <span className="w-3 h-3 rounded-full bg-[#EC4899]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase font-serif text-white">30% - Estilo de Vida</h3>
                        <p className="text-[11px] text-gray-400 font-semibold">(Lazer, Hobbies & Compras)</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 items-start pt-1">
                        <div>
                          <span className="text-[10px] text-gray-400 font-black uppercase">Atual</span>
                          <p className="text-xl font-black font-serif text-white">{lifestyleStats.pct.toFixed(1).replace('.', ',')}%</p>
                          <p className="text-xs font-bold text-gray-200">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pillarMap.lifestyle.total)}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 font-black uppercase">Desejado</span>
                          <p className="text-lg font-black font-serif text-gray-300">30%</p>
                        </div>
                      </div>
                      <div className="w-full bg-white/15 rounded-full h-2.5 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${lifestyleStats.isOver ? 'bg-[#FF5252]' : 'bg-[#00E676]'}`} style={{ width: `${Math.min(100, (lifestyleStats.pct / 30) * 100)}%` }} />
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-white/10">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Categorias:</span>
                        {pillarLifestyleItems.length === 0 ? (
                          <p className="text-[11px] text-gray-500 italic">Nenhuma despesa nesta categoria</p>
                        ) : (
                          pillarLifestyleItems.map((it, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="text-gray-300 font-medium">{it.category}</span>
                              <span className="font-bold text-[#D4AF37]">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(it.total)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Pillar 3: 20% Investimentos */}
                    <div className={`p-4 sm:p-5 rounded-2xl border transition space-y-3 bg-[#18181B] ${investmentStats.isOver ? 'border-[#FF5252]/40' : 'border-[#00E676]/40'}`}>
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <span className={`text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded-full uppercase ${investmentStats.isOver ? 'bg-[#FF5252] text-white' : 'bg-[#00E676] text-[#121212]'}`}>
                          {investmentStats.isOver ? 'Excedido' : 'Dentro do Limite'}
                        </span>
                        <span className="w-3 h-3 rounded-full bg-[#00E676]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase font-serif text-white">20% - Investimentos</h3>
                        <p className="text-[11px] text-gray-400 font-semibold">(Aportes, Poupança & Futuro)</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 items-start pt-1">
                        <div>
                          <span className="text-[10px] text-gray-400 font-black uppercase">Atual</span>
                          <p className="text-xl font-black font-serif text-white">{investmentStats.pct.toFixed(1).replace('.', ',')}%</p>
                          <p className="text-xs font-bold text-gray-200">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pillarMap.investment.total)}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 font-black uppercase">Desejado</span>
                          <p className="text-lg font-black font-serif text-gray-300">20%</p>
                        </div>
                      </div>
                      <div className="w-full bg-white/15 rounded-full h-2.5 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${investmentStats.isOver ? 'bg-[#FF5252]' : 'bg-[#00E676]'}`} style={{ width: `${Math.min(100, (investmentStats.pct / 20) * 100)}%` }} />
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-white/10">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Categorias:</span>
                        {pillarInvestmentItems.length === 0 ? (
                          <p className="text-[11px] text-gray-500 italic">Nenhuma despesa nesta categoria</p>
                        ) : (
                          pillarInvestmentItems.map((it, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="text-gray-300 font-medium">{it.category}</span>
                              <span className="font-bold text-[#D4AF37]">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(it.total)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Top Ativos e Investimentos Alocados (Separate Card) */}
            <div className="bg-[#161616] border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white font-serif">Top Ativos e Investimentos Alocados</h2>
                  <p className="text-xs text-gray-400">Distribuição e percentual dos investimentos da base</p>
                </div>
              </div>

              <div>
                {(!filteredTopInvestments || filteredTopInvestments.length === 0) ? (
                  <p className="text-xs text-gray-500">Nenhum investimento registrado na base ainda.</p>
                ) : (
                  <div className="space-y-3">
                    {filteredTopInvestments.map((item: any, idx: number) => {
                      const totalInv = filteredTopInvestments.reduce((acc: number, i: any) => acc + (i.total || 0), 0) || 1;
                      const pct = Math.round(((item.total || 0) / totalInv) * 100);
                      return (
                        <div key={idx} className="p-3.5 bg-[#1f1f1f] border border-gray-800 rounded-2xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white uppercase">{item.type}</span>
                            <div className="text-right">
                              <span className="text-xs font-extrabold text-emerald-400">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.total)}
                              </span>
                              <span className="text-[11px] text-gray-400 ml-2">({pct}% do total)</span>
                            </div>
                          </div>
                          <div className="w-full bg-[#222] h-2.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 6)}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Broadcast Announcement / In-App Notification Module */}
          <div className="bg-[#161616] border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
              <div className="p-3 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-2xl text-[#D4AF37]">
                <Send className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white font-serif">Disparar Comunicado In-App / Broadcast</h2>
                <p className="text-xs text-gray-400">Envie mensagens, avisos ou parabéns que aparecerão como notificação no app de todos os usuários.</p>
              </div>
            </div>

            {sendSuccess && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{sendSuccess}</span>
              </div>
            )}

            <form onSubmit={(e) => handleSendAnnouncement(e)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Título da Mensagem</label>
                  <input
                    type="text"
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    placeholder="Ex: 📢 Novidade Importante na Plataforma"
                    required
                    className="w-full px-4 py-3 bg-[#222] border border-gray-700 rounded-xl text-white text-xs focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div className="space-y-1 relative">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Destinatário Específico (Opcional)</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={targetEmail}
                      onChange={(e) => {
                        setTargetEmail(e.target.value);
                        setUserSearchQuery(e.target.value);
                        setIsUserDropdownOpen(true);
                      }}
                      onFocus={() => setIsUserDropdownOpen(true)}
                      placeholder="Deixe em branco para enviar a TODOS ou pesquise..."
                      className="w-full px-4 py-3 bg-[#222] border border-gray-700 rounded-xl text-white text-xs focus:outline-none focus:border-[#D4AF37]"
                    />
                    {targetEmail && (
                      <button
                        type="button"
                        onClick={() => { setTargetEmail(''); setUserSearchQuery(''); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Searchable Dropdown List */}
                  {isUserDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-[#1a1a1a] border border-gray-700 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto">
                      <div
                        onClick={() => {
                          setTargetEmail('');
                          setUserSearchQuery('');
                          setIsUserDropdownOpen(false);
                        }}
                        className="px-4 py-2.5 hover:bg-[#2a2a2a] cursor-pointer border-b border-gray-800 text-xs font-bold text-[#D4AF37] flex items-center justify-between"
                      >
                        <span>📢 Enviar para TODOS (Broadcast)</span>
                      </div>
                      {(() => {
                        const registeredUsers = allUsersDocs
                          .map(doc => {
                            const email = (doc.userId || doc.email || '').trim().toLowerCase();
                            const name = doc.name || email.split('@')[0];
                            return { email, name };
                          })
                          .filter(u => u.email && u.email !== 'suporte.dinheirosemfiltro@gmail.com');

                        const filteredUsers = registeredUsers.filter(u => 
                          u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                          u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                        );

                        if (filteredUsers.length === 0) {
                          return <div className="px-4 py-3 text-xs text-gray-500 text-center">Nenhum usuário encontrado</div>;
                        }

                        return filteredUsers.map((u, i) => (
                          <div
                            key={i}
                            onClick={() => {
                              setTargetEmail(u.email);
                              setUserSearchQuery(u.name);
                              setIsUserDropdownOpen(false);
                            }}
                            className="px-4 py-2.5 hover:bg-[#2a2a2a] cursor-pointer border-b border-gray-800/50 last:border-0 flex items-center justify-between text-xs"
                          >
                            <span className="font-bold text-white">{u.name}</span>
                            <span className="text-gray-400 text-[11px]">{u.email}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mensagem Detalhada</label>
                <textarea
                  value={annMessage}
                  onChange={(e) => setAnnMessage(e.target.value)}
                  placeholder="Escreva aqui o conteúdo da mensagem que aparecerá para os usuários..."
                  rows={4}
                  required
                  className="w-full px-4 py-3 bg-[#222] border border-gray-700 rounded-xl text-white text-xs focus:outline-none focus:border-[#D4AF37] resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Link / URL (Opcional - Exibe botão "SAIBA MAIS")</label>
                <input
                  type="url"
                  value={annLink}
                  onChange={(e) => setAnnLink(e.target.value)}
                  placeholder="https://exemplo.com.br ou https://..."
                  className="w-full px-4 py-3 bg-[#222] border border-gray-700 rounded-xl text-white text-xs focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={sending}
                  className="px-6 py-3 bg-[#D4AF37] hover:bg-[#c29f31] text-[#121212] font-black rounded-2xl text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg"
                >
                  <Send className={`w-4 h-4 ${sending ? 'animate-pulse' : ''}`} />
                  <span>{sending ? 'Enviando...' : 'Disparar Notificação'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    })()}
      <CustomAlertModal
        isOpen={Boolean(alertInfo?.isOpen)}
        title={alertInfo?.title}
        message={alertInfo?.message || ''}
        type={alertInfo?.type || 'info'}
        onClose={() => setAlertInfo(null)}
      />
    </div>
  );
};
