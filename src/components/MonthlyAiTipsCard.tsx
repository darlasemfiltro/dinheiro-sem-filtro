import React, { useState, useMemo, useEffect } from 'react';
import { MonthSummary, Transaction, Category, User, AIBudgetAdvice } from '../types';
import { formatCurrency, getMonthYearLabel } from '../utils/finance';
import { StorageService } from '../services/storage';
import { Sparkles, BrainCircuit, Target, ShieldCheck, PiggyBank, Lightbulb, TrendingUp, AlertTriangle, ArrowRight, CheckCircle2, RefreshCw, Lock, AlertCircle } from 'lucide-react';

interface MonthlyAiTipsCardProps {
  summary: MonthSummary;
  transactions: Transaction[];
  categories: Category[];
  currentYear: number;
  currentMonth: number;
  user?: User | null;
  onOpenPlans?: () => void;
}

export const MonthlyAiTipsCard: React.FC<MonthlyAiTipsCardProps> = ({
  summary,
  transactions,
  categories,
  currentYear,
  currentMonth,
  user,
  onOpenPlans,
}) => {
  const currentUser = user || StorageService.getCurrentUser();
  const isAllowed = StorageService.isFeatureAllowed(currentUser, 'ai_tips');

  const [activeTab, setActiveTab] = useState<'sem_filtro' | 'distribution' | 'reserve' | 'tips' | 'savings'>('sem_filtro');
  const [customGoalPct, setCustomGoalPct] = useState<number>(20);
  const [budgetAdvice, setBudgetAdvice] = useState<AIBudgetAdvice | null>(null);
  const [isLoadingAdvice, setIsLoadingAdvice] = useState<boolean>(false);

  const monthLabel = getMonthYearLabel(currentYear, currentMonth);
  const income = summary.totalIncome;
  const expenses = summary.totalExpenses;
  const netResult = income - expenses;

  // Disparo Automático: requisição da IA ao carregar ou atualizar mês/dados
  const fetchSemFiltroBudgetAnalysis = async () => {
    setIsLoadingAdvice(true);
    try {
      const res = await fetch('/api/budget/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary,
          transactions,
          categories,
          month: currentMonth,
          year: currentYear,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.advice) {
          setBudgetAdvice(data.advice);
          return;
        }
      }
    } catch (err) {
      console.error('[Sem Filtro Budget Error]', err);
    } finally {
      setIsLoadingAdvice(false);
    }

    // Client-side fallback to guarantee analysis is generated
    const totalInc = summary.totalIncome || 0;
    const totalExp = summary.totalExpenses || 0;
    const net = totalInc - totalExp;
    const savingsRate = totalInc > 0 ? (net / totalInc) * 100 : 0;

    const positivePoints: string[] = [];
    const warningPoints: string[] = [];

    if (totalInc > 0) {
      positivePoints.push(`Receita total de ${formatCurrency(totalInc)} devidamente registrada no período.`);
    } else {
      positivePoints.push('Acompanhamento ativo e disciplina no cadastro financeiro.');
    }

    if (net > 0) {
      positivePoints.push(`Sobra financeira de ${formatCurrency(net)} (${savingsRate.toFixed(1)}% da receita mensal).`);
    }

    if (totalExp > totalInc && totalInc > 0) {
      warningPoints.push(`Déficit de ${formatCurrency(totalExp - totalInc)}. Seus custos atuais superam o total de receitas.`);
    } else if (savingsRate < 20 && totalInc > 0) {
      warningPoints.push(`Sua taxa de poupança (${savingsRate.toFixed(1)}%) está abaixo do patamar ideal de 20% para a construção de reserva.`);
    } else if (totalExp === 0) {
      warningPoints.push('Nenhum lançamento de despesa efetuado ainda neste mês.');
    }

    if (warningPoints.length === 0) {
      warningPoints.push('Monitore pequenas despesas do dia a dia para evitar vazamentos silenciosos de caixa.');
    }

    const savingTip = net > 0
      ? `Separe ${formatCurrency(totalInc * 0.2)} no dia em que receber sua receita para investimentos e reserva de emergência, antes de efetuar despesas discricionárias.`
      : 'Elimine assinaturas não essenciais e renegocie despesas fixas para retomar o saldo positivo no próximo mês.';

    setBudgetAdvice({
      positivePoints,
      warningPoints,
      savingTip,
      generatedAt: new Date().toISOString(),
    });
  };

  useEffect(() => {
    if (isAllowed) {
      fetchSemFiltroBudgetAnalysis();
    }
  }, [currentYear, currentMonth, summary.totalIncome, summary.totalExpenses]);

  // 50 / 30 / 20 Budget Rule calculated based on current month's income
  const budget50 = income * 0.5; // Essenciais
  const budget30 = income * 0.3; // Estilo de vida / Lazer
  const budget20 = income * 0.2; // Investimentos & Reserva

  // Actual breakdown in current month
  const currentMonthTx = transactions.filter((t) => {
    const [y, m] = t.date.split('-').map(Number);
    return y === currentYear && m === currentMonth;
  });

  // Calculate essential expenses (Moradia, Alimentação, Saúde, Transporte)
  const essentialExpenseTotal = useMemo(() => {
    return currentMonthTx
      .filter((t) => t.type === 'expense')
      .reduce((acc, t) => {
        const cat = categories.find((c) => c.id === t.categoryId);
        const name = cat?.name.toLowerCase() || '';
        if (
          name.includes('moradia') ||
          name.includes('alimenta') ||
          name.includes('saúde') ||
          name.includes('saude') ||
          name.includes('transporte')
        ) {
          return acc + t.amount;
        }
        return acc;
      }, 0);
  }, [currentMonthTx, categories]);

  const lifestyleExpenseTotal = Math.max(0, expenses - essentialExpenseTotal);

  // Recommended Emergency Fund (6 months of current income or 6 months of expenses)
  const recommendedEmergencyFund = income > 0 ? income * 6 : 30000;

  // AI Insights Generation based on income
  const aiInsights = useMemo(() => {
    if (income === 0) {
      return {
        status: 'neutral',
        title: 'Comece cadastrando suas Receitas do Mês',
        message: 'Assim que você lançar seu salário ou entradas, a IA irá calcular automaticamente a distribuição ideal (50/30/20) e as metas de reserva para você!',
      };
    }

    if (expenses > income) {
      const deficit = expenses - income;
      return {
        status: 'danger',
        title: `Atenção: Suas despesas superam sua receita em ${formatCurrency(deficit)}`,
        message: `Com uma receita de ${formatCurrency(income)}, o ideal é manter seus custos totais abaixo deste valor para evitar endividamento. Foque em renegociar despesas não essenciais.`,
      };
    }

    const savingsRate = ((income - expenses) / income) * 100;

    if (savingsRate >= 20) {
      return {
        status: 'success',
        title: `Excelente! Você está economizando ${savingsRate.toFixed(1)}% da sua receita de ${formatCurrency(income)}`,
        message: `Parabéns pela disciplina! Com o saldo de ${formatCurrency(netResult)}, você pode acelerar sua Reserva de Emergência ou aplicar em investimentos de longo prazo.`,
      };
    }

    return {
      status: 'warning',
      title: `Sua taxa de poupança atual é de ${savingsRate.toFixed(1)}% da sua receita`,
      message: `Para atingir a regra de ouro dos 20% (${formatCurrency(budget20)}), tente reduzir despesas supérfluas no próximo mês em cerca de ${formatCurrency(budget20 - netResult)}.`,
    };
  }, [income, expenses, netResult, budget20]);

  return (
    <div className="bg-[#121212] text-white rounded-3xl p-6 shadow-xl border border-[#D4AF37]/30 space-y-6 relative overflow-hidden" id="ai-financial-tips-card">
      {/* Locked Overlay for Expired Trial Users */}
      {!isAllowed && (
        <div className="absolute inset-0 z-20 bg-[#121212]/95 backdrop-blur-md p-6 flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-3 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-2xl">
            <Lock className="w-8 h-8 text-[#D4AF37]" />
          </div>
          <div className="space-y-1.5 max-w-md">
            <h3 className="text-lg font-black text-white font-serif">
              Análises da IA Exclusivas do Plano Pago
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed font-medium">
              Seu período de 90 dias de teste grátis foi concluído. Assine um dos planos a partir de R$ 6,90/mês para desbloquear diagnósticos e simulação de poupança com Inteligência Artificial!
            </p>
          </div>
          <button
            onClick={onOpenPlans}
            className="py-3 px-6 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs rounded-2xl transition cursor-pointer shadow-lg flex items-center gap-2 uppercase tracking-wide border border-[#00A843]"
          >
            <Sparkles className="w-4 h-4 fill-[#121212]" />
            <span>Ver Planos Pro a partir de R$ 6,90/mês</span>
            <ArrowRight className="w-4 h-4 stroke-[3]" />
          </button>
        </div>
      )}

      {/* Background Accent Circle */}
      <div className="absolute -right-16 -top-16 w-64 h-64 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#D4AF37] text-[#121212] rounded-2xl shadow-lg ring-2 ring-[#D4AF37]/40">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="mb-1.5">
              <span className="text-[10px] bg-[#D4AF37]/20 text-[#D4AF37] px-2.5 py-0.5 rounded-full border border-[#D4AF37]/40 font-bold uppercase tracking-wider inline-block">
                Inteligência Financeira
              </span>
            </div>
            <h2 className="text-base font-extrabold text-white font-serif tracking-wide">
              Dicas Sem Filtro para sua Receita do Mês
            </h2>
            <p className="text-xs text-gray-300 mt-0.5">
              Análise personalizada com base na sua receita de <strong className="text-[#00C853] font-serif">{formatCurrency(income)}</strong> em {monthLabel}
            </p>
          </div>
        </div>

        {/* Dynamic Status Badge */}
        <div className="flex items-center gap-2">
          {aiInsights.status === 'success' && (
            <span className="bg-[#00C853]/20 text-[#00C853] border border-[#00C853]/40 px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-[#00C853]" />
              <span>Orçamento Saudável</span>
            </span>
          )}
          {aiInsights.status === 'warning' && (
            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Atenção aos Custos</span>
            </span>
          )}
          {aiInsights.status === 'danger' && (
            <span className="bg-[#FF3D00]/20 text-[#FF3D00] border border-[#FF3D00]/40 px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-[#FF3D00] animate-bounce" />
              <span>Déficit Detectado</span>
            </span>
          )}
        </div>
      </div>

      {/* Primary AI Recommendation Banner */}
      <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 space-y-1">
        <h3 className="text-xs font-extrabold text-[#D4AF37] flex items-center gap-1.5">
          <BrainCircuit className="w-4 h-4 text-[#D4AF37]" />
          <span>{aiInsights.title}</span>
        </h3>
        <p className="text-xs text-gray-200 leading-relaxed">
          {aiInsights.message}
        </p>
      </div>

      {/* Tabs Control */}
      <div className="flex flex-wrap gap-1.5 bg-black/50 p-1.5 rounded-2xl border border-gray-800">
        <button
          type="button"
          onClick={() => setActiveTab('sem_filtro')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'sem_filtro'
              ? 'bg-[#D4AF37] text-[#121212] shadow-md'
              : 'text-gray-300 hover:bg-white/10'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 fill-current" />
          <span>Análise Sem Filtro</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('distribution')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'distribution'
              ? 'bg-[#D4AF37] text-[#121212] shadow-md'
              : 'text-gray-300 hover:bg-white/10'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Regra 50 / 30 / 20</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reserve')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'reserve'
              ? 'bg-[#D4AF37] text-[#121212] shadow-md'
              : 'text-gray-300 hover:bg-white/10'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Meta de Reserva (6M)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tips')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'tips'
              ? 'bg-[#D4AF37] text-[#121212] shadow-md'
              : 'text-gray-300 hover:bg-white/10'
          }`}
        >
          <Lightbulb className="w-3.5 h-3.5" />
          <span>Dicas Sem Filtro</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('savings')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'savings'
              ? 'bg-[#D4AF37] text-[#121212] shadow-md'
              : 'text-gray-300 hover:bg-white/10'
          }`}
        >
          <PiggyBank className="w-3.5 h-3.5" />
          <span>Simulador de Sobra</span>
        </button>
      </div>

      {/* Tab Content 0: Análise Sem Filtro */}
      {activeTab === 'sem_filtro' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between bg-[#1E1E22] p-3 rounded-xl border border-[#D4AF37]/30">
            <span className="text-xs sm:text-sm text-[#D4AF37] font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              Diagnóstico Direto do Orçamento Familiar
            </span>
            <button
              onClick={fetchSemFiltroBudgetAnalysis}
              disabled={isLoadingAdvice}
              className="text-xs text-[#D4AF37] hover:text-white bg-[#D4AF37]/20 hover:bg-[#D4AF37]/40 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold cursor-pointer transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAdvice ? 'animate-spin' : ''}`} />
              <span>Atualizar Análise</span>
            </button>
          </div>

          {isLoadingAdvice ? (
            <div className="py-10 text-center space-y-3 bg-[#18181B] rounded-2xl border border-white/10">
              <div className="w-10 h-10 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-semibold text-gray-200">A IA "Sem Filtro" está auditando seu orçamento...</p>
            </div>
          ) : budgetAdvice ? (
            <div className="space-y-4">
              {/* Pontos Positivos */}
              <div className="p-4 sm:p-5 bg-[#1A231E] border-l-4 border-l-[#00E676] border border-[#00C853]/40 rounded-2xl space-y-3 shadow-lg">
                <div className="flex items-center gap-2.5 text-[#00E676]">
                  <div className="p-1.5 bg-[#00E676]/20 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <h4 className="text-sm font-black uppercase tracking-wider text-white">
                    Pontos Positivos do Orçamento
                  </h4>
                </div>
                <ul className="space-y-2 pl-1">
                  {budgetAdvice.positivePoints?.map((p, i) => (
                    <li key={i} className="text-sm text-gray-100 font-medium leading-relaxed flex items-start gap-2.5">
                      <span className="text-[#00E676] font-extrabold text-base">•</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pontos de Alerta (Onde cortar/ajustar) */}
              <div className="p-4 sm:p-5 bg-[#251A1A] border-l-4 border-l-red-500 border border-red-500/40 rounded-2xl space-y-3 shadow-lg">
                <div className="flex items-center gap-2.5 text-red-400">
                  <div className="p-1.5 bg-red-500/20 rounded-lg">
                    <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <h4 className="text-sm font-black uppercase tracking-wider text-white">
                    Pontos de Alerta (Onde Cortar / Ajustar)
                  </h4>
                </div>
                <ul className="space-y-2 pl-1">
                  {budgetAdvice.warningPoints?.map((w, i) => (
                    <li key={i} className="text-sm text-gray-100 font-medium leading-relaxed flex items-start gap-2.5">
                      <span className="text-red-400 font-extrabold text-base">•</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Dica Sem Filtro para Economizar em Destaque */}
              <div className="p-5 bg-gradient-to-r from-[#211E15] via-[#1C1A14] to-[#211E15] border-2 border-[#D4AF37] rounded-2xl space-y-2.5 shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-2.5 text-[#D4AF37]">
                  <div className="p-1.5 bg-[#D4AF37]/20 rounded-lg">
                    <Lightbulb className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <h4 className="text-sm font-black uppercase tracking-wider text-amber-300">
                    Dica em Evidência para Economizar
                  </h4>
                </div>
                <p className="text-sm sm:text-base font-bold text-white leading-relaxed pl-1">
                  {budgetAdvice.savingTip}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-[#18181B] border border-[#D4AF37]/30 rounded-2xl text-center space-y-3">
              <p className="text-sm text-gray-200 font-medium">Clique para gerar o diagnóstico transparente das suas despesas.</p>
              <button
                onClick={fetchSemFiltroBudgetAnalysis}
                className="px-5 py-2.5 bg-[#D4AF37] text-[#121212] font-black text-sm rounded-xl hover:bg-[#FACC15] transition cursor-pointer shadow-lg"
              >
                Gerar Análise Sem Filtro
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab Content 1: 50/30/20 Distribution */}
      {activeTab === 'distribution' && (
        <div className="space-y-4 animate-in fade-in">
          <p className="text-xs text-gray-300">
            Com base na sua receita mensal de <strong>{formatCurrency(income)}</strong>, veja como seu orçamento deveria ser distribuído segundo a regra financeira tradicional:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 50% Essential */}
            <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-[#D4AF37]">50% Essenciais</span>
                <span className="text-xs font-serif font-extrabold text-white">{formatCurrency(budget50)}</span>
              </div>
              <p className="text-[11px] text-gray-400">Aluguel, luz, feira, remédios e combustível</p>
              <div className="pt-2 text-[10px] font-bold text-[#00C853]">
                Gasto real atual: {formatCurrency(essentialExpenseTotal)}
              </div>
            </div>

            {/* 30% Lifestyle */}
            <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-amber-300">30% Estilo de Vida</span>
                <span className="text-xs font-serif font-extrabold text-white">{formatCurrency(budget30)}</span>
              </div>
              <p className="text-[11px] text-gray-400">Restaurantes, viagens, compras e streaming</p>
              <div className="pt-2 text-[10px] font-bold text-amber-300">
                Gasto real atual: {formatCurrency(lifestyleExpenseTotal)}
              </div>
            </div>

            {/* 20% Investments */}
            <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-[#00C853]">20% Reserva & Futuro</span>
                <span className="text-xs font-serif font-extrabold text-white">{formatCurrency(budget20)}</span>
              </div>
              <p className="text-[11px] text-gray-400">Investimentos, Tesouro, CDB e Reserva</p>
              <div className="pt-2 text-[10px] font-bold text-[#00C853]">
                Aporte sugerido: {formatCurrency(Math.max(0, netResult))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 2: Emergency Fund Goal */}
      {activeTab === 'reserve' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-[#D4AF37] tracking-wider">
                Reserva de Emergência Recomendada pela IA
              </span>
              <h4 className="text-lg font-extrabold text-white font-serif mt-0.5">
                {formatCurrency(recommendedEmergencyFund)}
              </h4>
              <p className="text-xs text-gray-300 mt-1">
                Calculado como 6 meses de cobertura financeira total com base na sua receita atual ({formatCurrency(income)} x 6).
              </p>
            </div>

            <div className="bg-black/60 p-3 rounded-xl border border-[#D4AF37]/30 text-xs space-y-1 shrink-0">
              <div className="text-gray-300 font-bold">Aporte Mensal Recomendado:</div>
              <div className="text-base font-extrabold text-[#00C853] font-serif">
                {formatCurrency(budget20)} / mês
              </div>
              <p className="text-[10px] text-gray-400">Você atinge a meta em aproximadamente 30 meses</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 3: Practical Tips */}
      {activeTab === 'tips' && (
        <div className="space-y-3 animate-in fade-in text-xs">
          <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-start gap-3">
            <div className="p-1.5 bg-[#D4AF37]/20 text-[#D4AF37] rounded-lg shrink-0">
              <Lightbulb className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-white font-bold block">1. Regra das 24 Horas para Compras</strong>
              <span className="text-gray-300">
                Antes de gastar com itens não essenciais acima de {formatCurrency(income * 0.05)}, aguarde 24 horas. 80% dos impulsos de consumo desaparecem após esse período.
              </span>
            </div>
          </div>

          <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-start gap-3">
            <div className="p-1.5 bg-[#D4AF37]/20 text-[#D4AF37] rounded-lg shrink-0">
              <Lightbulb className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-white font-bold block">2. Automatize seu Aporte no Dia do Salário</strong>
              <span className="text-gray-300">
                Assim que receber sua receita de {formatCurrency(income)}, transfira imediatamente {formatCurrency(budget20)} para a conta de investimento/reserva antes de pagar outras contas.
              </span>
            </div>
          </div>

          <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-start gap-3">
            <div className="p-1.5 bg-[#D4AF37]/20 text-[#D4AF37] rounded-lg shrink-0">
              <Lightbulb className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-white font-bold block">3. Audite Assinaturas e Recorrencias</strong>
              <span className="text-gray-300">
                Cancele serviços de streaming ou aplicativos que não usou nos últimos 30 dias. Isso gera uma economia imediata para realocar em objetivos.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 4: Savings Simulator */}
      {activeTab === 'savings' && (
        <div className="space-y-4 animate-in fade-in">
          <p className="text-xs text-gray-300">
            Ajuste a porcentagem da sua receita de <strong>{formatCurrency(income)}</strong> que você deseja poupar por mês para calcular seu patrimônio futuro:
          </p>

          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Porcentagem Poupada: {customGoalPct}% da Receita</span>
              <span className="text-[#00C853] font-serif text-sm">
                {formatCurrency(income * (customGoalPct / 100))} / mês
              </span>
            </div>

            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={customGoalPct}
              onChange={(e) => setCustomGoalPct(Number(e.target.value))}
              className="w-full accent-[#D4AF37] cursor-pointer"
            />

            <div className="grid grid-cols-3 gap-2 text-center pt-2">
              <div className="bg-black/40 p-2.5 rounded-xl border border-white/10">
                <span className="text-[10px] text-gray-400 uppercase block font-bold">Em 6 Meses</span>
                <span className="text-xs font-extrabold text-white font-serif mt-0.5 block">
                  {formatCurrency(income * (customGoalPct / 100) * 6)}
                </span>
              </div>

              <div className="bg-black/40 p-2.5 rounded-xl border border-white/10">
                <span className="text-[10px] text-gray-400 uppercase block font-bold">Em 1 Ano</span>
                <span className="text-xs font-extrabold text-white font-serif mt-0.5 block">
                  {formatCurrency(income * (customGoalPct / 100) * 12)}
                </span>
              </div>

              <div className="bg-black/40 p-2.5 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10">
                <span className="text-[10px] text-[#D4AF37] uppercase block font-bold">Em 2 Anos</span>
                <span className="text-xs font-extrabold text-[#00C853] font-serif mt-0.5 block">
                  {formatCurrency(income * (customGoalPct / 100) * 24)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
