import { WeeklyGamificationState, LeagueDivision, WeeklyQuest, AchievementBadge, LeaderboardCompetitor } from '../types';
import { StorageService, getCanonicalUserId } from './storage';
import { PortfolioStorageService } from './portfolioStorage';

const STORAGE_KEY_PREFIX = 'darla_gamification_state_';

export function getCurrentISOWeekKey(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Sunday start of week (Sunday = day 0)
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const jan1Day = jan1.getDay();
  const firstSunday = new Date(jan1);
  if (jan1Day !== 0) {
    firstSunday.setDate(jan1.getDate() - jan1Day);
  }
  
  const diffDays = Math.floor((d.getTime() - firstSunday.getTime()) / (1000 * 60 * 60 * 24));
  const weekNo = Math.floor(diffDays / 7) + 1;
  const weekStr = weekNo < 10 ? `0${weekNo}` : `${weekNo}`;
  return `${d.getFullYear()}-W${weekStr}`;
}

export interface DivisionDefinition {
  id: LeagueDivision;
  name: string;
  subtitle: string;
  description: string;
  goal: string;
  financialReq: string;
  color: string;
  bg: string;
  icon: string;
  minXP: number;
}

export const LEAGUE_DIVISIONS: DivisionDefinition[] = [
  {
    id: 'Bronze',
    name: 'Divisão Calote Zero',
    subtitle: '🟤 Mapeamento & Organização',
    description: 'Fase inicial de organização do orçamento, fim dos atrasos e controle total do fluxo financeiro.',
    goal: 'Mapear 100% das contas fixas e estancar pendências em atraso.',
    financialReq: 'Estágio inicial (padrão de entrada ao mapear orçamento, mesmo em déficit ou sem reserva).',
    color: '#CD7F32',
    bg: 'bg-amber-800',
    icon: '🟤',
    minXP: 0,
  },
  {
    id: 'Prata',
    name: 'Divisão Boleto Pago',
    subtitle: '⚪ Contas em Dia',
    description: 'Todas as contas essenciais e boletos quitados dentro da data de vencimento sem atrasos.',
    goal: 'Pagar 100% dos boletos em dia antes do vencimento.',
    financialReq: 'Zero contas/boletos em atraso cadastrados no aplicativo.',
    color: '#C0C0C0',
    bg: 'bg-slate-400',
    icon: '⚪',
    minXP: 300,
  },
  {
    id: 'Ouro',
    name: 'Divisão Sobrou Troco',
    subtitle: '🟡 Superávit Mensal (No Azul)',
    description: 'A conquista do saldo positivo: fechar o mês com receitas maiores do que as despesas.',
    goal: 'Garantir um superávit mensal (Receitas do mês > Despesas do mês).',
    financialReq: 'Superávit Mensal Obrigatório (Receitas > Despesas no mês atual, sem estar em DÉFICIT!).',
    color: '#FFD700',
    bg: 'bg-yellow-500',
    icon: '🟡',
    minXP: 800,
  },
  {
    id: 'Safira',
    name: 'Divisão Reserva Feita',
    subtitle: '🔹 Colchão de Segurança',
    description: 'Fundo de emergência ativo cobrindo de 1 a 6 meses de custo de vida guardados.',
    goal: 'Superávit no mês + Fundo de emergência guardado em Objetivos ou Renda Fixa.',
    financialReq: 'Superávit no mês + Fundo de Reserva de Emergência ativo (mínimo de R$ 100 acumulados).',
    color: '#0F52BA',
    bg: 'bg-blue-600',
    icon: '🔹',
    minXP: 1800,
  },
  {
    id: 'Rubi',
    name: 'Divisão Cartão no Bolso',
    subtitle: '🔴 Consumo Inteligente',
    description: 'Cartão de crédito 100% sob controle, sem parcelamentos acumulados ou faturas atrasadas.',
    goal: 'Manter superávit no mês + Reserva de emergência + Faturas de cartão quitadas sem juros.',
    financialReq: 'Superávit no mês + Reserva de emergência feita + Cartão sem dívidas atrasadas.',
    color: '#E0115F',
    bg: 'bg-rose-600',
    icon: '🔴',
    minXP: 3200,
  },
  {
    id: 'Esmeralda',
    name: 'Divisão Primeiro Aporte',
    subtitle: '🟢 Acesso aos Investimentos',
    description: 'Evolução além da poupança: primeiros aportes em investimentos de renda fixa ou renda variável.',
    goal: 'Efetuar aporte em investimentos com rentabilidade real mantendo a reserva de emergência.',
    financialReq: 'Superávit no mês + Reserva de emergência + Pelo menos 1 Aporte/Investimento realizado.',
    color: '#50C878',
    bg: 'bg-emerald-600',
    icon: '🟢',
    minXP: 5000,
  },
  {
    id: 'Ametista',
    name: 'Divisão Renda Passiva',
    subtitle: '🟣 Proventos em Conta',
    description: 'Os primeiros dividendos, JCP ou juros pingando mensalmente via investimentos.',
    goal: 'Receber proventos ou rendimentos recorrentes dos seus investimentos.',
    financialReq: 'Superávit no mês + Carteira ativa gerando renda passiva mensal.',
    color: '#9966CC',
    bg: 'bg-purple-600',
    icon: '🟣',
    minXP: 7500,
  },
  {
    id: 'Pérola',
    name: 'Divisão Blindado',
    subtitle: '⚪✨ Proteção Patrimonial',
    description: 'Patrimônio diversificado em múltiplas classes de ativos contra inflação e crises.',
    goal: 'Diversificar o patrimônio em 3 ou mais classes de ativos.',
    financialReq: 'Superávit no mês + Carteira diversificada em no mínimo 3 classes de ativos.',
    color: '#FF69B4',
    bg: 'bg-pink-500',
    icon: '⚪✨',
    minXP: 11000,
  },
  {
    id: 'Obsidiana',
    name: 'Divisão Bola de Neve',
    subtitle: '🖤 Multiplicação Exponencial',
    description: 'Reinvestimento de 100% dos proventos e taxa de poupança superior a 20% da renda mensal.',
    goal: 'Poupar/aportar mais de 20% da receita mensal e reinvestir 100% dos dividendos.',
    financialReq: 'Superávit mensal >= 20% da receita total do mês + Reinvestimento ativo.',
    color: '#3B3C36',
    bg: 'bg-neutral-800',
    icon: '🖤',
    minXP: 15000,
  },
  {
    id: 'Diamante',
    name: 'Divisão Liberdade Financeira',
    subtitle: '💎 Autonomia Total',
    description: 'Rendimento passivo dos investimentos cobrindo 100% do custo de vida mensal.',
    goal: 'Viver 100% dos rendimentos passivos gerados pelo patrimônio acumulado.',
    financialReq: 'Renda passiva mensal de investimentos cobrindo 100% das despesas totais.',
    color: '#B9F2FF',
    bg: 'bg-cyan-400',
    icon: '💎',
    minXP: 20000,
  },
];

