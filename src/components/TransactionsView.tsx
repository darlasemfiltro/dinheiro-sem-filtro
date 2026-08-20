import React, { useState, useMemo } from 'react';
import { Account, Category, FamilyMember, Transaction } from '../types';
import { formatCurrency, formatDateBR, getMonthYearLabel } from '../utils/finance';
import {
  Search,
  Filter,
  Plus,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  ReceiptText,
  Calendar,
  Layers,
  ArrowDownUp,
  RotateCcw,
  ChevronDown,
  Check,
  X,
  Users,
} from 'lucide-react';

const getAccountTypeLabel = (accType: string): string => {
  switch (accType) {
    case 'credit':
      return 'Cartão de Crédito';
    case 'checking':
      return 'Conta Corrente';
    case 'savings':
      return 'Poupança';
    case 'cash':
      return 'Dinheiro';
    default:
      return 'Outro';
  }
};

const ptBrToIso = (text: string): string | null => {
  const digits = text.replace(/\D/g, '');
  if (digits.length === 8) {
    const day = parseInt(digits.slice(0, 2), 10);
    const month = parseInt(digits.slice(2, 4), 10);
    const year = parseInt(digits.slice(4, 8), 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return null;
};

const isoToPtBr = (iso: string): string => {
  if (!iso || !iso.includes('-')) return '';
  const [y, m, d] = iso.split('-');
  if (y && m && d) {
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return '';
};

const formatPtBrDateInput = (val: string): string => {
  const digits = val.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

interface DateInputFieldProps {
  label: string;
  valueIso: string;
  onChangeIso: (iso: string) => void;
}

const DateInputField: React.FC<DateInputFieldProps> = ({ label, valueIso, onChangeIso }) => {
  const [textValue, setTextValue] = useState(() => isoToPtBr(valueIso));
  const datePickerRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setTextValue(isoToPtBr(valueIso));
  }, [valueIso]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatPtBrDateInput(raw);
    setTextValue(formatted);

    if (!formatted) {
      onChangeIso('');
      return;
    }

    const parsedIso = ptBrToIso(formatted);
    if (parsedIso) {
      onChangeIso(parsedIso);
    }
  };

  const handleCalendarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value;
    if (iso) {
      onChangeIso(iso);
      setTextValue(isoToPtBr(iso));
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold text-gray-600 uppercase">{label}</label>
      <div className="relative flex items-center">
        <input
          type="text"
          value={textValue}
          onChange={handleTextChange}
          placeholder="DD/MM/AAAA"
          maxLength={10}
          className="w-full pl-3 pr-8 py-2 bg-white border border-gray-300 rounded-xl text-xs text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37] font-semibold shadow-2xs"
        />
        <button
          type="button"
          onClick={() => {
            if (datePickerRef.current) {
              if (typeof datePickerRef.current.showPicker === 'function') {
                datePickerRef.current.showPicker();
              } else {
                datePickerRef.current.click();
              }
            }
          }}
          className="absolute right-2 text-gray-500 hover:text-[#D4AF37] p-1 transition cursor-pointer"
          title="Selecionar data no calendário"
        >
          <Calendar className="w-4 h-4" />
        </button>
        <input
          ref={datePickerRef}
          type="date"
          value={valueIso}
          onChange={handleCalendarPick}
          className="sr-only pointer-events-none"
          tabIndex={-1}
        />
      </div>
    </div>
  );
};

interface TransactionsViewProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  familyMembers?: FamilyMember[];
  currentYear: number;
  currentMonth: number;
  onOpenNewTransaction: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onToggleConsolidated: (id: string) => void;
  onUpdateTransaction?: (tx: Transaction) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  accounts,
  categories,
  familyMembers = [],
  currentYear,
  currentMonth,
  onOpenNewTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onToggleConsolidated,
  onUpdateTransaction,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]); // 'income', 'expense', 'transfer'
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]); // 'consolidated', 'pending'
  const [selectedFamilyMemberIds, setSelectedFamilyMemberIds] = useState<string[]>([]);
  const [periodMode, setPeriodMode] = useState<'month' | 'custom' | 'all'>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [includePreviousBalance, setIncludePreviousBalance] = useState(false);
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);

  // Modal active picker state for search + multi-select
  const [activeFilterModal, setActiveFilterModal] = useState<'period' | 'account' | 'category' | 'type' | 'status' | 'familyMember' | null>(null);
  const [modalSearch, setModalSearch] = useState('');

  const effectiveSingleAccountId = selectedAccountIds.length === 1 ? selectedAccountIds[0] : 'all';

  // Consolidate family members from props + transactions
  const allFamilyMembersList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color?: string }>();
    (familyMembers || []).forEach((fm) => {
      map.set(fm.id, { id: fm.id, name: fm.name, color: fm.color });
    });
    transactions.forEach((t) => {
      if (t.familyMemberId && !map.has(t.familyMemberId)) {
        map.set(t.familyMemberId, { id: t.familyMemberId, name: t.familyMemberName || 'Membro', color: '#D4AF37' });
      } else if (t.familyMemberName && !t.familyMemberId) {
        const existingByKey = Array.from(map.values()).find((m) => m.name === t.familyMemberName);
        if (!existingByKey) {
          map.set(`name_${t.familyMemberName}`, { id: `name_${t.familyMemberName}`, name: t.familyMemberName, color: '#D4AF37' });
        }
      }
    });
    return Array.from(map.values());
  }, [familyMembers, transactions]);

  const isTransactionMatchingFamilyMember = (t: Transaction): boolean => {
    if (selectedFamilyMemberIds.length === 0) return true;
    return selectedFamilyMemberIds.some((memberId) => {
      if (memberId === 'unassigned') {
        return !t.familyMemberId && !t.familyMemberName;
      }
      const memberObj = allFamilyMembersList.find((m) => m.id === memberId);
      if (t.familyMemberId && t.familyMemberId === memberId) return true;
      if (memberObj && t.familyMemberName && t.familyMemberName === memberObj.name) return true;
      if (t.familyMemberId === memberId) return true;
      return false;
    });
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    selectedAccountIds.length > 0 ||
    selectedCategoryIds.length > 0 ||
    selectedTypes.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedFamilyMemberIds.length > 0 ||
    periodMode !== 'month' ||
    startDate !== '' ||
    endDate !== '';

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedAccountIds([]);
    setSelectedCategoryIds([]);
    setSelectedTypes([]);
    setSelectedStatuses([]);
    setSelectedFamilyMemberIds([]);
    setPeriodMode('month');
    setStartDate('');
    setEndDate('');
    setIncludePreviousBalance(false);
  };

  // Calculate Previous Balance (Saldo Anterior) strictly before current period filter start
  const calculatePreviousBalance = (): number => {
    let periodStartDate: string | null = null;

    if (periodMode === 'month') {
      periodStartDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    } else if (periodMode === 'custom' && startDate) {
      periodStartDate = startDate;
    } else {
      periodStartDate = null;
    }

    let initialSum = 0;
    const targetAccounts =
      selectedAccountIds.length === 0
        ? accounts
        : accounts.filter((a) => selectedAccountIds.includes(a.id));

    for (const acc of targetAccounts) {
      initialSum += acc.initialBalance || 0;
    }

    if (!periodStartDate) {
      return initialSum;
    }

    let priorTransactionsNet = 0;

    for (const t of transactions) {
      if (t.date < periodStartDate) {
        if (!isTransactionMatchingFamilyMember(t)) continue;

        if (selectedStatuses.length > 0) {
          const isConsolidatedMatch = selectedStatuses.includes('consolidated') && t.isConsolidated;
          const isPendingMatch = selectedStatuses.includes('pending') && !t.isConsolidated;
          if (!isConsolidatedMatch && !isPendingMatch) continue;
        }

        if (selectedAccountIds.length === 0) {
          if (t.type === 'income') {
            priorTransactionsNet += t.amount;
          } else if (t.type === 'expense') {
            priorTransactionsNet -= t.amount;
          }
        } else {
          if (selectedAccountIds.includes(t.accountId)) {
            if (t.type === 'income') {
              priorTransactionsNet += t.amount;
            } else if (t.type === 'expense' || t.type === 'transfer') {
              priorTransactionsNet -= t.amount;
            }
          }
          if (t.type === 'transfer' && t.targetAccountId && selectedAccountIds.includes(t.targetAccountId)) {
            priorTransactionsNet += t.amount;
          }
        }
      }
    }

    return initialSum + priorTransactionsNet;
  };

  const previousBalance = calculatePreviousBalance();

  // Apply search, date period and filter criteria across all transactions
  const filteredTransactions = transactions.filter((t) => {
    // Period / Date filter
    if (periodMode === 'month') {
      const [y, m] = t.date.split('-').map(Number);
      if (y !== currentYear || m !== currentMonth) return false;
    } else if (periodMode === 'custom') {
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;
    }

    // Search term
    if (searchTerm && !t.description.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    // Account
    if (selectedAccountIds.length > 0) {
      const matchesAccount = selectedAccountIds.includes(t.accountId);
      const matchesTarget = t.targetAccountId ? selectedAccountIds.includes(t.targetAccountId) : false;
      if (!matchesAccount && !matchesTarget) return false;
    }
    // Category
    if (selectedCategoryIds.length > 0 && !selectedCategoryIds.includes(t.categoryId)) {
      return false;
    }
    // Type
    if (selectedTypes.length > 0 && !selectedTypes.includes(t.type)) {
      return false;
    }
    // Status
    if (selectedStatuses.length > 0) {
      const isConsolidatedMatch = selectedStatuses.includes('consolidated') && t.isConsolidated;
      const isPendingMatch = selectedStatuses.includes('pending') && !t.isConsolidated;
      if (!isConsolidatedMatch && !isPendingMatch) return false;
    }
    // Family Member
    if (!isTransactionMatchingFamilyMember(t)) {
      return false;
    }

    return true;
  });

  // Totals for filtered transactions
  const totalIncome = filteredTransactions
    .filter((t) => {
      if (t.type === 'income') return true;
      if (selectedAccountIds.length > 0 && t.type === 'transfer' && t.targetAccountId && selectedAccountIds.includes(t.targetAccountId)) {
        return true;
      }
      return false;
    })
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = filteredTransactions
    .filter((t) => {
      if (t.type === 'expense') return true;
      if (selectedAccountIds.length > 0 && t.type === 'transfer' && selectedAccountIds.includes(t.accountId)) {
        return true;
      }
      return false;
    })
    .reduce((acc, t) => acc + t.amount, 0);

  const netBalance = totalIncome - totalExpense;
  const finalResult = includePreviousBalance ? previousBalance + netBalance : netBalance;

  return (
    <div className="space-y-6 pb-12" id="transactions-view">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-gray-200 rounded-3xl p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-[#D4AF37]" />
            <h1 className="text-lg font-bold text-[#121212] font-serif">
              Extrato de Lançamentos -{' '}
              {periodMode === 'month'
                ? getMonthYearLabel(currentYear, currentMonth)
                : periodMode === 'custom'
                ? `Período Personalizado ${
                    startDate || endDate
                      ? `(${startDate ? formatDateBR(startDate) : 'Início'} até ${
                          endDate ? formatDateBR(endDate) : 'Hoje'
                        })`
                      : ''
                  }`
                : 'Todo o Histórico'}
            </h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Gerencie entradas, saídas, parcelamentos e conciliação bancária
          </p>
        </div>

        <button
          onClick={onOpenNewTransaction}
          className="min-h-[42px] sm:min-h-[44px] py-2.5 px-4 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer border border-[#00A843] shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3] shrink-0" />
          <span>Novo Lançamento</span>
        </button>
      </div>

      {/* Summary Chips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Saldo Anterior */}
        <div className="bg-sky-50/90 border border-sky-200 p-4 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold text-sky-900 uppercase">Saldo Anterior</span>
              <span className="text-[9px] font-bold text-sky-800 bg-sky-100 px-1.5 py-0.5 rounded">
                {periodMode === 'month'
                  ? `Até 01/${String(currentMonth).padStart(2, '0')}/${currentYear}`
                  : periodMode === 'custom' && startDate
                  ? `Até ${formatDateBR(startDate)}`
                  : 'Acumulado'}
              </span>
            </div>
            <p
              className={`text-base font-extrabold font-serif mt-1 ${
                previousBalance >= 0 ? 'text-sky-900' : 'text-[#FF3D00]'
              }`}
            >
              {formatCurrency(previousBalance)}
            </p>
          </div>
        </div>

        {/* Entradas do Período */}
        <div className="bg-[#00C853]/10 border border-[#00C853]/30 p-4 rounded-2xl flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#121212] uppercase">Entradas do Período</span>
            <p className="text-base font-extrabold text-[#00C853] font-serif mt-1">{formatCurrency(totalIncome)}</p>
          </div>
        </div>

        {/* Saídas do Período */}
        <div className="bg-[#FF3D00]/10 border border-[#FF3D00]/30 p-4 rounded-2xl flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#121212] uppercase">Saídas do Período</span>
            <p className="text-base font-extrabold text-[#FF3D00] font-serif mt-1">{formatCurrency(totalExpense)}</p>
          </div>
        </div>

        {/* Resultado do Período (Com / Sem Saldo Anterior) */}
        <div
          className={`p-4 rounded-2xl flex flex-col justify-between border transition-colors ${
            finalResult >= 0
              ? 'bg-[#00C853]/10 border-[#00C853]/40 text-[#121212] shadow-xs'
              : 'bg-[#FF3D00]/10 border-[#FF3D00]/40 text-[#121212] shadow-xs'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-1">
              <span
                className={`text-[11px] font-extrabold uppercase ${
                  finalResult >= 0 ? 'text-[#00C853]' : 'text-[#FF3D00]'
                }`}
              >
                Resultado do Período
              </span>
            </div>
            <p
              className={`text-base font-extrabold font-serif mt-0.5 ${
                finalResult >= 0 ? 'text-[#00C853]' : 'text-[#FF3D00]'
              }`}
            >
              {formatCurrency(finalResult)}
            </p>
          </div>

          <div className="mt-2 pt-1.5 border-t border-black/10 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIncludePreviousBalance(false)}
              className={`flex-1 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer text-center ${
                !includePreviousBalance
                  ? 'bg-[#121212] text-white shadow-2xs'
                  : 'bg-white/80 text-gray-700 hover:bg-white border border-gray-200'
              }`}
            >
              Sem Saldo Anterior
            </button>
            <button
              type="button"
              onClick={() => setIncludePreviousBalance(true)}
              className={`flex-1 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer text-center ${
                includePreviousBalance
                  ? 'bg-[#121212] text-white shadow-2xs'
                  : 'bg-white/80 text-gray-700 hover:bg-white border border-gray-200'
              }`}
            >
              Com Saldo Anterior
            </button>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#D4AF37]" />
            <h2 className="text-xs font-bold text-[#121212] uppercase tracking-wider">Filtros de Busca</h2>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-[#121212] border border-gray-300 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              title="Limpar todos os filtros da busca"
            >
              <RotateCcw className="w-3 h-3 text-[#121212]" />
              <span>Limpar Filtro</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="w-4 h-4 text-[#D4AF37] absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar histórico..."
              className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border-2 border-gray-300 focus:border-[#D4AF37] rounded-xl text-xs sm:text-sm text-[#121212] font-semibold focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            />
          </div>

          {/* Period Mode Selector */}
          <div>
            <button
              type="button"
              onClick={() => {
                setActiveFilterModal('period');
                setModalSearch('');
              }}
              className={`w-full px-3.5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm flex items-center justify-between transition cursor-pointer font-black border-2 shadow-xs ${
                periodMode !== 'month' || startDate || endDate
                  ? 'bg-[#121212] text-[#D4AF37] border-[#D4AF37] shadow-md'
                  : 'bg-white hover:bg-amber-50/60 text-[#121212] border-gray-300 hover:border-[#D4AF37]'
              }`}
            >
              <span className="truncate">
                {periodMode === 'month' && `Mês: ${getMonthYearLabel(currentYear, currentMonth)}`}
                {periodMode === 'custom' && 'Período Personalizado 🗓️'}
                {periodMode === 'all' && 'Todo o Histórico'}
              </span>
              <ChevronDown className={`w-4 h-4 shrink-0 ml-1 ${periodMode !== 'month' || startDate || endDate ? 'text-[#D4AF37]' : 'text-gray-500'}`} />
            </button>
          </div>

          {/* Account Filter */}
          <div>
            <button
              type="button"
              onClick={() => {
                setActiveFilterModal('account');
                setModalSearch('');
              }}
              className={`w-full px-3.5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm flex items-center justify-between transition cursor-pointer font-black border-2 shadow-xs ${
                selectedAccountIds.length > 0
                  ? 'bg-[#121212] text-[#D4AF37] border-[#D4AF37] shadow-md'
                  : 'bg-white hover:bg-amber-50/60 text-[#121212] border-gray-300 hover:border-[#D4AF37]'
              }`}
            >
              <span className="truncate">
                {selectedAccountIds.length === 0
                  ? 'Todas as Contas'
                  : selectedAccountIds.length === 1
                  ? accounts.find((a) => a.id === selectedAccountIds[0])?.name || '1 Conta'
                  : `${selectedAccountIds.length} Contas Selecionadas`}
              </span>
              <ChevronDown className={`w-4 h-4 shrink-0 ml-1 ${selectedAccountIds.length > 0 ? 'text-[#D4AF37]' : 'text-gray-500'}`} />
            </button>
          </div>

          {/* Category Filter */}
          <div>
            <button
              type="button"
              onClick={() => {
                setActiveFilterModal('category');
                setModalSearch('');
              }}
              className={`w-full px-3.5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm flex items-center justify-between transition cursor-pointer font-black border-2 shadow-xs ${
                selectedCategoryIds.length > 0
                  ? 'bg-[#121212] text-[#D4AF37] border-[#D4AF37] shadow-md'
                  : 'bg-white hover:bg-amber-50/60 text-[#121212] border-gray-300 hover:border-[#D4AF37]'
              }`}
            >
              <span className="truncate">
                {selectedCategoryIds.length === 0
                  ? 'Todas as Categorias'
                  : selectedCategoryIds.length === 1
                  ? categories.find((c) => c.id === selectedCategoryIds[0])?.name || '1 Categoria'
                  : `${selectedCategoryIds.length} Categorias Selecionadas`}
              </span>
              <ChevronDown className={`w-4 h-4 shrink-0 ml-1 ${selectedCategoryIds.length > 0 ? 'text-[#D4AF37]' : 'text-gray-500'}`} />
            </button>
          </div>

          {/* Type Filter */}
          <div>
            <button
              type="button"
              onClick={() => {
                setActiveFilterModal('type');
                setModalSearch('');
              }}
              className={`w-full px-3.5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm flex items-center justify-between transition cursor-pointer font-black border-2 shadow-xs ${
                selectedTypes.length > 0
                  ? 'bg-[#121212] text-[#D4AF37] border-[#D4AF37] shadow-md'
                  : 'bg-white hover:bg-amber-50/60 text-[#121212] border-gray-300 hover:border-[#D4AF37]'
              }`}
            >
              <span className="truncate">
                {selectedTypes.length === 0
                  ? 'Todos os Tipos'
                  : selectedTypes.length === 1
                  ? selectedTypes[0] === 'income'
                    ? 'Apenas Receitas (+)'
                    : selectedTypes[0] === 'expense'
                    ? 'Apenas Despesas (-)'
                    : 'Transferências (↔)'
                  : `${selectedTypes.length} Tipos Selecionados`}
              </span>
              <ChevronDown className={`w-4 h-4 shrink-0 ml-1 ${selectedTypes.length > 0 ? 'text-[#D4AF37]' : 'text-gray-500'}`} />
            </button>
          </div>

          {/* Consolidation Filter */}
          <div>
            <button
              type="button"
              onClick={() => {
                setActiveFilterModal('status');
                setModalSearch('');
              }}
              className={`w-full px-3.5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm flex items-center justify-between transition cursor-pointer font-black border-2 shadow-xs ${
                selectedStatuses.length > 0
                  ? 'bg-[#121212] text-[#D4AF37] border-[#D4AF37] shadow-md'
                  : 'bg-white hover:bg-amber-50/60 text-[#121212] border-gray-300 hover:border-[#D4AF37]'
              }`}
            >
              <span className="truncate">
                {selectedStatuses.length === 0
                  ? 'Todos os Status'
                  : selectedStatuses.length === 1
                  ? selectedStatuses[0] === 'consolidated'
                    ? 'Efetivados / Conciliados'
                    : 'Pendentes / Previstos'
                  : `${selectedStatuses.length} Status Selecionados`}
              </span>
              <ChevronDown className={`w-4 h-4 shrink-0 ml-1 ${selectedStatuses.length > 0 ? 'text-[#D4AF37]' : 'text-gray-500'}`} />
            </button>
          </div>

          {/* Family Member Filter */}
          <div>
            <button
              type="button"
              onClick={() => {
                setActiveFilterModal('familyMember');
                setModalSearch('');
              }}
              className={`w-full px-3.5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm flex items-center justify-between transition cursor-pointer font-black border-2 shadow-xs ${
                selectedFamilyMemberIds.length > 0
                  ? 'bg-[#121212] text-[#D4AF37] border-[#D4AF37] shadow-md'
                  : 'bg-white hover:bg-amber-50/60 text-[#121212] border-gray-300 hover:border-[#D4AF37]'
              }`}
            >
              <span className="truncate">
                {selectedFamilyMemberIds.length === 0
                  ? 'Todos os Membros'
                  : selectedFamilyMemberIds.length === 1
                  ? selectedFamilyMemberIds[0] === 'unassigned'
                    ? 'Sem Membro Atribuído'
                    : allFamilyMembersList.find((m) => m.id === selectedFamilyMemberIds[0])?.name || '1 Membro'
                  : `${selectedFamilyMemberIds.length} Membros Selecionados`}
              </span>
              <ChevronDown className={`w-4 h-4 shrink-0 ml-1 ${selectedFamilyMemberIds.length > 0 ? 'text-[#D4AF37]' : 'text-gray-500'}`} />
            </button>
          </div>
        </div>

        {/* Custom Date Range Panel */}
        {periodMode === 'custom' && (
          <div className="pt-3 border-t border-gray-200 flex flex-wrap items-end gap-3 bg-gray-50/80 p-3.5 rounded-2xl border border-gray-200 animate-in fade-in duration-200">
            <div className="flex-1 min-w-[140px]">
              <DateInputField
                label="Data Inicial (De)"
                valueIso={startDate}
                onChangeIso={(iso) => setStartDate(iso)}
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <DateInputField
                label="Data Final (Até)"
                valueIso={endDate}
                onChangeIso={(iso) => setEndDate(iso)}
              />
            </div>
            <div className="flex items-center gap-1.5 pb-0.5 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  const firstDay = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
                  const lastDayNum = new Date(currentYear, currentMonth, 0).getDate();
                  const lastDay = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;
                  setStartDate(firstDay);
                  setEndDate(lastDay);
                }}
                className="px-2.5 py-2 bg-white border border-gray-300 hover:border-[#D4AF37] rounded-xl text-[11px] font-bold text-[#121212] transition cursor-pointer shadow-2xs"
              >
                Este Mês
              </button>
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  const past = new Date();
                  past.setDate(today.getDate() - 30);
                  setStartDate(past.toISOString().split('T')[0]);
                  setEndDate(today.toISOString().split('T')[0]);
                }}
                className="px-2.5 py-2 bg-white border border-gray-300 hover:border-[#D4AF37] rounded-xl text-[11px] font-bold text-[#121212] transition cursor-pointer shadow-2xs"
              >
                Últimos 30 Dias
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartDate(`${currentYear}-01-01`);
                  setEndDate(`${currentYear}-12-31`);
                }}
                className="px-2.5 py-2 bg-white border border-gray-300 hover:border-[#D4AF37] rounded-xl text-[11px] font-bold text-[#121212] transition cursor-pointer shadow-2xs"
              >
                Este Ano
              </button>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="px-2.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-[11px] font-bold transition cursor-pointer"
                >
                  Limpar Datas
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Transactions List / Table */}
      <div className="bg-white border border-gray-200 rounded-3xl shadow-xs overflow-hidden">
        {/* Desktop / Tablet Table View (Only 5 columns: Ações/Status, Data, Histórico/Descrição, Conta, Valor (R$)) */}
        <div className="hidden md:block overflow-x-auto">
          <table translate="no" className="w-full text-left text-xs">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200 text-[#121212] font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3 w-44">Ações / Status</th>
                <th className="py-3 px-3 w-32">Data</th>
                <th className="py-3 px-3">Histórico / Descrição</th>
                <th className="py-3 px-3 w-36">Conta</th>
                <th className="py-3 px-3 text-right w-32">Valor (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTransactions.map((tx) => {
                const isIncome = tx.type === 'income';
                const isTransfer = tx.type === 'transfer';
                const accOrigin = accounts.find((a) => a.id === tx.accountId);
                const accTarget = isTransfer ? accounts.find((a) => a.id === tx.targetAccountId) : undefined;

                return (
                  <tr key={tx.id} className="hover:bg-gray-50 transition">
                    {/* Ações / Status */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onEditTransaction(tx)}
                          className="p-1.5 text-[#121212] bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg transition cursor-pointer"
                          title="Editar Lançamento"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingTxId(tx.id)}
                          className="p-1.5 text-[#FF3D00] bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition cursor-pointer"
                          title="Excluir Lançamento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onToggleConsolidated(tx.id)}
                          className={`px-2 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                            tx.isConsolidated
                              ? 'bg-[#00C853]/20 text-[#121212] border border-[#00C853]'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                          title="Clique para alterar status"
                        >
                          {tx.isConsolidated ? (
                            <CheckCircle2 className="w-3 h-3 text-[#00C853] shrink-0" />
                          ) : (
                            <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                          )}
                          <span>{tx.isConsolidated ? 'Efetivado' : 'Previsto'}</span>
                        </button>
                      </div>
                    </td>

                    {/* Data */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <input
                        type="date"
                        value={tx.date}
                        onChange={(e) => {
                          if (e.target.value && onUpdateTransaction) {
                            onUpdateTransaction({ ...tx, date: e.target.value });
                          }
                        }}
                        title="Clique para alterar a data"
                        className="bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold text-[#121212] focus:outline-none focus:ring-1 focus:ring-[#D4AF37] cursor-pointer transition"
                      />
                    </td>

                    {/* Histórico / Descrição */}
                    <td className="py-3 px-3 text-[#121212] font-bold">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{tx.description}</span>
                        {tx.installmentTotal && (
                          <span className="text-[10px] bg-gray-100 text-[#121212] border border-gray-300 px-2 py-0.5 rounded-md font-bold shrink-0">
                            {tx.installmentIndex}/{tx.installmentTotal}x
                          </span>
                        )}
                        {(tx.familyMemberName || tx.familyMemberId) && (
                          <span className="text-[10px] bg-amber-50 text-[#121212] border border-[#D4AF37]/50 px-2 py-0.5 rounded-md font-bold shrink-0 flex items-center gap-1">
                            <Users className="w-2.5 h-2.5 text-[#D4AF37]" />
                            {tx.familyMemberName || allFamilyMembersList.find((m) => m.id === tx.familyMemberId)?.name || 'Membro'}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Conta */}
                    <td className="py-3 px-3 text-gray-600 font-medium whitespace-nowrap">
                      {isTransfer ? (
                        effectiveSingleAccountId === tx.accountId ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-[#121212]">{accOrigin?.name || 'Origem'}</span>
                            <span className="text-[10px] text-[#FF3D00] font-bold">→ {accTarget?.name || 'Destino'}</span>
                          </div>
                        ) : effectiveSingleAccountId === tx.targetAccountId ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-[#121212]">{accTarget?.name || 'Destino'}</span>
                            <span className="text-[10px] text-[#00C853] font-bold">← {accOrigin?.name || 'Origem'}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <div className="font-bold text-[#121212] flex items-center gap-1">
                              <span>{accOrigin?.name || 'Origem'}</span>
                              <span className="text-gray-400">→</span>
                              <span>{accTarget?.name || 'Destino'}</span>
                            </div>
                          </div>
                        )
                      ) : (
                        accOrigin?.name || 'Conta'
                      )}
                    </td>

                    {/* Valor (R$) */}
                    <td className="py-3 px-3 text-right font-extrabold font-serif whitespace-nowrap">
                      {isTransfer ? (
                        effectiveSingleAccountId === tx.accountId ? (
                          <span className="text-[#FF3D00]">- {formatCurrency(tx.amount)}</span>
                        ) : effectiveSingleAccountId === tx.targetAccountId ? (
                          <span className="text-[#00C853]">+ {formatCurrency(tx.amount)}</span>
                        ) : (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[#FF3D00] text-xs">
                              - {formatCurrency(tx.amount)}{' '}
                              <span className="text-[9px] font-sans font-bold text-red-600 bg-red-50 px-1 py-0.2 rounded border border-red-200">
                                {accOrigin?.name || 'Origem'}
                              </span>
                            </span>
                            <span className="text-[#00C853] text-xs">
                              + {formatCurrency(tx.amount)}{' '}
                              <span className="text-[9px] font-sans font-bold text-green-700 bg-green-50 px-1 py-0.2 rounded border border-green-200">
                                {accTarget?.name || 'Destino'}
                              </span>
                            </span>
                          </div>
                        )
                      ) : (
                        <span className={isIncome ? 'text-[#00C853]' : 'text-[#FF3D00]'}>
                          {isIncome ? '+' : '-'} {formatCurrency(tx.amount)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500 text-xs">
                    Nenhum lançamento encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Compact Card View (100% visible, NO horizontal scrollbar) */}
        <div className="md:hidden divide-y divide-gray-200">
          {filteredTransactions.map((tx) => {
            const isIncome = tx.type === 'income';
            const isTransfer = tx.type === 'transfer';
            const accOrigin = accounts.find((a) => a.id === tx.accountId);
            const accTarget = isTransfer ? accounts.find((a) => a.id === tx.targetAccountId) : undefined;

            return (
              <div key={tx.id} className="p-3.5 space-y-2 hover:bg-gray-50 transition">
                {/* Top Row: Description & Amount */}
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-xs text-[#121212] flex items-center gap-1.5 flex-wrap">
                    <span>{tx.description}</span>
                    {tx.installmentTotal && (
                      <span className="text-[9px] bg-gray-100 text-[#121212] border border-gray-300 px-1.5 py-0.5 rounded-md font-bold">
                        {tx.installmentIndex}/{tx.installmentTotal}x
                      </span>
                    )}
                    {(tx.familyMemberName || tx.familyMemberId) && (
                      <span className="text-[9px] bg-amber-50 text-[#121212] border border-[#D4AF37]/50 px-1.5 py-0.5 rounded-md font-bold shrink-0 flex items-center gap-1">
                        <Users className="w-2.5 h-2.5 text-[#D4AF37]" />
                        {tx.familyMemberName || allFamilyMembersList.find((m) => m.id === tx.familyMemberId)?.name || 'Membro'}
                      </span>
                    )}
                  </div>
                  {isTransfer ? (
                    effectiveSingleAccountId === tx.accountId ? (
                      <div className="font-extrabold font-serif text-xs text-[#FF3D00] whitespace-nowrap">
                        - {formatCurrency(tx.amount)}
                      </div>
                    ) : effectiveSingleAccountId === tx.targetAccountId ? (
                      <div className="font-extrabold font-serif text-xs text-[#00C853] whitespace-nowrap">
                        + {formatCurrency(tx.amount)}
                      </div>
                    ) : (
                      <div className="flex flex-col items-end text-right">
                        <span className="font-extrabold font-serif text-xs text-[#FF3D00] whitespace-nowrap">
                          - {formatCurrency(tx.amount)}{' '}
                          <span className="text-[9px] font-sans font-bold text-red-600">({accOrigin?.name || 'Origem'})</span>
                        </span>
                        <span className="font-extrabold font-serif text-xs text-[#00C853] whitespace-nowrap">
                          + {formatCurrency(tx.amount)}{' '}
                          <span className="text-[9px] font-sans font-bold text-green-700">({accTarget?.name || 'Destino'})</span>
                        </span>
                      </div>
                    )
                  ) : (
                    <div
                      className={`font-extrabold font-serif text-xs whitespace-nowrap ${
                        isIncome ? 'text-[#00C853]' : 'text-[#FF3D00]'
                      }`}
                    >
                      {isIncome ? '+' : '-'} {formatCurrency(tx.amount)}
                    </div>
                  )}
                </div>

                {/* Second Row: Date, Account, Status & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1">
                  <div className="flex items-center gap-2">
                    {/* Date */}
                    <input
                      type="date"
                      value={tx.date}
                      onChange={(e) => {
                        if (e.target.value && onUpdateTransaction) {
                          onUpdateTransaction({ ...tx, date: e.target.value });
                        }
                      }}
                      className="bg-gray-50 border border-gray-300 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-[#121212]"
                    />
                    {/* Conta */}
                    {isTransfer ? (
                      effectiveSingleAccountId === tx.accountId ? (
                        <span className="text-red-700 font-semibold bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                          {accOrigin?.name || 'Origem'} → {accTarget?.name || 'Destino'}
                        </span>
                      ) : effectiveSingleAccountId === tx.targetAccountId ? (
                        <span className="text-green-700 font-semibold bg-green-50 px-2 py-0.5 rounded-md border border-green-200">
                          {accTarget?.name || 'Destino'} ← {accOrigin?.name || 'Origem'}
                        </span>
                      ) : (
                        <span className="text-gray-700 font-semibold bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200">
                          {accOrigin?.name || 'Origem'} → {accTarget?.name || 'Destino'}
                        </span>
                      )
                    ) : (
                      <span className="text-gray-600 font-semibold bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200">
                        {accOrigin?.name || 'Conta'}
                      </span>
                    )}
                  </div>

                  {/* Actions & Status */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onToggleConsolidated(tx.id)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition ${
                        tx.isConsolidated
                          ? 'bg-[#00C853]/20 text-[#121212] border border-[#00C853]'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      {tx.isConsolidated ? (
                        <CheckCircle2 className="w-3 h-3 text-[#00C853] shrink-0" />
                      ) : (
                        <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                      )}
                      <span>{tx.isConsolidated ? 'Efetivado' : 'Previsto'}</span>
                    </button>

                    <button
                      onClick={() => onEditTransaction(tx)}
                      className="p-1 text-[#121212] bg-gray-100 border border-gray-300 rounded-md"
                      title="Editar"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setDeletingTxId(tx.id)}
                      className="p-1 text-[#FF3D00] bg-red-50 border border-red-200 rounded-md"
                      title="Excluir"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredTransactions.length === 0 && (
            <div className="py-8 text-center text-gray-500 text-xs">
              Nenhum lançamento encontrado para os filtros selecionados.
            </div>
          )}
        </div>
      </div>

      {/* Filter Selection Modal with Search and Multi-Select */}
      {activeFilterModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveFilterModal(null);
          }}
        >
          <div className="bg-white text-[#121212] border-2 border-[#D4AF37] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-4 bg-gray-900 text-white flex items-center justify-between border-b border-gray-800 shrink-0">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#D4AF37]" />
                <h3 className="text-sm font-bold">
                  {activeFilterModal === 'period' && 'Filtrar por Período'}
                  {activeFilterModal === 'account' && 'Filtrar por Contas'}
                  {activeFilterModal === 'category' && 'Filtrar por Categorias'}
                  {activeFilterModal === 'type' && 'Filtrar por Tipo'}
                  {activeFilterModal === 'status' && 'Filtrar por Status'}
                  {activeFilterModal === 'familyMember' && 'Filtrar por Membros da Família'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveFilterModal(null)}
                className="p-1 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input & Action bar */}
            <div className="p-3 bg-gray-50 border-b border-gray-200 flex flex-col gap-2 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-300 rounded-xl text-xs text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  autoFocus
                />
                {modalSearch && (
                  <button
                    type="button"
                    onClick={() => setModalSearch('')}
                    className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] px-1 font-semibold">
                <span className="text-gray-500">
                  {activeFilterModal === 'period' && (
                    periodMode === 'month'
                      ? `Mês Atual (${getMonthYearLabel(currentYear, currentMonth)})`
                      : periodMode === 'custom'
                      ? 'Período Personalizado'
                      : 'Todo o Histórico'
                  )}
                  {activeFilterModal === 'account' && `${selectedAccountIds.length} de ${accounts.length} selecionada(s)`}
                  {activeFilterModal === 'category' && `${selectedCategoryIds.length} de ${categories.length} selecionada(s)`}
                  {activeFilterModal === 'type' && `${selectedTypes.length} de 3 selecionado(s)`}
                  {activeFilterModal === 'status' && `${selectedStatuses.length} de 2 selecionado(s)`}
                  {activeFilterModal === 'familyMember' && `${selectedFamilyMemberIds.length} de ${allFamilyMembersList.length + 1} selecionado(s)`}
                </span>

                {activeFilterModal !== 'period' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (activeFilterModal === 'account') setSelectedAccountIds(accounts.map((a) => a.id));
                        if (activeFilterModal === 'category') setSelectedCategoryIds(categories.map((c) => c.id));
                        if (activeFilterModal === 'type') setSelectedTypes(['income', 'expense', 'transfer']);
                        if (activeFilterModal === 'status') setSelectedStatuses(['consolidated', 'pending']);
                        if (activeFilterModal === 'familyMember') setSelectedFamilyMemberIds([...allFamilyMembersList.map((m) => m.id), 'unassigned']);
                      }}
                      className="text-[#121212] hover:text-[#D4AF37] cursor-pointer"
                    >
                      Marcar Todas
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (activeFilterModal === 'account') setSelectedAccountIds([]);
                        if (activeFilterModal === 'category') setSelectedCategoryIds([]);
                        if (activeFilterModal === 'type') setSelectedTypes([]);
                        if (activeFilterModal === 'status') setSelectedStatuses([]);
                        if (activeFilterModal === 'familyMember') setSelectedFamilyMemberIds([]);
                      }}
                      className="text-red-600 hover:text-red-700 cursor-pointer"
                    >
                      Limpar
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* List options */}
            <div className="p-3 overflow-y-auto space-y-1 divide-y divide-gray-100 flex-1">
              {/* PERIOD OPTIONS */}
              {activeFilterModal === 'period' &&
                [
                  {
                    id: 'month' as const,
                    label: `Mês: ${getMonthYearLabel(currentYear, currentMonth)}`,
                    sub: 'Exibe lançamentos do mês selecionado',
                  },
                  {
                    id: 'custom' as const,
                    label: 'Período Personalizado 🗓️',
                    sub: 'Filtrar por intervalo de datas inicial e final',
                  },
                  {
                    id: 'all' as const,
                    label: 'Todo o Histórico',
                    sub: 'Exibir todos os lançamentos sem restrição de data',
                  },
                ]
                  .filter(
                    (opt) =>
                      opt.label.toLowerCase().includes(modalSearch.toLowerCase()) ||
                      opt.sub.toLowerCase().includes(modalSearch.toLowerCase())
                  )
                  .map((opt) => {
                    const isSelected = periodMode === opt.id;
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition border-2 ${
                          isSelected
                            ? 'bg-[#121212] text-[#D4AF37] border-[#D4AF37] shadow-md'
                            : 'bg-white hover:bg-amber-50/50 text-[#121212] border-gray-200'
                        }`}
                        onClick={() => {
                          setPeriodMode(opt.id);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="periodModeOption"
                            checked={isSelected}
                            onChange={() => setPeriodMode(opt.id)}
                            className="w-5 h-5 text-[#D4AF37] focus:ring-[#D4AF37] border-gray-300 cursor-pointer accent-[#D4AF37]"
                          />
                          <div>
                            <div className={`text-xs sm:text-sm font-black ${isSelected ? 'text-[#D4AF37]' : 'text-[#121212]'}`}>{opt.label}</div>
                            <div className={`text-xs font-medium ${isSelected ? 'text-amber-200/80' : 'text-gray-500'}`}>{opt.sub}</div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-5 h-5 text-[#D4AF37] stroke-[3]" />}
                      </label>
                    );
                  })}

              {/* ACCOUNT OPTIONS */}
              {activeFilterModal === 'account' &&
                accounts
                  .filter((acc) =>
                    acc.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
                    getAccountTypeLabel(acc.type).toLowerCase().includes(modalSearch.toLowerCase())
                  )
                  .map((acc) => {
                    const isSelected = selectedAccountIds.includes(acc.id);
                    return (
                      <label
                        key={acc.id}
                        className={`flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition border-2 ${
                          isSelected
                            ? 'bg-[#121212] text-[#D4AF37] border-[#D4AF37] shadow-md'
                            : 'bg-white hover:bg-amber-50/50 text-[#121212] border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedAccountIds((prev) =>
                                prev.includes(acc.id)
                                  ? prev.filter((id) => id !== acc.id)
                                  : [...prev, acc.id]
                              );
                            }}
                            className="w-5 h-5 rounded text-[#D4AF37] focus:ring-[#D4AF37] border-gray-300 cursor-pointer accent-[#D4AF37]"
                          />
                          <div>
                            <div className={`text-xs sm:text-sm font-black ${isSelected ? 'text-[#D4AF37]' : 'text-[#121212]'}`}>{acc.name}</div>
                            <div className={`text-xs font-medium ${isSelected ? 'text-amber-200/80' : 'text-gray-500'}`}>{getAccountTypeLabel(acc.type)}</div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-5 h-5 text-[#D4AF37] stroke-[3]" />}
                      </label>
                    );
                  })}

              {/* CATEGORY OPTIONS */}
              {activeFilterModal === 'category' &&
                categories
                  .filter((cat) => cat.name.toLowerCase().includes(modalSearch.toLowerCase()))
                  .map((cat) => {
                    const isSelected = selectedCategoryIds.includes(cat.id);
                    return (
                      <label
                        key={cat.id}
                        className={`flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition border-2 ${
                          isSelected
                            ? 'bg-[#121212] text-[#D4AF37] border-[#D4AF37] shadow-md'
                            : 'bg-white hover:bg-amber-50/50 text-[#121212] border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedCategoryIds((prev) =>
                                prev.includes(cat.id)
                                  ? prev.filter((id) => id !== cat.id)
                                  : [...prev, cat.id]
                              );
                            }}
                            className="w-5 h-5 rounded text-[#D4AF37] focus:ring-[#D4AF37] border-gray-300 cursor-pointer accent-[#D4AF37]"
                          />
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full shrink-0 border border-black/20"
                              style={{ backgroundColor: cat.color || '#D4AF37' }}
                            />
                            <span className={`text-xs sm:text-sm font-black ${isSelected ? 'text-[#D4AF37]' : 'text-[#121212]'}`}>{cat.name}</span>
                          </div>
                        </div>
                        {isSelected && <Check className="w-5 h-5 text-[#D4AF37] stroke-[3]" />}
                      </label>
                    );
                  })}

              {/* TYPE OPTIONS */}
              {activeFilterModal === 'type' &&
                [
                  { id: 'income', label: 'Receitas (+)', sub: 'Apenas entradas financeiras' },
                  { id: 'expense', label: 'Despesas (-)', sub: 'Apenas saídas financeiras' },
                  { id: 'transfer', label: 'Transferências (↔)', sub: 'Entre contas próprias' },
                ]
                  .filter(
                    (opt) =>
                      opt.label.toLowerCase().includes(modalSearch.toLowerCase()) ||
                      opt.sub.toLowerCase().includes(modalSearch.toLowerCase())
                  )
                  .map((opt) => {
                    const isSelected = selectedTypes.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition border-2 ${
                          isSelected
                            ? 'bg-[#121212] text-[#D4AF37] border-[#D4AF37] shadow-md'
                            : 'bg-white hover:bg-amber-50/50 text-[#121212] border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedTypes((prev) =>
                                prev.includes(opt.id)
                                  ? prev.filter((id) => id !== opt.id)
                                  : [...prev, opt.id]
                              );
                            }}
                            className="w-5 h-5 rounded text-[#D4AF37] focus:ring-[#D4AF37] border-gray-300 cursor-pointer accent-[#D4AF37]"
                          />
                          <div>
                            <div className={`text-xs sm:text-sm font-black ${isSelected ? 'text-[#D4AF37]' : 'text-[#121212]'}`}>{opt.label}</div>
                            <div className={`text-xs font-medium ${isSelected ? 'text-amber-200/80' : 'text-gray-500'}`}>{opt.sub}</div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-5 h-5 text-[#D4AF37] stroke-[3]" />}
                      </label>
                    );
                  })}

              {/* STATUS OPTIONS */}
              {activeFilterModal === 'status' &&
                [
                  { id: 'consolidated', label: 'Efetivados / Conciliados', sub: 'Lançamentos já pagos ou recebidos' },
                  { id: 'pending', label: 'Pendentes / Previstos', sub: 'Lançamentos em aberto ou futuros' },
                ]
                  .filter(
                    (opt) =>
                      opt.label.toLowerCase().includes(modalSearch.toLowerCase()) ||
                      opt.sub.toLowerCase().includes(modalSearch.toLowerCase())
                  )
                  .map((opt) => {
                    const isSelected = selectedStatuses.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition border-2 ${
                          isSelected
                            ? 'bg-[#121212] text-[#D4AF37] border-[#D4AF37] shadow-md'
                            : 'bg-white hover:bg-amber-50/50 text-[#121212] border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedStatuses((prev) =>
                                prev.includes(opt.id)
                                  ? prev.filter((id) => id !== opt.id)
                                  : [...prev, opt.id]
                              );
                            }}
                            className="w-5 h-5 rounded text-[#D4AF37] focus:ring-[#D4AF37] border-gray-300 cursor-pointer accent-[#D4AF37]"
                          />
                          <div>
                            <div className={`text-xs sm:text-sm font-black ${isSelected ? 'text-[#D4AF37]' : 'text-[#121212]'}`}>{opt.label}</div>
                            <div className={`text-xs font-medium ${isSelected ? 'text-amber-200/80' : 'text-gray-500'}`}>{opt.sub}</div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-5 h-5 text-[#D4AF37] stroke-[3]" />}
                      </label>
                    );
                  })}

              {/* FAMILY MEMBER OPTIONS */}
              {activeFilterModal === 'familyMember' && (
                <>
                  {('sem membro geral sem atribuicao').includes(modalSearch.toLowerCase()) && (
                    <label
                      className={`flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition border-2 ${
                        selectedFamilyMemberIds.includes('unassigned')
                          ? 'bg-[#121212] text-[#D4AF37] border-[#D4AF37] shadow-md'
                          : 'bg-white hover:bg-amber-50/50 text-[#121212] border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedFamilyMemberIds.includes('unassigned')}
                          onChange={() => {
                            setSelectedFamilyMemberIds((prev) =>
                              prev.includes('unassigned')
                                ? prev.filter((id) => id !== 'unassigned')
                                : [...prev, 'unassigned']
                            );
                          }}
                          className="w-5 h-5 rounded text-[#D4AF37] focus:ring-[#D4AF37] border-gray-300 cursor-pointer accent-[#D4AF37]"
                        />
                        <div>
                          <div className={`text-xs sm:text-sm font-black ${selectedFamilyMemberIds.includes('unassigned') ? 'text-[#D4AF37]' : 'text-[#121212]'}`}>Sem Membro / Geral</div>
                          <div className={`text-xs font-medium ${selectedFamilyMemberIds.includes('unassigned') ? 'text-amber-200/80' : 'text-gray-500'}`}>Lançamentos sem atribuição individual</div>
                        </div>
                      </div>
                      {selectedFamilyMemberIds.includes('unassigned') && <Check className="w-5 h-5 text-[#D4AF37] stroke-[3]" />}
                    </label>
                  )}

                  {allFamilyMembersList
                    .filter((m) => m.name.toLowerCase().includes(modalSearch.toLowerCase()))
                    .map((member) => {
                      const isSelected = selectedFamilyMemberIds.includes(member.id);
                      return (
                        <label
                          key={member.id}
                          className={`flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition border-2 ${
                            isSelected
                              ? 'bg-[#121212] text-[#D4AF37] border-[#D4AF37] shadow-md'
                              : 'bg-white hover:bg-amber-50/50 text-[#121212] border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedFamilyMemberIds((prev) =>
                                  prev.includes(member.id)
                                    ? prev.filter((id) => id !== member.id)
                                    : [...prev, member.id]
                                );
                              }}
                              className="w-5 h-5 rounded text-[#D4AF37] focus:ring-[#D4AF37] border-gray-300 cursor-pointer accent-[#D4AF37]"
                            />
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-full shrink-0 border border-black/20"
                                style={{ backgroundColor: member.color || '#D4AF37' }}
                              />
                              <span className={`text-xs sm:text-sm font-black ${isSelected ? 'text-[#D4AF37]' : 'text-[#121212]'}`}>{member.name}</span>
                            </div>
                          </div>
                          {isSelected && <Check className="w-5 h-5 text-[#D4AF37] stroke-[3]" />}
                        </label>
                      );
                    })}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setActiveFilterModal(null)}
                className="py-2 px-5 bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTxId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeletingTxId(null);
          }}
        >
          <div className="bg-[#18181B] text-white border-2 border-[#D4AF37] w-full max-w-sm rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center gap-5">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white mb-1">
                Deseja realmente excluir?
              </h3>
            </div>
            <div className="flex items-center justify-center gap-3 w-full pt-1">
              <button
                type="button"
                onClick={() => setDeletingTxId(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-white/20 text-xs font-bold text-gray-300 hover:bg-white/10 transition cursor-pointer"
              >
                Não
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteTransaction(deletingTxId);
                  setDeletingTxId(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs transition cursor-pointer shadow-md"
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
