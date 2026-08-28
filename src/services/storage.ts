import { Account, Category, Goal, Transaction, User, FamilyMember, SharedBudget, BudgetCollaborator, BudgetNotification, EmailLog } from '../types';
import { PortfolioStorageService } from './portfolioStorage';
import {
  db,
  auth,
  isDeviceOnline,
  migrateLocalDataToFirestore,
  fetchUserDataFromFirestore,
  saveUserDataToFirestore,
  pushUserToFirestore,
  deleteUserFromFirestore,
  pushTransactionToFirestore,
  deleteTransactionFromFirestore,
  pushAccountToFirestore,
  deleteAccountFromFirestore,
  pushCategoryToFirestore,
  deleteCategoryFromFirestore,
  pushGoalToFirestore,
  deleteGoalFromFirestore,
  pushFamilyMemberToFirestore,
  deleteFamilyMemberFromFirestore,
  pushSharedBudgetToFirestore,
} from '../lib/firebase';
import {
  fetchUserDataFromAppwrite,
  syncUserDataWithAppwrite,
  createAppwriteTransaction,
  updateAppwriteTransaction,
  deleteAppwriteTransaction,
  getCanonicalAppwriteDocId,
  fetchTransactionsFromAppwrite,
  checkAndMigrateOrFetchUserFinancials,
  findUserAccount,
} from '../lib/appwriteSync';
import { getAppwriteUser, appwriteDatabases, getAppwriteConfig } from '../lib/appwrite';
import { Permission, Role, ID } from 'appwrite';

export interface InMemoryFinancialStore {
  currentUser: User | null;
  users: User[];
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  goals: Goal[];
  familyMembers: FamilyMember[];
  sharedBudgets: SharedBudget[];
  notifications: BudgetNotification[];
  emailLogs: EmailLog[];
  deletedIds: Record<string, Set<string>>;
  privacyMode: boolean;
  initialized: boolean;
}

export const _inMemoryStore: InMemoryFinancialStore = {
  currentUser: null,
  users: [],
  accounts: [],
  categories: [],
  transactions: [],
  goals: [],
  familyMembers: [],
  sharedBudgets: [],
  notifications: [],
  emailLogs: [],
  deletedIds: {},
  privacyMode: false,
  initialized: false,
};

const STORAGE_KEYS = {
  CURRENT_USER: 'darla_current_user',
  USERS: 'darla_users',
  ACCOUNTS: 'darla_accounts',
  CATEGORIES: 'darla_categories',
  TRANSACTIONS: 'darla_transactions',
  GOALS: 'darla_goals',
  FAMILY_MEMBERS: 'darla_family_members',
  BUDGET_GOALS: 'darla_budget_goals',
  SHARED_BUDGETS: 'darla_shared_budgets',
  NOTIFICATIONS: 'darla_notifications',
  EMAIL_LOGS: 'darla_email_logs',
  PRIVACY_MODE: 'darla_privacy_mode',
  DELETED_IDS: 'darla_deleted_ids',
};

// Initial Demo User
export const DEMO_USER: User = {
  id: 'user_darla_semfiltro_gmail_com',
  name: 'Darla Sem Filtro',
  email: 'darla.semfiltro@gmail.com',
  avatarUrl: '',
  createdAt: new Date().toISOString(),
  isPro: true,
  plan: 'lifetime',
  subscriptionStatus: 'active',
};

export function isDarlaAccount(idOrEmail: string): boolean {
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

export function normalizeUserEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

export function isEmailMatch(email1?: string, email2?: string): boolean {
  const a = (email1 || '').trim().toLowerCase();
  const b = (email2 || '').trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  return normalizeUserEmail(a) === normalizeUserEmail(b);
}

export function getCanonicalUserId(idOrEmail: string): string {
  if (!idOrEmail) return 'default';
  const clean = idOrEmail.toLowerCase().trim();
  if (clean.includes('@')) {
    return clean;
  }

  // Specific alias mappings for known accounts
  if (
    clean === 'user_carvalho_darlla_gmail_com' ||
    clean === 'user_carvalho.darlla.gmail.com' ||
    clean === 'user_carvalho.darlla_gmail_com' ||
    clean === 'user_carvalhodarlla_gmail_com' ||
    clean === 'carvalhodarlla@gmail.com' ||
    clean === 'darlla-5921' ||
    clean === 'darlla-8704'
  ) {
    return 'carvalho.darlla@gmail.com';
  }

  if (
    clean === 'user_darla_semfiltro_gmail_com' ||
    clean === 'user_darla.semfiltro.gmail.com' ||
    clean === 'user_darla.semfiltro_gmail_com' ||
    clean === 'user_darlasemfiltro_gmail_com' ||
    clean === 'darlasemfiltro@gmail.com'
  ) {
    return 'darla.semfiltro@gmail.com';
  }

  if (
    clean === 'user_danilujb_gmail_com' ||
    clean === 'user_danilujb.gmail.com' ||
    clean === 'user_danilujb_gmail.com'
  ) {
    return 'danilujb@gmail.com';
  }

  if (clean.startsWith('user_')) {
    const unprefix = clean.slice(5);
    if (unprefix.endsWith('.gmail.com') || unprefix.endsWith('_gmail_com') || unprefix.endsWith('_gmail.com')) {
      const local = unprefix.replace(/(\.|\_)gmail(\.|\_)com$/, '').replace(/_/g, '.');
      return `${local}@gmail.com`;
    }
    if (unprefix.endsWith('.com.br') || unprefix.endsWith('_com_br')) {
      const withoutExt = unprefix.replace(/(\.|\_)com(\.|\_)br$/, '');
      const parts = withoutExt.split(/[._]/);
      const domain = parts.pop();
      const local = parts.join('.');
      return `${local}@${domain}.com.br`;
    }
    if (unprefix.endsWith('.com') || unprefix.endsWith('_com')) {
      const withoutExt = unprefix.replace(/(\.|\_)com$/, '');
      const parts = withoutExt.split(/[._]/);
      const domain = parts.pop();
      const local = parts.join('.');
      return `${local}@${domain}.com`;
    }
    if (unprefix.includes('.')) {
      const parts = unprefix.split('.');
      if (parts.length >= 2) {
        const domain = parts.pop();
        const local = parts.join('.');
        return `${local}@${domain}`;
      }
    }
  }

  return clean;
}

export function getDeterministicBudgetCode(email: string, name?: string): string {
  const clean = (email || '').trim().toLowerCase();
  const safe = clean.replace(/[^a-z0-9]/gi, '_');
  return `budget_${safe}`;
}

export function getUserIdForEmail(email: string): string {
  const clean = (email || '').trim().toLowerCase();
  if (!clean) return 'user_guest';
  if (
    clean === 'demo@dinheirosemfiltro.com' ||
    clean === 'demo@exemplo.com' ||
    clean === 'demo@exemplo.com.br' ||
    clean === 'titular@exemplo.com'
  ) {
    return DEMO_USER.id;
  }
  return getCanonicalUserId(clean);
}

// Seed Categories (Structured by 50 / 30 / 20 Rule & Income)
export const SEED_CATEGORIES: Category[] = [
  // --- 50% NECESSIDADES BÁSICAS & ESSENCIAIS ---
  {
    id: 'cat_moradia',
    userId: DEMO_USER.id,
    name: 'Moradia',
    type: 'expense',
    ruleGroup: '50_essentials',
    color: '#E11D48', // Rose
    icon: 'Home',
    subcategories: [
      { id: 'sub_aluguel', categoryId: 'cat_moradia', name: 'Aluguel / Financiamento' },
      { id: 'sub_condominio', categoryId: 'cat_moradia', name: 'Condomínio' },
      { id: 'sub_luz', categoryId: 'cat_moradia', name: 'Energia Elétrica' },
      { id: 'sub_agua', categoryId: 'cat_moradia', name: 'Água & Gás' },
      { id: 'sub_internet', categoryId: 'cat_moradia', name: 'Internet & TV' },
      { id: 'sub_manutencao_casa', categoryId: 'cat_moradia', name: 'Manutenção Residencial' },
    ],
  },
  {
    id: 'cat_alimentacao',
    userId: DEMO_USER.id,
    name: 'Alimentação & Feira',
    type: 'expense',
    ruleGroup: '50_essentials',
    color: '#F43F5E',
    icon: 'Utensils',
    subcategories: [
      { id: 'sub_mercado', categoryId: 'cat_alimentacao', name: 'Supermercado' },
      { id: 'sub_hortifruti', categoryId: 'cat_alimentacao', name: 'Açougue & Hortifrúti' },
      { id: 'sub_padaria', categoryId: 'cat_alimentacao', name: 'Feira Livre & Padaria' },
    ],
  },
  {
    id: 'cat_saude',
    userId: DEMO_USER.id,
    name: 'Saúde & Remédios',
    type: 'expense',
    ruleGroup: '50_essentials',
    color: '#EC4899',
    icon: 'HeartHandshake',
    subcategories: [
      { id: 'sub_plano', categoryId: 'cat_saude', name: 'Plano de Saúde' },
      { id: 'sub_farmacia', categoryId: 'cat_saude', name: 'Farmácia & Remédios' },
      { id: 'sub_consultas', categoryId: 'cat_saude', name: 'Consultas & Exames' },
      { id: 'sub_dentista', categoryId: 'cat_saude', name: 'Dentista' },
    ],
  },
  {
    id: 'cat_transporte',
    userId: DEMO_USER.id,
    name: 'Transporte Essencial',
    type: 'expense',
    ruleGroup: '50_essentials',
    color: '#D97706',
    icon: 'Car',
    subcategories: [
      { id: 'sub_combustivel', categoryId: 'cat_transporte', name: 'Combustível' },
      { id: 'sub_uber', categoryId: 'cat_transporte', name: 'Transporte Público & Uber' },
      { id: 'sub_manutencao', categoryId: 'cat_transporte', name: 'Manutenção Veicular / IPVA' },
    ],
  },
  {
    id: 'cat_educacao',
    userId: DEMO_USER.id,
    name: 'Educação & Contas Básicas',
    type: 'expense',
    ruleGroup: '50_essentials',
    color: '#2563EB',
    icon: 'BookOpen',
    subcategories: [
      { id: 'sub_escola', categoryId: 'cat_educacao', name: 'Escola / Faculdade' },
      { id: 'sub_cursos', categoryId: 'cat_educacao', name: 'Cursos & Treinamentos' },
      { id: 'sub_material', categoryId: 'cat_educacao', name: 'Material Escolar & Livros' },
    ],
  },

  // --- 30% ESTILO DE VIDA & DESEJOS ---
  {
    id: 'cat_lazer',
    userId: DEMO_USER.id,
    name: 'Lazer & Gastronomia',
    type: 'expense',
    ruleGroup: '30_lifestyle',
    color: '#8B5CF6',
    icon: 'Sparkles',
    subcategories: [
      { id: 'sub_restaurante', categoryId: 'cat_lazer', name: 'Restaurante & Cafés' },
      { id: 'sub_delivery', categoryId: 'cat_lazer', name: 'iFood & Delivery' },
      { id: 'sub_cinema', categoryId: 'cat_lazer', name: 'Cinema & Bares' },
      { id: 'sub_viagens', categoryId: 'cat_lazer', name: 'Viagens & Passeios' },
    ],
  },
  {
    id: 'cat_estetica',
    userId: DEMO_USER.id,
    name: 'Cuidados Pessoais & Estética',
    type: 'expense',
    ruleGroup: '30_lifestyle',
    color: '#C084FC',
    icon: 'Smile',
    subcategories: [
      { id: 'sub_salao', categoryId: 'cat_estetica', name: 'Salão, Barbearia & Estética' },
      { id: 'sub_skincare', categoryId: 'cat_estetica', name: 'Cosméticos & Skincare' },
      { id: 'sub_academia', categoryId: 'cat_estetica', name: 'Academia & Esportes' },
    ],
  },
  {
    id: 'cat_compras',
    userId: DEMO_USER.id,
    name: 'Vestuário & Compras',
    type: 'expense',
    ruleGroup: '30_lifestyle',
    color: '#F59E0B',
    icon: 'ShoppingBag',
    subcategories: [
      { id: 'sub_roupas', categoryId: 'cat_compras', name: 'Roupas & Calçados' },
      { id: 'sub_eletronicos', categoryId: 'cat_compras', name: 'Eletrônicos & Acessórios' },
      { id: 'sub_presentes', categoryId: 'cat_compras', name: 'Presentes & Mimos' },
    ],
  },
  {
    id: 'cat_assinaturas',
    userId: DEMO_USER.id,
    name: 'Assinaturas & Hobbies',
    type: 'expense',
    ruleGroup: '30_lifestyle',
    color: '#6366F1',
    icon: 'Tv',
    subcategories: [
      { id: 'sub_streaming', categoryId: 'cat_assinaturas', name: 'Streaming (Netflix, Spotify, Prime)' },
      { id: 'sub_hobbies', categoryId: 'cat_assinaturas', name: 'Jogos & Hobbies' },
    ],
  },

  // --- 20% RESERVA & FUTURO / INVESTIMENTOS ---
  {
    id: 'cat_reserva',
    userId: DEMO_USER.id,
    name: 'Reserva de Emergência',
    type: 'expense',
    ruleGroup: '20_investment',
    color: '#059669',
    icon: 'ShieldCheck',
    subcategories: [
      { id: 'sub_tesouro_selic', categoryId: 'cat_reserva', name: 'Tesouro SELIC' },
      { id: 'sub_cdb_liquidez', categoryId: 'cat_reserva', name: 'CDB Liquidez Diária' },
      { id: 'sub_poupanca', categoryId: 'cat_reserva', name: 'Reserva em Poupança' },
    ],
  },
  {
    id: 'cat_investimentos',
    userId: DEMO_USER.id,
    name: 'Investimentos & Futuro',
    type: 'expense',
    ruleGroup: '20_investment',
    color: '#10B981',
    icon: 'TrendingUp',
    subcategories: [
      { id: 'sub_acoes_fiis', categoryId: 'cat_investimentos', name: 'Ações & FIIs' },
      { id: 'sub_tesouro_ipca', categoryId: 'cat_investimentos', name: 'Tesouro Direto / IPCA+' },
      { id: 'sub_previdencia', categoryId: 'cat_investimentos', name: 'Previdência Privada' },
      { id: 'sub_sonhos', categoryId: 'cat_investimentos', name: 'Aporte para Objetivos & Sonhos' },
    ],
  },

  // --- RECEITAS (ENTRADAS) ---
  {
    id: 'cat_renda',
    userId: DEMO_USER.id,
    name: 'Receita Principal',
    type: 'income',
    ruleGroup: 'income',
    color: '#00C853',
    icon: 'Wallet',
    subcategories: [
      { id: 'sub_salario', categoryId: 'cat_renda', name: 'Salário / Prolabore' },
      { id: 'sub_beneficios', categoryId: 'cat_renda', name: 'Benefícios (VR / VA / VT)' },
      { id: 'sub_ferias', categoryId: 'cat_renda', name: '13º Salário & Férias' },
    ],
  },
  {
    id: 'cat_renda_extra',
    userId: DEMO_USER.id,
    name: 'Renda Extra & Negócios',
    type: 'income',
    ruleGroup: 'income',
    color: '#2563EB',
    icon: 'DollarSign',
    subcategories: [
      { id: 'sub_freelance', categoryId: 'cat_renda_extra', name: 'Projetos & Freelance' },
      { id: 'sub_vendas', categoryId: 'cat_renda_extra', name: 'Vendas & Comissões' },
      { id: 'sub_consultoria', categoryId: 'cat_renda_extra', name: 'Consultoria & Aulas' },
    ],
  },
  {
    id: 'cat_rendimentos',
    userId: DEMO_USER.id,
    name: 'Rendimentos & Outros',
    type: 'income',
    ruleGroup: 'income',
    color: '#8B5CF6',
    icon: 'PiggyBank',
    subcategories: [
      { id: 'sub_dividendos', categoryId: 'cat_rendimentos', name: 'Dividendos & Juros de Investimentos' },
      { id: 'sub_reembolso', categoryId: 'cat_rendimentos', name: 'Reembolsos & Cashbacks' },
      { id: 'sub_presente', categoryId: 'cat_rendimentos', name: 'Prêmios & Presentes' },
    ],
  },
];

// Seed Accounts
const SEED_ACCOUNTS: Account[] = [
  {
    id: 'acc_itau',
    userId: DEMO_USER.id,
    name: 'Conta Corrente Principal',
    type: 'checking',
    initialBalance: 4500.0,
    color: '#E11D48',
    icon: 'Building2',
    isDefault: true,
  },
  {
    id: 'acc_cartao',
    userId: DEMO_USER.id,
    name: 'Cartão Rose Gold (Crédito)',
    type: 'credit',
    initialBalance: 0.0,
    color: '#9F1239',
    icon: 'CreditCard',
  },
  {
    id: 'acc_reserva',
    userId: DEMO_USER.id,
    name: 'Reserva & Investimentos',
    type: 'savings',
    initialBalance: 18500.0,
    color: '#059669',
    icon: 'PiggyBank',
  },
  {
    id: 'acc_carteira',
    userId: DEMO_USER.id,
    name: 'Carteira (Dinheiro)',
    type: 'cash',
    initialBalance: 350.0,
    color: '#D97706',
    icon: 'Wallet',
  },
];

// Seed Goals
const SEED_GOALS: Goal[] = [
  {
    id: 'goal_paris',
    userId: DEMO_USER.id,
    title: 'EuroTrip: Paris & Roma',
    targetAmount: 25000.0,
    currentAmount: 16500.0,
    targetDate: '2026-11-15',
    category: 'Viagem',
    color: '#E11D48',
    icon: 'Plane',
    notes: 'Ingressos para o Louvre e hospedagem em Montmartre',
  },
  {
    id: 'goal_reserva',
    userId: DEMO_USER.id,
    title: 'Reserva de Emergência 6M',
    targetAmount: 30000.0,
    currentAmount: 22800.0,
    targetDate: '2026-12-31',
    category: 'Segurança',
    color: '#059669',
    icon: 'ShieldCheck',
    notes: 'Meta para cobrir 6 meses de custo fixo com tranquilidade',
  },
  {
    id: 'goal_carro',
    userId: DEMO_USER.id,
    title: 'Novo Carro Elétrico',
    targetAmount: 85000.0,
    currentAmount: 34000.0,
    targetDate: '2027-06-30',
    category: 'Bens',
    color: '#9F1239',
    icon: 'Car',
    notes: 'Entrada reforçada para parcelamento sem juros',
  },
];

// Helper to format YYYY-MM-DD for current / prev / next months
function getRelativeDate(monthOffset: number, day: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, day);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const dayStr = String(Math.min(day, 28)).padStart(2, '0');
  return `${year}-${month}-${dayStr}`;
}