export interface FinancialQualificationMetrics {
  monthlyIncome: number;
  monthlyExpense: number;
  monthlyBalance: number;
  isDeficit: boolean;
  overdueCount: number;
  emergencyReserveAmount: number;
  hasEmergencyReserve: boolean;
  hasInvestments: boolean;
  hasPassiveIncome: boolean;
}

export function calculateUserFinancialMetrics(userId: string): FinancialQualificationMetrics {
  const currentDate = new Date();
  const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const todayStr = currentDate.toISOString().split('T')[0];

  let monthlyIncome = 0;
  let monthlyExpense = 0;
  let overdueCount = 0;

  try {
    const transactions = StorageService.getTransactions(userId);

    transactions.forEach((tx) => {
      const isCurrentMonth = tx.date && tx.date.startsWith(currentMonthStr);

      if (isCurrentMonth) {
        if (tx.type === 'income') {
          monthlyIncome += tx.amount || 0;
        } else if (tx.type === 'expense') {
          monthlyExpense += tx.amount || 0;
        }
      }

      // Check overdue bills (unpaid expenses before today)
      if (tx.type === 'expense' && !tx.isConsolidated && tx.date < todayStr) {
        overdueCount++;
      }
    });
  } catch (e) {
    // fallback if error reading transactions
  }

  const monthlyBalance = monthlyIncome - monthlyExpense;
  // If expense > income or (income is 0 and expense > 0) -> isDeficit
  const isDeficit = (monthlyIncome === 0 && monthlyExpense > 0) || (monthlyBalance < 0);

  // Emergency reserve check
  let emergencyReserveAmount = 0;
  try {
    const goals = StorageService.getGoals(userId);
    goals.forEach((g) => {
      const nameLower = (g.title || '').toLowerCase();
      const catLower = (g.category || '').toLowerCase();
      if (
        nameLower.includes('reserva') ||
        nameLower.includes('emergência') ||
        nameLower.includes('emergencia') ||
        nameLower.includes('fundo') ||
        catLower.includes('reserva') ||
        catLower.includes('emergência')
      ) {
        emergencyReserveAmount += g.currentAmount || 0;
      }
    });
  } catch (e) {
    // fallback
  }

  const hasEmergencyReserve = emergencyReserveAmount >= 100;

  // Investment check
  let hasInvestments = false;
  let hasPassiveIncome = false;
  try {
    const assets = PortfolioStorageService.getAssets(userId);
    hasInvestments = assets.length > 0 && assets.some((a) => (a.quantity || 0) > 0);

    const invTxs = PortfolioStorageService.getTransactions(userId);
    hasPassiveIncome = invTxs.some((t: any) => t.type === 'dividend' || t.type === 'jcp' || t.type === 'yield');
  } catch (e) {
    // fallback
  }

  return {
    monthlyIncome,
    monthlyExpense,
    monthlyBalance,
    isDeficit,
    overdueCount,
    emergencyReserveAmount,
    hasEmergencyReserve,
    hasInvestments,
    hasPassiveIncome,
  };
}

