import React from 'react';
import { DarlaLogo } from './DarlaLogo';
import { Account, Category, FamilyMember, Goal, MonthSummary, Transaction, User } from '../types';
import { formatCurrency, formatDateBR, findSubcategoryById, usePrivacyMode } from '../utils/finance';
import { MonthlyComparisonDashboard } from './MonthlyComparisonDashboard';
import { MonthlyAiTipsCard } from './MonthlyAiTipsCard';
import { FiftyThirtyTwentyWidget } from './FiftyThirtyTwentyWidget';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CheckCircle2,
  Clock,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Sparkles,
  Layers,
  ArrowRightLeft,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface DashboardViewProps {
  summary: MonthSummary;
  accounts: Account[];
  accountBalances: Record<string, { currentBalance: number; consolidatedBalance: number }>;
  categories: Category[];
  transactions: Transaction[];
  goals: Goal[];
  familyMembers?: FamilyMember[];
  currentYear: number;
  currentMonth: number;
  onOpenNewTransaction: () => void;
  onToggleConsolidated: (id: string) => void;
  setActiveTab: (tab: string) => void;
  user?: User | null;
  onEditTransaction?: (transaction: Transaction) => void;
  onUpdateSingleTransaction?: (transaction: Transaction) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  summary,
  accounts,
  accountBalances,
  categories,
  transactions,
  goals,
  familyMembers = [],
  currentYear,
  currentMonth,
  onOpenNewTransaction,
  onToggleConsolidated,
  setActiveTab,
  user,
  onEditTransaction,
  onUpdateSingleTransaction,
}) => {
  usePrivacyMode();
  const [pieType, setPieType] = React.useState<'expense' | 'income'>('expense');
  const [selectedCategoryDrilldown, setSelectedCategoryDrilldown] = React.useState<Category | null>(null);

  // Interactive Cash Flow filter buttons
  const [cashflowFilters, setCashflowFilters] = React.useState({
    receitaEfetivada: true,
    receitaPendente: true,
    despesaEfetivada: true,
    despesaPendente: true,
  });

  // Filter transactions for current month
  const currentMonthTx = React.useMemo(() => transactions.filter((t) => {
    const [y, m] = t.date.split('-').map(Number);
    return y === currentYear && m === currentMonth;
  }), [transactions, currentYear, currentMonth]);

  // Calculate Net Monthly Result (Entradas - Saídas)
  const monthlyNetResult = summary.totalIncome - summary.totalExpenses;
  const isNetPositive = monthlyNetResult >= 0;
  const isEndingPositive = summary.endingBalance >= 0;

  // Category or Subcategory breakdown for Pie Chart
  const { categoryMap, subcategoryMap } = React.useMemo(() => {
    const categoryMap: Record<string, { id: string; amount: number; color?: string }> = {};
    const subcategoryMap: Record<string, { amount: number }> = {};
    
    if (!selectedCategoryDrilldown) {
      currentMonthTx
        .filter((t) => t.type === pieType)
        .forEach((t) => {
          const cat = categories.find((c) => c.id === t.categoryId);
          const catName = cat ? cat.name : 'Outros';
          const catId = cat ? cat.id : 'other';
          const catColor = cat?.color;
          if (!categoryMap[catName]) {
            categoryMap[catName] = { id: catId, amount: 0, color: catColor };
          }
          categoryMap[catName].amount += t.amount;
        });
    } else {
      currentMonthTx
        .filter((t) => t.type === pieType && t.categoryId === selectedCategoryDrilldown.id)
        .forEach((t) => {
          const sub = selectedCategoryDrilldown.subcategories.find((s) => s.id === t.subcategoryId);
          const subName = sub ? sub.name : 'Geral / Sem Subcategoria';
          if (!subcategoryMap[subName]) {
            subcategoryMap[subName] = { amount: 0 };
          }
          subcategoryMap[subName].amount += t.amount;
        });
    }
    return { categoryMap, subcategoryMap };
  }, [currentMonthTx, pieType, selectedCategoryDrilldown, categories]);

  // Vibrant, multi-color palette ensuring high visual contrast across all categories & subcategories
  const VIBRANT_COLOR_PALETTE = React.useMemo(() => [
    '#E11D48', // Crimson Rose
    '#2563EB', // Royal Blue
    '#00C853', // Emerald Green
    '#8B5CF6', // Purple
    '#D97706', // Amber / Dark Orange
    '#EC4899', // Pink
    '#06B6D4', // Cyan / Turquoise
    '#F59E0B', // Golden Yellow
    '#6366F1', // Indigo
    '#10B981', // Mint Teal
    '#F43F5E', // Coral Red
    '#84CC16', // Lime Green
    '#A855F7', // Violet
    '#0284C7', // Sky Blue
    '#D946EF', // Fuchsia
    '#14B8A6', // Teal
    '#FF3D00', // Deep Orange
  ], []);

  const pieChartData = React.useMemo(() => {
    const usedColors = new Set<string>();
    return !selectedCategoryDrilldown
      ? Object.keys(categoryMap).map((name, index) => {
          const item = categoryMap[name];
          let color =
            item.color && item.color.startsWith('#') && item.color !== '#121212' ? item.color : '';

          if (!color || usedColors.has(color.toLowerCase())) {
            const available = VIBRANT_COLOR_PALETTE.find((c) => !usedColors.has(c.toLowerCase()));
            color = available || VIBRANT_COLOR_PALETTE[index % VIBRANT_COLOR_PALETTE.length];
          }

          usedColors.add(color.toLowerCase());

          return {
            name,
            categoryId: item.id,
            value: item.amount,
            color,
          };
        })
      : Object.keys(subcategoryMap).map((name, index) => {
          const item = subcategoryMap[name];
          const color = VIBRANT_COLOR_PALETTE[index % VIBRANT_COLOR_PALETTE.length];
          return {
            name,
            value: item.amount,
            color,
          };
        });
  }, [selectedCategoryDrilldown, categoryMap, subcategoryMap, VIBRANT_COLOR_PALETTE]);

  // Cashflow comparison data for Bar Chart (Green for Receita, Red for Despesa)
  const cashflowData = React.useMemo(() => [
    {
      name: 'Receitas (Entradas)',
      Efetivado: cashflowFilters.receitaEfetivada ? summary.consolidatedIncome : 0,
      Pendente: cashflowFilters.receitaPendente ? summary.pendingIncome : 0,
      type: 'income',
    },
    {
      name: 'Despesas (Saídas)',
      Efetivado: cashflowFilters.despesaEfetivada ? summary.consolidatedExpenses : 0,
      Pendente: cashflowFilters.despesaPendente ? summary.pendingExpenses : 0,
      type: 'expense',
    },
  ], [cashflowFilters, summary]);

  return (
    <div className="space-y-4 sm:space-y-6 pb-12" id="dashboard-container">
      {/* Compact Dashboard Branding Header */}
      <div
        className="bg-gradient-to-r from-[#121212] via-[#241E10] to-[#121212] text-white rounded-2xl p-3 sm:p-4 shadow-lg border border-[#D4AF37]/60 flex flex-col sm:flex-row items-center justify-between gap-3"
        id="dashboard-center-logo-hero"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-[#121212] rounded-xl border border-[#D4AF37] shadow-sm shrink-0">
            <DarlaLogo size="sm" showTitle={false} showSubtext={false} variant="dark" />
          </div>
          <div className="text-left">
            <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-[#FAFAFA] font-serif">
              Painel Financeiro & Controladoria Pessoal
            </h1>
            <p className="text-[11px] text-gray-300 font-medium hidden sm:block">
              Acompanhe o saldo acumulado mês a mês e concilie suas finanças.
            </p>
          </div>
        </div>

        {/* Month Status Health Pill & Quick CTA */}
        <div className="flex items-center gap-2 shrink-0">
          {isNetPositive ? (
            <div className="flex items-center gap-1.5 text-xs font-black text-[#121212] bg-[#00C853] border border-[#00E676] px-3 py-1 rounded-full shadow-md">
              <TrendingUp className="w-3.5 h-3.5 text-[#121212] stroke-[3]" />
              <span>Balanço: Positivo (+{formatCurrency(monthlyNetResult)})</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-black text-white bg-[#FF3D00] border border-red-400 px-3 py-1 rounded-full shadow-md animate-pulse">
              <TrendingDown className="w-3.5 h-3.5 text-white stroke-[3]" />
              <span>Balanço: Alerta ({formatCurrency(monthlyNetResult)}) ⚠️</span>
            </div>
          )}

          <button
            onClick={onOpenNewTransaction}
            className="min-h-[42px] sm:min-h-[44px] py-2.5 px-4 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer border border-[#00A843] shrink-0"
          >
            <Plus className="w-4 h-4 text-[#121212] stroke-[3] shrink-0" />
            <span>Novo Lançamento</span>
          </button>
        </div>
      </div>

      {/* Rolling Balance & Month Status Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" id="dashboard-summary-cards">
        {/* Card 1: Saldo Anterior (Rolling Balance) */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs hover:shadow-md transition relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Saldo Anterior (Rollover)
            </span>
            <div className="p-1.5 bg-gray-100 rounded-xl text-gray-700">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-lg font-extrabold text-[#121212] font-serif">
              {formatCurrency(summary.startingBalance)}
            </span>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Acumulado dos meses anteriores
            </p>
          </div>
        </div>

        {/* Card 2: Entradas (Receitas) - ALWAYS GREEN */}
        <div className="bg-emerald-50/40 border border-emerald-200 rounded-2xl p-4 shadow-xs hover:shadow-md transition flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Receitas do Mês
            </span>
            <div className="p-1.5 bg-emerald-100 rounded-xl text-emerald-700">
              <TrendingUp className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-lg font-extrabold text-emerald-900 font-serif">
              {formatCurrency(summary.totalIncome)}
            </span>
            <div className="flex flex-col gap-0.5 text-[10px] mt-1">
              <span className="text-emerald-700 font-semibold">
                Consolidado: {formatCurrency(summary.consolidatedIncome)}
              </span>
              {summary.pendingIncome > 0 && (
                <span className="text-amber-700 font-semibold">
                  Previsto: {formatCurrency(summary.pendingIncome)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Saídas (Despesas) - ALWAYS RED */}
        <div className="bg-red-50/40 border border-red-200 rounded-2xl p-4 shadow-xs hover:shadow-md transition flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-red-800 uppercase tracking-wider">
              Despesas do Mês
            </span>
            <div className="p-1.5 bg-red-100 rounded-xl text-red-700">
              <TrendingDown className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-lg font-extrabold text-red-900 font-serif">
              {formatCurrency(summary.totalExpenses)}
            </span>
            <div className="flex flex-col gap-0.5 text-[10px] mt-1">
              <span className="text-red-700 font-semibold">
                Consolidado: {formatCurrency(summary.consolidatedExpenses)}
              </span>
              {summary.pendingExpenses > 0 && (
                <span className="text-amber-700 font-semibold">
                  Previsto: {formatCurrency(summary.pendingExpenses)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card 4: Resultado do Mês (Entradas - Saídas) - GREEN IF POSITIVE, RED IF NEGATIVE */}
        <div
          className={`rounded-2xl p-4 border shadow-xs transition flex flex-col justify-between ${
            isNetPositive
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-red-50 border-red-300 text-red-950'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] font-extrabold uppercase tracking-wider ${
                isNetPositive ? 'text-emerald-800' : 'text-red-800'
              }`}
            >
              Resultado do Mês
            </span>
            <div
              className={`p-1.5 rounded-xl ${
                isNetPositive ? 'bg-emerald-200/80 text-emerald-800' : 'bg-red-200/80 text-red-800'
              }`}
            >
              {isNetPositive ? (
                <TrendingUp className="w-4 h-4 stroke-[2.5]" />
              ) : (
                <TrendingDown className="w-4 h-4 stroke-[2.5]" />
              )}
            </div>
          </div>
          <div className="mt-2">
            <span
              className={`text-lg font-extrabold font-serif ${
                isNetPositive ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {isNetPositive ? '+' : ''}{formatCurrency(monthlyNetResult)}
            </span>
            <div className="mt-1">
              <span
                className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isNetPositive
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-red-100 text-red-800 border-red-300'
                }`}
              >
                {isNetPositive ? 'Superávit (Positivo)' : 'Déficit (Negativo) ⚠️'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 5: Saldo Final Acumulado - GREEN IF POSITIVE, RED IF NEGATIVE */}
        <div
          className={`rounded-2xl p-4 text-white shadow-sm relative overflow-hidden border transition flex flex-col justify-between ${
            isEndingPositive
              ? 'bg-gradient-to-br from-emerald-950 via-teal-900 to-emerald-900 border-emerald-600'
              : 'bg-gradient-to-br from-[#121212] via-[#5C1D24] to-[#FF3D00] border-[#FF3D00]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-white/90 uppercase tracking-wider">
              Saldo Final Projetado
            </span>
            <div className="p-1.5 bg-white/20 rounded-xl text-white">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-lg font-extrabold text-white font-serif">
              {formatCurrency(summary.endingBalance)}
            </span>
            <p className="text-[10px] text-white/80 mt-0.5">
              Realizado: <strong className="text-white">{formatCurrency(summary.consolidatedBalance)}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Meta de Orçamento Familiar: Estratégia 50/30/20 (Percentual Desejado x Atual + Filtro de Período + Detalhamento por Membro) */}
      <FiftyThirtyTwentyWidget
        transactions={transactions}
        categories={categories}
        familyMembers={familyMembers}
        currentYear={currentYear}
        currentMonth={currentMonth}
        userId={user?.id || user?.email}
        onEditTransaction={onEditTransaction}
        onUpdateSingleTransaction={onUpdateSingleTransaction}
      />

      {/* Dashboard Comparativo Mensal (1M, Semestre, 12M, 24M, Personalizado) */}
      <MonthlyComparisonDashboard
        transactions={transactions}
        familyMembers={familyMembers}
        currentYear={currentYear}
        currentMonth={currentMonth}
      />

      {/* Main Charts & Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-charts-grid">
        {/* Left 2 Cols: Cashflow Comparison Bar Chart (Receitas em Verde, Despesas em Vermelho) */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-bold text-[#121212] font-serif">
                Fluxo de Caixa (Receitas x Despesas)
              </h2>
              <p className="text-xs text-gray-500">
                Clique na legenda abaixo para filtrar e alternar os valores no gráfico
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
              <button
                type="button"
                onClick={() =>
                  setCashflowFilters((prev) => ({ ...prev, receitaEfetivada: !prev.receitaEfetivada }))
                }
                title="Clique para ativar/desativar no gráfico"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition border cursor-pointer ${
                  cashflowFilters.receitaEfetivada
                    ? 'bg-[#00C853]/10 text-[#00C853] border-[#00C853]/40 shadow-2xs font-extrabold'
                    : 'bg-gray-100 text-gray-400 border-gray-200 line-through opacity-60 hover:opacity-80'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${cashflowFilters.receitaEfetivada ? 'bg-[#00C853]' : 'bg-gray-400'}`}></span>
                <span>Receita Efetivada</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setCashflowFilters((prev) => ({ ...prev, receitaPendente: !prev.receitaPendente }))
                }
                title="Clique para ativar/desativar no gráfico"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition border cursor-pointer ${
                  cashflowFilters.receitaPendente
                    ? 'bg-[#00C853]/5 text-[#00C853] border-[#00C853]/20 shadow-2xs font-extrabold'
                    : 'bg-gray-100 text-gray-400 border-gray-200 line-through opacity-60 hover:opacity-80'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${cashflowFilters.receitaPendente ? 'bg-[#00E676]' : 'bg-gray-400'}`}></span>
                <span>Receita Pendente</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setCashflowFilters((prev) => ({ ...prev, despesaEfetivada: !prev.despesaEfetivada }))
                }
                title="Clique para ativar/desativar no gráfico"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition border cursor-pointer ${
                  cashflowFilters.despesaEfetivada
                    ? 'bg-[#FF3D00]/10 text-[#FF3D00] border-[#FF3D00]/40 shadow-2xs font-extrabold'
                    : 'bg-gray-100 text-gray-400 border-gray-200 line-through opacity-60 hover:opacity-80'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${cashflowFilters.despesaEfetivada ? 'bg-[#FF3D00]' : 'bg-gray-400'}`}></span>
                <span>Despesa Efetivada</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setCashflowFilters((prev) => ({ ...prev, despesaPendente: !prev.despesaPendente }))
                }
                title="Clique para ativar/desativar no gráfico"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition border cursor-pointer ${
                  cashflowFilters.despesaPendente
                    ? 'bg-[#FF3D00]/5 text-[#FF3D00] border-[#FF3D00]/20 shadow-2xs font-extrabold'
                    : 'bg-gray-100 text-gray-400 border-gray-200 line-through opacity-60 hover:opacity-80'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${cashflowFilters.despesaPendente ? 'bg-orange-400' : 'bg-gray-400'}`}></span>
                <span>Despesa Pendente</span>
              </button>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflowData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#121212', fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 11, fill: '#121212' }} />
                <Tooltip
                  formatter={(value: any, name: any) => [formatCurrency(Number(value)), name]}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', borderColor: '#D4AF37', fontSize: '12px' }}
                />
                <Bar dataKey="Efetivado" radius={[6, 6, 0, 0]}>
                  {cashflowData.map((entry, index) => (
                    <Cell
                      key={`cell-efetivado-${index}`}
                      fill={entry.type === 'income' ? '#059669' : '#DC2626'}
                    />
                  ))}
                </Bar>
                <Bar dataKey="Pendente" radius={[6, 6, 0, 0]}>
                  {cashflowData.map((entry, index) => (
                    <Cell
                      key={`cell-pendente-${index}`}
                      fill={entry.type === 'income' ? '#6EE7B7' : '#FCA5A5'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 1 Col: Category Breakdown Pie Chart (With Drill-down to Subcategories) */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col gap-2 mb-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#121212] font-serif">
                  {selectedCategoryDrilldown
                    ? `Subcategorias: ${selectedCategoryDrilldown.name}`
                    : pieType === 'expense'
                    ? 'Despesas por Categoria'
                    : 'Receitas por Categoria'}
                </h2>
                <p className="text-xs text-gray-500">
                  {selectedCategoryDrilldown
                    ? 'Detalhamento por subcategorias do mês'
                    : 'Clique na categoria para abrir subcategorias 🔍'}
                </p>
              </div>

              {/* Category Pie Toggle */}
              <div className="flex bg-gray-100 p-0.5 rounded-xl text-[10px] font-bold">
                <button
                  onClick={() => {
                    setPieType('expense');
                    setSelectedCategoryDrilldown(null);
                  }}
                  className={`px-2 py-1 rounded-lg transition ${
                    pieType === 'expense' ? 'bg-[#FF3D00] text-white shadow-xs' : 'text-gray-700 hover:text-[#FF3D00]'
                  }`}
                >
                  Despesas
                </button>
                <button
                  onClick={() => {
                    setPieType('income');
                    setSelectedCategoryDrilldown(null);
                  }}
                  className={`px-2 py-1 rounded-lg transition ${
                    pieType === 'income' ? 'bg-[#00C853] text-[#121212] shadow-xs' : 'text-gray-700 hover:text-[#00C853]'
                  }`}
                >
                  Receitas
                </button>
              </div>
            </div>

            {/* Back Button when drilled down */}
            {selectedCategoryDrilldown && (
              <button
                onClick={() => setSelectedCategoryDrilldown(null)}
                className="self-start text-[11px] font-bold text-[#121212] hover:text-[#D4AF37] bg-gray-100 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer border border-gray-200"
              >
                <span>&larr; Voltar para todas as Categorias</span>
              </button>
            )}
          </div>

          {pieChartData.length > 0 ? (
            <div className="h-52 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    onClick={(entry: any) => {
                      if (!selectedCategoryDrilldown && entry && entry.categoryId) {
                        const targetCat = categories.find((c) => c.id === entry.categoryId);
                        if (targetCat) setSelectedCategoryDrilldown(targetCat);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any) => [formatCurrency(Number(value)), name]}
                    contentStyle={{
                      backgroundColor: '#fff',
                      borderRadius: '12px',
                      borderColor: '#D4AF37',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: '#121212',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center text-xs text-gray-500 text-center p-4">
              Nenhum lançamento de {pieType === 'expense' ? 'despesa' : 'receita'}{' '}
              {selectedCategoryDrilldown ? `para a categoria "${selectedCategoryDrilldown.name}"` : ''} neste mês.
            </div>
          )}

          {/* Interactive Legend List */}
          <div className="space-y-1.5 pt-2 border-t border-gray-200 max-h-40 overflow-y-auto">
            {(() => {
              const pieChartTotal = pieChartData.reduce((acc, curr) => acc + curr.value, 0);
              return pieChartData.map((item) => {
                const percentage = pieChartTotal > 0 ? (item.value / pieChartTotal) * 100 : 0;
                return (
                  <div
                    key={item.name}
                    onClick={() => {
                      if (!selectedCategoryDrilldown && (item as any).categoryId) {
                        const targetCat = categories.find((c) => c.id === (item as any).categoryId);
                        if (targetCat) setSelectedCategoryDrilldown(targetCat);
                      }
                    }}
                    className={`flex items-center justify-between text-xs p-1 rounded-lg transition ${
                      !selectedCategoryDrilldown ? 'hover:bg-gray-50 cursor-pointer' : ''
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 pr-2 flex-1">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                      <span className="text-[#121212] font-medium leading-tight">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-extrabold text-gray-500">
                        {percentage.toFixed(1).replace('.', ',')}%
                      </span>
                      <span className="font-bold font-serif text-[#121212]">{formatCurrency(item.value)}</span>
                      {!selectedCategoryDrilldown && <span className="text-[10px] text-[#D4AF37] font-bold">&rsaquo;</span>}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* Middle Row: Accounts Balances Widget & Goals & Dreams Mini-Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-middle-row">
        {/* Account Balances Widget */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[#D4AF37]" />
              <h3 className="text-sm font-bold text-[#121212] font-serif">Minhas Contas</h3>
            </div>
            <button
              onClick={() => setActiveTab('accounts')}
              className="text-xs font-semibold text-[#D4AF37] hover:text-[#121212] cursor-pointer"
            >
              Gerenciar &rarr;
            </button>
          </div>

          <div className="space-y-2.5">
            {accounts.map((acc) => {
              const bal = accountBalances[acc.id] || { currentBalance: acc.initialBalance, consolidatedBalance: acc.initialBalance };
              const accountTypeLabel =
                acc.type === 'checking'
                  ? 'Conta Corrente'
                  : acc.type === 'credit'
                  ? 'Cartão de Crédito'
                  : acc.type === 'savings'
                  ? 'Investimentos / Poupança'
                  : acc.type === 'cash'
                  ? 'Dinheiro em Espécie'
                  : 'Outra Conta';

              return (
                <div
                  key={acc.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: acc.color }}
                    ></div>
                    <div>
                      <p className="text-xs font-bold text-[#121212]">{acc.name}</p>
                      <p className="text-[10px] text-gray-500">{accountTypeLabel}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-extrabold text-[#121212] font-serif">
                      {formatCurrency(bal.currentBalance)}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      Consolidado: {formatCurrency(bal.consolidatedBalance)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Goals & Dreams Widget */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-[#D4AF37]" />
              <div>
                <h3 className="text-sm font-bold text-[#121212] font-serif">Objetivos & Sonhos</h3>
                <p className="text-xs text-gray-500">Acompanhe a evolução das suas metas financeiras</p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('goals')}
              className="text-xs font-semibold text-[#D4AF37] hover:text-[#121212] cursor-pointer"
            >
              Ver todos &rarr;
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {goals.slice(0, 2).map((goal) => {
              const progressPct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
              return (
                <div
                  key={goal.id}
                  className="p-4 rounded-2xl bg-gray-50/80 border border-gray-200 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider">
                        {goal.category}
                      </span>
                      <h4 className="text-xs font-bold text-[#121212]">{goal.title}</h4>
                    </div>
                    <span className="text-xs font-extrabold text-[#121212] font-serif bg-[#D4AF37]/20 px-2 py-0.5 rounded-lg border border-[#D4AF37]/40">
                      {progressPct}%
                    </span>
                  </div>

                  {/* Progress Bar with Mustard Gold Glow */}
                  <div className="space-y-1">
                    <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden p-0.5 border border-gray-300">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#00C853] shadow-[0_0_8px_rgba(212,175,55,0.6)] transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[#121212]">{formatCurrency(goal.currentAmount)}</span>
                      <span className="text-gray-500">Meta: {formatCurrency(goal.targetAmount)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Transactions & Quick Consolidation Toggle */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-4" id="dashboard-recent-tx">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#121212] font-serif">Lançamentos Recentes do Mês</h3>
            <p className="text-xs text-gray-500">Clique no checkbox para efetivar ou conciliar instantaneamente</p>
          </div>
          <button
            onClick={() => setActiveTab('transactions')}
            className="text-xs font-bold text-[#121212] hover:text-[#D4AF37] px-3 py-1.5 bg-gray-100 rounded-xl hover:bg-gray-200 transition cursor-pointer border border-gray-300"
          >
            Ver Extrato Completo
          </button>
        </div>

        <div className="overflow-x-auto">
          <table translate="no" className="w-full text-left text-xs min-w-[650px]">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3 whitespace-nowrap">Status</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Data</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Descrição</th>
                <th className="py-2.5 px-3 whitespace-nowrap min-w-[140px]">Categoria</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Conta</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentMonthTx.map((tx) => {
                const isIncome = tx.type === 'income';
                const cat = categories.find((c) => c.id === tx.categoryId);
                const sub = cat?.subcategories && tx.subcategoryId ? findSubcategoryById(cat.subcategories, tx.subcategoryId) : undefined;
                const acc = accounts.find((a) => a.id === tx.accountId);

                return (
                  <tr key={tx.id} className="hover:bg-gray-50 transition">
                    {/* Consolidation Checkbox Toggle */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <button
                        onClick={() => onToggleConsolidated(tx.id)}
                        className={`p-1 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                          tx.isConsolidated
                            ? 'bg-[#00C853]/10 text-[#00C853] border border-[#00C853]/40'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                        title={tx.isConsolidated ? 'Consolidado (Efetivado)' : 'Pendente (Previsto) - Clique para efetivar'}
                      >
                        {tx.isConsolidated ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#00C853]" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                        )}
                        <span className="text-[10px] font-bold">
                          {tx.isConsolidated ? 'Efetivado' : 'Previsto'}
                        </span>
                      </button>
                    </td>

                    <td className="py-3 px-3 text-gray-700 font-medium whitespace-nowrap">
                      {formatDateBR(tx.date)}
                    </td>

                    <td className="py-3 px-3 text-[#121212] font-bold whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{tx.description}</span>
                        {tx.installmentTotal && (
                          <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-md font-semibold border border-gray-200">
                            Parcela {tx.installmentIndex}/{tx.installmentTotal}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap shadow-2xs"
                        style={{
                          backgroundColor: `${cat?.color || '#D4AF37'}20`,
                          color: cat?.color || '#121212',
                          border: `1px solid ${cat?.color || '#D4AF37'}40`,
                        }}
                      >
                        <span>{cat?.name || 'Geral'}</span>
                        {sub && <span className="opacity-80 text-[11px] font-semibold">› {sub.name}</span>}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-gray-600 font-medium whitespace-nowrap">
                      {acc?.name || 'Conta'}
                    </td>

                    <td className={`py-3 px-3 text-right font-bold font-serif whitespace-nowrap ${
                      isIncome ? 'text-[#00C853]' : 'text-[#FF3D00]'
                    }`}>
                      {isIncome ? '+' : '-'} {formatCurrency(tx.amount)}
                    </td>
                  </tr>
                );
              })}

              {currentMonthTx.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500 text-xs">
                    Nenhum lançamento encontrado para este mês.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
