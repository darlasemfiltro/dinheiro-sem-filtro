import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FamilyMember, Transaction } from '../types';
import { formatCurrency, getMonthYearLabel, getYearMonthKey } from '../utils/finance';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Sparkles,
  ArrowRightLeft,
  ChevronRight,
  Filter,
  Users,
  User,
  UserCheck,
  Search,
  ChevronDown,
  Check,
  X,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
  Line,
  ComposedChart,
} from 'recharts';

interface SearchableMonthSelectProps {
  value: string;
  onChange: (value: string) => void;
  allMonthKeys: string[];
  placeholder?: string;
}

const SearchableMonthSelect: React.FC<SearchableMonthSelectProps> = ({
  value,
  onChange,
  allMonthKeys,
  placeholder = 'Pesquisar mês...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = useMemo(() => {
    if (!value) return 'Selecione o mês';
    const [y, m] = value.split('-').map(Number);
    return getMonthYearLabel(y, m);
  }, [value]);

  const filteredKeys = useMemo(() => {
    if (!searchTerm.trim()) return allMonthKeys;
    const term = searchTerm.toLowerCase().trim();
    return allMonthKeys.filter((mk) => {
      const [y, m] = mk.split('-').map(Number);
      const label = getMonthYearLabel(y, m).toLowerCase();
      const numFormat = `${String(m).padStart(2, '0')}/${y}`;
      return label.includes(term) || mk.includes(term) || numFormat.includes(term);
    });
  }, [allMonthKeys, searchTerm]);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="px-3 py-1.5 bg-white border border-gray-300 hover:border-gray-400 rounded-xl text-[#121212] font-bold text-xs flex items-center gap-2 transition shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
      >
        <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <span className="truncate max-w-[140px] sm:max-w-[180px]">{selectedLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-64 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 p-2 text-xs font-sans">
          {/* Search Input */}
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={placeholder}
              className="w-full pl-8 pr-7 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]"
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
            {filteredKeys.length === 0 ? (
              <div className="py-3 px-2 text-center text-gray-500 text-xs font-medium">
                Nenhum mês encontrado
              </div>
            ) : (
              filteredKeys.map((mk) => {
                const [y, m] = mk.split('-').map(Number);
                const label = getMonthYearLabel(y, m);
                const isSelected = mk === value;
                return (
                  <button
                    key={mk}
                    type="button"
                    onClick={() => {
                      onChange(mk);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg font-bold text-xs transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-[#121212] text-[#D4AF37]'
                        : 'text-gray-800 hover:bg-gray-100'
                    }`}
                  >
                    <span>{label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface MonthlyComparisonDashboardProps {
  transactions: Transaction[];
  familyMembers?: FamilyMember[];
  currentYear: number;
  currentMonth: number;
}

export const MonthlyComparisonDashboard: React.FC<MonthlyComparisonDashboardProps> = ({
  transactions,
  familyMembers = [],
  currentYear,
  currentMonth,
}) => {
  // Family Member Filter State
  const [selectedFamilyMemberId, setSelectedFamilyMemberId] = useState<string>('ALL');

  // Range Preset Mode: Default is '1_month' (Período A x Período B)
  const [rangePreset, setRangePreset] = useState<'1_month' | '6_months' | '12_months' | '24_months' | 'custom'>('1_month');

  // Sub-granularity when rangePreset === '1_month' (Período A x Período B)
  const [compareGranularity, setCompareGranularity] = useState<'month' | 'year' | 'custom_ab'>('month');

  // Month x Month state
  const [monthAKey, setMonthAKey] = useState<string>(() => {
    const prevM = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevY = currentMonth === 1 ? currentYear - 1 : currentYear;
    return getYearMonthKey(prevY, prevM);
  });
  const [monthBKey, setMonthBKey] = useState<string>(() => getYearMonthKey(currentYear, currentMonth));

  // Year x Year state
  const [yearA, setYearA] = useState<number>(() => currentYear - 1);
  const [yearB, setYearB] = useState<number>(() => currentYear);

  // Custom Period A x Period B state
  const [customAStart, setCustomAStart] = useState<string>(() => getYearMonthKey(currentYear - 1, 1));
  const [customAEnd, setCustomAEnd] = useState<string>(() => getYearMonthKey(currentYear - 1, 12));
  const [customBStart, setCustomBStart] = useState<string>(() => getYearMonthKey(currentYear, 1));
  const [customBEnd, setCustomBEnd] = useState<string>(() => getYearMonthKey(currentYear, currentMonth));

  // Custom Single Timeline Range State (when rangePreset === 'custom')
  const [startYearMonth, setStartYearMonth] = useState<string>(() => {
    const startY = currentMonth <= 6 ? currentYear - 1 : currentYear;
    const startM = currentMonth <= 6 ? currentMonth + 6 : currentMonth - 6;
    return getYearMonthKey(startY, startM);
  });
  const [endYearMonth, setEndYearMonth] = useState<string>(() => getYearMonthKey(currentYear, currentMonth));

  // View Mode: 'income_vs_expense' | 'net_balance' | 'both'
  const [viewMode, setViewMode] = useState<'income_vs_expense' | 'net_balance' | 'both'>('income_vs_expense');

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

  // Filter transactions according to selectedFamilyMemberId
  const filteredTransactions = useMemo(() => {
    if (selectedFamilyMemberId === 'ALL') return transactions;

    if (selectedFamilyMemberId === 'UNASSIGNED') {
      return transactions.filter(
        (t) => !t.familyMemberId && (!t.familyMemberName || t.familyMemberName === 'Geral')
      );
    }

    const memberObj = allFamilyMembersList.find((fm) => fm.id === selectedFamilyMemberId);

    return transactions.filter((t) => {
      if (t.familyMemberId && t.familyMemberId === selectedFamilyMemberId) return true;
      if (memberObj && t.familyMemberName === memberObj.name) return true;
      return false;
    });
  }, [transactions, selectedFamilyMemberId, allFamilyMembersList]);

  // Helper for available years list
  const availableYears = useMemo(() => {
    const set = new Set<number>();
    set.add(currentYear);
    set.add(currentYear - 1);
    filteredTransactions.forEach((t) => {
      if (t.date && t.date.length >= 4) {
        const y = parseInt(t.date.slice(0, 4), 10);
        if (!isNaN(y)) set.add(y);
      }
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [filteredTransactions, currentYear]);

  // Helper for all distinct year-months in transaction history
  const allAvailableMonthKeys = useMemo(() => {
    const set = new Set<string>();
    filteredTransactions.forEach((t) => {
      if (t.date && t.date.length >= 7) {
        set.add(t.date.slice(0, 7));
      }
    });
    let y = currentYear;
    let m = currentMonth;
    for (let i = 0; i < 24; i++) {
      set.add(getYearMonthKey(y, m));
      m--;
      if (m < 1) {
        m = 12;
        y--;
      }
    }
    return Array.from(set).sort().reverse();
  }, [filteredTransactions, currentYear, currentMonth]);

  // Comparison Calculations for Period A vs Period B
  const compareDataAB = useMemo(() => {
    let txA: Transaction[] = [];
    let txB: Transaction[] = [];
    let labelA = '';
    let labelB = '';

    if (compareGranularity === 'month') {
      const [yA, mA] = monthAKey.split('-').map(Number);
      const [yB, mB] = monthBKey.split('-').map(Number);
      labelA = getMonthYearLabel(yA, mA);
      labelB = getMonthYearLabel(yB, mB);
      txA = filteredTransactions.filter((t) => t.date.startsWith(monthAKey));
      txB = filteredTransactions.filter((t) => t.date.startsWith(monthBKey));
    } else if (compareGranularity === 'year') {
      labelA = `Ano ${yearA}`;
      labelB = `Ano ${yearB}`;
      txA = filteredTransactions.filter((t) => t.date.startsWith(`${yearA}-`));
      txB = filteredTransactions.filter((t) => t.date.startsWith(`${yearB}-`));
    } else {
      const [yA1, mA1] = customAStart.split('-').map(Number);
      const [yA2, mA2] = customAEnd.split('-').map(Number);
      const [yB1, mB1] = customBStart.split('-').map(Number);
      const [yB2, mB2] = customBEnd.split('-').map(Number);
      labelA = `${getMonthYearLabel(yA1, mA1)} a ${getMonthYearLabel(yA2, mA2)}`;
      labelB = `${getMonthYearLabel(yB1, mB1)} a ${getMonthYearLabel(yB2, mB2)}`;

      txA = filteredTransactions.filter((t) => {
        const ym = t.date.substring(0, 7);
        return ym >= customAStart && ym <= customAEnd;
      });
      txB = filteredTransactions.filter((t) => {
        const ym = t.date.substring(0, 7);
        return ym >= customBStart && ym <= customBEnd;
      });
    }

    const incomeA = txA.filter((t) => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expensesA = txA.filter((t) => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const netA = incomeA - expensesA;

    const incomeB = txB.filter((t) => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expensesB = txB.filter((t) => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const netB = incomeB - expensesB;

    const diffIncome = incomeB - incomeA;
    const pctIncome = incomeA > 0 ? ((incomeB - incomeA) / incomeA) * 100 : 0;

    const diffExpenses = expensesB - expensesA;
    const pctExpenses = expensesA > 0 ? ((expensesB - expensesA) / expensesA) * 100 : 0;

    const diffNet = netB - netA;

    return {
      labelA,
      labelB,
      incomeA,
      expensesA,
      netA,
      incomeB,
      expensesB,
      netB,
      diffIncome,
      pctIncome,
      diffExpenses,
      pctExpenses,
      diffNet,
    };
  }, [
    compareGranularity,
    monthAKey,
    monthBKey,
    yearA,
    yearB,
    customAStart,
    customAEnd,
    customBStart,
    customBEnd,
    filteredTransactions,
  ]);

  // Chart data for direct side-by-side comparison of Period A vs Period B
  const sideBySideChartData = useMemo(() => {
    return [
      {
        metric: 'Receitas (Entradas)',
        [compareDataAB.labelA]: compareDataAB.incomeA,
        [compareDataAB.labelB]: compareDataAB.incomeB,
      },
      {
        metric: 'Despesas (Saídas)',
        [compareDataAB.labelA]: compareDataAB.expensesA,
        [compareDataAB.labelB]: compareDataAB.expensesB,
      },
      {
        metric: 'Resultado Líquido',
        [compareDataAB.labelA]: compareDataAB.netA,
        [compareDataAB.labelB]: compareDataAB.netB,
      },
    ];
  }, [compareDataAB]);

  // Month-by-month chart data when comparing Year A vs Year B
  const yearByYearMonthlyComparison = useMemo(() => {
    if (compareGranularity !== 'year') return [];
    const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return monthLabels.map((mName, idx) => {
      const mNum = idx + 1;
      const mStr = mNum < 10 ? `0${mNum}` : `${mNum}`;
      const keyA = `${yearA}-${mStr}`;
      const keyB = `${yearB}-${mStr}`;

      const txA = filteredTransactions.filter((t) => t.date.startsWith(keyA));
      const txB = filteredTransactions.filter((t) => t.date.startsWith(keyB));

      const incA = txA.filter((t) => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
      const expA = txA.filter((t) => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
      const netA = incA - expA;

      const incB = txB.filter((t) => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
      const expB = txB.filter((t) => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
      const netB = incB - expB;

      return {
        month: mName,
        [`Receita ${yearA}`]: incA,
        [`Receita ${yearB}`]: incB,
        [`Despesa ${yearA}`]: expA,
        [`Despesa ${yearB}`]: expB,
        [`Saldo ${yearA}`]: netA,
        [`Saldo ${yearB}`]: netB,
      };
    });
  }, [compareGranularity, yearA, yearB, filteredTransactions]);

  // Generate list of month keys based on rangePreset for timeline views
  const monthKeysList = useMemo(() => {
    if (rangePreset === '1_month') {
      return [monthAKey, monthBKey].sort();
    }

    let countMonths = 6;
    if (rangePreset === '6_months') countMonths = 6;
    else if (rangePreset === '12_months') countMonths = 12;
    else if (rangePreset === '24_months') countMonths = 24;

    if (rangePreset === 'custom') {
      const list: string[] = [];
      let [currY, currM] = startYearMonth.split('-').map(Number);
      const [targetY, targetM] = endYearMonth.split('-').map(Number);

      let safety = 0;
      while (safety < 120) {
        safety++;
        const key = getYearMonthKey(currY, currM);
        list.push(key);
        if (currY === targetY && currM === targetM) break;
        if (currY > targetY || (currY === targetY && currM > targetM)) break;

        currM++;
        if (currM > 12) {
          currM = 1;
          currY++;
        }
      }
      return list;
    }

    const list: string[] = [];
    let y = currentYear;
    let m = currentMonth;

    for (let i = 0; i < countMonths; i++) {
      list.unshift(getYearMonthKey(y, m));
      m--;
      if (m < 1) {
        m = 12;
        y--;
      }
    }
    return list;
  }, [rangePreset, monthAKey, monthBKey, startYearMonth, endYearMonth, currentYear, currentMonth]);

  // Aggregate financial data per month for timeline views
  const monthlyData = useMemo(() => {
    return monthKeysList.map((mKey) => {
      const [year, month] = mKey.split('-').map(Number);
      const monthLabel = getMonthYearLabel(year, month);
      const shortLabel = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
        month: 'short',
        year: '2-digit',
      });

      const monthTx = filteredTransactions.filter((t) => t.date.startsWith(mKey));

      const income = monthTx.filter((t) => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
      const expenses = monthTx.filter((t) => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
      const net = income - expenses;

      return {
        key: mKey,
        label: monthLabel,
        shortLabel,
        income,
        expenses,
        net,
        isPositive: net >= 0,
      };
    });
  }, [monthKeysList, filteredTransactions]);

  // Aggregated totals for summary analytics
  const totals = useMemo(() => {
    const totalIncome = monthlyData.reduce((acc, d) => acc + d.income, 0);
    const totalExpenses = monthlyData.reduce((acc, d) => acc + d.expenses, 0);
    const totalNet = totalIncome - totalExpenses;
    const avgMonthlyExpense = monthlyData.length > 0 ? totalExpenses / monthlyData.length : 0;

    let maxIncomeMonth = monthlyData[0];
    let maxExpenseMonth = monthlyData[0];

    monthlyData.forEach((d) => {
      if (!maxIncomeMonth || d.income > maxIncomeMonth.income) maxIncomeMonth = d;
      if (!maxExpenseMonth || d.expenses > maxExpenseMonth.expenses) maxExpenseMonth = d;
    });

    return {
      totalIncome,
      totalExpenses,
      totalNet,
      avgMonthlyExpense,
      maxIncomeMonth,
      maxExpenseMonth,
    };
  }, [monthlyData]);

  // Family Members Breakdown Comparison Calculation (Side-by-Side per member comparing Period A vs Period B)
  const familyComparisonBreakdown = useMemo(() => {
    let txA: Transaction[] = [];
    let txB: Transaction[] = [];
    let labelA = '';
    let labelB = '';
    let periodTitle = '';

    if (rangePreset === '1_month') {
      if (compareGranularity === 'month') {
        const [yA, mA] = monthAKey.split('-').map(Number);
        const [yB, mB] = monthBKey.split('-').map(Number);
        labelA = getMonthYearLabel(yA, mA);
        labelB = getMonthYearLabel(yB, mB);
        txA = transactions.filter((t) => t.date.startsWith(monthAKey));
        txB = transactions.filter((t) => t.date.startsWith(monthBKey));
        periodTitle = monthAKey === monthBKey ? labelA : `${labelA} vs ${labelB}`;
      } else if (compareGranularity === 'year') {
        labelA = `Ano ${yearA}`;
        labelB = `Ano ${yearB}`;
        txA = transactions.filter((t) => t.date.startsWith(`${yearA}-`));
        txB = transactions.filter((t) => t.date.startsWith(`${yearB}-`));
        periodTitle = yearA === yearB ? labelA : `${labelA} vs ${labelB}`;
      } else {
        const [yA1, mA1] = customAStart.split('-').map(Number);
        const [yA2, mA2] = customAEnd.split('-').map(Number);
        const [yB1, mB1] = customBStart.split('-').map(Number);
        const [yB2, mB2] = customBEnd.split('-').map(Number);

        labelA = `${getMonthYearLabel(yA1, mA1)} a ${getMonthYearLabel(yA2, mA2)}`;
        labelB = `${getMonthYearLabel(yB1, mB1)} a ${getMonthYearLabel(yB2, mB2)}`;

        txA = transactions.filter((t) => {
          const ym = t.date.substring(0, 7);
          return ym >= customAStart && ym <= customAEnd;
        });
        txB = transactions.filter((t) => {
          const ym = t.date.substring(0, 7);
          return ym >= customBStart && ym <= customBEnd;
        });
        periodTitle =
          customAStart === customBStart && customAEnd === customBEnd
            ? labelA
            : `${labelA} vs ${labelB}`;
      }
    } else {
      periodTitle = `Período (${monthKeysList.length} Meses)`;
      labelA = 'Período Completo';
      labelB = 'Período Completo';
      txB = transactions.filter((t) => {
        const ym = t.date.substring(0, 7);
        return monthKeysList.includes(ym);
      });
      txA = [];
    }

    interface MemberStat {
      id: string;
      name: string;
      incomeA: number;
      expensesA: number;
      netA: number;
      incomeB: number;
      expensesB: number;
      netB: number;
      diffExpenses: number;
      pctExpenses: number;
      diffIncome: number;
      pctIncome: number;
      diffNet: number;
      income: number;
      expenses: number;
      net: number;
    }

    const memberStatsMap = new Map<string, MemberStat>();

    allFamilyMembersList.forEach((fm) => {
      memberStatsMap.set(fm.id, {
        id: fm.id,
        name: fm.name,
        incomeA: 0,
        expensesA: 0,
        netA: 0,
        incomeB: 0,
        expensesB: 0,
        netB: 0,
        diffExpenses: 0,
        pctExpenses: 0,
        diffIncome: 0,
        pctIncome: 0,
        diffNet: 0,
        income: 0,
        expenses: 0,
        net: 0,
      });
    });

    let unassignedIncomeA = 0;
    let unassignedExpensesA = 0;
    let unassignedIncomeB = 0;
    let unassignedExpensesB = 0;

    txA.forEach((t) => {
      let matchedId = '';
      if (t.familyMemberId && memberStatsMap.has(t.familyMemberId)) {
        matchedId = t.familyMemberId;
      } else if (t.familyMemberName && t.familyMemberName !== 'Geral') {
        const found = allFamilyMembersList.find((fm) => fm.name === t.familyMemberName);
        if (found) matchedId = found.id;
      }

      if (matchedId) {
        const stat = memberStatsMap.get(matchedId)!;
        if (t.type === 'income') stat.incomeA += t.amount;
        if (t.type === 'expense') stat.expensesA += t.amount;
      } else {
        if (t.type === 'income') unassignedIncomeA += t.amount;
        if (t.type === 'expense') unassignedExpensesA += t.amount;
      }
    });

    txB.forEach((t) => {
      let matchedId = '';
      if (t.familyMemberId && memberStatsMap.has(t.familyMemberId)) {
        matchedId = t.familyMemberId;
      } else if (t.familyMemberName && t.familyMemberName !== 'Geral') {
        const found = allFamilyMembersList.find((fm) => fm.name === t.familyMemberName);
        if (found) matchedId = found.id;
      }

      if (matchedId) {
        const stat = memberStatsMap.get(matchedId)!;
        if (t.type === 'income') stat.incomeB += t.amount;
        if (t.type === 'expense') stat.expensesB += t.amount;
      } else {
        if (t.type === 'income') unassignedIncomeB += t.amount;
        if (t.type === 'expense') unassignedExpensesB += t.amount;
      }
    });

    const membersList: MemberStat[] = Array.from(memberStatsMap.values());

    if (
      unassignedIncomeA > 0 ||
      unassignedExpensesA > 0 ||
      unassignedIncomeB > 0 ||
      unassignedExpensesB > 0 ||
      membersList.length === 0
    ) {
      membersList.push({
        id: 'UNASSIGNED',
        name: 'Geral / Não Especificado',
        incomeA: unassignedIncomeA,
        expensesA: unassignedExpensesA,
        netA: unassignedIncomeA - unassignedExpensesA,
        incomeB: unassignedIncomeB,
        expensesB: unassignedExpensesB,
        netB: unassignedIncomeB - unassignedExpensesB,
        diffExpenses: 0,
        pctExpenses: 0,
        diffIncome: 0,
        pctIncome: 0,
        diffNet: 0,
        income: 0,
        expenses: 0,
        net: 0,
      });
    }

    membersList.forEach((m) => {
      m.netA = m.incomeA - m.expensesA;
      m.netB = m.incomeB - m.expensesB;
      m.diffExpenses = m.expensesB - m.expensesA;
      m.pctExpenses =
        m.expensesA > 0 ? ((m.expensesB - m.expensesA) / m.expensesA) * 100 : m.expensesB > 0 ? 100 : 0;
      m.diffIncome = m.incomeB - m.incomeA;
      m.pctIncome =
        m.incomeA > 0 ? ((m.incomeB - m.incomeA) / m.incomeA) * 100 : m.incomeB > 0 ? 100 : 0;
      m.diffNet = m.netB - m.netA;
      m.income = m.incomeB;
      m.expenses = m.expensesB;
      m.net = m.netB;
    });

    const familyExpensesA = membersList.reduce((acc, m) => acc + m.expensesA, 0);
    const familyExpensesB = membersList.reduce((acc, m) => acc + m.expensesB, 0);
    const familyDiffExpenses = familyExpensesB - familyExpensesA;
    const familyPctExpenses =
      familyExpensesA > 0 ? ((familyExpensesB - familyExpensesA) / familyExpensesA) * 100 : familyExpensesB > 0 ? 100 : 0;

    const familyIncomeA = membersList.reduce((acc, m) => acc + m.incomeA, 0);
    const familyIncomeB = membersList.reduce((acc, m) => acc + m.incomeB, 0);
    const familyDiffIncome = familyIncomeB - familyIncomeA;

    const familyNetA = familyIncomeA - familyExpensesA;
    const familyNetB = familyIncomeB - familyExpensesB;
    const familyDiffNet = familyNetB - familyNetA;

    const chartData = membersList.map((m) => ({
      name: m.name,
      id: m.id,
      Receita: m.incomeB,
      Despesa: m.expensesB,
      Saldo: m.netB,
      'Despesa (A)': m.expensesA,
      'Despesa (B)': m.expensesB,
    }));

    return {
      periodTitle,
      labelA,
      labelB,
      familyExpensesA,
      familyExpensesB,
      familyDiffExpenses,
      familyPctExpenses,
      familyIncomeA,
      familyIncomeB,
      familyDiffIncome,
      familyNetA,
      familyNetB,
      familyDiffNet,
      familyTotalIncome: familyIncomeB,
      familyTotalExpenses: familyExpensesB,
      familyTotalNet: familyNetB,
      membersList,
      chartData,
    };
  }, [
    rangePreset,
    compareGranularity,
    monthAKey,
    monthBKey,
    yearA,
    yearB,
    customAStart,
    customAEnd,
    customBStart,
    customBEnd,
    monthKeysList,
    transactions,
    allFamilyMembersList,
  ]);

  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-6" id="monthly-comparison-dashboard">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#121212] text-[#D4AF37] rounded-xl">
              <BarChart3 className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#121212] font-serif">
                Comparativo Mensal (Receitas x Despesas x Saldo)
              </h2>
              <p className="text-xs text-gray-600">
                Compare gastos e entradas mensalmente no período desejado e por membro da família
              </p>
            </div>
          </div>
        </div>

        {/* Period Selector Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 p-1.5 rounded-2xl border border-gray-200">
          <button
            type="button"
            onClick={() => setRangePreset('1_month')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              rangePreset === '1_month'
                ? 'bg-[#121212] text-[#D4AF37] shadow-xs'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            Período A x Período B
          </button>

          <button
            type="button"
            onClick={() => setRangePreset('6_months')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              rangePreset === '6_months'
                ? 'bg-[#121212] text-[#D4AF37] shadow-xs'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            Semestre (6M)
          </button>

          <button
            type="button"
            onClick={() => setRangePreset('12_months')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              rangePreset === '12_months'
                ? 'bg-[#121212] text-[#D4AF37] shadow-xs'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            1 Ano (12M)
          </button>

          <button
            type="button"
            onClick={() => setRangePreset('24_months')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              rangePreset === '24_months'
                ? 'bg-[#121212] text-[#D4AF37] shadow-xs'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            2 Anos (24M)
          </button>

          <button
            type="button"
            onClick={() => setRangePreset('custom')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              rangePreset === 'custom'
                ? 'bg-[#121212] text-[#D4AF37] shadow-xs'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            Personalizado
          </button>
        </div>
      </div>

      {/* Filter by Family Member Selector Bar */}
      <div className="bg-gradient-to-r from-amber-50/90 via-amber-50/40 to-amber-100/50 border border-amber-200/90 rounded-2xl p-3.5 space-y-2 shadow-2xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#121212] text-[#D4AF37] rounded-lg">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#121212] uppercase tracking-wider block">
                Filtro por Membro da Família
              </span>
              <span className="text-[11px] text-gray-600">
                {selectedFamilyMemberId === 'ALL'
                  ? 'Exibindo comparativo consolidado de Todos os Membros da Família'
                  : `Filtrando comparativo exclusivamente para: ${
                      allFamilyMembersList.find((f) => f.id === selectedFamilyMemberId)?.name || 'Membro Selecionado'
                    }`}
              </span>
            </div>
          </div>

          {selectedFamilyMemberId !== 'ALL' && (
            <button
              type="button"
              onClick={() => setSelectedFamilyMemberId('ALL')}
              className="text-[11px] font-bold text-[#121212] bg-white border border-gray-300 hover:border-[#D4AF37] px-2.5 py-1 rounded-xl transition flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <span>Exibir Todos os Membros</span>
            </button>
          )}
        </div>

        {/* Member Selector Badges */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => setSelectedFamilyMemberId('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              selectedFamilyMemberId === 'ALL'
                ? 'bg-[#121212] text-[#D4AF37] shadow-xs'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Todos os Membros</span>
          </button>

          {allFamilyMembersList.map((fm) => {
            const isActive = selectedFamilyMemberId === fm.id;
            return (
              <button
                key={fm.id}
                type="button"
                onClick={() => setSelectedFamilyMemberId(fm.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-[#D4AF37] text-[#121212] shadow-xs font-extrabold border border-amber-500'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                <User className="w-3.5 h-3.5 text-gray-800" />
                <span>{fm.name}</span>
              </button>
            );
          })}

          {familyComparisonBreakdown.membersList.some((m) => m.id === 'UNASSIGNED') && (
            <button
              type="button"
              onClick={() => setSelectedFamilyMemberId('UNASSIGNED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                selectedFamilyMemberId === 'UNASSIGNED'
                  ? 'bg-[#121212] text-[#D4AF37] shadow-xs'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              <span>Geral / Não Especificado</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-controls for Período A x Período B or timeline custom range */}
      {rangePreset === '1_month' && (
        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3 text-xs font-bold">
          {/* Sub-granularity mode selector */}
          <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-gray-200">
            <span className="text-[#121212] font-serif font-extrabold mr-1">Tipo de Comparação:</span>
            <button
              type="button"
              onClick={() => setCompareGranularity('month')}
              className={`px-3 py-1 rounded-xl cursor-pointer transition ${
                compareGranularity === 'month'
                  ? 'bg-[#121212] text-[#D4AF37] shadow-2xs'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
              }`}
            >
              Mês x Mês
            </button>
            <button
              type="button"
              onClick={() => setCompareGranularity('year')}
              className={`px-3 py-1 rounded-xl cursor-pointer transition ${
                compareGranularity === 'year'
                  ? 'bg-[#121212] text-[#D4AF37] shadow-2xs'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
              }`}
            >
              Ano x Ano (1 ano inteiro vs outro)
            </button>
            <button
              type="button"
              onClick={() => setCompareGranularity('custom_ab')}
              className={`px-3 py-1 rounded-xl cursor-pointer transition ${
                compareGranularity === 'custom_ab'
                  ? 'bg-[#121212] text-[#D4AF37] shadow-2xs'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
              }`}
            >
              Período A x B (Personalizado)
            </button>
          </div>

          {/* Granularity 1: Month x Month */}
          {compareGranularity === 'month' && (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-gray-700 uppercase tracking-wider text-[11px]">PERÍODO A (Mês):</span>
                <SearchableMonthSelect
                  value={monthAKey}
                  onChange={setMonthAKey}
                  allMonthKeys={allAvailableMonthKeys}
                  placeholder="Pesquisar Período A..."
                />
              </div>

              <span className="text-[#D4AF37] font-serif font-extrabold text-sm">vs</span>

              <div className="flex items-center gap-2">
                <span className="text-gray-700 uppercase tracking-wider text-[11px]">PERÍODO B (Mês):</span>
                <SearchableMonthSelect
                  value={monthBKey}
                  onChange={setMonthBKey}
                  allMonthKeys={allAvailableMonthKeys}
                  placeholder="Pesquisar Período B..."
                />
              </div>
            </div>
          )}

          {/* Granularity 2: Year x Year */}
          {compareGranularity === 'year' && (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-gray-700 uppercase tracking-wider text-[11px]">PERÍODO A (Ano):</span>
                <select
                  value={yearA}
                  onChange={(e) => setYearA(Number(e.target.value))}
                  className="px-3 py-1.5 bg-white border border-gray-300 rounded-xl text-[#121212] font-bold"
                >
                  {availableYears.map((yr) => (
                    <option key={`yrA-${yr}`} value={yr}>
                      Ano {yr}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-[#D4AF37] font-serif font-extrabold text-sm">vs</span>

              <div className="flex items-center gap-2">
                <span className="text-gray-700 uppercase tracking-wider text-[11px]">PERÍODO B (Ano):</span>
                <select
                  value={yearB}
                  onChange={(e) => setYearB(Number(e.target.value))}
                  className="px-3 py-1.5 bg-white border border-gray-300 rounded-xl text-[#121212] font-bold"
                >
                  {availableYears.map((yr) => (
                    <option key={`yrB-${yr}`} value={yr}>
                      Ano {yr}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Granularity 3: Custom Period A x Period B */}
          {compareGranularity === 'custom_ab' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3 bg-white p-2.5 rounded-xl border border-gray-200">
                <span className="text-[#121212] font-extrabold min-w-[90px]">PERÍODO A:</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-600 text-[10px]">De:</span>
                  <input
                    type="month"
                    value={customAStart}
                    onChange={(e) => setCustomAStart(e.target.value)}
                    className="px-2.5 py-1 border border-gray-300 rounded-lg text-[#121212] font-bold text-xs"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-600 text-[10px]">Até:</span>
                  <input
                    type="month"
                    value={customAEnd}
                    onChange={(e) => setCustomAEnd(e.target.value)}
                    className="px-2.5 py-1 border border-gray-300 rounded-lg text-[#121212] font-bold text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 bg-white p-2.5 rounded-xl border border-gray-200">
                <span className="text-[#121212] font-extrabold min-w-[90px]">PERÍODO B:</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-600 text-[10px]">De:</span>
                  <input
                    type="month"
                    value={customBStart}
                    onChange={(e) => setCustomBStart(e.target.value)}
                    className="px-2.5 py-1 border border-gray-300 rounded-lg text-[#121212] font-bold text-xs"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-600 text-[10px]">Até:</span>
                  <input
                    type="month"
                    value={customBEnd}
                    onChange={(e) => setCustomBEnd(e.target.value)}
                    className="px-2.5 py-1 border border-gray-300 rounded-lg text-[#121212] font-bold text-xs"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {rangePreset === 'custom' && (
        <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 flex flex-wrap items-center gap-4 text-xs font-bold">
          <div className="flex items-center gap-2">
            <span className="text-gray-700">De (Mês Inicial):</span>
            <input
              type="month"
              value={startYearMonth}
              onChange={(e) => setStartYearMonth(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-xl text-[#121212] font-bold"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-700">Até (Mês Final):</span>
            <input
              type="month"
              value={endYearMonth}
              onChange={(e) => setEndYearMonth(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-xl text-[#121212] font-bold"
            />
          </div>
        </div>
      )}

      {/* Direct Comparison Summary Block when rangePreset === '1_month' */}
      {rangePreset === '1_month' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card Receitas */}
          <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                Receitas (Entradas)
              </span>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  compareDataAB.diffIncome >= 0
                    ? 'bg-emerald-200/80 text-emerald-950'
                    : 'bg-red-200/80 text-red-950'
                }`}
              >
                {compareDataAB.diffIncome >= 0 ? '+' : ''}
                {compareDataAB.pctIncome.toFixed(1)}%
              </span>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between items-center text-emerald-900 font-semibold">
                <span className="text-[11px] truncate max-w-[140px]">A: {compareDataAB.labelA}</span>
                <span className="font-bold">{formatCurrency(compareDataAB.incomeA)}</span>
              </div>
              <div className="flex justify-between items-center text-emerald-950 font-extrabold">
                <span className="text-[11px] truncate max-w-[140px]">B: {compareDataAB.labelB}</span>
                <span className="font-extrabold font-serif text-sm">
                  {formatCurrency(compareDataAB.incomeB)}
                </span>
              </div>
            </div>

            <div className="pt-1 border-t border-emerald-200/80 text-[11px] font-bold text-emerald-800 flex justify-between">
              <span>Variação de Receita:</span>
              <span className={compareDataAB.diffIncome >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                {compareDataAB.diffIncome >= 0 ? '+' : ''}
                {formatCurrency(compareDataAB.diffIncome)}
              </span>
            </div>
          </div>

          {/* Card Despesas */}
          <div className="bg-red-50/70 border border-red-200 p-4 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-red-900 uppercase tracking-wider">
                Despesas (Saídas)
              </span>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  compareDataAB.diffExpenses <= 0
                    ? 'bg-emerald-200/80 text-emerald-950'
                    : 'bg-red-200/80 text-red-950'
                }`}
              >
                {compareDataAB.diffExpenses >= 0 ? '+' : ''}
                {compareDataAB.pctExpenses.toFixed(1)}%
              </span>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between items-center text-red-900 font-semibold">
                <span className="text-[11px] truncate max-w-[140px]">A: {compareDataAB.labelA}</span>
                <span className="font-bold">{formatCurrency(compareDataAB.expensesA)}</span>
              </div>
              <div className="flex justify-between items-center text-red-950 font-extrabold">
                <span className="text-[11px] truncate max-w-[140px]">B: {compareDataAB.labelB}</span>
                <span className="font-extrabold font-serif text-sm">{formatCurrency(compareDataAB.expensesB)}</span>
              </div>
            </div>

            <div className="pt-1 border-t border-red-200/80 text-[11px] font-bold text-red-800 flex justify-between">
              <span>Variação de Despesa:</span>
              <span className={compareDataAB.diffExpenses <= 0 ? 'text-emerald-700' : 'text-red-700'}>
                {compareDataAB.diffExpenses >= 0 ? '+' : ''}
                {formatCurrency(compareDataAB.diffExpenses)}
              </span>
            </div>
          </div>

          {/* Card Resultado Líquido */}
          <div
            className={`p-4 rounded-2xl border space-y-2 ${
              compareDataAB.diffNet >= 0
                ? 'bg-emerald-100/70 border-emerald-300 text-emerald-950'
                : 'bg-red-100/70 border-red-300 text-red-950'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider">
                Resultado Líquido
              </span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white/80 border border-current">
                {compareDataAB.diffNet >= 0 ? 'Evolução Positiva 👍' : 'Queda no Resultado ⚠️'}
              </span>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between items-center font-semibold">
                <span className="text-[11px] truncate max-w-[140px]">A: {compareDataAB.labelA}</span>
                <span className="font-bold">{formatCurrency(compareDataAB.netA)}</span>
              </div>
              <div className="flex justify-between items-center font-extrabold">
                <span className="text-[11px] truncate max-w-[140px]">B: {compareDataAB.labelB}</span>
                <span className="font-extrabold font-serif text-sm">{formatCurrency(compareDataAB.netB)}</span>
              </div>
            </div>

            <div className="pt-1 border-t border-current/20 text-[11px] font-bold flex justify-between">
              <span>Diferença Líquida (B - A):</span>
              <span className="font-extrabold font-serif">
                {compareDataAB.diffNet >= 0 ? '+' : ''}
                {formatCurrency(compareDataAB.diffNet)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Analytics Summary Cards Grid for timeline views */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-2xl">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
              Receita Total ({monthlyData.length} Meses)
            </span>
            <span className="text-lg font-extrabold text-emerald-950 font-serif block mt-1">
              {formatCurrency(totals.totalIncome)}
            </span>
            <span className="text-[10px] text-emerald-700 font-semibold mt-0.5 block">
              Maior em: {totals.maxIncomeMonth ? totals.maxIncomeMonth.label : '-'} ({formatCurrency(totals.maxIncomeMonth?.income || 0)})
            </span>
          </div>

          <div className="bg-red-50/60 border border-red-200 p-4 rounded-2xl">
            <span className="text-[10px] font-bold text-red-800 uppercase tracking-wider block">
              Despesa Total ({monthlyData.length} Meses)
            </span>
            <span className="text-lg font-extrabold text-red-950 font-serif block mt-1">
              {formatCurrency(totals.totalExpenses)}
            </span>
            <span className="text-[10px] text-red-700 font-semibold mt-0.5 block">
              Média Mensal: {formatCurrency(totals.avgMonthlyExpense)}
            </span>
          </div>

          <div
            className={`p-4 rounded-2xl border ${
              totals.totalNet >= 0
                ? 'bg-emerald-100/70 border-emerald-300 text-emerald-950'
                : 'bg-red-100/70 border-red-300 text-red-950'
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider block">
              Resultado do Período
            </span>
            <span className="text-lg font-extrabold font-serif block mt-1">
              {totals.totalNet >= 0 ? '+' : ''}{formatCurrency(totals.totalNet)}
            </span>
            <span className="text-[10px] font-bold mt-0.5 block">
              {totals.totalNet >= 0 ? 'Superávit Acumulado' : 'Déficit no Período ⚠️'}
            </span>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl">
            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block">
              Pico de Gastos no Período
            </span>
            <span className="text-sm font-extrabold text-[#121212] font-serif block mt-1 truncate">
              {totals.maxExpenseMonth ? totals.maxExpenseMonth.label : '-'}
            </span>
            <span className="text-[11px] font-extrabold text-[#FF3D00] block mt-0.5">
              {formatCurrency(totals.maxExpenseMonth?.expenses || 0)}
            </span>
          </div>
        </div>
      )}

      {/* Interactive Main Chart */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-extrabold text-[#121212] uppercase tracking-wider">
            {rangePreset === '1_month'
              ? `Gráfico Comparativo Lado a Lado: ${compareDataAB.labelA} vs ${compareDataAB.labelB}`
              : 'Gráfico Comparativo Mensal:'}
          </span>

          {rangePreset !== '1_month' && (
            <div className="flex bg-gray-100 p-0.5 rounded-xl text-[10px] font-bold border border-gray-200">
              <button
                type="button"
                onClick={() => setViewMode('income_vs_expense')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  viewMode === 'income_vs_expense' ? 'bg-[#121212] text-[#D4AF37] shadow-2xs' : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Receitas x Despesas
              </button>
              <button
                type="button"
                onClick={() => setViewMode('net_balance')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  viewMode === 'net_balance' ? 'bg-[#121212] text-[#D4AF37] shadow-2xs' : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Resultado Líquido
              </button>
              <button
                type="button"
                onClick={() => setViewMode('both')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  viewMode === 'both' ? 'bg-[#121212] text-[#D4AF37] shadow-2xs' : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Visão Completa
              </button>
            </div>
          )}
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {rangePreset === '1_month' ? (
              <BarChart data={sideBySideChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="metric" tick={{ fontSize: 11, fill: '#121212', fontWeight: 700 }} />
                <YAxis tick={{ fontSize: 10, fill: '#121212' }} tickFormatter={(val) => `R$ ${val}`} />
                <Tooltip
                  formatter={(value: number, name: string) => [formatCurrency(value), name]}
                  contentStyle={{
                    backgroundColor: '#FFF',
                    borderColor: '#D4AF37',
                    borderRadius: '16px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                <Bar name={`${compareDataAB.labelA} (Período Anterior)`} dataKey={compareDataAB.labelA} radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {sideBySideChartData.map((entry, index) => {
                    let color = '#81C784';
                    if (index === 1) {
                      color = '#FF8A80';
                    } else if (index === 2) {
                      const val = Number(entry[compareDataAB.labelA]) || 0;
                      color = val >= 0 ? '#81C784' : '#FF8A80';
                    }
                    return <Cell key={`cell-a-${index}`} fill={color} />;
                  })}
                </Bar>
                <Bar name={`${compareDataAB.labelB} (Período Recente)`} dataKey={compareDataAB.labelB} radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {sideBySideChartData.map((entry, index) => {
                    let color = '#00C853';
                    if (index === 1) {
                      color = '#FF3D00';
                    } else if (index === 2) {
                      const val = Number(entry[compareDataAB.labelB]) || 0;
                      color = val >= 0 ? '#00C853' : '#FF3D00';
                    }
                    return <Cell key={`cell-b-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            ) : (
              <ComposedChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="shortLabel" tick={{ fontSize: 10, fill: '#121212', fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 10, fill: '#121212' }} tickFormatter={(val) => `R$ ${val}`} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === 'income'
                      ? 'Receita (Entradas)'
                      : name === 'expenses'
                      ? 'Despesa (Saídas)'
                      : 'Resultado Líquido',
                  ]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload.length > 0 && payload[0].payload) {
                      return payload[0].payload.label;
                    }
                    return label;
                  }}
                  contentStyle={{
                    backgroundColor: '#FFF',
                    borderColor: '#D4AF37',
                    borderRadius: '16px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                  }}
                />
                <Legend
                  formatter={(value) =>
                    value === 'income'
                      ? 'Receita (Entradas)'
                      : value === 'expenses'
                      ? 'Despesa (Saídas)'
                      : 'Resultado (Líquido)'
                  }
                  wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                />

                {(viewMode === 'income_vs_expense' || viewMode === 'both') && (
                  <>
                    <Bar dataKey="income" fill="#00C853" name="income" radius={[6, 6, 0, 0]} maxBarSize={36} />
                    <Bar dataKey="expenses" fill="#FF3D00" name="expenses" radius={[6, 6, 0, 0]} maxBarSize={36} />
                  </>
                )}

                {(viewMode === 'net_balance' || viewMode === 'both') && (
                  <Line
                    type="monotone"
                    dataKey="net"
                    stroke="#121212"
                    strokeWidth={3}
                    name="net"
                    dot={{ r: 4, fill: '#D4AF37' }}
                  />
                )}
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Dedicated Section: Comparativo de Todos os Membros e de Cada Membro da Família */}
      <div className="space-y-4 pt-6 border-t-2 border-gray-100" id="family-members-comparison-section">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-50/80 p-4 rounded-2xl border border-gray-200">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#D4AF37]" />
              <h3 className="text-sm font-extrabold text-[#121212] font-serif uppercase tracking-wider">
                Comparativo por Membro da Família ({familyComparisonBreakdown.periodTitle})
              </h3>
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              Compare as receitas, despesas e resultado líquido de cada integrante da família lado a lado
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-500">Membros Detectados:</span>
            <span className="px-2.5 py-0.5 bg-[#121212] text-[#D4AF37] text-xs font-bold rounded-full font-serif">
              {familyComparisonBreakdown.membersList.length}
            </span>
          </div>
        </div>

        {/* Member Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card Consolidado Familiar (Todos os Membros) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#121212] via-gray-900 to-black text-white border border-[#D4AF37]/50 shadow-md flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#D4AF37] text-[#121212] rounded-xl font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#D4AF37]">
                    Total da Família
                  </h4>
                  <p className="text-[10px] text-gray-300">Todos os Integrantes Reunidos</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFamilyMemberId('ALL')}
                className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer ${
                  selectedFamilyMemberId === 'ALL'
                    ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37]'
                    : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                }`}
              >
                {selectedFamilyMemberId === 'ALL' ? 'Ativo' : 'Ver Todos'}
              </button>
            </div>

            {/* Despesas (Saídas) Comparison Block matching Image 1 */}
            <div className="bg-red-950/40 border border-red-500/30 p-3 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-red-300 uppercase tracking-wider">
                  Despesas (Saídas)
                </span>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    familyComparisonBreakdown.familyDiffExpenses <= 0
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  }`}
                >
                  {familyComparisonBreakdown.familyDiffExpenses >= 0 ? '+' : ''}
                  {familyComparisonBreakdown.familyPctExpenses.toFixed(1)}%
                </span>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between items-center text-red-200">
                  <span className="text-[11px] truncate max-w-[140px]">
                    A: {familyComparisonBreakdown.labelA}
                  </span>
                  <span className="font-bold font-serif">
                    {formatCurrency(familyComparisonBreakdown.familyExpensesA)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-white font-extrabold">
                  <span className="text-[11px] truncate max-w-[140px]">
                    B: {familyComparisonBreakdown.labelB}
                  </span>
                  <span className="font-extrabold font-serif text-sm">
                    {formatCurrency(familyComparisonBreakdown.familyExpensesB)}
                  </span>
                </div>
              </div>

              <div className="pt-1 border-t border-red-500/30 text-[11px] font-bold text-red-200 flex justify-between items-center">
                <span>Variação de Despesa:</span>
                <span
                  className={`font-serif ${
                    familyComparisonBreakdown.familyDiffExpenses <= 0
                      ? 'text-emerald-400'
                      : 'text-red-400 font-extrabold'
                  }`}
                >
                  {familyComparisonBreakdown.familyDiffExpenses >= 0 ? '+' : ''}
                  {formatCurrency(familyComparisonBreakdown.familyDiffExpenses)}
                </span>
              </div>
            </div>

            {/* Summary metrics for Receita & Saldo */}
            <div className="pt-1 space-y-1 text-xs border-t border-white/10">
              <div className="flex justify-between items-center text-emerald-400">
                <span className="font-medium">Receita Total ({familyComparisonBreakdown.labelB}):</span>
                <span className="font-extrabold font-serif">
                  {formatCurrency(familyComparisonBreakdown.familyTotalIncome)}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-200">
                <span className="font-medium">Saldo Família ({familyComparisonBreakdown.labelB}):</span>
                <span
                  className={`font-serif font-extrabold ${
                    familyComparisonBreakdown.familyTotalNet >= 0
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  }`}
                >
                  {familyComparisonBreakdown.familyTotalNet >= 0 ? '+' : ''}
                  {formatCurrency(familyComparisonBreakdown.familyTotalNet)}
                </span>
              </div>
            </div>
          </div>

          {/* Cards for each individual member */}
          {familyComparisonBreakdown.membersList.map((m) => {
            const isMemberActive = selectedFamilyMemberId === m.id;
            const expenseSharePct =
              familyComparisonBreakdown.familyTotalExpenses > 0
                ? (m.expensesB / familyComparisonBreakdown.familyTotalExpenses) * 100
                : 0;

            return (
              <div
                key={m.id}
                className={`p-4 rounded-2xl border transition flex flex-col justify-between space-y-3 ${
                  isMemberActive
                    ? 'bg-amber-50/90 border-[#D4AF37] shadow-sm ring-1 ring-[#D4AF37]'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-gray-100 text-[#121212] rounded-xl font-bold border border-gray-300">
                      <User className="w-4 h-4 text-[#121212]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-[#121212]">{m.name}</h4>
                      <p className="text-[10px] text-gray-500">
                        {m.id === 'UNASSIGNED' ? 'Lançamentos sem indicação' : 'Membro Familiar'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedFamilyMemberId(m.id)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer ${
                      isMemberActive
                        ? 'bg-[#121212] text-[#D4AF37] border-[#121212]'
                        : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    {isMemberActive ? 'Filtrado' : 'Filtrar'}
                  </button>
                </div>

                {/* Despesas (Saídas) Comparison Block matching Image 1 */}
                <div className="bg-red-50/70 border border-red-200 p-3 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-red-900 uppercase tracking-wider">
                      Despesas (Saídas)
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        m.diffExpenses <= 0
                          ? 'bg-emerald-200/80 text-emerald-950'
                          : 'bg-red-200/80 text-red-950'
                      }`}
                    >
                      {m.diffExpenses >= 0 ? '+' : ''}
                      {m.pctExpenses.toFixed(1)}%
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between items-center text-red-900 font-semibold">
                      <span className="text-[11px] truncate max-w-[140px]">
                        A: {familyComparisonBreakdown.labelA}
                      </span>
                      <span className="font-bold">{formatCurrency(m.expensesA)}</span>
                    </div>
                    <div className="flex justify-between items-center text-red-950 font-extrabold">
                      <span className="text-[11px] truncate max-w-[140px]">
                        B: {familyComparisonBreakdown.labelB}
                      </span>
                      <span className="font-extrabold font-serif text-sm">
                        {formatCurrency(m.expensesB)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1 border-t border-red-200/80 text-[11px] font-bold text-red-800 flex justify-between items-center">
                    <span>Variação de Despesa:</span>
                    <span
                      className={`font-serif ${
                        m.diffExpenses <= 0 ? 'text-emerald-700' : 'text-red-700 font-extrabold'
                      }`}
                    >
                      {m.diffExpenses >= 0 ? '+' : ''}
                      {formatCurrency(m.diffExpenses)}
                    </span>
                  </div>
                </div>

                {/* Income and Net Balance metrics */}
                <div className="space-y-1 text-xs pt-1 border-t border-gray-100">
                  <div className="flex justify-between items-center text-emerald-700 font-semibold">
                    <span>Receitas (Entradas - {familyComparisonBreakdown.labelB}):</span>
                    <span className="font-serif font-bold">{formatCurrency(m.incomeB)}</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-800 font-bold">
                    <span>Saldo Líquido ({familyComparisonBreakdown.labelB}):</span>
                    <span
                      className={`font-serif text-xs ${
                        m.netB >= 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {m.netB >= 0 ? '+' : ''}
                      {formatCurrency(m.netB)}
                    </span>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between text-[10px] text-gray-500 font-semibold border-t border-dashed border-gray-200">
                  <span>Participação nos Gastos ({familyComparisonBreakdown.labelB}):</span>
                  <span className="font-bold text-[#121212] bg-gray-100 px-1.5 py-0.5 rounded-md border border-gray-200">
                    {expenseSharePct.toFixed(1)}% das despesas
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Side-by-Side Chart comparing each Family Member */}
        {familyComparisonBreakdown.chartData.length > 0 && (
          <div className="bg-gray-50/50 border border-gray-200 p-4 rounded-2xl space-y-3">
            <span className="text-xs font-extrabold text-[#121212] uppercase tracking-wider block">
              Gráfico Comparativo de Cada Membro da Família:
            </span>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={familyComparisonBreakdown.chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#121212', fontWeight: 700 }} />
                  <YAxis tick={{ fontSize: 10, fill: '#121212' }} tickFormatter={(val) => `R$ ${val}`} />
                  <Tooltip
                    formatter={(val: number) => [formatCurrency(val)]}
                    contentStyle={{
                      backgroundColor: '#FFF',
                      borderColor: '#D4AF37',
                      borderRadius: '16px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                  <Bar dataKey="Despesa (A)" fill="#EF4444" radius={[6, 6, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="Despesa (B)" fill="#991B1B" radius={[6, 6, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="Receita" fill="#00C853" radius={[6, 6, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="Saldo" fill="#D4AF37" radius={[6, 6, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Detailed Family Members Comparison Table */}
        <div className="overflow-x-auto rounded-2xl border border-gray-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#121212] text-[#D4AF37] font-serif">
                <th className="p-3">Membro da Família</th>
                <th className="p-3 text-right">Despesas A ({familyComparisonBreakdown.labelA})</th>
                <th className="p-3 text-right">Despesas B ({familyComparisonBreakdown.labelB})</th>
                <th className="p-3 text-right">Variação Despesa</th>
                <th className="p-3 text-right">Receita B</th>
                <th className="p-3 text-right">Saldo B</th>
                <th className="p-3 text-center">% Gastos (B)</th>
                <th className="p-3 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {familyComparisonBreakdown.membersList.map((m) => {
                const isSelected = selectedFamilyMemberId === m.id;
                const expenseSharePct =
                  familyComparisonBreakdown.familyTotalExpenses > 0
                    ? (m.expensesB / familyComparisonBreakdown.familyTotalExpenses) * 100
                    : 0;

                return (
                  <tr key={m.id} className={`hover:bg-amber-50/50 transition ${isSelected ? 'bg-amber-50/70 font-bold' : ''}`}>
                    <td className="p-3 font-bold text-[#121212] flex items-center gap-2">
                      <div className="p-1 bg-gray-100 rounded-lg border border-gray-300">
                        <User className="w-3.5 h-3.5 text-gray-700" />
                      </div>
                      <span>{m.name}</span>
                    </td>
                    <td className="p-3 text-right font-medium text-red-800 font-serif">
                      {formatCurrency(m.expensesA)}
                    </td>
                    <td className="p-3 text-right font-extrabold text-red-950 font-serif">
                      {formatCurrency(m.expensesB)}
                    </td>
                    <td className={`p-3 text-right font-extrabold font-serif ${m.diffExpenses <= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {m.diffExpenses >= 0 ? '+' : ''}{formatCurrency(m.diffExpenses)} ({m.pctExpenses.toFixed(1)}%)
                    </td>
                    <td className="p-3 text-right font-extrabold text-emerald-700 font-serif">
                      {formatCurrency(m.incomeB)}
                    </td>
                    <td className={`p-3 text-right font-extrabold font-serif ${m.netB >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {m.netB >= 0 ? '+' : ''}{formatCurrency(m.netB)}
                    </td>
                    <td className="p-3 text-center font-bold text-gray-700">
                      {expenseSharePct.toFixed(1)}%
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedFamilyMemberId(m.id)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-xl transition cursor-pointer border ${
                          isSelected
                            ? 'bg-[#121212] text-[#D4AF37] border-[#121212]'
                            : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                        }`}
                      >
                        {isSelected ? 'Filtrado' : 'Filtrar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* If comparing Year vs Year, show monthly evolution side-by-side */}
      {rangePreset === '1_month' && compareGranularity === 'year' && yearByYearMonthlyComparison.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-gray-200">
          <span className="text-xs font-extrabold text-[#121212] uppercase tracking-wider block">
            Evolução Mês a Mês ({yearA} vs {yearB}):
          </span>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearByYearMonthlyComparison} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#121212', fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 10, fill: '#121212' }} tickFormatter={(val) => `R$ ${val}`} />
                <Tooltip
                  formatter={(val: number) => [formatCurrency(val)]}
                  contentStyle={{
                    backgroundColor: '#FFF',
                    borderColor: '#D4AF37',
                    borderRadius: '16px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                <Bar dataKey={`Receita ${yearA}`} fill="#00C853" maxBarSize={16} />
                <Bar dataKey={`Receita ${yearB}`} fill="#00E676" maxBarSize={16} />
                <Bar dataKey={`Despesa ${yearA}`} fill="#FF3D00" maxBarSize={16} />
                <Bar dataKey={`Despesa ${yearB}`} fill="#FF6D00" maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Month-by-Month Detailed Table */}
      {rangePreset !== '1_month' && (
        <div className="space-y-2 pt-2 border-t border-gray-200">
          <span className="text-xs font-extrabold text-[#121212] uppercase tracking-wider block">
            Tabela Comparativa Mês a Mês ({monthlyData.length} Meses):
          </span>

          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#121212] text-[#D4AF37] font-serif">
                  <th className="p-3">Mês / Ano</th>
                  <th className="p-3 text-right">Receitas (Verde)</th>
                  <th className="p-3 text-right">Despesas (Vermelho)</th>
                  <th className="p-3 text-right">Resultado do Mês</th>
                  <th className="p-3 text-center">Balanço</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {monthlyData.map((m) => (
                  <tr key={m.key} className="hover:bg-gray-50 transition">
                    <td className="p-3 font-bold text-[#121212]">{m.label}</td>
                    <td className="p-3 text-right font-extrabold text-emerald-700 font-serif">
                      {formatCurrency(m.income)}
                    </td>
                    <td className="p-3 text-right font-extrabold text-red-700 font-serif">
                      {formatCurrency(m.expenses)}
                    </td>
                    <td
                      className={`p-3 text-right font-extrabold font-serif ${
                        m.isPositive ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {m.isPositive ? '+' : ''}{formatCurrency(m.net)}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                          m.isPositive
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-red-100 text-red-900 border border-red-300'
                        }`}
                      >
                        {m.isPositive ? 'Superávit' : 'Déficit ⚠️'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