export function checkDivisionQualification(
  divisionId: LeagueDivision,
  xpTotal: number,
  metrics: FinancialQualificationMetrics
): { metXP: boolean; metFinancial: boolean; reasonIfNotMet?: string } {
  const divObj = LEAGUE_DIVISIONS.find((d) => d.id === divisionId);
  const minXP = divObj ? divObj.minXP : 0;
  const metXP = xpTotal >= minXP;

  let metFinancial = true;
  let reasonIfNotMet: string | undefined = undefined;

  switch (divisionId) {
    case 'Bronze': // Calote Zero
      metFinancial = true; // Estágio inicial sempre acessível
      break;

    case 'Prata': // Boleto Pago
      if (metrics.overdueCount > 0) {
        metFinancial = false;
        reasonIfNotMet = `Você possui ${metrics.overdueCount} conta(s) em atraso. Regularize suas pendências para alcançar esta divisão.`;
      }
      break;

    case 'Ouro': // Sobrou Troco
      if (metrics.overdueCount > 0) {
        metFinancial = false;
        reasonIfNotMet = `Você possui ${metrics.overdueCount} conta(s) em atraso.`;
      } else if (metrics.isDeficit) {
        metFinancial = false;
        reasonIfNotMet = `Sua conta está em DÉFICIT no mês (Despesas R$ ${metrics.monthlyExpense.toFixed(2)} > Receitas R$ ${metrics.monthlyIncome.toFixed(2)}). É necessário fechar no azul (Superávit) para estar nesta divisão.`;
      }
      break;

    case 'Safira': // Reserva Feita
      if (metrics.isDeficit) {
        metFinancial = false;
        reasonIfNotMet = `Sua conta está em DÉFICIT no mês. É necessário estar no azul e possuir Fundo de Reserva de Emergência guardado.`;
      } else if (!metrics.hasEmergencyReserve) {
        metFinancial = false;
        reasonIfNotMet = `Você ainda não possui Reserva de Emergência guardada em seus Objetivos (saldo atual: R$ ${metrics.emergencyReserveAmount.toFixed(2)}). Crie ou alimente um Objetivo de Reserva de Emergência para liberar esta divisão.`;
      }
      break;

    case 'Rubi': // Cartão no Bolso
      if (metrics.isDeficit) {
        metFinancial = false;
        reasonIfNotMet = `Requer fechar o mês no azul + Reserva de Emergência ativa.`;
      } else if (!metrics.hasEmergencyReserve) {
        metFinancial = false;
        reasonIfNotMet = `Requer Reserva de Emergência ativa guardada em Objetivos.`;
      } else if (metrics.overdueCount > 0) {
        metFinancial = false;
        reasonIfNotMet = `Você possui ${metrics.overdueCount} conta(s)/cartão em atraso.`;
      }
      break;

    case 'Esmeralda': // Primeiro Aporte
      if (metrics.isDeficit || !metrics.hasEmergencyReserve) {
        metFinancial = false;
        reasonIfNotMet = `Requer Superávit Mensal + Reserva de Emergência feita + Primeiro Aporte realizado em investimentos.`;
      } else if (!metrics.hasInvestments) {
        metFinancial = false;
        reasonIfNotMet = `Você ainda não cadastrou nenhum Aporte ou Investimento em sua Carteira de Investimentos.`;
      }
      break;

    case 'Ametista': // Renda Passiva
      if (metrics.isDeficit || !metrics.hasEmergencyReserve || !metrics.hasInvestments) {
        metFinancial = false;
        reasonIfNotMet = `Requer Superávit Mensal + Reserva de Emergência + Investimentos gerando renda passiva.`;
      }
      break;

    case 'Pérola': // Blindado
      if (metrics.isDeficit || !metrics.hasEmergencyReserve || !metrics.hasInvestments) {
        metFinancial = false;
        reasonIfNotMet = `Requer Superávit Mensal + Reserva de Emergência + Carteira de investimentos diversificada.`;
      }
      break;

    case 'Obsidiana': // Bola de Neve
      if (metrics.isDeficit || (metrics.monthlyIncome > 0 && metrics.monthlyBalance < 0.2 * metrics.monthlyIncome)) {
        metFinancial = false;
        reasonIfNotMet = `Requer taxa de poupança/superávit mensal superior a 20% da sua receita total.`;
      }
      break;

    case 'Diamante': // Liberdade Financeira
      if (metrics.isDeficit || !metrics.hasPassiveIncome) {
        metFinancial = false;
        reasonIfNotMet = `Requer renda passiva mensal de investimentos cobrindo 100% do seu custo de vida.`;
      }
      break;
  }

  return { metXP, metFinancial, reasonIfNotMet };
}

