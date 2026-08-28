export type AccountType = 'checking' | 'credit' | 'cash' | 'savings' | 'other';

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  color: string;
  icon: string;
  isDefault?: boolean;
  updatedAt?: string;
  _pendingSync?: boolean;
}

export type CategoryType = 'income' | 'expense';
export type RuleGroup = '50_essentials' | '30_lifestyle' | '20_investment' | 'income';

export interface Subcategory {
  id: string;
  categoryId: string;
  parentId?: string;
  name: string;
  subcategories?: Subcategory[];
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  ruleGroup?: RuleGroup;
  color: string;
  icon: string;
  subcategories: Subcategory[];
  updatedAt?: string;
  _pendingSync?: boolean;
}

export interface FamilyMember {
  id: string;
  userId: string;
  name: string;
  color?: string;
  relationship?: string;
  updatedAt?: string;
  _pendingSync?: boolean;
}

export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  targetAccountId?: string; // For transfers
  type: TransactionType;
  amount: number;
  date: string; // YYYY-MM-DD
  description: string;
  categoryId: string;
  subcategoryId?: string;
  familyMemberId?: string;
  familyMemberName?: string;
  isConsolidated: boolean; // Efetivada / Conciliada
  installmentIndex?: number; // e.g. 1
  installmentTotal?: number; // e.g. 12
  parentInstallmentId?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  _pendingSync?: boolean;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // YYYY-MM-DD
  startDate?: string; // YYYY-MM-DD
  category?: string;
  color: string;
  icon: string;
  notes?: string;
  yieldRate?: number; // e.g. 0.8 (% per month or year)
  yieldPeriod?: 'monthly' | 'yearly'; // 'monthly' | 'yearly'
  updatedAt?: string;
  _pendingSync?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  authProvider?: 'email' | 'google';
  avatarUrl?: string;
  budgetId?: string; // ID of the budget currently being accessed
  createdAt?: string; // ISO date string when account was created
  isPro?: boolean; // Whether the user has an active paid plan
  plan?: 'mensal' | 'trimestral' | 'anual' | 'free' | string;
  subscriptionStatus?: 'trial' | 'active' | 'expired' | 'canceled';
  subscriptionAutoRenew?: boolean; // Se renovação automática está ativa
  subscriptionCanceledAt?: string; // Data ISO de cancelamento
  subscriptionPurchasedAt?: string; // Data ISO de compra da assinatura
  trialEndsAt?: string;
  sharedBudgetCode?: string;
  lastSessionId?: string;
  lastSessionCreatedAt?: string;
}

export interface BudgetCollaborator {
  email: string;
  name?: string;
  addedAt: string;
  role: 'owner' | 'collaborator' | string;
  accessMode?: 'edit' | 'read'; // 'edit' = Modo Edição (Completo), 'read' = Modo Leitura (Apenas Visualizar)
}

export interface SharedBudget {
  budgetId: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  code: string; // E.g. "DARLA-8492"
  collaborators: BudgetCollaborator[];
}

export interface MonthSummary {
  year: number;
  month: number; // 1-12
  startingBalance: number; // Saldo que veio do mês anterior
  totalIncome: number;
  totalExpenses: number;
  endingBalance: number; // Saldo acumulado ao final do mês
  consolidatedIncome: number;
  consolidatedExpenses: number;
  consolidatedBalance: number;
  pendingIncome: number;
  pendingExpenses: number;
}

export interface AppNotification {
  id: string;
  type: 'budget_request' | 'budget_invite_accepted' | 'budget_invite_declined' | 'invite' | 'request' | 'info';
  senderEmail?: string;
  targetEmail?: string;
  status: 'pending' | 'read' | 'resolved' | 'accepted' | 'rejected';
  createdAt: string;
  fromUserId?: string;
  fromName?: string;
  fromEmail?: string;
  toEmail?: string;
  budgetId?: string;
  budgetCode?: string;
  message?: string;
}

export type BudgetNotification = AppNotification;

export interface EmailLog {
  id: string;
  toEmail: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  body: string;
  sentAt: string;
  status: 'delivered';
}

export type LeagueDivision =
  | 'Bronze'
  | 'Prata'
  | 'Ouro'
  | 'Safira'
  | 'Rubi'
  | 'Esmeralda'
  | 'Ametista'
  | 'Pérola'
  | 'Obsidiana'
  | 'Diamante';

export interface WeeklyQuest {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  gemsReward: number;
  currentProgress: number;
  targetProgress: number;
  completed: boolean;
  category: 'launches' | 'savings' | 'checkin' | 'consolidation';
}

export interface AchievementBadge {
  id: string;
  title: string;
  description: string;
  iconName: string;
  category: string;
  unlocked: boolean;
  unlockedAt?: string;
}

export interface LeaderboardCompetitor {
  id: string;
  name: string;
  avatarUrl?: string;
  weeklyXP: number;
  isCurrentUser?: boolean;
  weeklyStreak: number;
  division: LeagueDivision;
}

export interface GamificationProfile {
  xp: number;
  gems: number; // ou coins
  weeklyStreak: number;
  inventory: {
    freezes: number;
    doubleXpActiveUntil: string | null;
  };
  claimedMissions: string[];
}

export type UserProfileLevel = 'iniciante' | 'avancado';