// Seed Transactions
const SEED_TRANSACTIONS: Transaction[] = [
  // --- PREVIOUS MONTH (Rolls over to current) ---
  {
    id: 'tx_prev_salario',
    userId: DEMO_USER.id,
    accountId: 'acc_itau',
    type: 'income',
    amount: 9800.0,
    date: getRelativeDate(-1, 5),
    description: 'Salário Mensal - DARLA Sem Filtro',
    categoryId: 'cat_renda',
    subcategoryId: 'sub_salario',
    isConsolidated: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tx_prev_freelance',
    userId: DEMO_USER.id,
    accountId: 'acc_itau',
    type: 'income',
    amount: 2400.0,
    date: getRelativeDate(-1, 12),
    description: 'Consultoria de Estratégia de Marca',
    categoryId: 'cat_renda',
    subcategoryId: 'sub_freelance',
    isConsolidated: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tx_prev_aluguel',
    userId: DEMO_USER.id,
    accountId: 'acc_itau',
    type: 'expense',
    amount: 3200.0,
    date: getRelativeDate(-1, 10),
    description: 'Aluguel do Apê',
    categoryId: 'cat_moradia',
    subcategoryId: 'sub_aluguel',
    isConsolidated: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tx_prev_mercado',
    userId: DEMO_USER.id,
    accountId: 'acc_itau',
    type: 'expense',
    amount: 1420.5,
    date: getRelativeDate(-1, 15),
    description: 'Feira & Mercado Mensal',
    categoryId: 'cat_alimentacao',
    subcategoryId: 'sub_mercado',
    isConsolidated: true,
    createdAt: new Date().toISOString(),
  },

  // --- CURRENT MONTH ---
  {
    id: 'tx_curr_salario',
    userId: DEMO_USER.id,
    accountId: 'acc_itau',
    type: 'income',
    amount: 9800.0,
    date: getRelativeDate(0, 5),
    description: 'Salário Mensal - DARLA Sem Filtro',
    categoryId: 'cat_renda',
    subcategoryId: 'sub_salario',
    isConsolidated: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tx_curr_freelance',
    userId: DEMO_USER.id,
    accountId: 'acc_itau',
    type: 'income',
    amount: 3500.0,
    date: getRelativeDate(0, 18),
    description: 'Mentoria Pessoal & Projeto Especial',
    categoryId: 'cat_renda',
    subcategoryId: 'sub_freelance',
    isConsolidated: false, // Prevista
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tx_curr_aluguel',
    userId: DEMO_USER.id,
    accountId: 'acc_itau',
    type: 'expense',
    amount: 3200.0,
    date: getRelativeDate(0, 10),
    description: 'Aluguel & Condomínio',
    categoryId: 'cat_moradia',
    subcategoryId: 'sub_aluguel',
    isConsolidated: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tx_curr_luz',
    userId: DEMO_USER.id,
    accountId: 'acc_itau',
    type: 'expense',
    amount: 285.4,
    date: getRelativeDate(0, 14),
    description: 'Conta de Luz Enel',
    categoryId: 'cat_moradia',
    subcategoryId: 'sub_luz',
    isConsolidated: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tx_curr_mercado1',
    userId: DEMO_USER.id,
    accountId: 'acc_cartao',
    type: 'expense',
    amount: 860.2,
    date: getRelativeDate(0, 8),
    description: 'Compras Pão de Açúcar',
    categoryId: 'cat_alimentacao',
    subcategoryId: 'sub_mercado',
    isConsolidated: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tx_curr_restaurante',
    userId: DEMO_USER.id,
    accountId: 'acc_cartao',
    type: 'expense',
    amount: 340.0,
    date: getRelativeDate(0, 16),
    description: 'Jantar de Negócios & Mimos',
    categoryId: 'cat_alimentacao',
    subcategoryId: 'sub_restaurante',
    isConsolidated: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tx_curr_combustivel',
    userId: DEMO_USER.id,
    accountId: 'acc_cartao',
    type: 'expense',
    amount: 260.0,
    date: getRelativeDate(0, 12),
    description: 'Posto Shell - Tanque Cheio',
    categoryId: 'cat_transporte',
    subcategoryId: 'sub_combustivel',
    isConsolidated: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tx_curr_estetica',
    userId: DEMO_USER.id,
    accountId: 'acc_cartao',
    type: 'expense',
    amount: 450.0,
    date: getRelativeDate(0, 20),
    description: 'Salão de Beleza & Cuidados Rose',
    categoryId: 'cat_saude',
    subcategoryId: 'sub_estetica',
    isConsolidated: false, // Prevista
    createdAt: new Date().toISOString(),
  },

  // --- INSTALLMENTS (MacBook em 10x - Parcelado!) ---
  {
    id: 'tx_inst_1',
    userId: DEMO_USER.id,
    accountId: 'acc_cartao',
    type: 'expense',
    amount: 850.0,
    date: getRelativeDate(0, 22),
    description: 'MacBook M3 Rose Gold [1/10]',
    categoryId: 'cat_lazer',
    subcategoryId: 'sub_compras',
    isConsolidated: true,
    installmentIndex: 1,
    installmentTotal: 10,
    parentInstallmentId: 'inst_macbook_demo',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tx_inst_2',
    userId: DEMO_USER.id,
    accountId: 'acc_cartao',
    type: 'expense',
    amount: 850.0,
    date: getRelativeDate(1, 22),
    description: 'MacBook M3 Rose Gold [2/10]',
    categoryId: 'cat_lazer',
    subcategoryId: 'sub_compras',
    isConsolidated: false,
    installmentIndex: 2,
    installmentTotal: 10,
    parentInstallmentId: 'inst_macbook_demo',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tx_inst_3',
    userId: DEMO_USER.id,
    accountId: 'acc_cartao',
    type: 'expense',
    amount: 850.0,
    date: getRelativeDate(2, 22),
    description: 'MacBook M3 Rose Gold [3/10]',
    categoryId: 'cat_lazer',
    subcategoryId: 'sub_compras',
    isConsolidated: false,
    installmentIndex: 3,
    installmentTotal: 10,
    parentInstallmentId: 'inst_macbook_demo',
    createdAt: new Date().toISOString(),
  },

  // --- NEXT MONTH FUTURE PROJECTIONS ---
  {
    id: 'tx_next_salario',
    userId: DEMO_USER.id,
    accountId: 'acc_itau',
    type: 'income',
    amount: 9800.0,
    date: getRelativeDate(1, 5),
    description: 'Salário Mensal - DARLA Sem Filtro',
    categoryId: 'cat_renda',
    subcategoryId: 'sub_salario',
    isConsolidated: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tx_next_aluguel',
    userId: DEMO_USER.id,
    accountId: 'acc_itau',
    type: 'expense',
    amount: 3200.0,
    date: getRelativeDate(1, 10),
    description: 'Aluguel & Condomínio',
    categoryId: 'cat_moradia',
    subcategoryId: 'sub_aluguel',
    isConsolidated: false,
    createdAt: new Date().toISOString(),
  },
];

const SEED_FAMILY_MEMBERS: FamilyMember[] = [
  { id: 'fam_darla', userId: DEMO_USER.id, name: 'Darla (Titular)', relationship: 'Titular', color: '#E11D48' },
  { id: 'fam_conjuge', userId: DEMO_USER.id, name: 'Cônjuge / Marido', relationship: 'Cônjuge', color: '#0284C7' },
  { id: 'fam_filhos', userId: DEMO_USER.id, name: 'Filho(a) / Crianças', relationship: 'Dependente', color: '#10B981' },
  { id: 'fam_geral', userId: DEMO_USER.id, name: 'Geral / Casa & Família', relationship: 'Compartilhado', color: '#8B5CF6' },
];

export class StorageService {
  static isCloudSynced: boolean = false;

  static hydrateInMemoryStore() {
    try {
      const rawUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (rawUser) {
        try {
          _inMemoryStore.currentUser = JSON.parse(rawUser);
          StorageService.isCloudSynced = true;
        } catch (e) {}
      }

      const rawUsers = localStorage.getItem(STORAGE_KEYS.USERS);
      if (rawUsers) {
        try {
          const parsed = JSON.parse(rawUsers);
          if (Array.isArray(parsed)) _inMemoryStore.users = parsed;
        } catch (e) {}
      }

      const rawAccs = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
      if (rawAccs) {
        try {
          const parsed = JSON.parse(rawAccs);
          if (Array.isArray(parsed)) _inMemoryStore.accounts = parsed;
        } catch (e) {}
      }

      const rawCats = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (rawCats) {
        try {
          const parsed = JSON.parse(rawCats);
          if (Array.isArray(parsed)) _inMemoryStore.categories = parsed;
        } catch (e) {}
      }

      const rawTxs = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (rawTxs) {
        try {
          const parsed = JSON.parse(rawTxs);
          if (Array.isArray(parsed)) _inMemoryStore.transactions = parsed;
        } catch (e) {}
      }

      const rawGoals = localStorage.getItem(STORAGE_KEYS.GOALS);
      if (rawGoals) {
        try {
          const parsed = JSON.parse(rawGoals);
          if (Array.isArray(parsed)) _inMemoryStore.goals = parsed;
        } catch (e) {}
      }

      const rawFam = localStorage.getItem(STORAGE_KEYS.FAMILY_MEMBERS);
      if (rawFam) {
        try {
          const parsed = JSON.parse(rawFam);
          if (Array.isArray(parsed)) _inMemoryStore.familyMembers = parsed;
        } catch (e) {}
      }

      const rawShared = localStorage.getItem(STORAGE_KEYS.SHARED_BUDGETS);
      if (rawShared) {
        try {
          const parsed = JSON.parse(rawShared);
          if (Array.isArray(parsed)) _inMemoryStore.sharedBudgets = parsed;
        } catch (e) {}
      }

      const rawNotifs = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (rawNotifs) {
        try {
          const parsed = JSON.parse(rawNotifs);
          if (Array.isArray(parsed)) _inMemoryStore.notifications = parsed;
        } catch (e) {}
      }

      _inMemoryStore.privacyMode = localStorage.getItem(STORAGE_KEYS.PRIVACY_MODE) === 'true';
      _inMemoryStore.initialized = true;
    } catch (err) {
      console.warn('[StorageService Hydrate Error]', err);
    }
  }