const INITIAL_QUESTS: WeeklyQuest[] = [
  {
    id: 'quest_checkin',
    title: 'Check-in Semanal',
    description: 'Realize o check-in financeiro semanal no aplicativo.',
    xpReward: 60,
    gemsReward: 20,
    currentProgress: 0,
    targetProgress: 1,
    completed: false,
    category: 'checkin',
  },
  {
    id: 'quest_launches',
    title: 'Lançamentos em Dia',
    description: 'Cadastre pelo menos 3 receitas ou despesas nesta semana.',
    xpReward: 50,
    gemsReward: 15,
    currentProgress: 0,
    targetProgress: 3,
    completed: false,
    category: 'launches',
  },
  {
    id: 'quest_savings',
    title: 'Guardião de Metas',
    description: 'Guarde dinheiro em um Objetivo ou Economize na semana.',
    xpReward: 100,
    gemsReward: 30,
    currentProgress: 0,
    targetProgress: 1,
    completed: false,
    category: 'savings',
  },
  {
    id: 'quest_consolidation',
    title: 'Organizador Efetivo',
    description: 'Concilie/efetive 2 lançamentos pendentes.',
    xpReward: 40,
    gemsReward: 10,
    currentProgress: 0,
    targetProgress: 2,
    completed: false,
    category: 'consolidation',
  },
];

const INITIAL_ACHIEVEMENTS: AchievementBadge[] = [
  { id: 'ach_1', title: 'Primeiro Passo', description: 'Realizou seu primeiro check-in financeiro semanal.', iconName: 'Sparkles', category: 'Início', unlocked: false },
  { id: 'ach_2', title: 'Poupador de Ouro', description: 'Manteve 4 semanas consecutivas de ofensiva semanal.', iconName: 'Flame', category: 'Ofensiva', unlocked: false },
  { id: 'ach_3', title: 'Superação Pessoal', description: 'Bateu a meta pessoal de 500 XP em uma única semana.', iconName: 'Trophy', category: 'Desafios', unlocked: false },
  { id: 'ach_4', title: 'Mestre do Orçamento', description: 'Concluiu todas as missões semanais.', iconName: 'Award', category: 'Missões', unlocked: false },
];

