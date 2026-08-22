import React, { useState, useMemo, useEffect } from 'react';
import {
  Target,
  Edit3,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
  Filter,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  PieChart as PieIcon,
  Users,
  User,
  Search,
  ArrowRightLeft,
  Check,
  Tag,
  Pencil,
  FolderTree,
} from 'lucide-react';
import { Transaction, Category, RuleGroup, FamilyMember } from '../types';
import { formatCurrency, formatDateBR, findSubcategoryById } from '../utils/finance';
import { StorageService } from '../services/storage';
import { executeTransactionalBudgetGoals, mergeRemoteBudgetGoalsWithOptimistic } from '../lib/appwriteSync';

const formatPct = (val: number, decimals = 1): string => {
  return (val || 0).toFixed(decimals).replace('.', ',');
};

export type PerformancePeriod = 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom';

interface FiftyThirtyTwentyWidgetProps {
  transactions: Transaction[];
  categories: Category[];
  familyMembers?: FamilyMember[];
  currentYear: number;
  currentMonth: number;
  userId?: string;
  onEditTransaction?: (transaction: Transaction) => void;
  onUpdateSingleTransaction?: (transaction: Transaction) => void;
}

export const FiftyThirtyTwentyWidget: React.FC<FiftyThirtyTwentyWidgetProps> = ({
  transactions,
  categories,
  familyMembers = [],
  currentYear,
  currentMonth,
  userId,
  onEditTransaction,
  onUpdateSingleTransaction,
}) => {
  const effectiveUserId = userId || StorageService.getCurrentUser()?.id || 'default';

  // Period filter state
  const [period, setPeriod] = useState<PerformancePeriod>('monthly');

  // Custom date range state
  const todayStr = new Date().toISOString().split('T')[0];
  const firstOfMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
  const [startDate, setStartDate] = useState<string>(firstOfMonthStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Helper to format YYYY-MM-DD to DD/MM/AAAA for input display
  const formatDateBRInput = (isoDateStr: string) => {
    if (!isoDateStr) return '';
    const parts = isoDateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDateStr;
  };

  // Convert typed DD/MM/AAAA or YYYY-MM-DD to YYYY-MM-DD ISO
  const parseDateToISO = (val: string): string => {
    if (!val) return '';
    const clean = val.trim();
    // DD/MM/YYYY or DD-MM-YYYY
    const brMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (brMatch) {
      const d = brMatch[1].padStart(2, '0');
      const m = brMatch[2].padStart(2, '0');
      const y = brMatch[3];
      return `${y}-${m}-${d}`;
    }
    // YYYY-MM-DD
    const isoMatch = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (isoMatch) {
      const y = isoMatch[1];
      const m = isoMatch[2].padStart(2, '0');
      const d = isoMatch[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return '';
  };

  const [startText, setStartText] = useState<string>(() => formatDateBRInput(firstOfMonthStr));
  const [endText, setEndText] = useState<string>(() => formatDateBRInput(todayStr));

  // Target percentages state (50%, 30%, 20% default or loaded from StorageService)
  const [targets, setTargets] = useState<{ essentials: number; lifestyle: number; investment: number }>(() => {
    return StorageService.getBudgetGoals(effectiveUserId);
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [tempTargets, setTempTargets] = useState({ ...targets });

  // Sync state with StorageService and real-time remote updates
  useEffect(() => {
    const loaded = StorageService.getBudgetGoals(effectiveUserId);
    setTargets(loaded);
    setTempTargets(loaded);

    const handleSync = (e?: any) => {
      const remote = e?.detail?.budgetGoals || StorageService.getBudgetGoals(effectiveUserId);
      const merged = mergeRemoteBudgetGoalsWithOptimistic(remote);
      setTargets(merged);
      StorageService.saveBudgetGoals(merged, effectiveUserId);
    };

    window.addEventListener('budget_goals_updated', handleSync);
    window.addEventListener('remote_data_updated', handleSync);
    window.addEventListener('financial_data_mutated', handleSync);

    return () => {
      window.removeEventListener('budget_goals_updated', handleSync);
      window.removeEventListener('remote_data_updated', handleSync);
      window.removeEventListener('financial_data_mutated', handleSync);
    };
  }, [effectiveUserId]);

  // Family breakdown view options
  const [breakdownViewMode, setBreakdownViewMode] = useState<'by_category' | 'by_member'>('by_category');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Expand / Collapse state for category accordions (collapsed by default as requested)
  const [expandedBuckets, setExpandedBuckets] = useState<Record<string, boolean>>({
    '50_essentials': false,
    '30_lifestyle': false,
    '20_investment': false,
  });

  // Expand / Collapse state for member cards
  const [expandedMembers, setExpandedMembers] = useState<Record<string, boolean>>({});

  // Quick feedback state when updating a member assignment
  const [lastUpdatedTxId, setLastUpdatedTxId] = useState<string | null>(null);

  // Extract all distinct family members from props + transactions
  const allFamilyMembersList = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();

    if (familyMembers && familyMembers.length > 0) {
      familyMembers.forEach((fm) => {
        map.set(fm.id, { id: fm.id, name: fm.name });
      });
    }

    transactions.forEach((t) => {
      if (t.familyMemberId && !map.has(t.familyMemberId)) {
        map.set(t.familyMemberId, {
          id: t.familyMemberId,
          name: t.familyMemberName || 'Membro Familiar',
        });
      } else if (t.familyMemberName && t.familyMemberName !== 'Geral' && !t.familyMemberId) {
        const slug = `name_${t.familyMemberName.toLowerCase().replace(/\s+/g, '_')}`;
        if (!map.has(slug)) {
          map.set(slug, { id: slug, name: t.familyMemberName });
        }
      }
    });

    return Array.from(map.values());
  }, [familyMembers, transactions]);

  // Calculate Date Range based on selected period filter
  const dateRange = useMemo(() => {
    if (period === 'custom') {
      return { start: startDate, end: endDate };
    }

    const year = currentYear;
    const month = currentMonth; // 1-indexed (1 to 12)

    if (period === 'monthly') {
      const lastDay = new Date(year, month, 0).getDate();
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { start, end };
    }

    if (period === 'quarterly') {
      let startMonth = month - 2;
      let startYear = year;
      if (startMonth <= 0) {
        startMonth += 12;
        startYear -= 1;
      }
      const lastDay = new Date(year, month, 0).getDate();
      const start = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
      const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { start, end };
    }

    if (period === 'semiannual') {
      let startMonth = month - 5;
      let startYear = year;
      if (startMonth <= 0) {
        startMonth += 12;
        startYear -= 1;
      }
      const lastDay = new Date(year, month, 0).getDate();
      const start = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
      const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { start, end };
    }

    if (period === 'annual') {
      const start = `${year}-01-01`;
      const end = `${year}-12-31`;
      return { start, end };
    }

    return { start: firstOfMonthStr, end: todayStr };
  }, [period, currentYear, currentMonth, startDate, endDate, firstOfMonthStr, todayStr]);

  // Filter transactions by date range
  const filteredTx = useMemo(() => {
    return transactions.filter((t) => {
      const txDate = t.date;
      return txDate >= dateRange.start && txDate <= dateRange.end;
    });
  }, [transactions, dateRange]);

  // Category Rule Group Mapping Lookup
  const categoryRuleMap = useMemo(() => {
    const map: Record<string, RuleGroup> = {};
    categories.forEach((cat) => {
      if (cat.ruleGroup) {
        map[cat.id] = cat.ruleGroup;
      } else {
        const lowerName = cat.name.toLowerCase();
        if (
          lowerName.includes('moradia') ||
          lowerName.includes('aliment') ||
          lowerName.includes('saúde') ||
          lowerName.includes('transporte') ||
          lowerName.includes('educação')
        ) {
          map[cat.id] = '50_essentials';
        } else if (
          lowerName.includes('lazer') ||
          lowerName.includes('restaurante') ||
          lowerName.includes('compras') ||
          lowerName.includes('viagem')
        ) {
          map[cat.id] = '30_lifestyle';
        } else if (
          lowerName.includes('invest') ||
          lowerName.includes('reserva') ||
          lowerName.includes('poupança') ||
          lowerName.includes('aporte')
        ) {
          map[cat.id] = '20_investment';
        } else {
          map[cat.id] = '30_lifestyle';
        }
      }
    });
    return map;
  }, [categories]);

  // Helper to format category and subcategory names for a transaction
  const getCategoryLabel = (categoryId: string, subcategoryId?: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return 'Outros';
    if (subcategoryId && cat.subcategories) {
      const sub = findSubcategoryById(cat.subcategories, subcategoryId);
      if (sub) {
        return `${cat.name} › ${sub.name}`;
      }
    }
    return cat.name;
  };

  // Calculate totals for period
  const periodData = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;

    let essentialsAmount = 0;
    let lifestyleAmount = 0;
    let investmentAmount = 0;

    filteredTx.forEach((t) => {
      if (t.type === 'income') {
        totalIncome += t.amount;
      } else if (t.type === 'expense') {
        totalExpense += t.amount;
        const group = categoryRuleMap[t.categoryId] || '30_lifestyle';
        if (group === '50_essentials') {
          essentialsAmount += t.amount;
        } else if (group === '30_lifestyle') {
          lifestyleAmount += t.amount;
        } else if (group === '20_investment') {
          investmentAmount += t.amount;
        }
      }
    });

    const base = totalIncome > 0 ? totalIncome : totalExpense > 0 ? totalExpense : 1;

    const essentialsPct = (essentialsAmount / base) * 100;
    const lifestylePct = (lifestyleAmount / base) * 100;
    const investmentPct = (investmentAmount / base) * 100;

    return {
      totalIncome,
      totalExpense,
      base,
      essentials: {
        amount: essentialsAmount,
        pct: essentialsPct,
        targetPct: targets.essentials,
        targetAmount: (base * targets.essentials) / 100,
        isOver: essentialsPct > targets.essentials,
      },
      lifestyle: {
        amount: lifestyleAmount,
        pct: lifestylePct,
        targetPct: targets.lifestyle,
        targetAmount: (base * targets.lifestyle) / 100,
        isOver: lifestylePct > targets.lifestyle,
      },
      investment: {
        amount: investmentAmount,
        pct: investmentPct,
        targetPct: targets.investment,
        targetAmount: (base * targets.investment) / 100,
        isAchieved: investmentPct >= targets.investment,
      },
    };
  }, [filteredTx, categoryRuleMap, targets]);

  // Family Member & Category detailed breakdown data calculation
  const familyBreakdownData = useMemo(() => {
    // Only expense transactions count as 50/30/20 spending
    let expenseTx = filteredTx.filter((t) => t.type === 'expense');

    // Filter by search term if typed
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      expenseTx = expenseTx.filter((t) => {
        const catName = getCategoryLabel(t.categoryId, t.subcategoryId).toLowerCase();
        const desc = t.description ? t.description.toLowerCase() : '';
        const notes = t.notes ? t.notes.toLowerCase() : '';
        const member = t.familyMemberName ? t.familyMemberName.toLowerCase() : '';
        return desc.includes(term) || catName.includes(term) || notes.includes(term) || member.includes(term);
      });
    }

    // Bucket structure:
    // 50_essentials, 30_lifestyle, 20_investment
    const bucketTxMap: Record<RuleGroup, Transaction[]> = {
      '50_essentials': [],
      '30_lifestyle': [],
      '20_investment': [],
      income: [],
    };

    expenseTx.forEach((t) => {
      const group = categoryRuleMap[t.categoryId] || '30_lifestyle';
      if (bucketTxMap[group]) {
        bucketTxMap[group].push(t);
      } else {
        bucketTxMap['30_lifestyle'].push(t);
      }
    });

    // Helper to calculate member stats within a transaction list
    const computeMemberStatsForList = (txList: Transaction[]) => {
      const memberMap = new Map<
        string,
        { id: string; name: string; amount: number; txCount: number; transactions: Transaction[] }
      >();

      // Pre-seed all family members from allFamilyMembersList
      allFamilyMembersList.forEach((fm) => {
        memberMap.set(fm.id, {
          id: fm.id,
          name: fm.name,
          amount: 0,
          txCount: 0,
          transactions: [],
        });
      });

      let unassignedAmount = 0;
      let unassignedTxCount = 0;
      const unassignedTx: Transaction[] = [];

      txList.forEach((t) => {
        let matchedId = '';
        if (t.familyMemberId && memberMap.has(t.familyMemberId)) {
          matchedId = t.familyMemberId;
        } else if (t.familyMemberName && t.familyMemberName !== 'Geral') {
          const found = allFamilyMembersList.find((fm) => fm.name === t.familyMemberName);
          if (found) matchedId = found.id;
        }

        if (matchedId) {
          const stat = memberMap.get(matchedId)!;
          stat.amount += t.amount;
          stat.txCount += 1;
          stat.transactions.push(t);
        } else {
          unassignedAmount += t.amount;
          unassignedTxCount += 1;
          unassignedTx.push(t);
        }
      });

      const memberList = Array.from(memberMap.values());

      if (unassignedAmount > 0 || unassignedTxCount > 0 || memberList.length === 0) {
        memberList.push({
          id: 'UNASSIGNED',
          name: 'Geral / Não Especificado',
          amount: unassignedAmount,
          txCount: unassignedTxCount,
          transactions: unassignedTx,
        });
      }

      // Sort by member amount descending
      return memberList.sort((a, b) => b.amount - a.amount);
    };

    const buckets = [
      {
        key: '50_essentials' as RuleGroup,
        title: '50% - Necessidades (Essenciais & Contas Fixas)',
        color: '#3B82F6',
        bgClass: 'bg-blue-50/70 border-blue-200',
        badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
        totalAmount: bucketTxMap['50_essentials'].reduce((acc, t) => acc + t.amount, 0),
        txList: bucketTxMap['50_essentials'],
        memberStats: computeMemberStatsForList(bucketTxMap['50_essentials']),
      },
      {
        key: '30_lifestyle' as RuleGroup,
        title: '30% - Estilo de Vida (Lazer, Hobbies & Compras)',
        color: '#EC4899',
        bgClass: 'bg-pink-50/70 border-pink-200',
        badgeClass: 'bg-pink-100 text-pink-900 border-pink-300',
        totalAmount: bucketTxMap['30_lifestyle'].reduce((acc, t) => acc + t.amount, 0),
        txList: bucketTxMap['30_lifestyle'],
        memberStats: computeMemberStatsForList(bucketTxMap['30_lifestyle']),
      },
      {
        key: '20_investment' as RuleGroup,
        title: '20% - Investimentos (Aportes, Poupança & Futuro)',
        color: '#10B981',
        bgClass: 'bg-emerald-50/70 border-emerald-200',
        badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        totalAmount: bucketTxMap['20_investment'].reduce((acc, t) => acc + t.amount, 0),
        txList: bucketTxMap['20_investment'],
        memberStats: computeMemberStatsForList(bucketTxMap['20_investment']),
      },
    ];

    // Compute stats grouped by Member (for 'by_member' view mode)
    const membersOverallMap = new Map<
      string,
      {
        id: string;
        name: string;
        totalAmount: number;
        essentialsAmount: number;
        lifestyleAmount: number;
        investmentAmount: number;
        transactions: Transaction[];
      }
    >();

    allFamilyMembersList.forEach((fm) => {
      membersOverallMap.set(fm.id, {
        id: fm.id,
        name: fm.name,
        totalAmount: 0,
        essentialsAmount: 0,
        lifestyleAmount: 0,
        investmentAmount: 0,
        transactions: [],
      });
    });

    let unassignedTotal = 0;
    let unassignedEssentials = 0;
    let unassignedLifestyle = 0;
    let unassignedInvestment = 0;
    const unassignedTxs: Transaction[] = [];

    expenseTx.forEach((t) => {
      const group = categoryRuleMap[t.categoryId] || '30_lifestyle';
      let matchedId = '';
      if (t.familyMemberId && membersOverallMap.has(t.familyMemberId)) {
        matchedId = t.familyMemberId;
      } else if (t.familyMemberName && t.familyMemberName !== 'Geral') {
        const found = allFamilyMembersList.find((fm) => fm.name === t.familyMemberName);
        if (found) matchedId = found.id;
      }

      if (matchedId) {
        const stat = membersOverallMap.get(matchedId)!;
        stat.totalAmount += t.amount;
        if (group === '50_essentials') stat.essentialsAmount += t.amount;
        else if (group === '30_lifestyle') stat.lifestyleAmount += t.amount;
        else if (group === '20_investment') stat.investmentAmount += t.amount;
        stat.transactions.push(t);
      } else {
        unassignedTotal += t.amount;
        if (group === '50_essentials') unassignedEssentials += t.amount;
        else if (group === '30_lifestyle') unassignedLifestyle += t.amount;
        else if (group === '20_investment') unassignedInvestment += t.amount;
        unassignedTxs.push(t);
      }
    });

    const membersOverallList = Array.from(membersOverallMap.values());

    if (unassignedTotal > 0 || unassignedTxs.length > 0 || membersOverallList.length === 0) {
      membersOverallList.push({
        id: 'UNASSIGNED',
        name: 'Geral / Não Especificado',
        totalAmount: unassignedTotal,
        essentialsAmount: unassignedEssentials,
        lifestyleAmount: unassignedLifestyle,
        investmentAmount: unassignedInvestment,
        transactions: unassignedTxs,
      });
    }

    membersOverallList.sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      buckets,
      membersOverallList,
      totalExpenseTxCount: expenseTx.length,
    };
  }, [filteredTx, categoryRuleMap, allFamilyMembersList, searchTerm]);

  // Handler for quick member reassignment
  const handleMemberChange = (tx: Transaction, newMemberId: string) => {
    let newName = 'Geral';
    if (newMemberId && newMemberId !== 'UNASSIGNED') {
      const member = allFamilyMembersList.find((m) => m.id === newMemberId);
      if (member) {
        newName = member.name;
      }
    }

    const updatedTx: Transaction = {
      ...tx,
      familyMemberId: newMemberId === 'UNASSIGNED' ? undefined : newMemberId,
      familyMemberName: newName,
    };

    if (onUpdateSingleTransaction) {
      onUpdateSingleTransaction(updatedTx);
      setLastUpdatedTxId(tx.id);
      setTimeout(() => {
        setLastUpdatedTxId(null);
      }, 2000);
    }
  };

  const handleSaveBudgetGoals = async (newGoals: { essentials: number; lifestyle: number; investment: number }) => {
    // 1. Backup do estado atual para caso de falha (Rollback)
    const previousGoals = { ...targets };

    // 2. ATUALIZAÇÃO OTIMISTA (0ms delay): Atualiza a tela imediatamente
    const sanitizedGoals = {
      essentials: Number(newGoals.essentials) || 50,
      lifestyle: Number(newGoals.lifestyle) || 30,
      investment: Number(newGoals.investment) || 20,
    };
    setTargets(sanitizedGoals);
    StorageService.saveBudgetGoals(sanitizedGoals, effectiveUserId);
    setIsEditModalOpen(false);

    // 3. Monta o payload e salva em background na nuvem (Appwrite Document ID 6a849358002db9e638ce + Servidor atômico)
    try {
      const res = await executeTransactionalBudgetGoals(effectiveUserId, sanitizedGoals);
      if (!res.success) {
        throw new Error('Falha ao sincronizar metas do orçamento no servidor.');
      }
    } catch (err) {
      console.error('[Optimistic UI Error - Budget Goals]', err);
      // 4. ROLLBACK: Em caso de falha, devolve os valores antigos para a tela e alerta o usuário
      setTargets(previousGoals);
      StorageService.saveBudgetGoals(previousGoals, effectiveUserId);
      alert('Não foi possível salvar as metas de orçamento no servidor. As alterações foram revertidas.');
    }
  };

  const handleSaveTargets = () => {
    handleSaveBudgetGoals(tempTargets);
  };

  const getPeriodLabel = (p: PerformancePeriod) => {
    switch (p) {
      case 'monthly':
        return 'Mensal (Mês Atual)';
      case 'quarterly':
        return 'Trimestral (3 Meses)';
      case 'semiannual':
        return 'Semestral (6 Meses)';
      case 'annual':
        return 'Anual (Ano Corrente)';
      case 'custom':
        return 'Personalizado';
      default:
        return 'Mensal';
    }
  };

  const toggleBucketExpand = (bucketKey: string) => {
    setExpandedBuckets((prev) => ({
      ...prev,
      [bucketKey]: !prev[bucketKey],
    }));
  };

  const toggleMemberExpand = (memberId: string) => {
    setExpandedMembers((prev) => ({
      ...prev,
      [memberId]: !prev[memberId],
    }));
  };

  return (
    <div className="bg-[#18181B] border border-white/10 rounded-2xl p-5 shadow-xl space-y-6 text-white" id="fifty-thirty-twenty-widget">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#D4AF37]/15 border border-[#D4AF37]/40 rounded-xl text-[#D4AF37] shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-white font-serif uppercase tracking-wider">
              Meta de Orçamento Familiar: Estratégia 50/30/20
            </h3>
            <p className="text-xs sm:text-sm text-gray-200 mt-1 font-medium leading-relaxed">
              Percentual Desejado x Atual por categoria e detalhamento de compras por membro. Em{' '}
              <span className="text-[#00E676] font-extrabold">verde</span> = dentro da meta; Em{' '}
              <span className="text-[#FF5252] font-extrabold">vermelho</span> = meta excedida.
            </p>
          </div>
        </div>

        {/* Filter Controls & Actions */}
        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto shrink-0">
          {/* Period Dropdown Filter */}
          <div className="flex items-center gap-1.5 bg-[#121212] border border-white/20 rounded-xl px-3 py-2 text-xs sm:text-sm">
            <Filter className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PerformancePeriod)}
              className="bg-transparent text-white font-extrabold text-xs sm:text-sm focus:outline-none cursor-pointer pr-1"
            >
              <option value="monthly" className="bg-[#18181B] text-white">
                Mensal (Mês)
              </option>
              <option value="quarterly" className="bg-[#18181B] text-white">
                Trimestral (3 Meses)
              </option>
              <option value="semiannual" className="bg-[#18181B] text-white">
                Semestral (6 Meses)
              </option>
              <option value="annual" className="bg-[#18181B] text-white">
                Anual (Ano)
              </option>
              <option value="custom" className="bg-[#18181B] text-white">
                Período Personalizado
              </option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setTempTargets({ ...targets });
              setIsEditModalOpen(true);
            }}
            className="min-h-[42px] sm:min-h-[44px] py-2 px-3.5 bg-[#D4AF37] hover:bg-[#c4a02e] text-[#121212] font-black text-xs sm:text-sm rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-md shrink-0 border border-amber-600/30"
          >
            <Edit3 className="w-4 h-4 shrink-0" />
            <span>Editar Meta %</span>
          </button>
        </div>
      </div>

      {/* Custom Date Inputs Range Selector (Only visible if Custom option is selected) */}
      {period === 'custom' && (
        <div className="bg-[#121212] border border-[#D4AF37]/30 rounded-xl p-3 flex flex-wrap items-center gap-4 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span className="font-bold text-gray-200 shrink-0">Data Início:</span>
            <div className="flex items-center gap-1">
              <input
                type="text"
                placeholder="DD/MM/AAAA"
                value={startText}
                onChange={(e) => {
                  const val = e.target.value;
                  setStartText(val);
                  const parsedISO = parseDateToISO(val);
                  if (parsedISO) {
                    setStartDate(parsedISO);
                  }
                }}
                className="w-28 sm:w-32 bg-[#18181B] border border-white/20 rounded-lg px-2.5 py-1 text-[#D4AF37] font-bold focus:outline-none focus:border-[#D4AF37]"
              />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setStartDate(val);
                  setStartText(formatDateBRInput(val));
                }}
                className="w-7 h-7 p-0 bg-[#18181B] border border-white/20 rounded-lg text-white font-bold cursor-pointer focus:outline-none focus:border-[#D4AF37]"
                title="Selecionar data no calendário"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-200 shrink-0">Data Fim:</span>
            <div className="flex items-center gap-1">
              <input
                type="text"
                placeholder="DD/MM/AAAA"
                value={endText}
                onChange={(e) => {
                  const val = e.target.value;
                  setEndText(val);
                  const parsedISO = parseDateToISO(val);
                  if (parsedISO) {
                    setEndDate(parsedISO);
                  }
                }}
                className="w-28 sm:w-32 bg-[#18181B] border border-white/20 rounded-lg px-2.5 py-1 text-[#D4AF37] font-bold focus:outline-none focus:border-[#D4AF37]"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setEndDate(val);
                  setEndText(formatDateBRInput(val));
                }}
                className="w-7 h-7 p-0 bg-[#18181B] border border-white/20 rounded-lg text-white font-bold cursor-pointer focus:outline-none focus:border-[#D4AF37]"
                title="Selecionar data no calendário"
              />
            </div>
          </div>

          <span className="text-xs sm:text-sm text-[#D4AF37] font-bold ml-auto">
            Período ativado de {formatDateBRInput(startDate)} até {formatDateBRInput(endDate)}
          </span>
        </div>
      )}

      {/* Baseline Info Badge */}
      <div className="flex flex-wrap items-center justify-between text-xs sm:text-sm bg-[#121212] p-3.5 rounded-xl border border-white/20 gap-3">
        <div className="flex items-center gap-2">
          <span className="text-gray-300 font-extrabold text-xs sm:text-sm">Filtro Ativo:</span>
          <span className="text-[#D4AF37] font-black text-xs sm:text-sm">{getPeriodLabel(period)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm font-semibold">
          <span className="text-gray-200">
            Base de Cálculo (Receitas): <strong className="text-white font-extrabold">{formatCurrency(periodData.totalIncome)}</strong>
          </span>
          <span className="text-gray-200">
            Total Saídas: <strong className="text-white font-extrabold">{formatCurrency(periodData.totalExpense)}</strong>
          </span>
        </div>
      </div>

      {/* 50 / 30 / 20 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Pillar 1: 50% Necessidades / Essenciais */}
        <div
          className={`p-4 sm:p-5 rounded-2xl border transition space-y-3 relative ${
            periodData.essentials.isOver
              ? 'bg-[#FF5252]/10 border-[#FF5252]/40 text-[#FF5252]'
              : 'bg-[#00E676]/10 border-[#00E676]/40 text-[#00E676]'
          }`}
        >
          <div className="flex items-center justify-between gap-1 border-b border-white/10 pb-2.5">
            <span className="text-xs sm:text-sm font-black uppercase font-serif text-white flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#3B82F6] shrink-0" />
              50% - Necessidades
            </span>
            <span
              className={`text-xs font-black px-2.5 py-1 rounded-full uppercase shrink-0 ${
                periodData.essentials.isOver ? 'bg-[#FF5252] text-white' : 'bg-[#00E676] text-[#121212]'
              }`}
            >
              {periodData.essentials.isOver ? 'Excedido' : 'Dentro do Limite'}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs text-gray-300 block font-black uppercase tracking-wider">Atual</span>
                <span className="text-2xl font-black font-serif text-white">
                  {formatPct(periodData.essentials.pct)}%
                </span>
                <span className="text-xs sm:text-sm font-bold text-gray-200 block mt-0.5">
                  {formatCurrency(periodData.essentials.amount)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-300 block font-black uppercase tracking-wider">Desejado</span>
                <span className="text-lg font-black font-serif text-gray-200">
                  {periodData.essentials.targetPct}%
                </span>
                <span className="text-xs sm:text-sm font-bold text-gray-300 block mt-0.5">
                  {formatCurrency(periodData.essentials.targetAmount)}
                </span>
              </div>
            </div>
          </div>

          <div className="w-full bg-white/15 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                periodData.essentials.isOver ? 'bg-[#FF5252]' : 'bg-[#00E676]'
              }`}
              style={{
                width: `${Math.min(100, (periodData.essentials.pct / periodData.essentials.targetPct) * 100)}%`,
              }}
            />
          </div>

          <div className="text-xs sm:text-sm text-gray-200 font-bold flex flex-wrap items-center justify-between pt-1 gap-1">
            <span className="text-gray-300 font-semibold">Essenciais e Contas Fixas</span>
            <span className="font-extrabold text-white">
              {periodData.essentials.isOver ? 'Reduzir custos fixos' : 'Gasto controlado'}
            </span>
          </div>
        </div>

        {/* Pillar 2: 30% Estilo de Vida / Desejos */}
        <div
          className={`p-4 sm:p-5 rounded-2xl border transition space-y-3 relative ${
            periodData.lifestyle.isOver
              ? 'bg-[#FF5252]/10 border-[#FF5252]/40 text-[#FF5252]'
              : 'bg-[#00E676]/10 border-[#00E676]/40 text-[#00E676]'
          }`}
        >
          <div className="flex items-center justify-between gap-1 border-b border-white/10 pb-2.5">
            <span className="text-xs sm:text-sm font-black uppercase font-serif text-white flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#EC4899] shrink-0" />
              30% - Estilo de Vida
            </span>
            <span
              className={`text-xs font-black px-2.5 py-1 rounded-full uppercase shrink-0 ${
                periodData.lifestyle.isOver ? 'bg-[#FF5252] text-white' : 'bg-[#00E676] text-[#121212]'
              }`}
            >
              {periodData.lifestyle.isOver ? 'Excedido' : 'Dentro do Limite'}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs text-gray-300 block font-black uppercase tracking-wider">Atual</span>
                <span className="text-2xl font-black font-serif text-white">
                  {formatPct(periodData.lifestyle.pct)}%
                </span>
                <span className="text-xs sm:text-sm font-bold text-gray-200 block mt-0.5">
                  {formatCurrency(periodData.lifestyle.amount)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-300 block font-black uppercase tracking-wider">Desejado</span>
                <span className="text-lg font-black font-serif text-gray-200">
                  {periodData.lifestyle.targetPct}%
                </span>
                <span className="text-xs sm:text-sm font-bold text-gray-300 block mt-0.5">
                  {formatCurrency(periodData.lifestyle.targetAmount)}
                </span>
              </div>
            </div>
          </div>

          <div className="w-full bg-white/15 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                periodData.lifestyle.isOver ? 'bg-[#FF5252]' : 'bg-[#00E676]'
              }`}
              style={{
                width: `${Math.min(100, (periodData.lifestyle.pct / periodData.lifestyle.targetPct) * 100)}%`,
              }}
            />
          </div>

          <div className="text-xs sm:text-sm text-gray-200 font-bold flex flex-wrap items-center justify-between pt-1 gap-1">
            <span className="text-gray-300 font-semibold">Lazer, Hobbies & Compras</span>
            <span className="font-extrabold text-white">
              {periodData.lifestyle.isOver ? 'Atenção aos supérfluos' : 'Orçamento equilibrado'}
            </span>
          </div>
        </div>

        {/* Pillar 3: 20% Investimentos & Futuro */}
        <div
          className={`p-4 sm:p-5 rounded-2xl border transition space-y-3 relative ${
            periodData.investment.isAchieved
              ? 'bg-[#00E676]/10 border-[#00E676]/40 text-[#00E676]'
              : 'bg-[#FACC15]/10 border-[#FACC15]/40 text-[#FACC15]'
          }`}
        >
          <div className="flex items-center justify-between gap-1 border-b border-white/10 pb-2.5">
            <span className="text-xs sm:text-sm font-black uppercase font-serif text-white flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#10B981] shrink-0" />
              20% - Investimentos
            </span>
            <span
              className={`text-xs font-black px-2.5 py-1 rounded-full uppercase shrink-0 ${
                periodData.investment.isAchieved ? 'bg-[#00E676] text-[#121212]' : 'bg-[#FACC15] text-[#121212]'
              }`}
            >
              {periodData.investment.isAchieved ? 'Meta Atingida' : 'Abaixo da Meta'}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs text-gray-300 block font-black uppercase tracking-wider">Atual</span>
                <span className="text-2xl font-black font-serif text-white">
                  {formatPct(periodData.investment.pct)}%
                </span>
                <span className="text-xs sm:text-sm font-bold text-gray-200 block mt-0.5">
                  {formatCurrency(periodData.investment.amount)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-300 block font-black uppercase tracking-wider">Desejado</span>
                <span className="text-lg font-black font-serif text-gray-200">
                  {periodData.investment.targetPct}%
                </span>
                <span className="text-xs sm:text-sm font-bold text-gray-300 block mt-0.5">
                  {formatCurrency(periodData.investment.targetAmount)}
                </span>
              </div>
            </div>
          </div>

          <div className="w-full bg-white/15 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                periodData.investment.isAchieved ? 'bg-[#00E676]' : 'bg-[#FACC15]'
              }`}
              style={{
                width: `${Math.min(100, (periodData.investment.pct / periodData.investment.targetPct) * 100)}%`,
              }}
            />
          </div>

          <div className="text-xs sm:text-sm text-gray-200 font-bold flex flex-wrap items-center justify-between pt-1 gap-1">
            <span className="text-gray-300 font-semibold">Aportes, Reservas & Poupança</span>
            <span className="font-extrabold text-white">
              {periodData.investment.isAchieved ? 'Excelente disciplina' : 'Oportunidade de Aporte'}
            </span>
          </div>
        </div>
      </div>

      {/* NEW FEATURE: Detalhamento por Membro da Família (50/30/20) + O que foi + Opção de Editar */}
      <div className="bg-[#121212] border border-[#D4AF37]/40 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
        {/* Breakdown Header & Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#D4AF37] text-[#121212] rounded-xl shrink-0 font-extrabold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base sm:text-lg font-black text-white font-serif uppercase tracking-wider">
                Detalhamento por Membro da Família (50/30/20)
              </h4>
              <p className="text-xs sm:text-sm text-gray-200 font-medium leading-relaxed mt-0.5">
                Veja o quanto cada membro gastou em cada pilar e altere o membro responsável com 1 clique caso
                tenha sido atribuído incorretamente.
              </p>
            </div>
          </div>

          {/* View Mode Toggle & Member Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-[#18181B] border border-white/20 p-1 rounded-xl text-xs sm:text-sm font-extrabold">
              <button
                type="button"
                onClick={() => setBreakdownViewMode('by_category')}
                className={`min-h-[48px] px-3.5 py-2 rounded-lg transition cursor-pointer flex items-center gap-2 ${
                  breakdownViewMode === 'by_category'
                    ? 'bg-[#D4AF37] text-[#121212] font-black shadow-xs'
                    : 'text-gray-200 hover:text-white'
                }`}
              >
                <FolderTree className="w-4 h-4" />
                <span>Por Categoria (50/30/20)</span>
              </button>
              <button
                type="button"
                onClick={() => setBreakdownViewMode('by_member')}
                className={`min-h-[48px] px-3.5 py-2 rounded-lg transition cursor-pointer flex items-center gap-2 ${
                  breakdownViewMode === 'by_member'
                    ? 'bg-[#D4AF37] text-[#121212] font-black shadow-xs'
                    : 'text-gray-200 hover:text-white'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Por Membro da Família</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Bar: Member Badges + Search Input */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Member Selector Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs sm:text-sm font-extrabold text-gray-200 mr-1 flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-[#D4AF37]" /> Membro:
            </span>
            <button
              type="button"
              onClick={() => setSelectedMemberFilter('ALL')}
              className={`min-h-[48px] px-3 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer ${
                selectedMemberFilter === 'ALL'
                  ? 'bg-[#D4AF37] text-[#121212] font-black'
                  : 'bg-[#18181B] text-gray-200 border border-white/20 hover:bg-white/10'
              }`}
            >
              Todos ({allFamilyMembersList.length})
            </button>
            {allFamilyMembersList.map((m) => (
              <button
                key={`badge-${m.id}`}
                type="button"
                onClick={() => setSelectedMemberFilter(m.id)}
                className={`min-h-[48px] px-3 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                  selectedMemberFilter === m.id
                    ? 'bg-[#D4AF37] text-[#121212] font-black'
                    : 'bg-[#18181B] text-gray-200 border border-white/20 hover:bg-white/10'
                }`}
              >
                <User className="w-4 h-4" />
                <span>{m.name}</span>
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar lançamento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-h-[48px] bg-[#18181B] border border-white/20 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-white font-medium placeholder-gray-400 focus:outline-none focus:border-[#D4AF37]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white text-sm font-bold min-w-[24px] min-h-[24px] flex items-center justify-center"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* FEEDBACK NOTICE WHEN A TRANSACTION MEMBER IS EDITED */}
        {lastUpdatedTxId && (
          <div className="p-2.5 bg-[#00C853]/20 border border-[#00C853]/60 rounded-xl text-xs text-[#00E676] font-bold flex items-center gap-2 animate-bounce">
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Lançamento atualizado com sucesso! O membro responsável foi reatribuído.</span>
          </div>
        )}

        {/* MODE 1: POR CATEGORIA (50/30/20) */}
        {breakdownViewMode === 'by_category' && (
          <div className="space-y-4">
            {familyBreakdownData.buckets.map((bucket) => {
              const isExpanded = !!expandedBuckets[bucket.key];

              // Filter bucket member stats if selectedMemberFilter !== 'ALL'
              const filteredMemberStats =
                selectedMemberFilter === 'ALL'
                  ? bucket.memberStats
                  : bucket.memberStats.filter((ms) => ms.id === selectedMemberFilter);

              // Filter bucket transactions if selectedMemberFilter !== 'ALL'
              const filteredTxList =
                selectedMemberFilter === 'ALL'
                  ? bucket.txList
                  : bucket.txList.filter((t) => {
                      if (selectedMemberFilter === 'UNASSIGNED') {
                        return !t.familyMemberId && (!t.familyMemberName || t.familyMemberName === 'Geral');
                      }
                      const memberObj = allFamilyMembersList.find((m) => m.id === selectedMemberFilter);
                      return (
                        t.familyMemberId === selectedMemberFilter ||
                        (memberObj && t.familyMemberName === memberObj.name)
                      );
                    });

              const bucketTotal = filteredTxList.reduce((acc, t) => acc + t.amount, 0);
              const bucketPctOfTotal = periodData.totalExpense > 0 ? (bucketTotal / periodData.totalExpense) * 100 : 0;

              return (
                <div key={bucket.key} className="bg-[#18181B] border border-white/10 rounded-xl overflow-hidden shadow-sm">
                  {/* Category Bucket Card Header */}
                  <div
                    onClick={() => toggleBucketExpand(bucket.key)}
                    className="p-3.5 bg-[#202024] hover:bg-[#27272A] transition cursor-pointer flex items-center justify-between gap-3 border-b border-white/5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: bucket.color }} />
                      <h5 className="text-xs sm:text-sm font-extrabold text-white font-serif">{bucket.title}</h5>
                      <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30">
                        {formatPct(bucketPctOfTotal)}%
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs sm:text-sm font-extrabold font-serif text-[#D4AF37]">
                        {formatCurrency(bucketTotal)}
                      </span>
                      <div className="p-1 rounded-lg text-gray-400 hover:text-white">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Bucket Content Body */}
                  {isExpanded && (
                    <div className="p-4 space-y-4">
                      {/* Member Spending Summary Pills for this bucket */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        {filteredMemberStats.map((ms) => {
                          const pctOfBucket =
                            bucket.totalAmount > 0 ? (ms.amount / bucket.totalAmount) * 100 : 0;
                          const memberPctOfTotal =
                            periodData.totalExpense > 0 ? (ms.amount / periodData.totalExpense) * 100 : 0;

                          return (
                            <div
                              key={`ms-${bucket.key}-${ms.id}`}
                              className="bg-[#121212] border border-white/10 p-2.5 rounded-xl space-y-1"
                            >
                              <div className="flex items-center justify-between text-xs sm:text-sm">
                                <span className="font-extrabold text-gray-100 flex items-center gap-1.5 truncate">
                                  <User className="w-3.5 h-3.5 text-[#D4AF37]" />
                                  <span className="truncate">{ms.name}</span>
                                </span>
                                <span className="font-extrabold text-[#00E676]">{formatCurrency(ms.amount)}</span>
                              </div>
                              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.min(100, pctOfBucket)}%`,
                                    backgroundColor: bucket.color,
                                  }}
                                />
                              </div>
                              <div className="flex justify-between text-xs text-gray-300 font-bold">
                                <span>{formatPct(memberPctOfTotal)}%</span>
                                <span>{formatPct(pctOfBucket)}% do pilar</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Transactions List ("O que foi") */}
                      <div className="space-y-2 pt-2 border-t border-white/10">
                        <span className="text-xs sm:text-sm font-black text-[#D4AF37] uppercase tracking-wider block">
                          Lançamentos do Pilar ({filteredTxList.length}):
                        </span>

                        {filteredTxList.length === 0 ? (
                          <p className="text-xs sm:text-sm text-gray-400 italic py-2">
                            Nenhum gasto encontrado neste pilar para o filtro selecionado.
                          </p>
                        ) : (
                          <div className="divide-y divide-white/10 bg-[#121212] border border-white/20 rounded-xl overflow-hidden">
                            {filteredTxList.map((tx) => {
                              const currentMemberId = tx.familyMemberId || 'UNASSIGNED';

                              return (
                                <div
                                  key={tx.id}
                                  className="p-3.5 hover:bg-white/5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm"
                                >
                                  {/* Left info: Date, Description, Category */}
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-extrabold text-[#D4AF37] bg-[#D4AF37]/15 px-2.5 py-1 rounded-md border border-[#D4AF37]/40">
                                        {formatDateBR(tx.date)}
                                      </span>
                                      <span className="font-extrabold text-white text-xs sm:text-sm">{tx.description}</span>
                                      {tx.isConsolidated && (
                                        <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                          Efetivado
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs sm:text-sm text-gray-300 font-medium flex items-center gap-1.5">
                                      <Tag className="w-3.5 h-3.5 text-gray-400" />
                                      <span>{getCategoryLabel(tx.categoryId, tx.subcategoryId)}</span>
                                      {tx.notes && <span className="text-gray-400 italic">({tx.notes})</span>}
                                    </div>
                                  </div>

                                  {/* Right info: Amount + Quick Member Selector + Full Edit Pencil */}
                                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                                    <span className="font-black text-sm sm:text-base text-[#FF5252] font-serif">
                                      {formatCurrency(tx.amount)}
                                    </span>

                                    {/* Inline Reassignment Dropdown */}
                                    <div className="flex items-center gap-1.5 bg-[#18181B] border border-white/20 rounded-xl px-2.5 py-1.5 min-h-[48px]">
                                      <User className="w-4 h-4 text-[#D4AF37] shrink-0" />
                                      <select
                                        value={currentMemberId}
                                        onChange={(e) => handleMemberChange(tx, e.target.value)}
                                        className="bg-transparent text-gray-100 text-xs sm:text-sm font-extrabold focus:outline-none cursor-pointer pr-1"
                                        title="Alterar membro da família deste lançamento"
                                      >
                                        <option value="UNASSIGNED" className="bg-[#18181B] text-white">
                                          Geral / Sem Membro
                                        </option>
                                        {allFamilyMembersList.map((m) => (
                                          <option key={`opt-${tx.id}-${m.id}`} value={m.id} className="bg-[#18181B] text-white">
                                            {m.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Full Edit Modal Pencil Action */}
                                    {onEditTransaction && (
                                      <button
                                        type="button"
                                        onClick={() => onEditTransaction(tx)}
                                        className="min-h-[48px] min-w-[48px] p-2.5 bg-white/10 hover:bg-[#D4AF37] hover:text-[#121212] text-gray-200 rounded-xl transition cursor-pointer flex items-center justify-center"
                                        title="Editar detalhes completos deste lançamento"
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* MODE 2: POR MEMBRO DA FAMÍLIA */}
        {breakdownViewMode === 'by_member' && (
          <div className="grid grid-cols-1 gap-4">
            {familyBreakdownData.membersOverallList
              .filter((m) => selectedMemberFilter === 'ALL' || selectedMemberFilter === m.id)
              .map((member) => {
                const isExpanded = !!expandedMembers[member.id];

                return (
                  <div key={`overall-m-${member.id}`} className="bg-[#18181B] border border-white/10 rounded-xl overflow-hidden shadow-sm">
                    {/* Member Card Header */}
                    <div
                      onClick={() => toggleMemberExpand(member.id)}
                      className="p-4 bg-[#202024] hover:bg-[#27272A] transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] rounded-xl font-bold">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <h5 className="text-base sm:text-lg font-extrabold text-white font-serif">
                            {member.name}
                          </h5>
                          <span className="text-xs sm:text-sm font-extrabold text-[#D4AF37]">
                            Representa {formatPct(periodData.totalExpense > 0 ? (member.totalAmount / periodData.totalExpense) * 100 : 0)}%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 self-end sm:self-center">
                        <div className="text-right">
                          <span className="text-xs text-gray-300 block uppercase font-black tracking-wide">Gasto Total</span>
                          <span className="text-lg sm:text-xl font-black font-serif text-[#FF5252]">
                            {formatCurrency(member.totalAmount)}
                          </span>
                        </div>
                        <div className="p-1 rounded-lg text-gray-300 hover:text-white">
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>

                    {/* Member Pillars Summary Badges Bar */}
                    {(() => {
                      const essentialsPct = member.totalAmount > 0 ? (member.essentialsAmount / member.totalAmount) * 100 : 0;
                      const lifestylePct = member.totalAmount > 0 ? (member.lifestyleAmount / member.totalAmount) * 100 : 0;
                      const investmentPct = member.totalAmount > 0 ? (member.investmentAmount / member.totalAmount) * 100 : 0;

                      return (
                        <div className="p-3 bg-[#121212] border-b border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs sm:text-sm">
                          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 flex justify-between items-center">
                            <span className="text-gray-200 font-bold">50% Necessidades:</span>
                            <span className="font-extrabold text-blue-400">
                              {formatCurrency(member.essentialsAmount)} <span className="text-xs font-bold text-blue-300">({formatPct(essentialsPct)}%)</span>
                            </span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-pink-500/10 border border-pink-500/30 flex justify-between items-center">
                            <span className="text-gray-200 font-bold">30% Estilo de Vida:</span>
                            <span className="font-extrabold text-pink-400">
                              {formatCurrency(member.lifestyleAmount)} <span className="text-xs font-bold text-pink-300">({formatPct(lifestylePct)}%)</span>
                            </span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex justify-between items-center">
                            <span className="text-gray-200 font-bold">20% Investimentos:</span>
                            <span className="font-extrabold text-emerald-400">
                              {formatCurrency(member.investmentAmount)} <span className="text-xs font-bold text-emerald-300">({formatPct(investmentPct)}%)</span>
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Member Transactions Drawer ("O que foi") */}
                    {isExpanded && (
                      <div className="p-4 space-y-3">
                        <span className="text-xs sm:text-sm font-black text-[#D4AF37] uppercase tracking-wider block">
                          Lançamentos do Membro ({member.transactions.length}):
                        </span>

                        {member.transactions.length === 0 ? (
                          <p className="text-xs sm:text-sm text-gray-400 italic py-2">
                            Nenhum lançamento registrado para este membro no período.
                          </p>
                        ) : (
                          <div className="divide-y divide-white/10 bg-[#121212] border border-white/20 rounded-xl overflow-hidden">
                            {member.transactions.map((tx) => {
                              const currentMemberId = tx.familyMemberId || 'UNASSIGNED';
                              const group = categoryRuleMap[tx.categoryId] || '30_lifestyle';

                              let badgeText = '30% Estilo de Vida';
                              let badgeClass = 'bg-pink-500/20 text-pink-400 border-pink-500/30';
                              if (group === '50_essentials') {
                                badgeText = '50% Necessidades';
                                badgeClass = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
                              } else if (group === '20_investment') {
                                badgeText = '20% Investimentos';
                                badgeClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
                              }

                              return (
                                <div
                                  key={`m-tx-${tx.id}`}
                                  className="p-3.5 hover:bg-white/5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm"
                                >
                                  {/* Left Info */}
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-extrabold text-[#D4AF37] bg-[#D4AF37]/15 px-2.5 py-1 rounded-md border border-[#D4AF37]/40">
                                        {formatDateBR(tx.date)}
                                      </span>
                                      <span className="font-extrabold text-white text-xs sm:text-sm">{tx.description}</span>
                                      <span className={`text-xs font-extrabold px-2 py-0.5 rounded border ${badgeClass}`}>
                                        {badgeText}
                                      </span>
                                    </div>
                                    <div className="text-xs sm:text-sm text-gray-300 font-medium flex items-center gap-1.5">
                                      <Tag className="w-3.5 h-3.5 text-gray-400" />
                                      <span>{getCategoryLabel(tx.categoryId, tx.subcategoryId)}</span>
                                    </div>
                                  </div>

                                  {/* Right Info: Amount + Inline Reassignment + Full Edit */}
                                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                                    <span className="font-black text-sm sm:text-base text-[#FF5252] font-serif">
                                      {formatCurrency(tx.amount)}
                                    </span>

                                    {/* Inline Member Reassignment Dropdown */}
                                    <div className="flex items-center gap-1.5 bg-[#18181B] border border-white/20 rounded-xl px-2.5 py-1.5 min-h-[48px]">
                                      <User className="w-4 h-4 text-[#D4AF37] shrink-0" />
                                      <select
                                        value={currentMemberId}
                                        onChange={(e) => handleMemberChange(tx, e.target.value)}
                                        className="bg-transparent text-gray-100 text-xs sm:text-sm font-extrabold focus:outline-none cursor-pointer pr-1"
                                        title="Reatribuir a outro membro da família"
                                      >
                                        <option value="UNASSIGNED" className="bg-[#18181B] text-white">
                                          Geral / Sem Membro
                                        </option>
                                        {allFamilyMembersList.map((m) => (
                                          <option key={`opt-m-${tx.id}-${m.id}`} value={m.id} className="bg-[#18181B] text-white">
                                            {m.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Edit Pencil Button */}
                                    {onEditTransaction && (
                                      <button
                                        type="button"
                                        onClick={() => onEditTransaction(tx)}
                                        className="min-h-[48px] min-w-[48px] p-2.5 bg-white/10 hover:bg-[#D4AF37] hover:text-[#121212] text-gray-200 rounded-xl transition cursor-pointer flex items-center justify-center"
                                        title="Editar detalhes completos deste lançamento"
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Edit Modal for 50/30/20 Targets */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#18181B] border border-[#D4AF37] rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="text-base font-black font-serif">Editar Metas do Orçamento Familiar</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 text-gray-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-300">
              Personalize as metas percentuais da sua estratégia de orçamento familiar (padrão 50% / 30% / 20%). A soma recomendada é 100%.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  50% Necessidades & Contas Essenciais:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={tempTargets.essentials}
                    onChange={(e) =>
                      setTempTargets({ ...tempTargets, essentials: Number(e.target.value) })
                    }
                    className="w-full bg-[#121212] border border-white/20 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-[#D4AF37]"
                  />
                  <span className="font-bold">%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  30% Estilo de Vida & Lazer:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={tempTargets.lifestyle}
                    onChange={(e) =>
                      setTempTargets({ ...tempTargets, lifestyle: Number(e.target.value) })
                    }
                    className="w-full bg-[#121212] border border-white/20 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-[#D4AF37]"
                  />
                  <span className="font-bold">%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  20% Investimentos & Reservas:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={tempTargets.investment}
                    onChange={(e) =>
                      setTempTargets({ ...tempTargets, investment: Number(e.target.value) })
                    }
                    className="w-full bg-[#121212] border border-white/20 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-[#D4AF37]"
                  />
                  <span className="font-bold">%</span>
                </div>
              </div>

              <div className="text-xs text-right font-bold text-gray-400">
                Soma Total: {(tempTargets.essentials + tempTargets.lifestyle + tempTargets.investment).toFixed(0)}%
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 bg-[#121212] hover:bg-black border border-white/20 text-gray-300 rounded-xl font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveTargets}
                className="px-5 py-2 bg-[#D4AF37] hover:bg-[#c4a02e] text-[#121212] font-black rounded-xl text-xs cursor-pointer shadow-md"
              >
                Salvar Metas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