  private static initialize() {
    let newlyInitialized = false;
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([]));
      newlyInitialized = true;
    }
    if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES)) {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify([]));
      newlyInitialized = true;
    }
    if (!localStorage.getItem(STORAGE_KEYS.ACCOUNTS)) {
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify([]));
      newlyInitialized = true;
    }
    if (!localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)) {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
      newlyInitialized = true;
    }
    if (!localStorage.getItem(STORAGE_KEYS.GOALS)) {
      localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify([]));
      newlyInitialized = true;
    }
    if (!localStorage.getItem(STORAGE_KEYS.FAMILY_MEMBERS)) {
      localStorage.setItem(STORAGE_KEYS.FAMILY_MEMBERS, JSON.stringify([]));
      newlyInitialized = true;
    }

    // Always hydrate the in-memory store from localStorage
    this.hydrateInMemoryStore();

    // Deduplicate duplicate user profiles and shared budgets on initialization
    this.deduplicateUsers();
    this.deduplicateSharedBudgets();

    // Auto sync to Firebase in background
    if (newlyInitialized || !localStorage.getItem('darla_firebase_initial_migrated')) {
      localStorage.setItem('darla_firebase_initial_migrated', 'true');
      migrateLocalDataToFirestore().catch(() => {});
    }
  }

  /**
   * Deduplication and Account Unification Script
   * Identifies all emails with >1 profile, selects the original (oldest) account as primary user_id,
   * migrates all data/transactions/accounts/categories/goals/family/budgets/notifications/investments,
   * and completely removes secondary duplicate accounts from database and storage.
   */
  static deduplicateUsers(): {
    unifiedEmailCount: number;
    mergedAccountsCount: number;
    migratedRecordsCount: number;
    details: Array<{ email: string; primaryUserId: string; removedUserIds: string[] }>;
  } {
    const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
    let users: User[] = [];
    try {
      users = JSON.parse(usersStr);
    } catch (e) {
      users = [];
    }

    const emailMap: Record<string, User[]> = {};
    users.forEach((u) => {
      const email = (u.email || '').trim().toLowerCase();
      if (!email) return;
      if (!emailMap[email]) {
        emailMap[email] = [];
      }
      emailMap[email].push(u);
    });

    let unifiedEmailCount = 0;
    let mergedAccountsCount = 0;
    let migratedRecordsCount = 0;
    const details: Array<{ email: string; primaryUserId: string; removedUserIds: string[] }> = [];
    const removedUserIdsSet = new Set<string>();

    for (const [email, userGroup] of Object.entries(emailMap)) {
      const canonicalId = getUserIdForEmail(email);

      // Sort by creation date (earliest first), giving priority to DEMO_USER.id or earliest created
      userGroup.sort((a, b) => {
        if (a.id === DEMO_USER.id) return -1;
        if (b.id === DEMO_USER.id) return 1;
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeA - timeB;
      });

      const primaryUser = userGroup[0];
      const hasIdMismatch = primaryUser.id !== canonicalId && email !== 'demo@exemplo.com' && email !== 'demo@dinheirosemfiltro.com';
      const secondaryUsers = userGroup.slice(1);
      const secondaryUserIds = secondaryUsers.map((u) => u.id);

      if (hasIdMismatch && !secondaryUserIds.includes(primaryUser.id)) {
        secondaryUserIds.push(primaryUser.id);
      }

      if (userGroup.length > 1 || hasIdMismatch) {
        unifiedEmailCount++;
        primaryUser.id = canonicalId;
        primaryUser.email = email;

        secondaryUserIds.forEach((id) => {
          if (id !== canonicalId) {
            removedUserIdsSet.add(id);
          }
        });
        mergedAccountsCount += secondaryUserIds.length;

        details.push({
          email,
          primaryUserId: canonicalId,
          removedUserIds: secondaryUserIds.filter((id) => id !== canonicalId),
        });

        // 1. Migrate Transactions
        try {
          const txsStr = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS) || '[]';
          const txs: Transaction[] = JSON.parse(txsStr);
          let txMigrated = 0;
          const updatedTxs = txs.map((t) => {
            if (secondaryUserIds.includes(t.userId)) {
              txMigrated++;
              return { ...t, userId: canonicalId };
            }
            return t;
          });
          migratedRecordsCount += txMigrated;
          localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updatedTxs));
        } catch (e) {}

        // 2. Migrate Accounts
        try {
          const accsStr = localStorage.getItem(STORAGE_KEYS.ACCOUNTS) || '[]';
          const accs: Account[] = JSON.parse(accsStr);
          let accMigrated = 0;
          const updatedAccs = accs.map((a) => {
            if (secondaryUserIds.includes(a.userId)) {
              accMigrated++;
              return { ...a, userId: canonicalId };
            }
            return a;
          });
          migratedRecordsCount += accMigrated;
          localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updatedAccs));
        } catch (e) {}

        // 3. Migrate Categories
        try {
          const catsStr = localStorage.getItem(STORAGE_KEYS.CATEGORIES) || '[]';
          const cats: Category[] = JSON.parse(catsStr);
          let catMigrated = 0;
          const updatedCats = cats.map((c) => {
            if (secondaryUserIds.includes(c.userId)) {
              catMigrated++;
              return { ...c, userId: canonicalId };
            }
            return c;
          });
          migratedRecordsCount += catMigrated;
          localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(updatedCats));
        } catch (e) {}

        // 4. Migrate Goals
        try {
          const goalsStr = localStorage.getItem(STORAGE_KEYS.GOALS) || '[]';
          const goals: Goal[] = JSON.parse(goalsStr);
          let gMigrated = 0;
          const updatedGoals = goals.map((g) => {
            if (secondaryUserIds.includes(g.userId)) {
              gMigrated++;
              return { ...g, userId: canonicalId };
            }
            return g;
          });
          migratedRecordsCount += gMigrated;
          localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(updatedGoals));
        } catch (e) {}

        // 5. Migrate Family Members
        try {
          const famStr = localStorage.getItem(STORAGE_KEYS.FAMILY_MEMBERS) || '[]';
          const fam: FamilyMember[] = JSON.parse(famStr);
          let fMigrated = 0;
          const updatedFam = fam.map((f) => {
            if (secondaryUserIds.includes(f.userId)) {
              fMigrated++;
              return { ...f, userId: canonicalId };
            }
            return f;
          });
          migratedRecordsCount += fMigrated;
          localStorage.setItem(STORAGE_KEYS.FAMILY_MEMBERS, JSON.stringify(updatedFam));
        } catch (e) {}

        // 6. Migrate Shared Budgets
        try {
          const budgetStr = localStorage.getItem(STORAGE_KEYS.SHARED_BUDGETS) || '[]';
          const budgets: SharedBudget[] = JSON.parse(budgetStr);
          const updatedBudgets = budgets.map((b) => {
            if (secondaryUserIds.includes(b.ownerId)) {
              return { ...b, ownerId: canonicalId, budgetId: canonicalId };
            }
            return b;
          });
          localStorage.setItem(STORAGE_KEYS.SHARED_BUDGETS, JSON.stringify(updatedBudgets));
        } catch (e) {}

        // 7. Migrate Portfolio Investments
        try {
          secondaryUserIds.forEach((secId) => {
            const secKey = `darla_portfolio_transactions_${secId}`;
            const secData = localStorage.getItem(secKey);
            if (secData) {
              const primaryKey = `darla_portfolio_transactions_${canonicalId}`;
              const primaryData = localStorage.getItem(primaryKey) || '[]';
              const secTxs = JSON.parse(secData);
              const primaryTxs = JSON.parse(primaryData);
              const merged = [...primaryTxs, ...secTxs.map((t: any) => ({ ...t, userId: canonicalId }))];
              localStorage.setItem(primaryKey, JSON.stringify(merged));
              localStorage.removeItem(secKey);
            }
          });
        } catch (e) {}

        // 8. Sync cleanup to Firestore if connected
        secondaryUserIds.forEach((secId) => {
          deleteUserFromFirestore(secId);
        });
      }
    }

    if (removedUserIdsSet.size > 0) {
      const remainingUsers = users.filter((u) => !removedUserIdsSet.has(u.id));
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(remainingUsers));

      const currentUserStr = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (currentUserStr) {
        try {
          const currentUser: User = JSON.parse(currentUserStr);
          if (removedUserIdsSet.has(currentUser.id)) {
            const matchingEmail = (currentUser.email || '').trim().toLowerCase();
            const mainUser = remainingUsers.find((u) => (u.email || '').trim().toLowerCase() === matchingEmail);
            if (mainUser) {
              localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(mainUser));
            }
          }
        } catch (e) {}
      }
    }

    return {
      unifiedEmailCount,
      mergedAccountsCount,
      migratedRecordsCount,
      details,
    };
  }

  static deduplicateSharedBudgets(): SharedBudget[] {
    const allStr = localStorage.getItem(STORAGE_KEYS.SHARED_BUDGETS) || '[]';
    let allBudgets: SharedBudget[] = [];
    try {
      allBudgets = JSON.parse(allStr);
    } catch {
      allBudgets = [];
    }

    const emailMap = new Map<string, SharedBudget>();

    allBudgets.forEach((b) => {
      if (!b || (!b.ownerEmail && !b.code)) return;
      const cleanEmail = (b.ownerEmail || '').trim().toLowerCase();
      const canonicalId = cleanEmail ? getCanonicalUserId(cleanEmail) : b.budgetId;
      const canonicalCode = cleanEmail
        ? getDeterministicBudgetCode(cleanEmail, b.ownerName)
        : (b.code || 'ORCAMENTO-1000');

      const key = cleanEmail || canonicalId || canonicalCode;
      const existing = emailMap.get(key);

      if (!existing) {
        const collabsMap = new Map<string, BudgetCollaborator>();
        (b.collaborators || []).forEach((c) => {
          if (c && c.email) {
            const cEmail = c.email.trim().toLowerCase();
            if (cEmail !== cleanEmail) {
              collabsMap.set(cEmail, {
                ...c,
                email: cEmail,
                accessMode: c.accessMode || 'edit',
                role: c.role || 'Colaborador',
              });
            }
          }
        });

        emailMap.set(key, {
          ...b,
          budgetId: canonicalId,
          ownerId: canonicalId,
          ownerEmail: cleanEmail || b.ownerEmail,
          code: canonicalCode,
          collaborators: Array.from(collabsMap.values()),
        });
      } else {
        // Merge collaborators
        const collabsMap = new Map<string, BudgetCollaborator>();
        (existing.collaborators || []).forEach((c) => collabsMap.set(c.email.toLowerCase(), c));
        (b.collaborators || []).forEach((c) => {
          if (c && c.email) {
            const cEmail = c.email.trim().toLowerCase();
            if (cEmail !== cleanEmail) {
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

    const unified = Array.from(emailMap.values());
    localStorage.setItem(STORAGE_KEYS.SHARED_BUDGETS, JSON.stringify(unified));
    return unified;
  }

  static async migrateToFirestore() {
    this.initialize();
    return await migrateLocalDataToFirestore();
  }

  static async migrateToSupabase() {
    return await this.migrateToFirestore();
  }

  static getDeletedIds(userId?: string): Set<string> {
    const canonicalId = getCanonicalUserId(userId || this.getCurrentUser()?.id || '');
    const key = `${STORAGE_KEYS.DELETED_IDS}_${canonicalId}`;
    try {
      const raw = localStorage.getItem(key) || '[]';
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  }

  static markAsDeleted(id: string, userId?: string, type?: string) {
    if (!id) return;
    const canonicalId = getCanonicalUserId(userId || this.getCurrentUser()?.id || '');
    const key = `${STORAGE_KEYS.DELETED_IDS}_${canonicalId}`;
    try {
      const existing = this.getDeletedIds(canonicalId);
      existing.add(id);
      localStorage.setItem(key, JSON.stringify(Array.from(existing)));
    } catch {}

    // Immediately remove from all local storage collections
    try {
      const pruneKey = (k: string) => {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              const cleaned = arr.filter((item: any) => item?.id !== id && item?.ticker !== id);
              if (cleaned.length !== arr.length) {
                localStorage.setItem(k, JSON.stringify(cleaned));
              }
            }
          } catch {}
        }
      };
      [STORAGE_KEYS.TRANSACTIONS, STORAGE_KEYS.ACCOUNTS, STORAGE_KEYS.CATEGORIES, STORAGE_KEYS.GOALS, STORAGE_KEYS.FAMILY_MEMBERS].forEach(pruneKey);
    } catch {}

    if (canonicalId) {
      fetch('/api/data/delete-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: canonicalId, type: type || 'transactions', id }),
      }).catch(() => {});
    }
  }

  static async syncUserDataWithRemote(userId: string): Promise<boolean> {
    if (!userId) return false;
    this.isCloudSynced = true;
    this.initialize();

    const canonicalId = getCanonicalUserId(userId);

    try {
      // 1. Fetch live financial data from Server backend
      let serverData: any = null;
      try {
        const sRes = await fetch(`/api/data/load?userId=${encodeURIComponent(canonicalId)}`);
        if (sRes.ok) {
          const sJson = await sRes.json();
          if (sJson && sJson.success && sJson.data) {
            serverData = sJson.data;
          }
        }
      } catch (e) {
        console.warn('[StorageService Server fetch notice]', e);
      }

      // 2. Fetch live financial data from Appwrite Cloud
      let appwriteConnData: any = null;
      let remoteTransactions: any[] = [];
      try {
        appwriteConnData = await fetchUserDataFromAppwrite(canonicalId);
      } catch (e) {
        console.warn('[StorageService Appwrite fetch notice]', e);
      }
      try {
        remoteTransactions = await fetchTransactionsFromAppwrite(canonicalId);
      } catch (e) {
        console.warn('[StorageService Appwrite tx fetch notice]', e);
      }

      // 3. Fetch from Firestore if available
      let firestoreData: any = null;
      try {
        firestoreData = await fetchUserDataFromFirestore(canonicalId);
      } catch (e) {
        console.warn('[StorageService Firestore fetch notice]', e);
      }

      const accMap = new Map(_inMemoryStore.accounts.map(a => [a.id, a]));
      const catMap = new Map(_inMemoryStore.categories.map(c => [c.id, c]));
      const fmMap = new Map(_inMemoryStore.familyMembers.map(f => [f.id, f]));
      const txMap = new Map(_inMemoryStore.transactions.map(t => [t.id, t]));
      const goalMap = new Map(_inMemoryStore.goals.map(g => [g.id, g]));

      const deletedIds = this.getDeletedIds(canonicalId);

      const mergeAccounts = (list?: any[]) => {
        if (!Array.isArray(list)) return;
        list.forEach(a => {
          if (!a || !a.id || deletedIds.has(a.id)) return;
          accMap.set(a.id, { ...a, userId: canonicalId });
        });
      };

      const mergeCategories = (list?: any[]) => {
        if (!Array.isArray(list)) return;
        list.forEach(c => {
          if (!c || !c.id || deletedIds.has(c.id)) return;
          catMap.set(c.id, { ...c, userId: canonicalId });
        });
      };

      const mergeFamily = (list?: any[]) => {
        if (!Array.isArray(list)) return;
        list.forEach(f => {
          if (!f || !f.id || deletedIds.has(f.id)) return;
          fmMap.set(f.id, { ...f, userId: canonicalId });
        });
      };

      const mergeGoals = (list?: any[]) => {
        if (!Array.isArray(list)) return;
        list.forEach(g => {
          if (!g || !g.id || deletedIds.has(g.id)) return;
          goalMap.set(g.id, { ...g, userId: canonicalId });
        });
      };

      const mergeTransactions = (list?: any[]) => {
        if (!Array.isArray(list)) return;
        list.forEach(t => {
          if (!t || !t.id || deletedIds.has(t.id)) return;
          const existing = txMap.get(t.id);
          if (!existing || new Date(t.updatedAt || t.createdAt || 0).getTime() >= new Date(existing.updatedAt || existing.createdAt || 0).getTime()) {
            txMap.set(t.id, { ...t, userId: canonicalId });
          }
        });
      };

      // Merge Server data
      if (serverData) {
        mergeAccounts(serverData.accounts);
        mergeCategories(serverData.categories);
        mergeFamily(serverData.familyMembers);
        mergeGoals(serverData.goals);
        mergeTransactions(serverData.transactions);
      }

      // Merge Appwrite data
      if (appwriteConnData) {
        mergeAccounts(appwriteConnData.accounts);
        mergeCategories(appwriteConnData.categories);
        mergeFamily(appwriteConnData.familyMembers);
        mergeGoals(appwriteConnData.goals);
        mergeTransactions(appwriteConnData.transactions);
        if (appwriteConnData.user) {
          const existingBudgetId = _inMemoryStore.currentUser?.budgetId || JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER) || '{}')?.budgetId;
          _inMemoryStore.currentUser = { ..._inMemoryStore.currentUser, ...appwriteConnData.user, id: canonicalId, budgetId: existingBudgetId || appwriteConnData.user.budgetId };
        }
      }

      // Merge remote individual transactions
      if (Array.isArray(remoteTransactions) && remoteTransactions.length > 0) {
        mergeTransactions(remoteTransactions);
      }

      // Merge Firestore data
      if (firestoreData) {
        mergeAccounts(firestoreData.accounts);
        mergeCategories(firestoreData.categories);
        mergeFamily(firestoreData.familyMembers);
        mergeGoals(firestoreData.goals);
        mergeTransactions(firestoreData.transactions);
      }

      _inMemoryStore.accounts = Array.from(accMap.values());
      _inMemoryStore.categories = Array.from(catMap.values());
      _inMemoryStore.familyMembers = Array.from(fmMap.values());
      _inMemoryStore.transactions = Array.from(txMap.values());
      _inMemoryStore.goals = Array.from(goalMap.values());

      // Save to localStorage immediately
      try {
        localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(_inMemoryStore.accounts));
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(_inMemoryStore.categories));
        localStorage.setItem(STORAGE_KEYS.FAMILY_MEMBERS, JSON.stringify(_inMemoryStore.familyMembers));
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(_inMemoryStore.transactions));
        localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(_inMemoryStore.goals));
        if (_inMemoryStore.currentUser) {
          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(_inMemoryStore.currentUser));
        }
      } catch (e) {}

      // Push merged state to Appwrite in background
      try {
        await syncUserDataWithAppwrite(canonicalId, {
          accounts: _inMemoryStore.accounts.filter(a => getCanonicalUserId(a.userId) === canonicalId),
          categories: _inMemoryStore.categories.filter(c => getCanonicalUserId(c.userId) === canonicalId),
          familyMembers: _inMemoryStore.familyMembers.filter(f => getCanonicalUserId(f.userId) === canonicalId),
          transactions: _inMemoryStore.transactions.filter(t => getCanonicalUserId(t.userId) === canonicalId),
          goals: _inMemoryStore.goals.filter(g => getCanonicalUserId(g.userId) === canonicalId),
          user: _inMemoryStore.currentUser,
        });
      } catch (err) {}

      // Sync portfolio with remote
      try {
        await PortfolioStorageService.loadPortfolioFromRemote(canonicalId);
      } catch (e) {}

      // Notify listeners across components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId: canonicalId } }));
      }

      return true;
    } catch (err) {
      console.warn('[StorageService Sync Remote Notice]', err);
      return true;
    }
  }

  static async syncUserMutationToServer(userId: string): Promise<boolean> {
    if (!userId) return false;
    const canonicalId = getCanonicalUserId(userId);

    // Notify local and cross-tab UI immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId: canonicalId } }));
      if ('BroadcastChannel' in window) {
        try {
          const channel = new BroadcastChannel('darla_data_sync_channel');
          channel.postMessage({ type: 'DATA_UPDATED', userId: canonicalId });
          channel.close();
        } catch (e) {}
      }
    }

    if (!isDeviceOnline()) {
      return true;
    }

    try {
      const accounts = this.getAccounts(canonicalId);
      const categories = this.getCategories(canonicalId);
      const familyMembers = this.getFamilyMembers(canonicalId);
      const transactions = this.getTransactions(canonicalId);
      const goals = this.getGoals(canonicalId);
      const deletedIds = this.getDeletedIds(canonicalId);

      // Save directly to Cloud Appwrite & Firestore
      syncUserDataWithAppwrite(canonicalId, {
        accounts,
        categories,
        familyMembers,
        transactions,
        goals,
        deletedIds: Array.from(deletedIds),
      }).catch(() => {});

      saveUserDataToFirestore(canonicalId, {
        accounts,
        categories,
        familyMembers,
        transactions,
        goals,
        deletedIds: Array.from(deletedIds),
      }).catch(() => {});

      const res = await fetch('/api/data/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: canonicalId,
          accounts,
          categories,
          familyMembers,
          transactions,
          goals,
          deletedIds: Array.from(deletedIds),
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json && json.success && json.data) {
          const updateStorage = (storageKey: string, items: any[]) => {
            const allLocal: any[] = JSON.parse(localStorage.getItem(storageKey) || '[]');
            const otherUsersItems = allLocal.filter(
              (item) => getCanonicalUserId(item.userId) !== canonicalId
            );
            const userItems = (items || []).map((item: any) => ({ ...item, userId: canonicalId }));
            localStorage.setItem(storageKey, JSON.stringify([...otherUsersItems, ...userItems]));
          };

          if (Array.isArray(json.data.accounts)) updateStorage(STORAGE_KEYS.ACCOUNTS, json.data.accounts);
          if (Array.isArray(json.data.categories)) updateStorage(STORAGE_KEYS.CATEGORIES, json.data.categories);
          if (Array.isArray(json.data.familyMembers)) updateStorage(STORAGE_KEYS.FAMILY_MEMBERS, json.data.familyMembers);
          if (Array.isArray(json.data.transactions)) updateStorage(STORAGE_KEYS.TRANSACTIONS, json.data.transactions);
          if (Array.isArray(json.data.goals)) updateStorage(STORAGE_KEYS.GOALS, json.data.goals);
        }
      }

      return true;
    } catch (e) {
      console.warn('[StorageService Sync Mutation Notice] Remote backend sync skipped while offline.', e);
      return true;
    }
  }

  // --- PRIVACY MODE ---
  static getPrivacyMode(): boolean {
    return localStorage.getItem(STORAGE_KEYS.PRIVACY_MODE) === 'true';
  }

  static setPrivacyMode(active: boolean): void {
    localStorage.setItem(STORAGE_KEYS.PRIVACY_MODE, active ? 'true' : 'false');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('privacy_mode_changed', { detail: { active } }));
      if ('BroadcastChannel' in window) {
        try {
          const channel = new BroadcastChannel('darla_privacy_channel');
          channel.postMessage({ active });
          channel.close();
        } catch (e) {
          // BroadcastChannel fallback
        }
      }
    }
  }

  // --- AUTHENTICATION & SUBSCRIPTIONS ---
  static getCurrentUser(): User | null {
    this.initialize();
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!data) {
      return null;
    }
    try {
      const user: User = JSON.parse(data);
      const canonicalId = getUserIdForEmail(user.email);
      if (user.id !== canonicalId) {
        user.id = canonicalId;
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      }

      // Check if user still exists in the local database of registered users
      const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
      const users: User[] = JSON.parse(usersStr);
      const cleanEmail = (user.email || '').trim().toLowerCase();
      const userExistsInDb = users.some(
        (u) => (u.email && u.email.trim().toLowerCase() === cleanEmail) || u.id === user.id || u.id === canonicalId
      );

      if (!userExistsInDb) {
        users.push(user);
        try {
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        } catch (e) {}
      }

      if (!user.createdAt) {
        user.createdAt = new Date().toISOString();
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      }
      return user;
    } catch (e) {
      return null;
    }
  }

  static getUserTrialStatus(user: User | null): {
    daysLeft: number;
    isExpired: boolean;
    daysSinceCreation: number;
    totalTrialDays: number;
    isPro: boolean;
  } {
    if (!user) {
      return { daysLeft: 90, isExpired: false, daysSinceCreation: 0, totalTrialDays: 90, isPro: false };
    }

    if (user.isPro || user.subscriptionStatus === 'active') {
      return { daysLeft: 90, isExpired: false, daysSinceCreation: 0, totalTrialDays: 90, isPro: true };
    }

    const createdAtStr = user.createdAt || new Date().toISOString();
    const createdDate = new Date(createdAtStr);
    const now = new Date();

    const diffMs = now.getTime() - createdDate.getTime();
    const daysSinceCreation = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    const totalTrialDays = 90;
    const daysLeft = Math.max(0, totalTrialDays - daysSinceCreation);
    const isExpired = daysSinceCreation >= 91 || daysLeft === 0;

    return {
      daysLeft,
      isExpired,
      daysSinceCreation,
      totalTrialDays,
      isPro: false,
    };
  }

  static isFeatureAllowed(
    user: User | null,
    featureKey: 'shared_budget' | 'ai_tips' | 'export_reports' | 'rewards_store' | 'future_projections' | 'portfolio'
  ): boolean {
    if (!user) return true;
    if (user.isPro || user.subscriptionStatus === 'active') return true;
    const trialStatus = this.getUserTrialStatus(user);
    return !trialStatus.isExpired;
  }

  static updateUserSubscription(userId: string, plan: string, isPro: boolean = true): User | null {
    this.initialize();
    const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
    try {
      const users: User[] = JSON.parse(usersStr);
      const idx = users.findIndex((u) => u.id === userId);
      let updatedUser: User | null = null;
      const nowIso = new Date().toISOString();

      if (idx !== -1) {
        users[idx].isPro = isPro;
        users[idx].plan = plan;
        users[idx].subscriptionStatus = isPro ? 'active' : 'expired';
        users[idx].subscriptionAutoRenew = isPro;
        users[idx].subscriptionPurchasedAt = isPro ? nowIso : users[idx].subscriptionPurchasedAt;
        users[idx].subscriptionCanceledAt = undefined;
        updatedUser = users[idx];
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      }

      const currentUser = this.getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        const updated: User = {
          ...currentUser,
          isPro,
          plan,
          subscriptionStatus: isPro ? 'active' : 'expired',
          subscriptionAutoRenew: isPro,
          subscriptionPurchasedAt: isPro ? nowIso : currentUser.subscriptionPurchasedAt,
          subscriptionCanceledAt: undefined,
        };
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updated));
        return updated;
      }
      return updatedUser;
    } catch (e) {}
    return null;
  }

  static cancelUserSubscription(userId: string, immediate7DaysRefund: boolean): User | null {
    this.initialize();
    const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
    try {
      const users: User[] = JSON.parse(usersStr);
      const idx = users.findIndex((u) => u.id === userId);
      let updatedUser: User | null = null;
      const nowIso = new Date().toISOString();

      if (idx !== -1) {
        if (immediate7DaysRefund) {
          users[idx].isPro = false;
          users[idx].subscriptionStatus = 'canceled';
          users[idx].subscriptionAutoRenew = false;
          users[idx].subscriptionCanceledAt = nowIso;
        } else {
          // Mantém acesso até o fim do período, desativa renovação
          users[idx].subscriptionAutoRenew = false;
          users[idx].subscriptionCanceledAt = nowIso;
        }
        updatedUser = users[idx];
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      }

      const currentUser = this.getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        const updated: User = {
          ...currentUser,
          isPro: immediate7DaysRefund ? false : currentUser.isPro,
          subscriptionStatus: immediate7DaysRefund ? 'canceled' : currentUser.subscriptionStatus,
          subscriptionAutoRenew: false,
          subscriptionCanceledAt: nowIso,
        };
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updated));
        return updated;
      }
      return updatedUser;
    } catch (e) {}
    return null;
  }

  static simulateUserAccountAge(userId: string, daysAgo: number): User | null {
    this.initialize();
    const simulatedDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
    const currentUser = this.getCurrentUser();

    if (currentUser && currentUser.id === userId) {
      const updated = {
        ...currentUser,
        createdAt: simulatedDate,
      };
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updated));

      const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
      try {
        const users: User[] = JSON.parse(usersStr);
        const idx = users.findIndex((u) => u.id === userId);
        if (idx !== -1) {
          users[idx].createdAt = simulatedDate;
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        }
      } catch (e) {}

      return updated;
    }
    return null;
  }

  static async syncUserWithServer(email: string): Promise<User | null> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) return null;
    try {
      const res = await fetch(`/api/users/lookup?email=${encodeURIComponent(cleanEmail)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.user) {
          const serverUser: User = data.user;
          const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
          let users: User[] = [];
          try {
            users = JSON.parse(usersStr);
          } catch (e) {}

          const idx = users.findIndex((u) => (u.email || '').toLowerCase() === cleanEmail);
          if (idx >= 0) {
            users[idx] = { ...users[idx], ...serverUser };
          } else {
            users.push(serverUser);
          }
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

          const currentUserStr = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
          if (currentUserStr) {
            try {
              const cur = JSON.parse(currentUserStr);
              if ((cur.email || '').toLowerCase() === cleanEmail) {
                localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify({ ...cur, ...serverUser }));
              }
            } catch (e) {}
          }
          return serverUser;
        }
      }
    } catch (e) {
      console.warn('[syncUserWithServer Error]', e);
    }
    return null;
  }

  static findUserByEmail(email: string): User | null {
    this.initialize();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return null;
    const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
    try {
      const users: User[] = JSON.parse(usersStr);
      return users.find((u) => (u.email || '').trim().toLowerCase() === cleanEmail) || null;
    } catch (e) {
      return null;
    }
  }

  static async isUserRegisteredAsync(email: string): Promise<{ exists: boolean; user: User | null }> {
    this.initialize();
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) return { exists: false, user: null };

    // 1. Query Central Server for User Record (Authoritative source across devices)
    try {
      const res = await fetch(`/api/users/lookup?email=${encodeURIComponent(cleanEmail)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.user) {
          // Cache user locally
          const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
          try {
            const users: User[] = JSON.parse(usersStr);
            const idx = users.findIndex((u) => (u.email || '').toLowerCase() === cleanEmail);
            if (idx >= 0) {
              users[idx] = { ...users[idx], ...data.user };
            } else {
              users.push(data.user);
            }
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
          } catch (e) {}
          return { exists: true, user: data.user };
        } else if (data && !data.success) {
          // Explicitly not found on server
          return { exists: false, user: null };
        }
      }
    } catch (e) {
      console.warn('[isUserRegisteredAsync lookup error]', e);
    }

    // 2. Fallback to local user
    const localUser = this.findUserByEmail(cleanEmail);
    if (localUser) {
      return { exists: true, user: localUser };
    }

    return { exists: false, user: null };
  }

  static async ensureUserAndDataSyncedAsync(
    email: string,
    password?: string,
    name?: string,
    avatarUrl?: string,
    authProvider: 'email' | 'google' = 'email'
  ): Promise<User> {
    StorageService.isCloudSynced = false;
    this.initialize();
    this.deduplicateUsers();
    const cleanEmail = email.trim().toLowerCase();
    const deterministicId = getUserIdForEmail(cleanEmail);

    // 1. Check if user already exists in local storage
    let existingUser = this.findUserByEmail(cleanEmail);

    // 2. Query Central Server for User Record and Data
    let serverUser: User | null = null;
    let serverData: any = null;
    try {
      const res = await fetch(`/api/users/lookup?email=${encodeURIComponent(cleanEmail)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.user) {
          serverUser = data.user;
        }
      }
    } catch (e) {
      console.warn('[ensureUserAndDataSyncedAsync lookup error]', e);
    }

    try {
      const sRes = await fetch(`/api/data/load?userId=${encodeURIComponent(deterministicId)}`);
      if (sRes.ok) {
        const sJson = await sRes.json();
        if (sJson && sJson.success && sJson.data) {
          serverData = sJson.data;
        }
      }
    } catch (e) {}

    // 3. Query Appwrite Cloud for User and Financial Data with Automatic Migration & Cloud Priority
    let appwriteConnData: any = null;
    let remoteTransactions: any[] = [];
    try {
      appwriteConnData = await checkAndMigrateOrFetchUserFinancials(
        deterministicId,
        () => ({
          accounts: _inMemoryStore.accounts.filter(a => getCanonicalUserId(a.userId) === deterministicId),
          categories: _inMemoryStore.categories.filter(c => getCanonicalUserId(c.userId) === deterministicId),
          familyMembers: _inMemoryStore.familyMembers.filter(f => getCanonicalUserId(f.userId) === deterministicId),
          transactions: _inMemoryStore.transactions.filter(t => getCanonicalUserId(t.userId) === deterministicId),
          goals: _inMemoryStore.goals.filter(g => getCanonicalUserId(g.userId) === deterministicId),
          user: _inMemoryStore.currentUser,
        }),
        (cloudData) => {
          if (cloudData) {
            if (cloudData.accounts && Array.isArray(cloudData.accounts)) {
              _inMemoryStore.accounts = _inMemoryStore.accounts.filter(a => getCanonicalUserId(a.userId) !== deterministicId).concat(cloudData.accounts);
              try { localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(_inMemoryStore.accounts)); } catch (e) {}
            }
            if (cloudData.categories && Array.isArray(cloudData.categories)) {
              _inMemoryStore.categories = _inMemoryStore.categories.filter(c => getCanonicalUserId(c.userId) !== deterministicId).concat(cloudData.categories);
              try { localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(_inMemoryStore.categories)); } catch (e) {}
            }
            if (cloudData.familyMembers && Array.isArray(cloudData.familyMembers)) {
              _inMemoryStore.familyMembers = _inMemoryStore.familyMembers.filter(f => getCanonicalUserId(f.userId) !== deterministicId).concat(cloudData.familyMembers);
              try { localStorage.setItem(STORAGE_KEYS.FAMILY_MEMBERS, JSON.stringify(_inMemoryStore.familyMembers)); } catch (e) {}
            }
            if (cloudData.transactions && Array.isArray(cloudData.transactions)) {
              _inMemoryStore.transactions = _inMemoryStore.transactions.filter(t => getCanonicalUserId(t.userId) !== deterministicId).concat(cloudData.transactions);
              try { localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(_inMemoryStore.transactions)); } catch (e) {}
            }
            if (cloudData.goals && Array.isArray(cloudData.goals)) {
              _inMemoryStore.goals = _inMemoryStore.goals.filter(g => getCanonicalUserId(g.userId) !== deterministicId).concat(cloudData.goals);
              try { localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(_inMemoryStore.goals)); } catch (e) {}
            }
          }
        }
      );
      if (!appwriteConnData) {
        appwriteConnData = await fetchUserDataFromAppwrite(deterministicId);
      }
    } catch (e) {
      console.warn('[ensureUserAndDataSyncedAsync Appwrite migration/lookup error]', e);
    }
    try {
      remoteTransactions = await fetchTransactionsFromAppwrite(deterministicId);
    } catch (e) {}

    // 4. Query Firestore if available
    let firestoreData: any = null;
    try {
      firestoreData = await fetchUserDataFromFirestore(deterministicId);
    } catch (e) {}

    const appUser = appwriteConnData?.user;
    const isDarla = isDarlaAccount(cleanEmail);

    const userToSave: User = {
      id: deterministicId,
      name: name || appUser?.name || serverUser?.name || existingUser?.name || cleanEmail.split('@')[0],
      email: cleanEmail,
      password: password || appUser?.password || serverUser?.password || existingUser?.password,
      authProvider: authProvider || appUser?.authProvider || serverUser?.authProvider || existingUser?.authProvider || 'email',
      avatarUrl: avatarUrl || appUser?.avatarUrl || serverUser?.avatarUrl || existingUser?.avatarUrl || DEMO_USER.avatarUrl,
      createdAt: appUser?.createdAt || serverUser?.createdAt || existingUser?.createdAt || new Date().toISOString(),
      isPro: isDarla ? true : (appUser?.isPro ?? serverUser?.isPro ?? existingUser?.isPro ?? false),
      plan: isDarla ? 'lifetime' : (appUser?.plan ?? serverUser?.plan ?? existingUser?.plan ?? 'free'),
      subscriptionStatus: isDarla ? 'active' : (appUser?.subscriptionStatus ?? serverUser?.subscriptionStatus ?? existingUser?.subscriptionStatus ?? 'trial'),
    };

    _inMemoryStore.currentUser = userToSave;
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(userToSave));
      const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
      const uList: User[] = JSON.parse(usersStr);
      const uIdx = uList.findIndex((u) => (u.email || '').toLowerCase() === cleanEmail);
      if (uIdx >= 0) {
        uList[uIdx] = userToSave;
      } else {
        uList.push(userToSave);
      }
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(uList));
    } catch (e) {}

    const userIdx = _inMemoryStore.users.findIndex(u => (u.email || '').toLowerCase() === cleanEmail);
    if (userIdx >= 0) {
      _inMemoryStore.users[userIdx] = userToSave;
    } else {
      _inMemoryStore.users.push(userToSave);
    }

    const accMap = new Map(_inMemoryStore.accounts.map(a => [a.id, a]));
    const catMap = new Map(_inMemoryStore.categories.map(c => [c.id, c]));
    const fmMap = new Map(_inMemoryStore.familyMembers.map(f => [f.id, f]));
    const txMap = new Map(_inMemoryStore.transactions.map(t => [t.id, t]));
    const goalMap = new Map(_inMemoryStore.goals.map(g => [g.id, g]));

    const deletedIds = this.getDeletedIds(deterministicId);

    const mergeAccounts = (list?: any[]) => {
      if (!Array.isArray(list)) return;
      list.forEach(a => {
        if (!a || !a.id || deletedIds.has(a.id)) return;
        accMap.set(a.id, { ...a, userId: deterministicId });
      });
    };

    const mergeCategories = (list?: any[]) => {
      if (!Array.isArray(list)) return;
      list.forEach(c => {
        if (!c || !c.id || deletedIds.has(c.id)) return;
        catMap.set(c.id, { ...c, userId: deterministicId });
      });
    };

    const mergeFamily = (list?: any[]) => {
      if (!Array.isArray(list)) return;
      list.forEach(f => {
        if (!f || !f.id || deletedIds.has(f.id)) return;
        fmMap.set(f.id, { ...f, userId: deterministicId });
      });
    };

    const mergeGoals = (list?: any[]) => {
      if (!Array.isArray(list)) return;
      list.forEach(g => {
        if (!g || !g.id || deletedIds.has(g.id)) return;
        goalMap.set(g.id, { ...g, userId: deterministicId });
      });
    };

    const mergeTransactions = (list?: any[]) => {
      if (!Array.isArray(list)) return;
      list.forEach(t => {
        if (!t || !t.id || deletedIds.has(t.id)) return;
        const existing = txMap.get(t.id);
        if (!existing || new Date(t.updatedAt || t.createdAt || 0).getTime() >= new Date(existing.updatedAt || existing.createdAt || 0).getTime()) {
          txMap.set(t.id, { ...t, userId: deterministicId });
        }
      });
    };

    if (serverData) {
      mergeAccounts(serverData.accounts);
      mergeCategories(serverData.categories);
      mergeFamily(serverData.familyMembers);
      mergeGoals(serverData.goals);
      mergeTransactions(serverData.transactions);
    }

    if (appwriteConnData) {
      mergeAccounts(appwriteConnData.accounts);
      mergeCategories(appwriteConnData.categories);
      mergeFamily(appwriteConnData.familyMembers);
      mergeGoals(appwriteConnData.goals);
      mergeTransactions(appwriteConnData.transactions);
    }

    if (Array.isArray(remoteTransactions) && remoteTransactions.length > 0) {
      mergeTransactions(remoteTransactions);
    }

    if (firestoreData) {
      mergeAccounts(firestoreData.accounts);
      mergeCategories(firestoreData.categories);
      mergeFamily(firestoreData.familyMembers);
      mergeGoals(firestoreData.goals);
      mergeTransactions(firestoreData.transactions);
    }

    // Check if user has accounts and categories
    const userAccs = Array.from(accMap.values()).filter(a => getCanonicalUserId(a.userId) === deterministicId);
    const userCats = Array.from(catMap.values()).filter(c => getCanonicalUserId(c.userId) === deterministicId);

    // If completely new user with 0 accounts and 0 categories in all stores, seed starter items
    if (userAccs.length === 0 && userCats.length === 0) {
      const seededCats = SEED_CATEGORIES.map((c) => ({ ...c, id: `${c.id}_${deterministicId}`, userId: deterministicId }));
      const seededAccs = SEED_ACCOUNTS.map((a) => ({ ...a, id: `${a.id}_${deterministicId}`, userId: deterministicId, initialBalance: 0.0 }));
      seededCats.forEach(c => catMap.set(c.id, c));
      seededAccs.forEach(a => accMap.set(a.id, a));
    }

    _inMemoryStore.accounts = Array.from(accMap.values());
    _inMemoryStore.categories = Array.from(catMap.values());
    _inMemoryStore.familyMembers = Array.from(fmMap.values());
    _inMemoryStore.transactions = Array.from(txMap.values());
    _inMemoryStore.goals = Array.from(goalMap.values());

    // Save to localStorage immediately
    try {
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(_inMemoryStore.accounts));
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(_inMemoryStore.categories));
      localStorage.setItem(STORAGE_KEYS.FAMILY_MEMBERS, JSON.stringify(_inMemoryStore.familyMembers));
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(_inMemoryStore.transactions));
      localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(_inMemoryStore.goals));
    } catch (e) {}

    // Sync portfolio from Appwrite
    try {
      await PortfolioStorageService.loadPortfolioFromRemote(deterministicId);
    } catch (e) {}

    // Push updated state to Appwrite
    try {
      await syncUserDataWithAppwrite(deterministicId, {
        accounts: _inMemoryStore.accounts.filter(a => getCanonicalUserId(a.userId) === deterministicId),
        categories: _inMemoryStore.categories.filter(c => getCanonicalUserId(c.userId) === deterministicId),
        familyMembers: _inMemoryStore.familyMembers.filter(f => getCanonicalUserId(f.userId) === deterministicId),
        transactions: _inMemoryStore.transactions.filter(t => getCanonicalUserId(t.userId) === deterministicId),
        goals: _inMemoryStore.goals.filter(g => getCanonicalUserId(g.userId) === deterministicId),
        user: userToSave,
      });
    } catch (e) {}

    // Push to server sync
    try {
      fetch('/api/users/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userToSave),
      }).catch(() => {});
    } catch (e) {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId: deterministicId } }));
    }

    StorageService.isCloudSynced = true;
    return userToSave;
  }

  static register(email: string, password?: string, name?: string): User {
    this.initialize();
    this.deduplicateUsers();
    const cleanEmail = email.trim().toLowerCase();
    const deterministicId = getUserIdForEmail(cleanEmail);
    const isDarla = isDarlaAccount(cleanEmail);

    const existing = this.findUserByEmail(cleanEmail);
    if (existing) {
      existing.id = deterministicId;
      if (password) existing.password = password;
      if (name && !existing.name) existing.name = name;
      if (isDarla) {
        existing.isPro = true;
        existing.plan = 'lifetime';
        existing.subscriptionStatus = 'active';
      }

      const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
      try {
        const users: User[] = JSON.parse(usersStr);
        const idx = users.findIndex((u) => (u.email || '').toLowerCase() === cleanEmail);
        if (idx !== -1) {
          users[idx] = existing;
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        }
      } catch (e) {}

      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(existing));

      pushUserToFirestore(existing);
      fetch('/api/users/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(existing),
      }).catch(() => {});

      return existing;
    }

    const sessionId = this.initNewSession();
    const newUser: User = {
      id: deterministicId,
      name: name || cleanEmail.split('@')[0],
      email: cleanEmail,
      password: password || undefined,
      authProvider: 'email',
      avatarUrl: DEMO_USER.avatarUrl,
      createdAt: new Date().toISOString(),
      isPro: isDarla ? true : false,
      plan: isDarla ? 'lifetime' : 'free',
      subscriptionStatus: isDarla ? 'active' : 'trial',
      lastSessionId: sessionId,
      lastSessionCreatedAt: new Date().toISOString(),
    };

    const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
    try {
      const users: User[] = JSON.parse(usersStr);
      users.push(newUser);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    } catch (e) {}

    const categories: Category[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CATEGORIES) || '[]');
    const userCategories = SEED_CATEGORIES.map((c) => ({ ...c, id: `${c.id}_${newUser.id}`, userId: newUser.id }));
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify([...categories, ...userCategories]));

    const accounts: Account[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACCOUNTS) || '[]');
    const userAccounts = SEED_ACCOUNTS.map((a) => ({ ...a, id: `${a.id}_${newUser.id}`, userId: newUser.id, initialBalance: 0.0 }));
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify([...accounts, ...userAccounts]));

    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser));

    this.getSharedBudget(deterministicId, newUser);

    try {
      this.syncNotificationsWithServer(cleanEmail, newUser.sharedBudgetCode);
      this.syncSharedBudgetsWithServer(cleanEmail);
      PortfolioStorageService.loadPortfolioFromRemote(deterministicId);
    } catch (e) {}

    pushUserToFirestore(newUser);
    userAccounts.forEach((acc) => pushAccountToFirestore(acc));
    userCategories.forEach((cat) => pushCategoryToFirestore(cat));

    fetch('/api/users/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    }).catch(() => {});

    return newUser;
  }

  static login(email: string, password?: string): User {
    this.initialize();
    this.deduplicateUsers();
    const cleanEmail = email.trim().toLowerCase();
    const deterministicId = getUserIdForEmail(cleanEmail);
    const isDarla = isDarlaAccount(cleanEmail);
    const sessionId = this.initNewSession();

    const existing = this.findUserByEmail(cleanEmail);
    if (!existing) {
      return this.register(cleanEmail, password);
    }

    existing.id = deterministicId;
    existing.lastSessionId = sessionId;
    existing.lastSessionCreatedAt = new Date().toISOString();
    if (!existing.createdAt) existing.createdAt = new Date().toISOString();
    if (password) existing.password = password;
    if (isDarla) {
      existing.isPro = true;
      existing.plan = 'lifetime';
      existing.subscriptionStatus = 'active';
    }

    const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
    try {
      const users: User[] = JSON.parse(usersStr);
      const idx = users.findIndex((u) => (u.email || '').toLowerCase() === cleanEmail);
      if (idx !== -1) {
        users[idx] = existing;
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      }
    } catch (e) {}

    _inMemoryStore.currentUser = existing;
    const uIdx = _inMemoryStore.users.findIndex(u => (u.email || '').toLowerCase() === cleanEmail);
    if (uIdx >= 0) {
      _inMemoryStore.users[uIdx] = existing;
    } else {
      _inMemoryStore.users.push(existing);
    }
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(existing));

    this.syncUserDataWithRemote(deterministicId).catch(() => {});

    fetch('/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...existing, sessionId }),
    }).catch(() => {});

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId: deterministicId } }));
    }

    return existing;
  }

  static loginWithGoogle(googleUser: { name: string; email: string; avatarUrl?: string }): User {
    this.initialize();
    this.deduplicateUsers();
    const cleanEmail = googleUser.email.trim().toLowerCase();
    const deterministicId = getUserIdForEmail(cleanEmail);
    const isDarla = isDarlaAccount(cleanEmail);
    const sessionId = this.initNewSession();

    const existing = this.findUserByEmail(cleanEmail);
    if (existing) {
      existing.id = deterministicId;
      existing.authProvider = 'google';
      existing.lastSessionId = sessionId;
      existing.lastSessionCreatedAt = new Date().toISOString();
      if (!existing.createdAt) existing.createdAt = new Date().toISOString();
      if (googleUser.avatarUrl) existing.avatarUrl = googleUser.avatarUrl;
      if (googleUser.name && !existing.name) existing.name = googleUser.name;
      if (isDarla) {
        existing.isPro = true;
        existing.plan = 'lifetime';
        existing.subscriptionStatus = 'active';
      }

      const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
      try {
        const users: User[] = JSON.parse(usersStr);
        const idx = users.findIndex((u) => (u.email || '').toLowerCase() === cleanEmail);
        if (idx !== -1) {
          users[idx] = existing;
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        }
      } catch (e) {}

      _inMemoryStore.currentUser = existing;
      const memIdx = _inMemoryStore.users.findIndex(u => (u.email || '').toLowerCase() === cleanEmail);
      if (memIdx >= 0) {
        _inMemoryStore.users[memIdx] = existing;
      } else {
        _inMemoryStore.users.push(existing);
      }
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(existing));

      this.syncUserDataWithRemote(deterministicId).catch(() => {});

      fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...existing, sessionId }),
      }).catch(() => {});

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId: deterministicId } }));
      }

      return existing;
    }

    const newUser: User = {
      id: deterministicId,
      name: googleUser.name,
      email: cleanEmail,
      authProvider: 'google',
      avatarUrl: googleUser.avatarUrl || 'https://lh3.googleusercontent.com/a/default-user=s96-c',
      createdAt: new Date().toISOString(),
      isPro: isDarla ? true : false,
      plan: isDarla ? 'lifetime' : 'free',
      subscriptionStatus: isDarla ? 'active' : 'trial',
      lastSessionId: sessionId,
      lastSessionCreatedAt: new Date().toISOString(),
    };

    const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
    try {
      const users: User[] = JSON.parse(usersStr);
      users.push(newUser);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    } catch (e) {}

    const categories: Category[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CATEGORIES) || '[]');
    const userCategories = SEED_CATEGORIES.map((c) => ({ ...c, id: `${c.id}_${newUser.id}`, userId: newUser.id }));
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify([...categories, ...userCategories]));

    const accounts: Account[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACCOUNTS) || '[]');
    const userAccounts = SEED_ACCOUNTS.map((a) => ({ ...a, id: `${a.id}_${newUser.id}`, userId: newUser.id, initialBalance: 0.0 }));
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify([...accounts, ...userAccounts]));

    _inMemoryStore.currentUser = newUser;
    _inMemoryStore.users.push(newUser);
    _inMemoryStore.categories.push(...userCategories);
    _inMemoryStore.accounts.push(...userAccounts);
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser));

    this.getSharedBudget(deterministicId, newUser);

    try {
      this.syncNotificationsWithServer(cleanEmail, newUser.sharedBudgetCode);
      this.syncSharedBudgetsWithServer(cleanEmail);
      PortfolioStorageService.loadPortfolioFromRemote(deterministicId);
      this.syncUserDataWithRemote(deterministicId);
    } catch (e) {}

    fetch('/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newUser, sessionId }),
    }).catch(() => {});

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId: deterministicId } }));
    }

    return newUser;
  }

  static async sendPasswordResetCodeAsync(email: string): Promise<{ success: boolean; message: string; code?: string; emailSent?: boolean }> {
    this.initialize();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, message: 'Informe seu e-mail cadastrado.' };
    }

    const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
    const users: User[] = JSON.parse(usersStr);
    let user = users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      user = {
        id: getUserIdForEmail(cleanEmail),
        name: cleanEmail.split('@')[0],
        email: cleanEmail,
        authProvider: 'email',
        avatarUrl: DEMO_USER.avatarUrl,
      };
      users.push(user);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    }

    // Generate random 6-digit code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Log locally
    this.sendSimulatedEmail(
      cleanEmail,
      'suporte.dinheirosemfiltro@gmail.com',
      'Dinheiro Sem Filtro (Suporte)',
      '[Dinheiro Sem Filtro] Código para Redefinição de Senha',
      `Olá ${user.name},\n\nRecebemos uma solicitação de redefinição de senha enviada de suporte.dinheirosemfiltro@gmail.com para sua conta do Dinheiro Sem Filtro.\n\nSeu código de segurança para redefinir a senha é: ${resetCode}\n\nCopie e digite este código no aplicativo para cadastrar sua nova senha com segurança.`
    );

    // Call server API route
    try {
      const response = await fetch('/api/send-reset-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          resetCode,
          userName: user.name,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: data.message || `✉️ Instruções e código enviados com sucesso de suporte.dinheirosemfiltro@gmail.com para ${cleanEmail}! Verifique sua caixa de entrada e Spam.`,
          code: resetCode,
          emailSent: data.emailSent,
        };
      }
    } catch (err) {
      console.warn('[Reset Email API call fallback]', err);
    }

    return {
      success: true,
      message: `✉️ Instruções e código enviados com sucesso de suporte.dinheirosemfiltro@gmail.com para ${cleanEmail}! Verifique sua caixa de entrada e Spam.`,
      code: resetCode,
    };
  }

  static sendPasswordResetCode(email: string): { success: boolean; message: string; code?: string } {
    this.initialize();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, message: 'Informe seu e-mail cadastrado.' };
    }

    const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
    const users: User[] = JSON.parse(usersStr);
    let user = users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      user = {
        id: getUserIdForEmail(cleanEmail),
        name: cleanEmail.split('@')[0],
        email: cleanEmail,
        authProvider: 'email',
        avatarUrl: DEMO_USER.avatarUrl,
      };
      users.push(user);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    }

    // Generate random 6-digit code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Log email
    this.sendSimulatedEmail(
      cleanEmail,
      'suporte.dinheirosemfiltro@gmail.com',
      'Dinheiro Sem Filtro (Suporte)',
      '[Dinheiro Sem Filtro] Código para Redefinição de Senha',
      `Olá ${user.name},\n\nRecebemos uma solicitação de redefinição de senha enviada de suporte.dinheirosemfiltro@gmail.com para sua conta do Dinheiro Sem Filtro.\n\nSeu código de segurança para redefinir a senha é: ${resetCode}\n\nCopie e digite este código no aplicativo para cadastrar sua nova senha com segurança.\n\nSe você não solicitou a redefinição, desconsidere esta mensagem.`
    );

    return {
      success: true,
      message: `✉️ Instruções e código enviados com sucesso de suporte.dinheirosemfiltro@gmail.com para ${cleanEmail}! Verifique sua caixa de entrada e Spam.`,
      code: resetCode,
    };
  }

  static updateUserPassword(email: string, newPassword: string): { success: boolean; message: string } {
    this.initialize();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, message: 'E-mail é obrigatório.' };
    }
    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: 'A nova senha deve ter no mínimo 6 caracteres.' };
    }

    const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
    const users: User[] = JSON.parse(usersStr);
    const idx = users.findIndex((u) => u.email.toLowerCase() === cleanEmail);

    if (idx >= 0) {
      users[idx].password = newPassword;
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    }

    return {
      success: true,
      message: '✅ Senha redefinida com sucesso! Você já pode acessar sua conta com a nova senha.',
    };
  }

  static purgeOtherUsersLocalData(_activeUserId: string) {
    // Keep local records intact so multi-user switching / offline cache is not lost
  }

  static logout(_clearUserData = false, _targetUserId?: string) {
    try {
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
    } catch (e) {
      console.warn('[StorageService.logout error]', e);
    }
  }

  static updateUserProfile(userId: string, newName: string, avatarUrl?: string): User | null {
    this.initialize();
    const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
    try {
      const users: User[] = JSON.parse(usersStr);
      const idx = users.findIndex((u) => u.id === userId);
      if (idx !== -1) {
        users[idx].name = newName;
        if (avatarUrl !== undefined) {
          users[idx].avatarUrl = avatarUrl;
        }
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      }
    } catch (e) {
      // ignore
    }

    const currentUser = this.getCurrentUser();
    if (currentUser) {
      currentUser.name = newName;
      if (avatarUrl !== undefined) {
        currentUser.avatarUrl = avatarUrl;
      }
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
      pushUserToFirestore(currentUser);
      fetch('/api/users/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentUser),
      }).catch(() => {});
      return currentUser;
    }
    return null;
  }

  // Reset all transactions and account initial balances to 0 for clean start
  static resetUserBudgetToZero(budgetId: string) {
    this.initialize();

    // 1. Remove all transactions for this budgetId
    const allTxStr = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS) || '[]';
    const allTx: Transaction[] = JSON.parse(allTxStr);
    const filteredTx = allTx.filter((t) => t.userId !== budgetId);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(filteredTx));

    // 2. Set initial balance of all user accounts to 0
    const allAccStr = localStorage.getItem(STORAGE_KEYS.ACCOUNTS) || '[]';
    const allAcc: Account[] = JSON.parse(allAccStr);
    const updatedAcc = allAcc.map((a) => {
      if (a.userId === budgetId) {
        return { ...a, initialBalance: 0.0 };
      }
      return a;
    });
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updatedAcc));

    fetch('/api/data/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: budgetId }),
    }).catch(() => {});
  }

  // --- SHARED BUDGET MANAGEMENT ---
  static getEffectiveBudgetId(user: User): string {
    if (!user) return 'default';
    return getCanonicalUserId(user.budgetId || user.id || user.email || 'default');
  }

  static getSharedBudget(budgetId: string, ownerUser?: User): SharedBudget {
    this.initialize();
    const allBudgets = this.deduplicateSharedBudgets();

    const currentUserId = ownerUser ? getCanonicalUserId(ownerUser.budgetId || ownerUser.id || ownerUser.email || 'default') : '';
    const targetId = budgetId || currentUserId || 'default';
    const canonicalId = getCanonicalUserId(targetId);
    const isOwnerRequested = !budgetId || (ownerUser && (budgetId === ownerUser.id || budgetId === ownerUser.email || budgetId === ownerUser.budgetId));
    
    const cleanEmail = (budgetId && budgetId.includes('@')) 
      ? budgetId.trim().toLowerCase() 
      : (isOwnerRequested && ownerUser ? (ownerUser.email || '').trim().toLowerCase() : (budgetId && !budgetId.includes('_') ? budgetId.trim().toLowerCase() : ''));

    let budget = allBudgets.find((b) => 
      b.budgetId === budgetId || 
      b.budgetId === canonicalId || 
      (budgetId && b.ownerEmail?.toLowerCase() === budgetId.toLowerCase())
    );

    if (!budget && cleanEmail) {
      budget = allBudgets.find((b) => (b.ownerEmail || '').trim().toLowerCase() === cleanEmail);
    }

    if (!budget && isOwnerRequested && ownerUser) {
      const ownerEmailClean = (ownerUser.email || '').trim().toLowerCase();
      budget = allBudgets.find((b) => (b.ownerEmail || '').trim().toLowerCase() === ownerEmailClean);
    }

    // Check registered users list if still not found
    if (!budget) {
      const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
      const users: User[] = JSON.parse(usersStr);
      const foundUser = users.find(u => u.id === targetId || u.id === canonicalId || isEmailMatch(u.email, targetId) || isEmailMatch(u.email, cleanEmail) || u.sharedBudgetCode === targetId);
      if (foundUser) {
        const fEmail = foundUser.email || 'titular@exemplo.com';
        const fName = foundUser.name || fEmail.split('@')[0];
        const fCode = foundUser.sharedBudgetCode || getDeterministicBudgetCode(fEmail, fName);
        budget = {
          budgetId: getCanonicalUserId(foundUser.id || fEmail),
          ownerId: getCanonicalUserId(foundUser.id || fEmail),
          ownerName: fName,
          ownerEmail: fEmail,
          code: fCode,
          collaborators: [],
        };
        allBudgets.push(budget);
        localStorage.setItem(STORAGE_KEYS.SHARED_BUDGETS, JSON.stringify(allBudgets));
      }
    }

    if (!budget) {
      const effectiveEmail = cleanEmail || (isOwnerRequested ? ownerUser?.email : '') || (budgetId && budgetId.includes('@') ? budgetId : 'titular@exemplo.com');
      const ownerName = (isOwnerRequested && ownerUser ? ownerUser.name : null) || (effectiveEmail !== 'titular@exemplo.com' ? effectiveEmail.split('@')[0] : 'Orçamento ' + (budgetId || 'Compartilhado'));
      const code = (isOwnerRequested ? ownerUser?.sharedBudgetCode : null) || getDeterministicBudgetCode(effectiveEmail, ownerName);

      budget = {
        budgetId: canonicalId,
        ownerId: canonicalId,
        ownerName,
        ownerEmail: effectiveEmail,
        code,
        collaborators: [],
      };
      allBudgets.push(budget);
      localStorage.setItem(STORAGE_KEYS.SHARED_BUDGETS, JSON.stringify(allBudgets));
    } else {
      let updated = false;

      const isOwnerMatch = ownerUser && (ownerUser.id === budget.ownerId || ownerUser.email?.toLowerCase() === budget.ownerEmail.toLowerCase() || (isOwnerRequested && ownerUser.id === currentUserId));
      // Update ownerName if user changed name and matches owner
      if (isOwnerMatch && ownerUser && ownerUser.name && budget.ownerName !== ownerUser.name) {
        budget.ownerName = ownerUser.name;
        updated = true;
      }

      // Update ownerEmail if ownerUser email matches
      if (isOwnerMatch && ownerUser && ownerUser.email && budget.ownerEmail !== ownerUser.email) {
        budget.ownerEmail = ownerUser.email;
        updated = true;
      }

      // Enforce canonical ID & deterministic code
      if (budget.ownerEmail && budget.ownerEmail !== 'titular@exemplo.com') {
        const canonicalCode = getDeterministicBudgetCode(budget.ownerEmail, budget.ownerName);
        if (budget.code !== canonicalCode) {
          budget.code = canonicalCode;
          updated = true;
        }
        if (budget.budgetId !== canonicalId || budget.ownerId !== canonicalId) {
          budget.budgetId = canonicalId;
          budget.ownerId = canonicalId;
          updated = true;
        }
      }

      // Filter out owner from collaborators list
      const ownerEmailLower = budget.ownerEmail.toLowerCase();
      const filteredCollabs = (budget.collaborators || []).filter(
        (c) => c.email.toLowerCase() !== ownerEmailLower
      );
      if (filteredCollabs.length !== budget.collaborators.length) {
        budget.collaborators = filteredCollabs;
        updated = true;
      }

      if (updated) {
        localStorage.setItem(STORAGE_KEYS.SHARED_BUDGETS, JSON.stringify(allBudgets));
      }

      // Fill in missing collaborator names if known
      budget.collaborators.forEach((c) => {
        if (!c.name || c.name === c.email || c.name.trim() === '') {
          const knownName = this.getUserNameByEmail(c.email);
          if (knownName) {
            c.name = knownName;
            updated = true;
          }
        }
      });

      if (updated) {
        localStorage.setItem(STORAGE_KEYS.SHARED_BUDGETS, JSON.stringify(allBudgets));
      }
    }

    // Always background sync user budget to server so other devices can discover code or email
    if (budget.ownerEmail && budget.ownerEmail !== 'titular@exemplo.com') {
      fetch('/api/shared-budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(budget),
      }).catch(() => {});
    }

    return budget;
  }

  // --- MULTI-DEVICE SERVER SYNC FOR NOTIFICATIONS AND SHARED BUDGETS ---
  static async syncNotificationsWithServer(userEmail: string, userBudgetCode?: string): Promise<BudgetNotification[]> {
    this.initialize();
    if (!userEmail && !userBudgetCode) return [];
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    const cleanCode = (userBudgetCode || '').trim().toUpperCase();

    try {
      const emailParam = cleanEmail ? `email=${encodeURIComponent(cleanEmail)}` : '';
      const codeParam = cleanCode ? `code=${encodeURIComponent(cleanCode)}` : '';
      const queryStr = [emailParam, codeParam].filter(Boolean).join('&');

      const res = await fetch(`/api/notifications?${queryStr}`);
      if (res.ok) {
        const data = await res.json();
        const serverNotifs: BudgetNotification[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.notifications)
          ? data.notifications
          : [];

        const localNotifsStr = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]';
        const localNotifs: BudgetNotification[] = JSON.parse(localNotifsStr);

        const map = new Map<string, BudgetNotification>();
        localNotifs.forEach((n) => map.set(n.id, n));
        // Server notifications take precedence and populate the local map
        serverNotifs.forEach((n) => {
          map.set(n.id, n);
        });

        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(merged));
      }
    } catch (err) {
      console.warn('[Sync Notifications Error]', err);
    }

    // Also sync shared budgets
    if (cleanEmail) {
      await this.syncSharedBudgetsWithServer(cleanEmail);
    }

    return this.getPendingNotifications(cleanEmail, cleanCode);
  }

  static async syncSharedBudgetsWithServer(userEmail: string): Promise<SharedBudget[]> {
    this.initialize();
    if (!userEmail) return [];
    try {
      const res = await fetch(`/api/shared-budgets?email=${encodeURIComponent(userEmail.trim().toLowerCase())}`);
      if (res.ok) {
        const serverBudgets: SharedBudget[] = await res.json();
        const localBudgets = this.deduplicateSharedBudgets();

        const map = new Map<string, SharedBudget>();
        localBudgets.forEach((b) => {
          const key = (b.ownerEmail || '').toLowerCase() || b.budgetId;
          map.set(key, b);
        });
        serverBudgets.forEach((b) => {
          const key = (b.ownerEmail || '').toLowerCase() || b.budgetId;
          const existing = map.get(key);
          if (!existing) {
            map.set(key, b);
          } else {
            // Merge collaborators
            const collabsMap = new Map<string, BudgetCollaborator>();
            (existing.collaborators || []).forEach((c) => collabsMap.set(c.email.toLowerCase(), c));
            (b.collaborators || []).forEach((c) => collabsMap.set(c.email.toLowerCase(), c));
            existing.collaborators = Array.from(collabsMap.values());
            map.set(key, existing);
          }
        });

        const merged = Array.from(map.values());
        localStorage.setItem(STORAGE_KEYS.SHARED_BUDGETS, JSON.stringify(merged));
        return this.deduplicateSharedBudgets();
      }
    } catch (err) {
      console.warn('[Sync Shared Budgets Error]', err);
    }
    return this.deduplicateSharedBudgets();
  }

  // --- NOTIFICATIONS & EMAIL LOGS ---
  static getNotifications(userEmail: string): BudgetNotification[] {
    this.initialize();
    const allStr = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]';
    const all: BudgetNotification[] = JSON.parse(allStr);
    const lower = (userEmail || '').trim().toLowerCase();
    return all.filter((n) => isEmailMatch(n.toEmail, lower) || isEmailMatch(n.fromEmail, lower));
  }

  static getPendingNotifications(userEmail: string, userBudgetCode?: string): BudgetNotification[] {
    this.initialize();
    let all: BudgetNotification[] = [];
    try {
      const allStr = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]';
      all = JSON.parse(allStr);
      if (!Array.isArray(all)) all = [];
    } catch {
      all = [];
    }
    const lower = (userEmail || '').trim().toLowerCase();
    let cleanCode = (userBudgetCode || '').trim().toUpperCase();

    if (!cleanCode && lower) {
      const userSharedBudget = this.getSharedBudget(lower);
      if (userSharedBudget && userSharedBudget.code) {
        cleanCode = userSharedBudget.code.trim().toUpperCase();
      }
    }

    const sharedBudgetsStr = localStorage.getItem(STORAGE_KEYS.SHARED_BUDGETS) || '[]';
    const sharedBudgets: SharedBudget[] = JSON.parse(sharedBudgetsStr);

    let storageChanged = false;

    const pending = all.filter((n) => {
      if (n.status !== 'pending') return false;

      // 1. Outgoing notifications (sent BY current user) must never appear as incoming pending notifications to the sender!
      if (lower && n.fromEmail && isEmailMatch(n.fromEmail, lower)) {
        return false;
      }

      // 2. Filter matching criteria:
      // - For 'invite': Must be sent directly TO the current user's email (n.toEmail === lower).
      // - For 'request': Must be sent TO current user's email (n.toEmail === lower) OR to current user's budget code.
      const matchesEmail = lower && n.toEmail && isEmailMatch(n.toEmail, lower);
      const matchesCode = cleanCode && n.budgetCode && n.budgetCode.trim().toUpperCase() === cleanCode;

      if (n.type === 'invite') {
        if (!matchesEmail) return false;
      } else if (n.type === 'request') {
        if (!matchesEmail && !matchesCode) return false;
      } else {
        if (!matchesEmail && !matchesCode) return false;
      }

      // Only 'request' and 'invite' count as actionable pending notifications
      if (n.type !== 'request' && n.type !== 'invite') {
        return false;
      }

      return true;
    });

    if (storageChanged) {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(all));
    }

    // Filter duplicates by fromEmail + budgetId + type so only 1 pending request shows
    const uniquePending: BudgetNotification[] = [];
    const seenKeys = new Set<string>();

    for (const n of pending) {
      const key = `${normalizeUserEmail(n.fromEmail)}_${n.budgetId}_${n.type}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniquePending.push(n);
      }
    }

    return uniquePending;
  }

  static addNotification(notif: Omit<BudgetNotification, 'id' | 'createdAt' | 'status'>): BudgetNotification {
    this.initialize();
    const allStr = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]';
    const all: BudgetNotification[] = JSON.parse(allStr);
    const newNotif: BudgetNotification = {
      ...notif,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      status: notif.type === 'info' ? ('read' as any) : 'pending',
      createdAt: new Date().toISOString(),
    };
    all.unshift(newNotif);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(all));

    // Get current shared budget info if relevant
    const sharedBudgetsStr = localStorage.getItem(STORAGE_KEYS.SHARED_BUDGETS) || '[]';
    const sharedBudgets: SharedBudget[] = JSON.parse(sharedBudgetsStr);
    const targetBudget = sharedBudgets.find((b) => b.budgetId === notif.budgetId || b.code === notif.budgetCode);

    // Sync notification and shared budget to backend server for multi-device delivery
    fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newNotif, sharedBudget: targetBudget }),
    }).catch((err) => console.warn('[Add notification server sync error]', err));

    return newNotif;
  }

  static sendSimulatedEmail(
    toEmail: string,
    fromEmail: string,
    fromName: string,
    subject: string,
    body: string
  ): EmailLog {
    this.initialize();
    const allStr = localStorage.getItem(STORAGE_KEYS.EMAIL_LOGS) || '[]';
    const all: EmailLog[] = JSON.parse(allStr);
    const newEmail: EmailLog = {
      id: `email_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      toEmail,
      fromEmail,
      fromName,
      subject,
      body,
      sentAt: new Date().toISOString(),
      status: 'delivered',
    };
    all.unshift(newEmail);
    localStorage.setItem(STORAGE_KEYS.EMAIL_LOGS, JSON.stringify(all));
    return newEmail;
  }

  static getEmailLogs(userEmail: string): EmailLog[] {
    this.initialize();
    const allStr = localStorage.getItem(STORAGE_KEYS.EMAIL_LOGS) || '[]';
    const all: EmailLog[] = JSON.parse(allStr);
    const lower = userEmail.toLowerCase();
    return all.filter((e) => e.toEmail.toLowerCase() === lower || e.fromEmail.toLowerCase() === lower);
  }

  static respondToNotification(notifId: string, action: 'accept' | 'reject', currentUser: User): { success: boolean; message: string; updatedUser?: User } {
    this.initialize();
    const allStr = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]';
    const all: BudgetNotification[] = JSON.parse(allStr);
    const notifIndex = all.findIndex((n) => n.id === notifId);
    if (notifIndex < 0) return { success: false, message: 'Notificação não encontrada.' };

    const notif = all[notifIndex];
    const newStatus = action === 'accept' ? 'accepted' : 'rejected';

    // Mark ALL matching pending notifications from same requester/invite as accepted/rejected
    all.forEach((n) => {
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
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(all));

    const isAccepted = action === 'accept';
    const actionText = isAccepted ? 'autorizou e conectou' : 'recusou';

    // Notify requester/inviter
    this.addNotification({
      type: 'info',
      fromUserId: currentUser.id,
      fromName: currentUser.name,
      fromEmail: currentUser.email,
      toEmail: notif.fromEmail,
      budgetId: notif.budgetId,
      budgetCode: '',
      message: `${currentUser.name} (${currentUser.email}) ${actionText} a conexão do orçamento.`,
    });

    // Send email to inviter/requester
    this.sendSimulatedEmail(
      notif.fromEmail,
      currentUser.email,
      currentUser.name,
      `[Dinheiro Sem Filtro] ${currentUser.name} ${actionText} a conexão do orçamento`,
      `Olá ${notif.fromName},\n\nO usuário ${currentUser.name} (${currentUser.email}) ${actionText} a autorização de compartilhamento do orçamento.\n\nAtenciosamente,\nEquipe Dinheiro Sem Filtro.`
    );

    // Sync response to server
    fetch('/api/notifications/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notifId, action, currentUser }),
    }).catch((err) => console.warn('[Respond notification server sync error]', err));

    if (isAccepted) {
      const budgetsStr = localStorage.getItem(STORAGE_KEYS.SHARED_BUDGETS) || '[]';
      const allBudgets: SharedBudget[] = JSON.parse(budgetsStr);
      let targetBudget = allBudgets.find((b) => b.budgetId === notif.budgetId || b.code === notif.budgetCode);

      if (!targetBudget) {
        targetBudget = this.getSharedBudget(notif.budgetId, currentUser);
      }

      if (targetBudget) {
        // Person to add to collaborators:
        // If 'invite', currentUser accepted invite from owner.
        // If 'request', currentUser (owner) accepted request from notif.fromEmail.
        const personToAddEmail = notif.type === 'invite' ? currentUser.email : notif.fromEmail;
        const personToAddName = notif.type === 'invite' ? currentUser.name : notif.fromName;

        if (!targetBudget.collaborators.some((c) => c.email.toLowerCase() === personToAddEmail.toLowerCase())) {
          targetBudget.collaborators.push({
            email: personToAddEmail,
            name: personToAddName,
            addedAt: new Date().toISOString(),
            role: 'collaborator',
            accessMode: 'edit',
          });
          const idx = allBudgets.findIndex((b) => b.budgetId === targetBudget!.budgetId);
          if (idx >= 0) allBudgets[idx] = targetBudget;
          else allBudgets.push(targetBudget);
          localStorage.setItem(STORAGE_KEYS.SHARED_BUDGETS, JSON.stringify(allBudgets));
        }

        // Also update that person's user profile in USERS
        const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
        const users: User[] = JSON.parse(usersStr);
        const uIdx = users.findIndex((u) => u.email.toLowerCase() === personToAddEmail.toLowerCase());
        if (uIdx >= 0) {
          users[uIdx].budgetId = targetBudget.budgetId;
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        }

        const updatedUser: User = { ...currentUser, budgetId: targetBudget.budgetId };
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));

        return {
          success: true,
          message: `✉️ Autorização aceita e conexão realizada com sucesso!`,
          updatedUser,
        };
      }
    }

    return {
      success: true,
      message: action === 'accept' ? 'Autorização aceita com sucesso!' : 'Solicitação recusada com sucesso.',
    };
  }

  static async resendNotification(
    notifId: string,
    currentUser?: User
  ): Promise<{ success: boolean; message: string }> {
    this.initialize();
    const allStr = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]';
    const all: BudgetNotification[] = JSON.parse(allStr);
    const notif = all.find((n) => n.id === notifId);
    if (!notif) {
      return { success: false, message: 'Notificação não encontrada.' };
    }

    notif.createdAt = new Date().toISOString();
    notif.status = 'pending';
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(all));

    try {
      await fetch('/api/notifications/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifId, currentUser, notif }),
      });

      if (notif.type === 'invite') {
        fetch('/api/send-invitation-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toEmail: notif.toEmail,
            inviterName: notif.fromName,
            inviterEmail: notif.fromEmail,
            budgetCode: notif.budgetCode,
          }),
        }).catch(() => {});
      } else if (notif.type === 'request') {
        fetch('/api/send-access-request-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toEmail: notif.toEmail,
            requesterName: notif.fromName,
            requesterEmail: notif.fromEmail,
            budgetCode: notif.budgetCode,
          }),
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('[Resend notification error]', err);
    }

    window.dispatchEvent(new CustomEvent('notifications_updated'));

    return {
      success: true,
      message: `🔄 Convite/solicitação para ${notif.toEmail} reenviado com sucesso!`,
    };
  }

  static getSentPendingNotifications(userEmail: string): BudgetNotification[] {
    this.initialize();
    if (!userEmail) return [];
    const allStr = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]';
    const all: BudgetNotification[] = JSON.parse(allStr);
    const lower = userEmail.trim().toLowerCase();
    return all.filter((n) => isEmailMatch(n.fromEmail, lower) && n.status === 'pending');
  }

  static cancelNotification(notifId: string): { success: boolean; message: string } {
    this.initialize();
    const allStr = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]';
    let all: BudgetNotification[] = JSON.parse(allStr);
    all = all.filter((n) => n.id !== notifId);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('notifications_updated'));
    return { success: true, message: 'Solicitação/convite cancelado com sucesso.' };
  }

  static async addCollaboratorByEmail(
    ownerUser: User,
    emailToAdd: string,
    accessMode: 'edit' | 'read' = 'edit'
  ): Promise<{ success: boolean; message: string; sharedBudget?: SharedBudget }> {
    this.initialize();
    const budgetId = this.getEffectiveBudgetId(ownerUser);
    const budget = this.getSharedBudget(budgetId, ownerUser);

    const query = emailToAdd.trim().toLowerCase();
    if (!query) {
      return { success: false, message: 'Informe o e-mail do convidado.' };
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!query.includes('@') || !emailRegex.test(query)) {
      return { success: false, message: 'E-mail inválido. Por favor, digite um e-mail válido.' };
    }

    const cleanEmail = query;

    if (isEmailMatch(cleanEmail, ownerUser.email)) {
      return { success: false, message: 'Você não pode conceder acesso ao seu próprio e-mail.' };
    }

    if (budget.collaborators.some((c) => isEmailMatch(c.email, cleanEmail))) {
      return { success: false, message: 'Este usuário já possui acesso a este orçamento.' };
    }

    // Verify if the target user exists in the database
    let guestUserExists = false;
    let guestUserName = cleanEmail.split('@')[0];

    // 1. Check local users
    const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
    const users: User[] = JSON.parse(usersStr);
    const localUser = users.find((u) => isEmailMatch(u.email, cleanEmail));
    if (localUser) {
      guestUserExists = true;
      if (localUser.name) guestUserName = localUser.name;
    }

    // 2. Check Appwrite fail-safe findUserAccount and server lookup
    if (!guestUserExists) {
      try {
        const appwriteDoc = await findUserAccount(cleanEmail);
        if (appwriteDoc) {
          guestUserExists = true;
          if (appwriteDoc.userId) {
            guestUserName = String(appwriteDoc.userId).split('@')[0];
          }
        }
      } catch (e) {
        console.warn('[Appwrite findUserAccount error]', e);
      }
    }

    if (!guestUserExists) {
      try {
        const res = await fetch(`/api/users/lookup?email=${encodeURIComponent(cleanEmail)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            guestUserExists = true;
            if (data.user.name) guestUserName = data.user.name;
            // Cache in local storage
            if (!users.some((u) => isEmailMatch(u.email, cleanEmail))) {
              users.push(data.user);
              localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
            }
          }
        }
      } catch (err) {
        console.warn('[Lookup server user error]', err);
      }
    }

    if (!guestUserExists) {
      return { success: false, message: 'E-mail inválido ou não cadastrado no banco de dados.' };
    }

    // Check if Guest B ALREADY sent a pending request to Owner A's budget
    const notifsStr = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]';
    const allNotifs: BudgetNotification[] = JSON.parse(notifsStr);

    const reciprocalRequest = allNotifs.find(
      (n) =>
        n.status === 'pending' &&
        n.type === 'request' &&
        n.budgetId === budget.budgetId &&
        isEmailMatch(n.fromEmail, cleanEmail)
    );

    if (reciprocalRequest) {
      // Reciprocal match found! Instantly accept Guest B's request!
      const res = this.respondToNotification(reciprocalRequest.id, 'accept', ownerUser);
      const updatedBudget = this.getSharedBudget(budget.budgetId, ownerUser);
      window.dispatchEvent(new CustomEvent('notifications_updated'));

      return {
        success: true,
        message: `🎉 Conexão estabelecida com sucesso! ${cleanEmail} já foi adicionado(a) ao seu orçamento.`,
        sharedBudget: updatedBudget,
      };
    }

    // Check if there is ALREADY a pending invite sent by Owner A to Guest B
    const existingPending = allNotifs.find(
      (n) =>
        n.status === 'pending' &&
        n.budgetId === budget.budgetId &&
        isEmailMatch(n.toEmail, cleanEmail)
    );

    if (existingPending) {
      // Automatically Re-send existing pending invite!
      await this.resendNotification(existingPending.id, ownerUser);
      return {
        success: true,
        message: `🔄 Convite reenviado com sucesso para ${cleanEmail}! Notificação atualizada e e-mail disparado.`,
        sharedBudget: budget,
      };
    }

    // 1. Send single pending notification for guest
    this.addNotification({
      type: 'invite',
      fromUserId: ownerUser.id,
      fromName: ownerUser.name,
      fromEmail: ownerUser.email,
      toEmail: cleanEmail,
      budgetId: budget.budgetId,
      budgetCode: '',
      message: `✉️ CONVITE RECEBIDO: ${ownerUser.name} (${ownerUser.email}) convidou você para se conectar e compartilhar o orçamento.`,
    });

    // Appwrite user_financials pending_invites & shared_members update
    try {
      const cfg = getAppwriteConfig();
      const dbId = cfg.databaseId;
      if (dbId) {
        const guestDocId = getCanonicalAppwriteDocId(cleanEmail);
        const ownerDocId = getCanonicalAppwriteDocId(ownerUser.email || ownerUser.id);
        
        let guestData: any = {};
        try {
          const guestDoc = await appwriteDatabases.getDocument(dbId, 'user_financials', guestDocId);
          if (guestDoc && guestDoc.data) {
            guestData = typeof guestDoc.data === 'string' ? JSON.parse(guestDoc.data) : guestDoc.data;
          }
        } catch (e) {}

        if (!Array.isArray(guestData.pedidos_acesso)) {
          guestData.pedidos_acesso = guestData.pending_invites || [];
        }

        const newInvite = {
          id: ID.unique ? ID.unique() : `inv_${Date.now()}`,
          from_email: ownerUser.email.toLowerCase().trim(),
          from_name: ownerUser.name || 'Titular',
          target_email: cleanEmail,
          type: 'INVITE',
          owner_budget_id: ownerDocId,
          mode: accessMode || 'full',
          created_at: new Date().toISOString(),
          emailRemetente: ownerUser.email.toLowerCase().trim(),
          timestamp: new Date().toISOString(),
          status: 'pendente'
        };

        guestData.pedidos_acesso = guestData.pedidos_acesso.filter((inv: any) => !isEmailMatch(inv.from_email || inv.emailRemetente, ownerUser.email));
        guestData.pedidos_acesso.push(newInvite);

        const guestPayload = {
          userId: cleanEmail,
          data: JSON.stringify(guestData)
        };

        try {
          await appwriteDatabases.updateDocument(dbId, 'user_financials', guestDocId, guestPayload);
        } catch {
          await appwriteDatabases.createDocument(dbId, 'user_financials', guestDocId, guestPayload, [
            Permission.read(Role.users()),
            Permission.update(Role.users()),
            Permission.delete(Role.users())
          ]);
        }

        // Update Owner document shared_members
        try {
          const ownerDoc = await appwriteDatabases.getDocument(dbId, 'user_financials', ownerDocId);
          let ownerData: any = {};
          if (ownerDoc && ownerDoc.data) {
            ownerData = typeof ownerDoc.data === 'string' ? JSON.parse(ownerDoc.data) : ownerDoc.data;
          }
          if (!Array.isArray(ownerData.shared_members)) {
            ownerData.shared_members = [];
          }
          if (!ownerData.shared_members.some((m: string) => isEmailMatch(m, cleanEmail))) {
            ownerData.shared_members.push(cleanEmail);
          }
          await appwriteDatabases.updateDocument(
            dbId,
            'user_financials',
            ownerDocId,
            {
              userId: ownerUser.email || ownerUser.id,
              data: JSON.stringify(ownerData)
            },
            [
              Permission.read(Role.users()),
              Permission.update(Role.users()),
              Permission.delete(Role.users())
            ]
          );
        } catch (ownerErr) {
          console.warn('[Appwrite owner shared_members update error]', ownerErr);
        }
      }
    } catch (appwriteErr) {
      console.warn('[Appwrite user_financials invite error]', appwriteErr);
    }

    // Mutação blindada do JSON para o convidado
    const targetEmail = cleanEmail.toLowerCase().trim();
    const targetKey = `darla_financial_data_${targetEmail}`;
    const rawTargetData = localStorage.getItem(targetKey) || '{}';
    let jsonAtual: any = {};
    try {
      jsonAtual = rawTargetData ? JSON.parse(rawTargetData) : {};
    } catch {
      jsonAtual = {};
    }
    if (!Array.isArray(jsonAtual.shared_requests)) {
      jsonAtual.shared_requests = [];
    }
    jsonAtual.shared_requests.push({
      from: ownerUser.email,
      fromName: ownerUser.name,
      type: 'invite',
      status: 'pending',
      timestamp: new Date().toISOString()
    });
    localStorage.setItem(targetKey, JSON.stringify(jsonAtual));
    fetch('/api/financials/update-shared-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail, shared_requests: jsonAtual.shared_requests })
    }).catch(err => console.warn('[Update shared_requests server error]', err));

    // 2. Simulated & Real SMTP Email sent to guest
    this.sendSimulatedEmail(
      cleanEmail,
      ownerUser.email,
      ownerUser.name,
      `[Dinheiro Sem Filtro] Convite para Conectar ao Orçamento de ${ownerUser.name}`,
      `Olá!\n\n${ownerUser.name} (${ownerUser.email}) enviou um convite para você compartilhar o orçamento dele(a).\n\nAcesse o aplicativo Dinheiro Sem Filtro para autorizar e conectar.`
    );

    // Trigger real backend SMTP email dispatch
    fetch('/api/send-invitation-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEmail: cleanEmail,
        inviterName: ownerUser.name,
        inviterEmail: ownerUser.email,
        budgetCode: budget.code,
      }),
    }).catch((err) => console.warn('[SMTP Invitation API call error]', err));

    window.dispatchEvent(new CustomEvent('notifications_updated'));

    return {
      success: true,
      message: `✉️ Convite de acesso enviado com sucesso para ${cleanEmail}! Aguardando a autorização do convidado.`,
      sharedBudget: budget,
    };
  }

  static async joinBudgetByCodeOrEmail(
    currentUser: User,
    emailOrCode: string
  ): Promise<{ success: boolean; message: string; updatedUser?: User }> {
    this.initialize();
    const query = emailOrCode.trim().toLowerCase();
    if (!query) {
      return { success: false, message: 'Informe o e-mail do titular do orçamento.' };
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (query.includes('@') && !emailRegex.test(query)) {
      return { success: false, message: 'E-mail inválido. Por favor, digite um e-mail válido.' };
    }

    const allStr = localStorage.getItem(STORAGE_KEYS.SHARED_BUDGETS) || '[]';
    let allBudgets: SharedBudget[] = JSON.parse(allStr);

    let targetBudget: SharedBudget | undefined = allBudgets.find(
      (b) => b.code.toLowerCase() === query || isEmailMatch(b.ownerEmail, query)
    );

    // If not found in local storage, query server lookup endpoint across network/devices
    if (!targetBudget) {
      try {
        const res = await fetch(`/api/shared-budgets/lookup?query=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.sharedBudget) {
            targetBudget = data.sharedBudget;
            if (!allBudgets.some((b) => b.budgetId === targetBudget!.budgetId)) {
              allBudgets.push(targetBudget!);
              localStorage.setItem(STORAGE_KEYS.SHARED_BUDGETS, JSON.stringify(allBudgets));
            }
          }
        }
      } catch (err) {
        console.warn('[Lookup server budget error]', err);
      }
    }

    if (!targetBudget) {
      const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
      const users: User[] = JSON.parse(usersStr);
      const owner = users.find((u) => isEmailMatch(u.email, query) || (u.sharedBudgetCode && u.sharedBudgetCode.toLowerCase() === query));
      if (owner) {
        targetBudget = this.getSharedBudget(owner.id, owner);
      }
    }

    if (!targetBudget) {
      try {
        const appwriteDoc = await findUserAccount(query);
        if (appwriteDoc) {
          const ownerEmail = appwriteDoc.userId || query;
          const ownerId = appwriteDoc.$id || getCanonicalAppwriteDocId(ownerEmail);
          targetBudget = this.getSharedBudget(ownerId, {
            id: ownerId,
            name: ownerEmail.split('@')[0],
            email: ownerEmail,
          });
        }
      } catch (e) {
        console.warn('[Appwrite findUserAccount join error]', e);
      }
    }

    if (!targetBudget) {
      // Also try /api/users/lookup to see if registered user exists
      try {
        const userRes = await fetch(`/api/users/lookup?email=${encodeURIComponent(query)}`);
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.success && userData.user) {
            targetBudget = this.getSharedBudget(userData.user.id, userData.user);
          }
        }
      } catch (e) {}
    }

    if (!targetBudget) {
      return { success: false, message: 'E-mail inválido ou não cadastrado no banco de dados.' };
    }

    const targetEmail = targetBudget.ownerEmail.toLowerCase().trim();

    if (targetBudget.ownerEmail && isEmailMatch(targetBudget.ownerEmail, currentUser.email)) {
      return { success: false, message: 'Este é o seu próprio e-mail.' };
    }

    if (targetBudget.collaborators.some((c) => isEmailMatch(c.email, currentUser.email))) {
      return { success: false, message: 'Você já possui acesso a este orçamento.' };
    }

    const notifsStr = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]';
    const allNotifs: BudgetNotification[] = JSON.parse(notifsStr);

    // Check if Owner A ALREADY sent a pending invite to Guest B (currentUser)
    const reciprocalInvite = allNotifs.find(
      (n) =>
        n.status === 'pending' &&
        n.type === 'invite' &&
        n.budgetId === targetBudget!.budgetId &&
        isEmailMatch(n.toEmail, currentUser.email)
    );

    if (reciprocalInvite) {
      // Reciprocal match found! Instantly accept Owner A's invitation!
      const res = this.respondToNotification(reciprocalInvite.id, 'accept', currentUser);
      if (res.success && res.updatedUser) {
        window.dispatchEvent(new CustomEvent('notifications_updated'));
        return {
          success: true,
          message: `🎉 Convite de ${targetBudget!.ownerName} aceito com sucesso! Você foi conectado ao orçamento.`,
          updatedUser: res.updatedUser,
        };
      }
    }

    // Check if there is ALREADY a pending request from this user to this budget
    const existingPending = allNotifs.find(
      (n) =>
        n.status === 'pending' &&
        n.budgetId === targetBudget!.budgetId &&
        isEmailMatch(n.fromEmail, currentUser.email)
    );

    if (existingPending) {
      // Re-send existing request!
      await this.resendNotification(existingPending.id, currentUser);
      return {
        success: true,
        message: `🔄 Solicitação de acesso reenviada com sucesso para o titular (${targetBudget.ownerName})! Notificação atualizada.`,
      };
    }

    // 1. In-app notification for budget owner
    this.addNotification({
      type: 'request',
      fromUserId: currentUser.id,
      fromName: currentUser.name,
      fromEmail: currentUser.email,
      toEmail: targetBudget.ownerEmail,
      budgetId: targetBudget.budgetId,
      budgetCode: '',
      message: `📩 SOLICITAÇÃO DE ACESSO: ${currentUser.name} (${currentUser.email}) solicitou sua autorização para acessar e se conectar ao seu orçamento compartilhado.`,
    });

    // Appwrite user_financials pending_invites update for budget owner
    try {
      const cfg = getAppwriteConfig();
      const dbId = cfg.databaseId;
      if (dbId) {
        const ownerDocId = getCanonicalAppwriteDocId(targetEmail);
        let ownerData: any = {};
        try {
          const ownerDoc = await appwriteDatabases.getDocument(dbId, 'user_financials', ownerDocId);
          if (ownerDoc && ownerDoc.data) {
            ownerData = typeof ownerDoc.data === 'string' ? JSON.parse(ownerDoc.data) : ownerDoc.data;
          }
        } catch (e) {}

        if (!Array.isArray(ownerData.pedidos_acesso)) {
          ownerData.pedidos_acesso = ownerData.pending_invites || [];
        }

        const newRequest = {
          id: ID.unique ? ID.unique() : `req_${Date.now()}`,
          from_email: currentUser.email.toLowerCase().trim(),
          from_name: currentUser.name || 'Solicitante',
          target_email: targetEmail,
          type: 'REQUEST',
          owner_budget_id: ownerDocId,
          mode: 'full',
          created_at: new Date().toISOString(),
          emailRemetente: currentUser.email.toLowerCase().trim(),
          timestamp: new Date().toISOString(),
          status: 'pendente'
        };

        ownerData.pedidos_acesso = ownerData.pedidos_acesso.filter((inv: any) => !isEmailMatch(inv.from_email || inv.emailRemetente, currentUser.email));
        ownerData.pedidos_acesso.push(newRequest);

        const ownerPayload = {
          userId: targetEmail,
          data: JSON.stringify(ownerData)
        };

        try {
          await appwriteDatabases.updateDocument(dbId, 'user_financials', ownerDocId, ownerPayload);
        } catch {
          await appwriteDatabases.createDocument(dbId, 'user_financials', ownerDocId, ownerPayload, [
            Permission.read(Role.users()),
            Permission.update(Role.users()),
            Permission.delete(Role.users())
          ]);
        }
      }
    } catch (appwriteErr) {
      console.warn('[Appwrite join budget request error]', appwriteErr);
    }
    const targetKey = `darla_financial_data_${targetEmail}`;
    const rawTargetData = localStorage.getItem(targetKey) || '{}';
    let jsonAtual: any = {};
    try {
      jsonAtual = rawTargetData ? JSON.parse(rawTargetData) : {};
    } catch {
      jsonAtual = {};
    }
    if (!Array.isArray(jsonAtual.shared_requests)) {
      jsonAtual.shared_requests = [];
    }
    jsonAtual.shared_requests.push({
      from: currentUser.email,
      fromName: currentUser.name,
      type: 'access_request',
      status: 'pending',
      timestamp: new Date().toISOString()
    });
    localStorage.setItem(targetKey, JSON.stringify(jsonAtual));
    fetch('/api/financials/update-shared-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail, shared_requests: jsonAtual.shared_requests })
    }).catch(err => console.warn('[Update shared_requests server error]', err));

    // 2. Email to budget owner
    this.sendSimulatedEmail(
      targetBudget.ownerEmail,
      currentUser.email,
      currentUser.name,
      `[Dinheiro Sem Filtro] Solicitação de Autorização do Orçamento: ${currentUser.name}`,
      `Olá ${targetBudget.ownerName},\n\n${currentUser.name} (${currentUser.email}) solicitou sua autorização para acessar e se conectar ao seu orçamento financeiro compartilhado.\n\nAcesse o aplicativo para autorizar e conectar.`
    );

    // Trigger real backend SMTP email dispatch
    fetch('/api/send-access-request-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEmail: targetBudget.ownerEmail,
        requesterName: currentUser.name,
        requesterEmail: currentUser.email,
        budgetCode: targetBudget.code,
      }),
    }).catch((err) => console.warn('[SMTP Request API call error]', err));

    window.dispatchEvent(new CustomEvent('notifications_updated'));

    return {
      success: true,
      message: `📩 Solicitação enviada com sucesso para ${targetBudget.ownerName} (${targetBudget.ownerEmail})! O titular receberá a notificação para autorizar.`,
    };
  }

  static getAvailableBudgetsForUser(user: User): { budget: SharedBudget; isOwner: boolean; isActive: boolean }[] {
    this.initialize();
    const effectiveBudgetId = this.getEffectiveBudgetId(user);
    const allBudgets = this.deduplicateSharedBudgets();
    const userEmail = (user.email || '').trim().toLowerCase();

    // Ensure user's own budget exists
    const ownBudget = this.getSharedBudget(user.id, user);

    const availableMap = new Map<string, SharedBudget>();
    availableMap.set(userEmail, ownBudget);

    allBudgets.forEach((b) => {
      if (!b || !b.ownerEmail) return;
      const bOwnerEmail = b.ownerEmail.trim().toLowerCase();
      const isOwner = bOwnerEmail === userEmail || b.ownerId === user.id;
      const isCollab = b.collaborators.some((c) => isEmailMatch(c.email, userEmail));
      if (isOwner) {
        availableMap.set(userEmail, ownBudget);
      } else if (isCollab) {
        availableMap.set(bOwnerEmail, b);
      }
    });

    return Array.from(availableMap.values()).map((budget) => {
      const isOwner = (budget.ownerEmail || '').trim().toLowerCase() === userEmail || budget.ownerId === user.id;
      return {
        budget,
        isOwner,
        isActive: budget.budgetId === effectiveBudgetId || (isOwner && effectiveBudgetId === ownBudget.budgetId),
      };
    });
  }

  static switchBudget(currentUser: User, newBudgetId?: string): User {
    this.initialize();
    const updatedUser: User = {
      ...currentUser,
      budgetId: newBudgetId || currentUser.id,
    };

    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
    const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
    const users: User[] = JSON.parse(usersStr);
    const uIdx = users.findIndex((u) => u.id === currentUser.id);
    if (uIdx >= 0) {
      users[uIdx] = updatedUser;
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    }

    return updatedUser;
  }

  static removeCollaborator(budgetId: string, emailToRemove: string): SharedBudget | null {
    this.initialize();
    const allStr = localStorage.getItem(STORAGE_KEYS.SHARED_BUDGETS) || '[]';
    const allBudgets: SharedBudget[] = JSON.parse(allStr);

    const budget = allBudgets.find((b) => b.budgetId === budgetId);
    if (!budget) return null;

    budget.collaborators = budget.collaborators.filter(
      (c) => c.email.toLowerCase() !== emailToRemove.trim().toLowerCase()
    );

    localStorage.setItem(STORAGE_KEYS.SHARED_BUDGETS, JSON.stringify(allBudgets));

    fetch('/api/shared-budgets/remove-collaborator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ budgetId, email: emailToRemove }),
    }).catch(() => {});

    return budget;
  }

  static updateCollaboratorAccessMode(
    budgetId: string,
    emailToUpdate: string,
    accessMode: 'edit' | 'read'
  ): SharedBudget | null {
    this.initialize();
    const allStr = localStorage.getItem(STORAGE_KEYS.SHARED_BUDGETS) || '[]';
    const allBudgets: SharedBudget[] = JSON.parse(allStr);

    const budget = allBudgets.find((b) => b.budgetId === budgetId);
    if (!budget) return null;

    const collab = budget.collaborators.find((c) => c.email.toLowerCase() === emailToUpdate.trim().toLowerCase());
    if (collab) {
      collab.accessMode = accessMode;
      localStorage.setItem(STORAGE_KEYS.SHARED_BUDGETS, JSON.stringify(allBudgets));

      fetch('/api/shared-budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(budget),
      }).catch(() => {});
    }

    return budget;
  }

  static isCurrentUserReadOnly(user: User): boolean {
    this.initialize();
    const effectiveBudgetId = this.getEffectiveBudgetId(user);
    if (effectiveBudgetId === user.id) return false; // Owner of personal budget

    const budget = this.getSharedBudget(effectiveBudgetId, user);
    if (budget.ownerEmail.toLowerCase() === user.email.toLowerCase()) return false;

    const collab = budget.collaborators.find((c) => c.email.toLowerCase() === user.email.toLowerCase());
    if (collab && collab.accessMode === 'read') {
      return true;
    }
    return false;
  }

  // --- CATEGORIES ---
  static getCategories(userId: string): Category[] {
    this.initialize();
    const canonicalId = getCanonicalUserId(userId);
    return _inMemoryStore.categories.filter((c) => getCanonicalUserId(c.userId) === canonicalId);
  }

  static saveCategory(category: Category): Category {
    const canonicalId = getCanonicalUserId(category.userId);
    const catToSave = { ...category, userId: canonicalId };
    const index = _inMemoryStore.categories.findIndex((c) => c.id === catToSave.id);
    if (index >= 0) {
      _inMemoryStore.categories[index] = catToSave;
    } else {
      _inMemoryStore.categories.push(catToSave);
    }
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(_inMemoryStore.categories));
    } catch (e) {}
    pushCategoryToFirestore(catToSave);
    this.syncUserMutationToServer(canonicalId);
    return catToSave;
  }

  static deleteCategory(categoryId: string) {
    const cat = _inMemoryStore.categories.find((c) => c.id === categoryId);
    _inMemoryStore.categories = _inMemoryStore.categories.filter((c) => c.id !== categoryId);
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(_inMemoryStore.categories));
    } catch (e) {}
    const currUser = this.getCurrentUser();
    const targetUserId = cat?.userId || currUser?.id || '';
    const canonicalId = getCanonicalUserId(targetUserId);
    this.markAsDeleted(categoryId, canonicalId, 'categories');
    deleteCategoryFromFirestore(categoryId);
    if (canonicalId) {
      this.syncUserMutationToServer(canonicalId);
    }
  }

  // --- ACCOUNTS ---
  static getAccounts(userId: string): Account[] {
    this.initialize();
    const canonicalId = getCanonicalUserId(userId);
    return _inMemoryStore.accounts.filter((a) => getCanonicalUserId(a.userId) === canonicalId);
  }

  static saveAccount(account: Account): Account {
    const currUser = this.getCurrentUser();
    const canonicalId = getCanonicalUserId(account.userId || currUser?.id || 'default');
    
    const parsedInitialBalance = typeof account.initialBalance === 'number'
      ? account.initialBalance
      : (parseFloat(String(account.initialBalance).replace(',', '.')) || 0);

    const accToSave: Account = {
      ...account,
      userId: canonicalId,
      initialBalance: parsedInitialBalance,
      updatedAt: new Date().toISOString(),
      _pendingSync: true,
    };

    const index = _inMemoryStore.accounts.findIndex((a) => a.id === accToSave.id);
    if (index >= 0) {
      _inMemoryStore.accounts[index] = { ..._inMemoryStore.accounts[index], ...accToSave };
    } else {
      _inMemoryStore.accounts.push(accToSave);
    }
    try {
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(_inMemoryStore.accounts));
    } catch (e) {}
    pushAccountToFirestore(accToSave);
    this.syncUserMutationToServer(canonicalId);
    return accToSave;
  }

  static setAccounts(accounts: Account[]) {
    this.initialize();
    _inMemoryStore.accounts = accounts;
    try {
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
    } catch (e) {}
  }

  static setCategories(categories: Category[]) {
    this.initialize();
    _inMemoryStore.categories = categories;
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    } catch (e) {}
  }

  static setFamilyMembers(familyMembers: FamilyMember[]) {
    this.initialize();
    _inMemoryStore.familyMembers = familyMembers;
    try {
      localStorage.setItem(STORAGE_KEYS.FAMILY_MEMBERS, JSON.stringify(familyMembers));
    } catch (e) {}
  }

  static setTransactions(transactions: Transaction[]) {
    this.initialize();
    _inMemoryStore.transactions = transactions;
    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    } catch (e) {}
  }

  static setGoals(goals: Goal[]) {
    this.initialize();
    _inMemoryStore.goals = goals;
    try {
      localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
    } catch (e) {}
  }

  static deleteAccount(accountId: string) {
    const acc = _inMemoryStore.accounts.find((a) => a.id === accountId);
    _inMemoryStore.accounts = _inMemoryStore.accounts.filter((a) => a.id !== accountId);
    try {
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(_inMemoryStore.accounts));
    } catch (e) {}
    const currUser = this.getCurrentUser();
    const targetUserId = acc?.userId || currUser?.id || '';
    const canonicalId = getCanonicalUserId(targetUserId);
    this.markAsDeleted(accountId, canonicalId, 'accounts');
    deleteAccountFromFirestore(accountId);
    if (canonicalId) {
      this.syncUserMutationToServer(canonicalId);
    }
  }

  // --- TRANSACTIONS ---
  static getTransactions(userId: string): Transaction[] {
    this.initialize();
    const canonicalId = getCanonicalUserId(userId);
    return _inMemoryStore.transactions.filter((t) => getCanonicalUserId(t.userId) === canonicalId);
  }

  static addTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>): Transaction {
    const canonicalId = getCanonicalUserId(transaction.userId);
    const newTx: Transaction = {
      ...transaction,
      userId: canonicalId,
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      createdAt: new Date().toISOString(),
      _pendingSync: true,
    };
    _inMemoryStore.transactions.push(newTx);
    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(_inMemoryStore.transactions));
    } catch (e) {}
    createAppwriteTransaction(canonicalId, newTx).catch(() => {});
    pushTransactionToFirestore(newTx);
    this.syncUserMutationToServer(canonicalId);
    return newTx;
  }

  static addMultipleTransactions(transactions: Omit<Transaction, 'id' | 'createdAt'>[]): Transaction[] {
    const added: Transaction[] = [];

    transactions.forEach((t, idx) => {
      const canonicalId = getCanonicalUserId(t.userId);
      const newTx: Transaction = {
        ...t,
        userId: canonicalId,
        id: `tx_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
        createdAt: new Date().toISOString(),
        _pendingSync: true,
      };
      _inMemoryStore.transactions.push(newTx);
      added.push(newTx);
      createAppwriteTransaction(canonicalId, newTx).catch(() => {});
      pushTransactionToFirestore(newTx);
    });

    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(_inMemoryStore.transactions));
    } catch (e) {}

    if (added.length > 0) {
      this.syncUserMutationToServer(added[0].userId);
    }
    return added;
  }

  static updateTransaction(transaction: Transaction): Transaction {
    const canonicalId = getCanonicalUserId(transaction.userId);
    const index = _inMemoryStore.transactions.findIndex((t) => t.id === transaction.id);
    const updatedTx = { ...transaction, userId: canonicalId, updatedAt: new Date().toISOString(), _pendingSync: true };
    if (index >= 0) {
      _inMemoryStore.transactions[index] = updatedTx;
      try {
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(_inMemoryStore.transactions));
      } catch (e) {}
      updateAppwriteTransaction(canonicalId, updatedTx).catch(() => {});
      pushTransactionToFirestore(updatedTx);
      this.syncUserMutationToServer(canonicalId);
    }
    return updatedTx;
  }

  static toggleConsolidated(transactionId: string): Transaction | null {
    const tx = _inMemoryStore.transactions.find((t) => t.id === transactionId);
    if (tx) {
      tx.isConsolidated = !tx.isConsolidated;
      tx.updatedAt = new Date().toISOString();
      try {
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(_inMemoryStore.transactions));
      } catch (e) {}
      updateAppwriteTransaction(tx.userId, tx).catch(() => {});
      pushTransactionToFirestore(tx);
      this.syncUserMutationToServer(tx.userId);
      return tx;
    }
    return null;
  }

  static deleteTransaction(transactionId: string) {
    const tx = _inMemoryStore.transactions.find((t) => t.id === transactionId);
    _inMemoryStore.transactions = _inMemoryStore.transactions.filter((t) => t.id !== transactionId);
    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(_inMemoryStore.transactions));
    } catch (e) {}
    const currUser = this.getCurrentUser();
    const targetUserId = tx?.userId || currUser?.id || '';
    const canonicalId = getCanonicalUserId(targetUserId);
    this.markAsDeleted(transactionId, canonicalId, 'transactions');
    deleteAppwriteTransaction(canonicalId, transactionId).catch(() => {});
    deleteTransactionFromFirestore(transactionId);
    if (canonicalId) {
      this.syncUserMutationToServer(canonicalId);
    }
  }

  // --- GOALS ---
  static getGoals(userId: string): Goal[] {
    this.initialize();
    const canonicalId = getCanonicalUserId(userId);
    return _inMemoryStore.goals.filter((g) => getCanonicalUserId(g.userId) === canonicalId);
  }

  static saveGoal(goal: Goal): Goal {
    const canonicalId = getCanonicalUserId(goal.userId);
    const index = _inMemoryStore.goals.findIndex((g) => g.id === goal.id);
    const updatedGoal = { ...goal, userId: canonicalId };
    if (index >= 0) {
      _inMemoryStore.goals[index] = updatedGoal;
    } else {
      _inMemoryStore.goals.push(updatedGoal);
    }
    try {
      localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(_inMemoryStore.goals));
    } catch (e) {}
    pushGoalToFirestore(updatedGoal);
    this.syncUserMutationToServer(canonicalId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('portfolio_updated'));
      window.dispatchEvent(new Event('remote_data_updated'));
      window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId: canonicalId } }));
    }
    return updatedGoal;
  }

  static updateGoalProgress(goalId: string, addedAmount: number): Goal | null {
    const goal = _inMemoryStore.goals.find((g) => g.id === goalId);
    if (goal) {
      goal.currentAmount = Math.max(0, goal.currentAmount + addedAmount);
      try {
        localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(_inMemoryStore.goals));
      } catch (e) {}
      pushGoalToFirestore(goal);
      this.syncUserMutationToServer(goal.userId);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('portfolio_updated'));
        window.dispatchEvent(new Event('remote_data_updated'));
        window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId: goal.userId } }));
      }
      return goal;
    }
    return null;
  }

  static deleteGoal(goalId: string) {
    const goal = _inMemoryStore.goals.find((g) => g.id === goalId);
    _inMemoryStore.goals = _inMemoryStore.goals.filter((g) => g.id !== goalId);
    try {
      localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(_inMemoryStore.goals));
    } catch (e) {}
    const currUser = this.getCurrentUser();
    const targetUserId = goal?.userId || currUser?.id || '';
    const canonicalId = getCanonicalUserId(targetUserId);
    this.markAsDeleted(goalId, canonicalId, 'goals');
    deleteGoalFromFirestore(goalId);
    if (canonicalId) {
      this.syncUserMutationToServer(canonicalId);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('portfolio_updated'));
      window.dispatchEvent(new Event('remote_data_updated'));
      window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId: canonicalId } }));
    }
  }

  // --- BUDGET GOALS (50/30/20 STRATEGY) ---
  static getBudgetGoals(userId: string = 'default'): { essentials: number; lifestyle: number; investment: number } {
    this.initialize();
    const canonicalId = getCanonicalUserId(userId);
    try {
      const stored = localStorage.getItem(`${STORAGE_KEYS.BUDGET_GOALS}_${canonicalId}`) || localStorage.getItem(STORAGE_KEYS.BUDGET_GOALS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.essentials === 'number' && typeof parsed.lifestyle === 'number' && typeof parsed.investment === 'number') {
          return {
            essentials: parsed.essentials,
            lifestyle: parsed.lifestyle,
            investment: parsed.investment,
          };
        }
      }
    } catch {}
    return { essentials: 50, lifestyle: 30, investment: 20 };
  }

  static saveBudgetGoals(goals: { essentials: number; lifestyle: number; investment: number }, userId: string = 'default'): void {
    this.initialize();
    const canonicalId = getCanonicalUserId(userId);
    try {
      const sanitized = {
        essentials: Number(goals.essentials) || 50,
        lifestyle: Number(goals.lifestyle) || 30,
        investment: Number(goals.investment) || 20,
      };
      localStorage.setItem(`${STORAGE_KEYS.BUDGET_GOALS}_${canonicalId}`, JSON.stringify(sanitized));
      localStorage.setItem(STORAGE_KEYS.BUDGET_GOALS, JSON.stringify(sanitized));
    } catch {}
  }

  // --- FAMILY MEMBERS ---
  static getFamilyMembers(userId: string): FamilyMember[] {
    this.initialize();
    const canonicalId = getCanonicalUserId(userId);
    return _inMemoryStore.familyMembers.filter((fm) => getCanonicalUserId(fm.userId) === canonicalId);
  }

  static saveFamilyMember(member: FamilyMember): FamilyMember {
    const canonicalId = getCanonicalUserId(member.userId);
    const updatedMember = { ...member, userId: canonicalId };
    const index = _inMemoryStore.familyMembers.findIndex((f) => f.id === member.id);
    if (index >= 0) {
      _inMemoryStore.familyMembers[index] = updatedMember;
    } else {
      _inMemoryStore.familyMembers.push(updatedMember);
    }
    try {
      localStorage.setItem(STORAGE_KEYS.FAMILY_MEMBERS, JSON.stringify(_inMemoryStore.familyMembers));
    } catch (e) {}
    pushFamilyMemberToFirestore(updatedMember);
    this.syncUserMutationToServer(canonicalId);
    return updatedMember;
  }

  static deleteFamilyMember(id: string) {
    const fm = _inMemoryStore.familyMembers.find((f) => f.id === id);
    _inMemoryStore.familyMembers = _inMemoryStore.familyMembers.filter((f) => f.id !== id);
    try {
      localStorage.setItem(STORAGE_KEYS.FAMILY_MEMBERS, JSON.stringify(_inMemoryStore.familyMembers));
    } catch (e) {}
    const currUser = this.getCurrentUser();
    const targetUserId = fm?.userId || currUser?.id || '';
    const canonicalId = getCanonicalUserId(targetUserId);
    this.markAsDeleted(id, canonicalId, 'familyMembers');
    deleteFamilyMemberFromFirestore(id);
    if (canonicalId) {
      this.syncUserMutationToServer(canonicalId);
    }
  }

  static getUserNameByEmail(email: string): string {
    if (!email || !email.includes('@')) return '';
    this.initialize();
    const lower = email.trim().toLowerCase();

    // 1. Check current user
    const currStr = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (currStr) {
      try {
        const curr: User = JSON.parse(currStr);
        if (curr.email && curr.email.toLowerCase() === lower && curr.name && curr.name.trim() !== '' && curr.name.toLowerCase() !== lower) {
          return curr.name;
        }
      } catch (e) {}
    }

    // 2. Check USERS array
    const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
    try {
      const users: User[] = JSON.parse(usersStr);
      const found = users.find((u) => u.email && u.email.toLowerCase() === lower && u.name && u.name.trim() !== '' && u.name.toLowerCase() !== lower);
      if (found && found.name) return found.name;
    } catch (e) {}

    // 3. Check SHARED_BUDGETS ownerName
    const budgetsStr = localStorage.getItem(STORAGE_KEYS.SHARED_BUDGETS) || '[]';
    try {
      const budgets: SharedBudget[] = JSON.parse(budgetsStr);
      const foundBudget = budgets.find((b) => b.ownerEmail && b.ownerEmail.toLowerCase() === lower && b.ownerName && b.ownerName.trim() !== '' && b.ownerName.toLowerCase() !== lower);
      if (foundBudget && foundBudget.ownerName) return foundBudget.ownerName;

      // 4. Check SHARED_BUDGETS collaborators
      for (const b of budgets) {
        const collab = b.collaborators?.find((c) => c.email && c.email.toLowerCase() === lower && c.name && c.name.trim() !== '' && c.name.toLowerCase() !== lower);
        if (collab && collab.name) return collab.name;
      }
    } catch (e) {}

    // 5. Check NOTIFICATIONS
    const notifsStr = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]';
    try {
      const notifs: BudgetNotification[] = JSON.parse(notifsStr);
      const foundNotif = notifs.find((n) => n.fromEmail && n.fromEmail.toLowerCase() === lower && n.fromName && n.fromName.trim() !== '' && n.fromName.toLowerCase() !== lower);
      if (foundNotif && foundNotif.fromName) return foundNotif.fromName;

      const foundNotifTo = notifs.find((n) => n.toEmail && n.toEmail.toLowerCase() === lower && n.fromName && n.fromName.trim() !== '' && n.fromName.toLowerCase() !== lower);
      if (foundNotifTo && foundNotifTo.fromName) return foundNotifTo.fromName;
    } catch (e) {}

    // Fallback: Format clean display name from email prefix (e.g. "danilujb" -> "Danilujb")
    const prefix = lower.split('@')[0];
    const formatted = prefix
      .split(/[\._-]/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    return formatted || prefix;
  }

  // --- USER ACCOUNT DELETION ---
  static async deleteUserAccount(userId: string): Promise<void> {
    this.initialize();

    const cleanInput = (userId || '').trim().toLowerCase();
    const isInputEmail = cleanInput.includes('@');
    const canonicalId = getCanonicalUserId(cleanInput);

    // 1. Retrieve user details before removing
    const usersStr = localStorage.getItem(STORAGE_KEYS.USERS) || '[]';
    let users: User[] = [];
    try {
      users = JSON.parse(usersStr);
    } catch (e) {
      users = [];
    }
    const targetUser = users.find(
      (u) =>
        (u.id && (u.id.toLowerCase() === cleanInput || u.id === canonicalId)) ||
        (u.email && u.email.toLowerCase() === cleanInput)
    );
    const userEmail = isInputEmail ? cleanInput : (targetUser?.email ? targetUser.email.toLowerCase() : '');

    // 2. Remove user from USERS table
    const filteredUsers = users.filter(
      (u) =>
        u.id !== userId &&
        u.id !== canonicalId &&
        u.id.toLowerCase() !== cleanInput &&
        (userEmail ? (u.email || '').toLowerCase() !== userEmail : true)
    );
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(filteredUsers));

    // 3. Clear budget data associated with user
    this.resetUserBudgetToZero(userId);
    if (canonicalId !== userId) {
      this.resetUserBudgetToZero(canonicalId);
    }

    const accsStr = localStorage.getItem(STORAGE_KEYS.ACCOUNTS) || '[]';
    const accs: Account[] = JSON.parse(accsStr).filter((a: Account) => a.userId !== userId && a.userId !== canonicalId);
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accs));

    const catsStr = localStorage.getItem(STORAGE_KEYS.CATEGORIES) || '[]';
    const cats: Category[] = JSON.parse(catsStr).filter((c: Category) => c.userId !== userId && c.userId !== canonicalId);
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(cats));

    const goalsStr = localStorage.getItem(STORAGE_KEYS.GOALS) || '[]';
    const goals: Goal[] = JSON.parse(goalsStr).filter((g: Goal) => g.userId !== userId && g.userId !== canonicalId);
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));

    const famStr = localStorage.getItem(STORAGE_KEYS.FAMILY_MEMBERS) || '[]';
    const fam: FamilyMember[] = JSON.parse(famStr).filter((f: FamilyMember) => f.userId !== userId && f.userId !== canonicalId);
    localStorage.setItem(STORAGE_KEYS.FAMILY_MEMBERS, JSON.stringify(fam));

    // 4. Remove all shared budgets owned by this user
    const budgetsStr = localStorage.getItem(STORAGE_KEYS.SHARED_BUDGETS) || '[]';
    let budgets: SharedBudget[] = JSON.parse(budgetsStr);
    budgets = budgets.filter((b) => b.ownerId !== userId && b.ownerId !== canonicalId && (userEmail ? b.ownerEmail.toLowerCase() !== userEmail : true));

    // Also remove user from collaborators in all remaining shared budgets
    if (userEmail) {
      budgets.forEach((b) => {
        b.collaborators = b.collaborators.filter((c) => c.email.toLowerCase() !== userEmail);
      });
    }
    localStorage.setItem(STORAGE_KEYS.SHARED_BUDGETS, JSON.stringify(budgets));

    // 5. Remove all notifications for this user
    const notifsStr = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]';
    let notifs: BudgetNotification[] = JSON.parse(notifsStr);
    notifs = notifs.filter(
      (n) =>
        n.fromUserId !== userId &&
        n.fromUserId !== canonicalId &&
        (userEmail ? n.toEmail.toLowerCase() !== userEmail && n.fromEmail.toLowerCase() !== userEmail : true)
    );
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifs));

    // 6. Delete gamification state
    localStorage.removeItem(`darla_gamification_state_${userId}`);
    localStorage.removeItem(`darla_gamification_state_${canonicalId}`);
    if (userEmail) {
      localStorage.removeItem(`darla_gamification_state_${userEmail}`);
    }

    // 7. Delete portfolio data
    PortfolioStorageService.clearAllData(userId);
    PortfolioStorageService.clearAllData(canonicalId);

    // 8. Delete immediately on backend server
    try {
      await fetch('/api/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, email: userEmail }),
      });
    } catch (e) {
      console.warn('[StorageService] Server delete request failed:', e);
    }

    // 9. Async cleanup in Firebase Firestore
    deleteUserFromFirestore(userId);
    if (canonicalId !== userId) {
      deleteUserFromFirestore(canonicalId);
    }

    // 10. Dispatch local events
    window.dispatchEvent(new CustomEvent('data_updated_event'));
    window.dispatchEvent(new CustomEvent('portfolio_updated_event'));
    window.dispatchEvent(new CustomEvent('notifications_updated_event'));
    window.dispatchEvent(new CustomEvent('shared_budget_updated_event'));
    window.dispatchEvent(new CustomEvent('gamification_updated_event'));

    // 11. Clear session and log out
    this.logout();
  }

  static async wipeSystem() {
    try {
      await fetch('/api/admin/wipe-all-database', { method: 'POST' });
    } catch (e) {}
    if (typeof window !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  }

  // --- CLIENT SESSION & SINGLE DEVICE LOCK ---
  static getClientSessionId(): string {
    if (typeof window === 'undefined') return 'server_session';
    let sessId = sessionStorage.getItem('darla_client_session_id');
    if (!sessId) {
      sessId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem('darla_client_session_id', sessId);
    }
    return sessId;
  }

  static initNewSession(): string {
    if (typeof window === 'undefined') return 'server_session';
    const sessId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem('darla_client_session_id', sessId);
    localStorage.setItem('darla_active_session_id', sessId);
    return sessId;
  }

  // --- CHECK PENDING UNSYNCED DATA ---
  static hasPendingSync(budgetId?: string): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const u = this.getCurrentUser();
      const targetBudgetId = budgetId || (u ? this.getEffectiveBudgetId(u) : 'default');
      const txs = this.getTransactions(targetBudgetId);
      if (txs.some((t: any) => t._pendingSync === true)) return true;
      const accs = this.getAccounts(targetBudgetId);
      if (accs.some((a: any) => a._pendingSync === true)) return true;
      const cats = this.getCategories(targetBudgetId);
      if (cats.some((c: any) => c._pendingSync === true)) return true;
      const goals = this.getGoals(targetBudgetId);
      if (goals.some((g: any) => g._pendingSync === true)) return true;
      const fam = this.getFamilyMembers(targetBudgetId);
      if (fam.some((f: any) => f._pendingSync === true)) return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  static getPendingSyncCount(budgetId?: string): number {
    if (typeof window === 'undefined') return 0;
    try {
      const u = this.getCurrentUser();
      const targetBudgetId = budgetId || (u ? this.getEffectiveBudgetId(u) : 'default');
      let count = 0;
      count += this.getTransactions(targetBudgetId).filter((t: any) => t._pendingSync === true).length;
      count += this.getAccounts(targetBudgetId).filter((a: any) => a._pendingSync === true).length;
      count += this.getCategories(targetBudgetId).filter((c: any) => c._pendingSync === true).length;
      count += this.getGoals(targetBudgetId).filter((g: any) => g._pendingSync === true).length;
      count += this.getFamilyMembers(targetBudgetId).filter((f: any) => f._pendingSync === true).length;
      return count;
    } catch (e) {
      return 0;
    }
  }
}