export class GamificationService {
  static getGamificationState(userId: string): WeeklyGamificationState {
    const key = STORAGE_KEY_PREFIX + userId;
    const currentWeekKey = getCurrentISOWeekKey();
    const stored = localStorage.getItem(key);

    let state: WeeklyGamificationState;

    if (stored) {
      try {
        state = JSON.parse(stored);
        // Reset legacy mock pre-filled state if user had old 3850 XP / 4 week streak default
        if (state.xpTotal === 3850 || state.currentDivision === 'Pérola') {
          state = this.createDefaultState(userId);
          this.saveGamificationState(state);
        } else if (!state.accountCreatedAt) {
          // Default account creation date to Jan 2025 for existing accounts
          state.accountCreatedAt = '2025-01-01T00:00:00.000Z';
          this.saveGamificationState(state);
        }
      } catch (e) {
        state = this.createDefaultState(userId);
      }
    } else {
      state = this.createDefaultState(userId);
    }

    // Check if new week has started
    if (state.lastActiveWeekKey !== currentWeekKey) {
      // Duolingo-style streak check:
      // If user did not complete weekly check-in for the previous week (or missed weeks)
      if (!state.hasCompletedWeeklyCheckIn && state.weeklyStreakCount > 0) {
        if (state.streakFreezeCount > 0) {
          // Protected by Bloqueio de Ofensiva (Streak Freeze)!
          state.streakFreezeCount -= 1;
        } else {
          // No streak freeze available -> Ofensiva zerada (Duolingo style)
          state.weeklyStreakCount = 0;
        }
      }

      state.hasCompletedWeeklyCheckIn = false;
      state.weeklyXP = 0; // Reset weekly XP for the new week
      
      // Reset progress of weekly quests
      state.weeklyQuests = INITIAL_QUESTS.map((q) => ({ ...q }));
      state.lastActiveWeekKey = currentWeekKey;
      
      this.saveGamificationState(state);
    }

    // Automatically check division promotion based on total / weekly XP milestones
    const prevDiv = state.currentDivision;
    this.updateDivisionProgress(state);

    if (prevDiv !== state.currentDivision) {
      this.saveGamificationState(state);
    }

    return state;
  }

