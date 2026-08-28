import React, { useState } from 'react';
import { Goal } from '../types';
import { formatCurrency, formatDateBR, calculateMonthlyContribution, parsePtBrNumber, formatNumberToPtBr } from '../utils/finance';
import { Target, Plus, Plane, ShieldCheck, Car, PiggyBank, Edit2, Trash2, Calendar, Sparkles, X, TrendingUp, Calculator, ChevronDown } from 'lucide-react';

const DEFAULT_GOAL_CATEGORIES = [
  'Viagem & Lazer',
  'Reserva de Segurança',
  'Aquisição de Bens',
  'Educação / Cursos',
  'Outros',
];

interface GoalsViewProps {
  goals: Goal[];
  onSaveGoal: (goal: Goal) => void;
  onUpdateGoalProgress: (goalId: string, addedAmount: number) => void;
  onDeleteGoal: (id: string) => void;
  userId: string;
}

function isoToBrDate(isoStr: string): string {
  if (!isoStr || !isoStr.includes('-')) return '';
  const parts = isoStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  return isoStr;
}

function brDateToIso(brStr: string): string | null {
  const clean = brStr.replace(/\D/g, '');
  if (clean.length === 8) {
    const day = clean.slice(0, 2);
    const month = clean.slice(2, 4);
    const year = clean.slice(4, 8);
    const dNum = parseInt(day, 10);
    const mNum = parseInt(month, 10);
    const yNum = parseInt(year, 10);
    if (dNum >= 1 && dNum <= 31 && mNum >= 1 && mNum <= 12 && yNum >= 1990 && yNum <= 2100) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  return null;
}

function formatBrDateMask(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export const GoalsView: React.FC<GoalsViewProps> = ({
  goals,
  onSaveGoal,
  onUpdateGoalProgress,
  onDeleteGoal,
  userId,
}) => {
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [dateText, setDateText] = useState('');
  const [category, setCategory] = useState('Viagem & Lazer');
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('custom_goal_categories');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const allCategories = Array.from(new Set([...DEFAULT_GOAL_CATEGORIES, ...customCategories]));

  const handleAddCustomCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    if (!allCategories.includes(trimmed)) {
      const updated = [...customCategories, trimmed];
      setCustomCategories(updated);
      try {
        localStorage.setItem('custom_goal_categories', JSON.stringify(updated));
      } catch (e) {}
    }
    setCategory(trimmed);
    setNewCategoryName('');
    setIsCreatingCategory(false);
    setIsCategoryPickerOpen(false);
  };

  const handleDeleteCustomCategory = (catToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customCategories.filter((c) => c !== catToDelete);
    setCustomCategories(updated);
    try {
      localStorage.setItem('custom_goal_categories', JSON.stringify(updated));
    } catch (e) {}
    if (category === catToDelete) {
      setCategory(DEFAULT_GOAL_CATEGORIES[0]);
    }
  };
  const [notes, setNotes] = useState('');
  const [yieldRate, setYieldRate] = useState('');
  const [yieldPeriod, setYieldPeriod] = useState<'monthly' | 'yearly'>('monthly');

  // Period duration state for Goal Deadline (Months or Years)
  const [periodMode, setPeriodMode] = useState<'period' | 'date'>('period');
  const [periodValue, setPeriodValue] = useState('12');
  const [periodUnit, setPeriodUnit] = useState<'months' | 'years'>('months');

  // Deposit Contribution Modal
  const [depositGoalId, setDepositGoalId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');

  const computeDateFromPeriod = (valStr: string, unit: 'months' | 'years') => {
    const num = parseInt(valStr, 10);
    if (isNaN(num) || num <= 0) return targetDate || new Date().toISOString().split('T')[0];
    const d = new Date();
    if (unit === 'years') {
      d.setFullYear(d.getFullYear() + num);
    } else {
      d.setMonth(d.getMonth() + num);
    }
    return d.toISOString().split('T')[0];
  };

  const handleOpenAddGoal = () => {
    setEditingGoal(null);
    setTitle('');
    setTargetAmount('');
    setCurrentAmount('0,00');
    setPeriodMode('period');
    setPeriodValue('12');
    setPeriodUnit('months');
    const computed = computeDateFromPeriod('12', 'months');
    setTargetDate(computed);
    setDateText(isoToBrDate(computed));
    setCategory('Viagem & Lazer');
    setIsCategoryPickerOpen(false);
    setIsCreatingCategory(false);
    setNotes('');
    setYieldRate('');
    setYieldPeriod('monthly');
    setIsGoalModalOpen(true);
  };

  const handleOpenEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setTitle(goal.title);
    setTargetAmount(formatNumberToPtBr(goal.targetAmount));
    setCurrentAmount(formatNumberToPtBr(goal.currentAmount));
    setTargetDate(goal.targetDate);
    setDateText(isoToBrDate(goal.targetDate));
    setPeriodMode('date');
    setCategory(goal.category || 'Viagem & Lazer');
    setIsCategoryPickerOpen(false);
    setIsCreatingCategory(false);
    setNotes(goal.notes || '');
    setYieldRate(goal.yieldRate !== undefined && goal.yieldRate !== null ? formatNumberToPtBr(goal.yieldRate) : '');
    setYieldPeriod(goal.yieldPeriod || 'monthly');
    setIsGoalModalOpen(true);
  };

  const handleGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !targetAmount) return;

    const parsedTarget = parsePtBrNumber(targetAmount);
    const parsedCurrent = parsePtBrNumber(currentAmount);
    const parsedYield = yieldRate ? parsePtBrNumber(yieldRate) : undefined;

    const goalToSave: Goal = {
      id: editingGoal ? editingGoal.id : `goal_${Date.now()}`,
      userId,
      title,
      targetAmount: parsedTarget,
      currentAmount: parsedCurrent,
      targetDate,
      category,
      color: '#D4AF37',
      icon: 'Target',
      notes,
      yieldRate: parsedYield,
      yieldPeriod: yieldPeriod,
    };

    onSaveGoal(goalToSave);
    setIsGoalModalOpen(false);
  };

  const handleDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositGoalId || !depositAmount) return;

    const amountNum = parsePtBrNumber(depositAmount);
    if (amountNum > 0) {
      onUpdateGoalProgress(depositGoalId, amountNum);
    }
    setDepositGoalId(null);
    setDepositAmount('');
  };

  // Real-time calculation inside modal
  const modalTargetNum = parsePtBrNumber(targetAmount);
  const modalCurrentNum = parsePtBrNumber(currentAmount);
  const modalYieldRateNum = parsePtBrNumber(yieldRate);
  const modalCalculation = calculateMonthlyContribution(
    modalTargetNum,
    modalCurrentNum,
    targetDate,
    modalYieldRateNum,
    yieldPeriod
  );

  const totalCurrent = goals.reduce((acc, g) => acc + g.currentAmount, 0);
  const totalTarget = goals.reduce((acc, g) => acc + g.targetAmount, 0);
  const totalOverallPct = totalTarget > 0 ? Math.min(100, Math.round((totalCurrent / totalTarget) * 100)) : 0;

  return (
    <div className="space-y-6 pb-12" id="goals-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-gray-200 rounded-3xl p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-[#D4AF37]" />
            <h1 className="text-lg font-bold text-[#121212] font-serif">Objetivos & Sonhos Financeiros</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Planeje suas grandes conquistas e acompanhe o acúmulo de patrimônio com simulação de rendimentos
          </p>
        </div>

        <button
          onClick={handleOpenAddGoal}
          className="min-h-[42px] sm:min-h-[44px] py-2.5 px-4 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer border border-[#00A843] shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3] shrink-0" />
          <span>Novo Objetivo</span>
        </button>
      </div>

      {/* Valor Geral Summary Banner */}
      <div className="bg-[#121212] text-white rounded-3xl p-6 shadow-md border border-[#D4AF37] space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-4">
          <div>
            <span className="text-xs font-bold text-[#D4AF37] uppercase tracking-widest block">
              Acompanhamento Geral de Conquistas
            </span>
            <h2 className="text-xl font-bold font-serif text-white">Valor Geral dos Sonhos</h2>
          </div>

          <div className="flex items-center gap-6">
            <div>
              <span className="text-[11px] text-gray-400 block">Acumulado Geral Total</span>
              <span className="text-xl font-extrabold text-[#00C853] font-serif">
                {formatCurrency(totalCurrent)}
              </span>
            </div>
            <div className="h-8 w-px bg-gray-800"></div>
            <div>
              <span className="text-[11px] text-gray-400 block">Meta Geral Total</span>
              <span className="text-xl font-extrabold text-white font-serif">
                {formatCurrency(totalTarget)}
              </span>
            </div>
          </div>
        </div>

        {/* Overall Progress Bar: Red to Green */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs text-gray-300">
            <span className="font-semibold">Progresso Geral de Todos os Sonhos</span>
            <span className="font-bold text-[#00C853]">{totalOverallPct}% Concluído</span>
          </div>
          <div className="w-full h-3 bg-gray-900 rounded-full overflow-hidden p-0.5 border border-gray-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#FF3D00] via-[#D4AF37] to-[#00C853] shadow-[0_0_12px_rgba(0,200,83,0.5)] transition-all duration-500"
              style={{ width: `${totalOverallPct}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map((goal) => {
          const progressPct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
          const remainingAmount = Math.max(0, goal.targetAmount - goal.currentAmount);

          // Calculate required monthly contribution
          const calc = calculateMonthlyContribution(
            goal.targetAmount,
            goal.currentAmount,
            goal.targetDate,
            goal.yieldRate || 0,
            goal.yieldPeriod || 'monthly'
          );

          return (
            <div
              key={goal.id}
              className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs hover:shadow-md transition space-y-4 flex flex-col justify-between relative overflow-hidden"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider">
                      {goal.category}
                    </span>
                    <h3 className="text-base font-bold text-[#121212] font-serif">{goal.title}</h3>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditGoal(goal)}
                      className="p-1.5 text-gray-600 hover:text-[#121212] hover:bg-gray-100 rounded-xl transition cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteGoal(goal.id)}
                      className="p-1.5 text-[#FF3D00] hover:bg-red-50 rounded-xl transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress Circle & Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-[#00C853] font-serif">
                      {formatCurrency(goal.currentAmount)}
                    </span>
                    <span className="font-extrabold text-[#121212] font-serif bg-gray-100 px-2.5 py-0.5 rounded-lg border border-gray-200">
                      {progressPct}% Concluído
                    </span>
                  </div>

                  {/* Red to Green Progress Bar */}
                  <div className="w-full h-3.5 bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#FF3D00] via-[#D4AF37] to-[#00C853] shadow-xs transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                    <span>Faltam: <strong className="text-[#121212]">{formatCurrency(remainingAmount)}</strong></span>
                    <span>Valor do Sonho: <strong className="text-[#121212]">{formatCurrency(goal.targetAmount)}</strong></span>
                  </div>
                </div>

                {/* Monthly Deposit Requirement Card */}
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#121212] font-extrabold flex items-center gap-1">
                      <Calculator className="w-3.5 h-3.5 text-[#D4AF37]" />
                      Precisa guardar por mês:
                    </span>
                    <span className="text-xs font-black text-[#00C853] font-serif">
                      {formatCurrency(calc.monthlyPayment)} / mês
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                    <span>Prazo: {calc.remainingMonths} {calc.remainingMonths === 1 ? 'mês' : 'meses'}</span>
                    {goal.yieldRate && goal.yieldRate > 0 ? (
                      <span className="font-extrabold text-[#00C853] flex items-center gap-0.5">
                        <TrendingUp className="w-3 h-3" />
                        Rendimento: {goal.yieldRate}% {goal.yieldPeriod === 'yearly' ? 'a.a.' : 'a.m.'}
                      </span>
                    ) : (
                      <span className="text-gray-400">Sem rendimento est.</span>
                    )}
                  </div>
                  {goal.yieldRate && goal.yieldRate > 0 && calc.yieldProfit > 0 && (
                    <p className="text-[10px] text-[#00C853] font-bold bg-[#00C853]/10 px-2 py-0.5 rounded-md text-center mt-1">
                      Juros a seu favor: +{formatCurrency(calc.yieldProfit)} acumulados!
                    </p>
                  )}
                </div>

                {goal.notes && (
                  <p className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-200 italic">
                    "{goal.notes}"
                  </p>
                )}

                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 pt-1">
                  <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Prazo planejado: {formatDateBR(goal.targetDate)}</span>
                </div>
              </div>

              {/* Deposit Action Button */}
              <button
                onClick={() => {
                  setDepositGoalId(goal.id);
                  setDepositAmount('');
                }}
                className="w-full py-2.5 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <Sparkles className="w-4 h-4 text-[#121212]" />
                <span>Registrar Aporte de Economia</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Goal Modal */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md max-h-[92vh] sm:max-h-[88vh] flex flex-col my-auto overflow-hidden animate-in fade-in">
            <div className="flex items-center justify-between border-b border-gray-200 p-4 sm:p-5 bg-white shrink-0">
              <h2 className="text-sm sm:text-base font-extrabold text-[#121212] font-serif">
                {editingGoal ? 'Editar Objetivo' : 'Novo Objetivo Financeiro'}
              </h2>
              <button
                onClick={() => setIsGoalModalOpen(false)}
                className="p-1 rounded-xl text-gray-500 hover:text-[#121212] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGoalSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-4 sm:p-6 overflow-y-auto space-y-3.5 flex-1">
              <div>
                <label className="text-xs font-semibold text-[#121212] block mb-1">Título do Sonho *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Eurotrip Paris, Reserva de Emergência..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#121212] block mb-1">Meta Valor (R$) *</label>
                  <input
                    type="text"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    onBlur={() => {
                      if (targetAmount.trim()) {
                        setTargetAmount(formatNumberToPtBr(targetAmount));
                      }
                    }}
                    placeholder="Ex: 1.001,09"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#121212] block mb-1">Acumulado Atual (R$)</label>
                  <input
                    type="text"
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(e.target.value)}
                    onBlur={() => {
                      if (currentAmount.trim()) {
                        setCurrentAmount(formatNumberToPtBr(currentAmount));
                      }
                    }}
                    placeholder="Ex: 0,00"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  />
                </div>
              </div>

              {/* Prazo / Período do Objetivo */}
              <div className="space-y-2 bg-gray-50 p-3 rounded-2xl border border-gray-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-[#121212] block uppercase tracking-wider">
                    Prazo / Período do Objetivo:
                  </label>
                  <div className="flex bg-gray-200 p-0.5 rounded-lg text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setPeriodMode('period');
                        const computed = computeDateFromPeriod(periodValue, periodUnit);
                        setTargetDate(computed);
                        setDateText(isoToBrDate(computed));
                      }}
                      className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                        periodMode === 'period'
                          ? 'bg-[#121212] text-white shadow-xs'
                          : 'text-[#121212] hover:bg-gray-300'
                      }`}
                    >
                      Em Mês / Ano
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPeriodMode('date');
                        if (targetDate) {
                          setDateText(isoToBrDate(targetDate));
                        }
                      }}
                      className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                        periodMode === 'date'
                          ? 'bg-[#121212] text-white shadow-xs'
                          : 'text-[#121212] hover:bg-gray-300'
                      }`}
                    >
                      Por Data
                    </button>
                  </div>
                </div>

                {periodMode === 'period' ? (
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <div>
                      <label className="text-[10px] font-bold text-[#121212] block mb-1">
                        Quantidade de Tempo:
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={periodValue}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPeriodValue(val);
                          const computed = computeDateFromPeriod(val, periodUnit);
                          setTargetDate(computed);
                          setDateText(isoToBrDate(computed));
                        }}
                        placeholder="Ex: 12 ou 2"
                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#121212] block mb-1">
                        Selecione (Mês ou Ano):
                      </label>
                      <select
                        value={periodUnit}
                        onChange={(e) => {
                          const unit = e.target.value as 'months' | 'years';
                          setPeriodUnit(unit);
                          const computed = computeDateFromPeriod(periodValue, unit);
                          setTargetDate(computed);
                          setDateText(isoToBrDate(computed));
                        }}
                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                      >
                        <option value="months">Mês / Meses</option>
                        <option value="years">Ano / Anos</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="pt-0.5 space-y-1.5">
                    <label className="text-xs font-bold text-[#121212] block">
                      Data Limite Específica:
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={dateText}
                        onChange={(e) => {
                          const masked = formatBrDateMask(e.target.value);
                          setDateText(masked);
                          const iso = brDateToIso(masked);
                          if (iso) {
                            setTargetDate(iso);
                          }
                        }}
                        onBlur={() => {
                          if (targetDate) {
                            setDateText(isoToBrDate(targetDate));
                          }
                        }}
                        placeholder="07/08/2027"
                        maxLength={10}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37] pr-10"
                        required
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7">
                        <Calendar className="w-4 h-4 text-gray-500 pointer-events-none" />
                        <input
                          type="date"
                          value={targetDate}
                          onChange={(e) => {
                            if (e.target.value) {
                              setTargetDate(e.target.value);
                              setDateText(isoToBrDate(e.target.value));
                            }
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          title="Selecionar no calendário"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-gray-600 font-medium flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                    Data Alvo Calculada:
                  </span>
                  <span className="font-extrabold text-[#121212] bg-white px-2 py-0.5 rounded-md border border-gray-300">
                    {formatDateBR(targetDate)}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#121212] block mb-1">
                  Categoria do Sonho
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCategoryPickerOpen(!isCategoryPickerOpen);
                      setIsCreatingCategory(false);
                    }}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-[#121212] flex items-center justify-between hover:bg-gray-100 transition cursor-pointer"
                  >
                    <span>{category || 'Selecione uma categoria'}</span>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isCategoryPickerOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isCategoryPickerOpen && (
                    <div className="mt-2 bg-[#182232] text-white rounded-2xl p-3 shadow-2xl border border-gray-700 space-y-2 z-20">
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {allCategories.map((catOption) => {
                          const isSelected = category === catOption;
                          const isCustom = customCategories.includes(catOption);
                          return (
                            <div
                              key={catOption}
                              onClick={() => {
                                setCategory(catOption);
                                setIsCategoryPickerOpen(false);
                              }}
                              className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-between transition cursor-pointer ${
                                isSelected
                                  ? 'bg-[#223046] text-white border border-[#00d2ff]/40 shadow-xs'
                                  : 'bg-[#1e2a3c] text-gray-200 hover:bg-[#283850]'
                              }`}
                            >
                              <span className="truncate pr-2">{catOption}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                {isCustom && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteCustomCategory(catOption, e)}
                                    title="Excluir categoria customizada"
                                    className="p-1 text-gray-400 hover:text-red-400 rounded transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <div
                                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                                    isSelected ? 'border-[#00d2ff]' : 'border-gray-500'
                                  }`}
                                >
                                  {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[#00d2ff]" />}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {!isCreatingCategory ? (
                        <button
                          type="button"
                          onClick={() => setIsCreatingCategory(true)}
                          className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-[#222e3f] hover:bg-[#2b3b51] text-[#00C853] flex items-center justify-center gap-2 border border-dashed border-[#00C853]/50 transition cursor-pointer mt-1"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Criar Nova Categoria</span>
                        </button>
                      ) : (
                        <div className="p-3 bg-[#202c3d] rounded-xl space-y-2 border border-gray-600 mt-2">
                          <label className="text-xs font-bold text-gray-200 block">Nome da Nova Categoria</label>
                          <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCustomCategory();
                              }
                            }}
                            placeholder="Ex: Casamento, Aposentadoria..."
                            className="w-full px-3 py-2 bg-[#121822] border border-gray-600 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#00C853]"
                            autoFocus
                          />
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setIsCreatingCategory(false);
                                setNewCategoryName('');
                              }}
                              className="px-3 py-1.5 text-xs text-gray-300 hover:text-white font-semibold cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={handleAddCustomCategory}
                              disabled={!newCategoryName.trim()}
                              className="px-3 py-1.5 bg-[#00C853] hover:bg-[#00e676] text-black font-bold text-xs rounded-lg transition disabled:opacity-50 cursor-pointer"
                            >
                              Salvar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Yield / Rendimento Inputs */}
              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-[#00C853]" />
                  <span className="text-xs font-extrabold text-[#121212] uppercase tracking-wider">
                    Rendimento / Juros Estimados (Opcional)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#121212] block mb-1">Taxa de Rendimento (%)</label>
                    <input
                      type="text"
                      value={yieldRate}
                      onChange={(e) => setYieldRate(e.target.value)}
                      onBlur={() => {
                        if (yieldRate.trim()) {
                          setYieldRate(formatNumberToPtBr(yieldRate));
                        }
                      }}
                      placeholder="Ex: 0,8 ou 10,50"
                      className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#121212] block mb-1">Período</label>
                    <select
                      value={yieldPeriod}
                      onChange={(e) => setYieldPeriod(e.target.value as 'monthly' | 'yearly')}
                      className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    >
                      <option value="monthly">% ao Mês (ex: CDI mensal)</option>
                      <option value="yearly">% ao Ano (ex: Tesouro, Poupança)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Real-time Recalculated Monthly Saving Requirement */}
              {modalTargetNum > 0 && (
                <div className="bg-[#121212] text-white p-3.5 rounded-2xl border border-[#D4AF37] shadow-inner space-y-1">
                  <div className="flex items-center justify-between text-xs font-extrabold">
                    <span className="text-[#D4AF37] uppercase tracking-wider flex items-center gap-1">
                      <Calculator className="w-3.5 h-3.5 text-[#D4AF37]" />
                      Quanto precisa guardar por mês:
                    </span>
                    <span className="text-sm font-black text-[#00C853] font-serif">
                      {formatCurrency(modalCalculation.monthlyPayment)} / mês
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-300 pt-0.5">
                    <span>Prazo total: {modalCalculation.remainingMonths} {modalCalculation.remainingMonths === 1 ? 'mês' : 'meses'}</span>
                    {modalCalculation.yieldProfit > 0 && (
                      <span className="font-bold text-[#00C853]">
                        Juros gerados: +{formatCurrency(modalCalculation.yieldProfit)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-[#121212] block mb-1">Notas & Observações</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detalhes sobre esta meta..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37] h-14"
                />
              </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4 sm:px-6 sm:py-4 border-t border-gray-200 bg-white shrink-0">
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(false)}
                  className="w-full py-3 bg-gray-100 border border-gray-300 text-[#121212] font-bold text-xs rounded-xl hover:bg-gray-200 transition cursor-pointer"
                >
                  Sair
                </button>
                <button
                  type="submit"
                  className="w-full py-3 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs rounded-xl shadow-md transition cursor-pointer"
                >
                  Salvar Objetivo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deposit Contribution Modal */}
      {depositGoalId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-sm my-auto p-5 sm:p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h2 className="text-base font-extrabold text-[#121212] font-serif">Registrar Aporte</h2>
              <button
                onClick={() => setDepositGoalId(null)}
                className="p-1 rounded-xl text-gray-500 hover:text-[#121212] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDepositSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#121212] block mb-1">
                  Valor a adicionar à poupança (R$) *
                </label>
                <input
                  type="text"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  onBlur={() => {
                    if (depositAmount.trim()) {
                      setDepositAmount(formatNumberToPtBr(depositAmount));
                    }
                  }}
                  placeholder="Ex: 500,00 ou 1.001,09"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  autoFocus
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                Confirmar Aporte
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