export interface WeeklyGamificationState {
  userId: string;
  accountCreatedAt?: string; // Data de criação da conta (ISO date string)
  userProfileLevel?: UserProfileLevel; // 'iniciante' (Foco Reserva) | 'avancado' (Foco Aportes)
  weeklyStreakCount: number; // Ofensiva Semanal (em SEMANAS)
  lastActiveWeekKey: string; // Ex: "2026-W30"
  completedWeeksHistory: string[]; // Array de "YYYY-Wxx" com semana concluída
  xpTotal: number;
  weeklyXP: number; // XP acumulado na semana atual
  gems: number; // Gemas 💎
  streakFreezeCount: number; // Congelamentos de Ofensiva Semanal
  inventory?: {
    freezes: number;
    doubleXpActiveUntil: string | null;
  };
  claimedMissions?: string[];
  currentDivision: LeagueDivision;
  divisionRankPosition: number;
  hasCompletedWeeklyCheckIn: boolean; // Se fez o check-in financeiro da semana
  weeklyQuests: WeeklyQuest[];
  achievements: AchievementBadge[];
  leaderboard: LeaderboardCompetitor[];
  updatedAt?: string;
}

// --- CARTEIRA DO INVESTIDOR TYPES ---
export type AssetCategory =
  | 'acoes'
  | 'fiis'
  | 'tesouro'
  | 'bdr'
  | 'etfs'
  | 'fiagro'
  | 'fundos'
  | 'renda_fixa'
  | 'stocks'
  | 'reits'
  | 'etf_exterior'
  | 'cripto'
  | 'fip'
  | 'fia'
  | 'fi_infra'
  | 'fidc';

export interface InvestmentAsset {
  id: string;
  userId: string;
  ticker: string;
  name: string;
  category: AssetCategory;
  segment: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  priceChange24h: number; // %
  priceChange24hValue: number; // R$
  currency: 'BRL' | 'USD';
  dy?: number; // %
  yieldOnCost?: number; // %
  lastDividendValue?: number;
  totalDividendsAccumulated?: number;
  provisionedDividends?: number;
  riskScore?: number; // 1-10
  returnPct?: number; // %
  notes?: string;
  updatedAt: string;
  _pendingSync?: boolean;
  _synced?: boolean;
}

export interface InvestmentTransaction {
  id: string;
  userId: string;
  assetTicker: string;
  assetCategory: AssetCategory;
  type: 'buy' | 'sell';
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  broker: string; // Rico, Binance, XP, Avenue, etc.
  date: string; // YYYY-MM-DD
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  _pendingSync?: boolean;
  _synced?: boolean;
}

export interface InvestmentDividend {
  id: string;
  userId: string;
  assetTicker: string;
  assetCategory: AssetCategory;
  type: 'dividendo' | 'jcp' | 'rendimento';
  quantity: number;
  valuePerShare: number;
  totalValue: number;
  dateCom: string;
  paymentDate: string;
  status: 'received' | 'future';
  createdAt: string;
  updatedAt?: string;
  _pendingSync?: boolean;
  _synced?: boolean;
}

export interface PortfolioGoal {
  id: string;
  userId: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // YYYY-MM-DD
  startDate?: string;
  category?: string;
  color?: string;
  icon?: string;
  notes?: string;
  yieldRate?: number;
  yieldPeriod?: 'monthly' | 'yearly';
  updatedAt?: string;
  _pendingSync?: boolean;
  _synced?: boolean;
}

export interface MarketQuote {
  id: string;
  name: string;
  symbol: string;
  price: number;
  changePct: number;
  currency: string;
  category: 'currency' | 'index' | 'crypto';
  lastUpdated: string;
  source?: string;
  // Percentage Variations (%)
  variationDaily?: number;      // 24h / Diário
  variationMonthly?: number;    // 30d / Mensal
  variationSemiannual?: number; // 180d / Semestral
  variationAnnual?: number;     // 365d / Anual
  variationAllTime?: number;    // Todo o Período / Histórico
  // Value Changes (R$ or pts)
  changeDailyValue?: number;
  changeMonthlyValue?: number;
  changeSemiannualValue?: number;
  changeAnnualValue?: number;
  changeAllTimeValue?: number;
}

export interface RebalancingSuggestion {
  category: AssetCategory;
  categoryName: string;
  currentAmount: number;
  currentPct: number;
  targetPct: number;
  targetAmount: number;
  differenceAmount: number;
  action: 'comprar' | 'manter' | 'rebalancear';
  recommendation: string;
}

export interface AIBudgetAdvice {
  positivePoints: string[]; // 🟢 Pontos Positivos
  warningPoints: string[];  // 🔴 Pontos de Alerta (Onde cortar/ajustar)
  savingTip: string;        // 💡 Dica Sem Filtro para Economizar
  generatedAt: string;
}

export interface AIPortfolioAdvice {
  score: number; // 0 to 100
  healthStatus: 'Excelente' | 'Equilibrada' | 'Atenção' | 'Alto Risco';
  summary: string;
  positivePoints?: string[]; // 🟢 Pontos Fortes da Carteira
  warningPoints?: string[];  // 🔴 Pontos de Atenção e Riscos
  studyTips?: string[];      // 📚 Dicas de Estudo para a Sua Alocação
  disclaimer?: string;       // ⚠️ Disclaimer (Aviso legal obrigatório)
  diversificationAnalysis?: string;
  riskReturnAnalysis?: string;
  dividendAnalysis?: string;
  currencyExposure?: string;
  rebalancingTips?: RebalancingSuggestion[];
  actionableTips?: string[];
  generatedAt: string;
}