  static refreshAllActiveUsersGamification(): void {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
          const userId = key.replace(STORAGE_KEY_PREFIX, '');
          if (userId) {
            this.getGamificationState(userId);
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  private static updateDivisionProgress(state: WeeklyGamificationState): void {
    const metrics = calculateUserFinancialMetrics(state.userId);
    let matchedDiv: LeagueDivision = 'Bronze';

    for (const div of LEAGUE_DIVISIONS) {
      const qualification = checkDivisionQualification(div.id, state.xpTotal, metrics);
      if (qualification.metXP && qualification.metFinancial) {
        matchedDiv = div.id;
      } else if (!qualification.metFinancial && state.xpTotal >= div.minXP) {
        // Se o usuario tem XP suficiente mas nao atende aos requisitos financeiros reais
        // (por exemplo, está em déficit ou não tem reserva de emergência), a ascensão é travada.
        break;
      }
    }
    state.currentDivision = matchedDiv;
  }

  private static createDefaultState(userId: string): WeeklyGamificationState {
    const currentWeekKey = getCurrentISOWeekKey();
    return {
      userId,
      accountCreatedAt: new Date().toISOString(),
      weeklyStreakCount: 0,
      lastActiveWeekKey: currentWeekKey,
      completedWeeksHistory: [],
      xpTotal: 0,
      weeklyXP: 0,
      gems: 0,
      streakFreezeCount: 0,
      currentDivision: 'Bronze',
      divisionRankPosition: 1,
      hasCompletedWeeklyCheckIn: false,
      weeklyQuests: INITIAL_QUESTS.map((q) => ({ ...q })),
      achievements: INITIAL_ACHIEVEMENTS.map((a) => ({ ...a })),
      leaderboard: [],
    };
  }

  static resetGamificationToZero(userId: string): WeeklyGamificationState {
    const state = this.createDefaultState(userId);
    this.saveGamificationState(state);
    return state;
  }

  static async loadGamificationFromRemote(userId: string): Promise<WeeklyGamificationState | null> {
    try {
      const canonicalId = getCanonicalUserId(userId);
      const res = await fetch(`/api/gamification/load?userId=${encodeURIComponent(canonicalId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.state) {
          const key = STORAGE_KEY_PREFIX + canonicalId;
          const altKey = STORAGE_KEY_PREFIX + userId;
          localStorage.setItem(key, JSON.stringify(json.state));
          localStorage.setItem(altKey, JSON.stringify(json.state));
          window.dispatchEvent(new CustomEvent('gamification_updated_event', { detail: json.state }));
          return json.state;
        }
      }
    } catch (e) {}
    return null;
  }

  static async syncGamificationWithServer(state: WeeklyGamificationState, email?: string): Promise<void> {
    try {
      const canonicalId = getCanonicalUserId(state.userId);
      await fetch('/api/gamification/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: canonicalId, email, state }),
      });
    } catch (e) {}
  }

  private static saveGamificationState(state: WeeklyGamificationState): void {
    const canonicalId = getCanonicalUserId(state.userId);
    const key = STORAGE_KEY_PREFIX + state.userId;
    const canKey = STORAGE_KEY_PREFIX + canonicalId;
    const dataStr = JSON.stringify(state);
    localStorage.setItem(key, dataStr);
    localStorage.setItem(canKey, dataStr);
    window.dispatchEvent(new CustomEvent('gamification_updated_event', { detail: state }));
    // Asynchronously push to backend
    this.syncGamificationWithServer(state);
  }

  static clearAllData(userId: string): void {
    const canonicalId = getCanonicalUserId(userId);
    localStorage.removeItem(STORAGE_KEY_PREFIX + userId);
    localStorage.removeItem(STORAGE_KEY_PREFIX + canonicalId);
    window.dispatchEvent(new CustomEvent('gamification_updated_event', { detail: null }));
  }

  static performWeeklyCheckIn(userId: string): { state: WeeklyGamificationState; xpEarned: number; gemsEarned: number; newlyCompletedQuest: WeeklyQuest | null } {
    const state = this.getGamificationState(userId);
    const currentWeekKey = getCurrentISOWeekKey();

    let xpEarned = 60;
    let gemsEarned = 25;
    let newlyCompletedQuest: WeeklyQuest | null = null;

    state.hasCompletedWeeklyCheckIn = true;
    if (!state.completedWeeksHistory.includes(currentWeekKey)) {
      state.completedWeeksHistory.push(currentWeekKey);
      state.weeklyStreakCount += 1;
    }

    state.weeklyXP += xpEarned;
    state.xpTotal += xpEarned;
    state.gems += gemsEarned;

    // Check off checkin quest
    const checkinQuest = state.weeklyQuests.find((q) => q.category === 'checkin');
    if (checkinQuest && !checkinQuest.completed) {
      checkinQuest.currentProgress = 1;
      checkinQuest.completed = true;
      newlyCompletedQuest = { ...checkinQuest };
    }

    this.saveGamificationState(state);
    return { state, xpEarned, gemsEarned, newlyCompletedQuest };
  }

  static recordAction(
    userId: string,
    actionCategory: 'launches' | 'savings' | 'consolidation',
    progressAmount: number = 1
  ): { state: WeeklyGamificationState; newlyCompletedQuest: WeeklyQuest | null } {
    const state = this.getGamificationState(userId);

    let xpGained = 0;
    let gemsGained = 0;
    let newlyCompletedQuest: WeeklyQuest | null = null;

    if (actionCategory === 'launches') {
      xpGained = 20 * progressAmount;
    } else if (actionCategory === 'savings') {
      xpGained = 50 * progressAmount;
      gemsGained = 10;
    } else if (actionCategory === 'consolidation') {
      xpGained = 15 * progressAmount;
    }

    state.weeklyXP += xpGained;
    state.xpTotal += xpGained;
    state.gems += gemsGained;

    // Update quest progress
    const quest = state.weeklyQuests.find((q) => q.category === actionCategory);
    if (quest && !quest.completed) {
      quest.currentProgress = Math.min(quest.targetProgress, quest.currentProgress + progressAmount);
      if (quest.currentProgress >= quest.targetProgress) {
        quest.completed = true;
        state.weeklyXP += quest.xpReward;
        state.xpTotal += quest.xpReward;
        state.gems += quest.gemsReward;
        newlyCompletedQuest = { ...quest };
      }
    }

    this.saveGamificationState(state);
    return { state, newlyCompletedQuest };
  }

  static buyStreakFreeze(userId: string): { success: boolean; message: string; state: WeeklyGamificationState } {
    const state = this.getGamificationState(userId);
    const COST = 450;

    if (state.gems < COST) {
      return { success: false, message: `Você precisa de ${COST} gemas. Seu saldo atual é de 💎 ${state.gems}.`, state };
    }

    state.gems -= COST;
    state.streakFreezeCount += 1;
    this.saveGamificationState(state);

    return { success: true, message: '🛡️ Congelamento de Ofensiva Semanal adquirido com sucesso!', state };
  }

  static buyDoubleXP(userId: string): { success: boolean; message: string; state: WeeklyGamificationState } {
    const state = this.getGamificationState(userId);
    const COST = 600;

    if (state.gems < COST) {
      return { success: false, message: `Você precisa de ${COST} gemas. Seu saldo atual é de 💎 ${state.gems}.`, state };
    }

    state.gems -= COST;
    this.saveGamificationState(state);

    return { success: true, message: '⚡ Dobro de XP por 7 Dias adquirido com sucesso!', state };
  }

  static setUserProfileLevel(userId: string, level: 'iniciante' | 'avancado'): WeeklyGamificationState {
    const state = this.getGamificationState(userId);
    state.userProfileLevel = level;

    if (level === 'iniciante') {
      state.weeklyQuests = [
        {
          id: 'quest_checkin',
          title: 'Check-in Semanal',
          description: 'Realize o check-in financeiro semanal no aplicativo.',
          xpReward: 60,
          gemsReward: 20,
          currentProgress: 0,
          targetProgress: 1,
          completed: false,
          category: 'checkin',
        },
        {
          id: 'quest_launches',
          title: 'Lançamentos Essenciais (Iniciante)',
          description: 'Cadastre 3 despesas fixas da casa para dominar seu fluxo de caixa.',
          xpReward: 60,
          gemsReward: 20,
          currentProgress: 0,
          targetProgress: 3,
          completed: false,
          category: 'launches',
        },
        {
          id: 'quest_savings',
          title: 'Reserva de Emergência Inicial',
          description: 'Guarde seu 1º R$ 100 para o colchão de segurança e garanta 1 mês de tranquilidade.',
          xpReward: 120,
          gemsReward: 40,
          currentProgress: 0,
          targetProgress: 1,
          completed: false,
          category: 'savings',
        },
        {
          id: 'quest_consolidation',
          title: 'Conciliação Semanal',
          description: 'Efetive 2 contas pagas para manter o saldo real atualizado.',
          xpReward: 50,
          gemsReward: 15,
          currentProgress: 0,
          targetProgress: 2,
          completed: false,
          category: 'consolidation',
        },
      ];
    } else {
      state.weeklyQuests = [
        {
          id: 'quest_checkin',
          title: 'Check-in Semanal',
          description: 'Realize o check-in financeiro semanal no aplicativo.',
          xpReward: 60,
          gemsReward: 20,
          currentProgress: 0,
          targetProgress: 1,
          completed: false,
          category: 'checkin',
        },
        {
          id: 'quest_launches',
          title: 'Aportes & Rentabilidade (Avançado)',
          description: 'Registre aportes em Renda Fixa ou Renda Variável.',
          xpReward: 80,
          gemsReward: 30,
          currentProgress: 0,
          targetProgress: 3,
          completed: false,
          category: 'launches',
        },
        {
          id: 'quest_savings',
          title: 'Aporte de +30% da Receita',
          description: 'Guarde ao menos 30% dos ganhos da semana em investimentos estratégicos.',
          xpReward: 150,
          gemsReward: 50,
          currentProgress: 0,
          targetProgress: 1,
          completed: false,
          category: 'savings',
        },
        {
          id: 'quest_consolidation',
          title: 'Análise de Dividendos',
          description: 'Concilie proventos de ações, FIIs ou juros sobre capital.',
          xpReward: 70,
          gemsReward: 25,
          currentProgress: 0,
          targetProgress: 2,
          completed: false,
          category: 'consolidation',
        },
      ];
    }

    this.saveGamificationState(state);
    return state;
  }
}
