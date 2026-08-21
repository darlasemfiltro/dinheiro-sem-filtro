import React, { useState } from 'react';
import { Calculator, TrendingUp, ShieldCheck, PieChart, Sparkles, DollarSign, Calendar, ArrowRight, Percent, CheckCircle2, RefreshCw, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { formatCurrency } from '../utils/finance';

export const FinancialCalculatorView: React.FC = () => {
  const [activeCalc, setActiveCalc] = useState<'compound' | 'emergency' | 'rule503020' | 'fire'>('compound');

  // --- 1. Juros Compostos State ---
  const [initialInvestment, setInitialInvestment] = useState<number>(1000);
  const [monthlyContribution, setMonthlyContribution] = useState<number>(300);
  const [interestRate, setInterestRate] = useState<number>(10.5); // % ao ano
  const [ratePeriod, setRatePeriod] = useState<'annual' | 'monthly'>('annual');
  const [years, setYears] = useState<number>(5);

  // Calculate Compound Interest
  const monthlyRate = ratePeriod === 'annual' ? Math.pow(1 + interestRate / 100, 1 / 12) - 1 : interestRate / 100;
  const totalMonths = years * 12;

  let totalInvested = initialInvestment;
  let currentBalance = initialInvestment;

  for (let m = 1; m <= totalMonths; m++) {
    currentBalance = currentBalance * (1 + monthlyRate) + monthlyContribution;
    totalInvested += monthlyContribution;
  }

  const totalInterestGained = Math.max(0, currentBalance - totalInvested);
  const estimatedMonthlyPassiveIncome = currentBalance * 0.008; // ~0.8% ao mês

  // Generate yearly simulation timeline data for AreaChart
  const chartTimelineData = [];
  let simBalance = initialInvestment;
  let simInvested = initialInvestment;

  chartTimelineData.push({
    year: 'Início',
    'Total Investido': Math.round(simInvested),
    'Juros Compostos': 0,
    'Total Acumulado': Math.round(simBalance),
  });

  for (let y = 1; y <= years; y++) {
    for (let m = 1; m <= 12; m++) {
      simBalance = simBalance * (1 + monthlyRate) + monthlyContribution;
      simInvested += monthlyContribution;
    }
    const simInterest = Math.max(0, simBalance - simInvested);
    chartTimelineData.push({
      year: `Ano ${y}`,
      'Total Investido': Math.round(simInvested),
      'Juros Compostos': Math.round(simInterest),
      'Total Acumulado': Math.round(simBalance),
    });
  }

  // --- 2. Reserva de Emergência State ---
  const [essentialMonthlyExpense, setEssentialMonthlyExpense] = useState<number>(3000);
  const [targetMonths, setTargetMonths] = useState<number>(6); // 3, 6, 12
  const targetReserve = essentialMonthlyExpense * targetMonths;

  // --- 3. Regra 50/30/20 State ---
  const [monthlyIncome, setMonthlyIncome] = useState<number>(5000);
  const needs50 = monthlyIncome * 0.5;
  const wants30 = monthlyIncome * 0.3;
  const savings20 = monthlyIncome * 0.2;

  // --- 4. Independência Financeira (FIRE) State ---
  const [desiredPassiveIncome, setDesiredPassiveIncome] = useState<number>(4000);
  const [withdrawalRate, setWithdrawalRate] = useState<number>(4); // Regra dos 4%
  const requiredFireFund = (desiredPassiveIncome * 12) / (withdrawalRate / 100);

  return (
    <div className="space-y-8 pb-12 animate-in fade-in" id="financial-calculator-view">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-[#121212] via-[#2A2210] to-[#121212] p-6 sm:p-8 rounded-3xl text-white shadow-xl border-2 border-[#D4AF37]/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#00C853]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 text-xs font-black uppercase tracking-wider">
              <Calculator className="w-4 h-4 text-[#D4AF37]" />
              <span>Simuladores e Ferramentas Financeiras</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-serif text-white tracking-tight">
              Calculadora Financeira Sem Filtro
            </h1>
            <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed font-medium">
              Projete seu futuro financeiro com simulações de juros compostos, reserva de emergência, orçamento 50/30/20 e meta de aposentadoria!
            </p>
          </div>
        </div>

        {/* Calculator Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-6 border-t border-white/10 mt-6">
          <button
            onClick={() => setActiveCalc('compound')}
            className={`py-3 px-3 rounded-2xl text-xs font-black transition flex flex-col items-center justify-center gap-1.5 cursor-pointer border ${
              activeCalc === 'compound'
                ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37] shadow-lg'
                : 'bg-white/5 hover:bg-white/10 text-white border-white/10'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Juros Compostos</span>
          </button>

          <button
            onClick={() => setActiveCalc('emergency')}
            className={`py-3 px-3 rounded-2xl text-xs font-black transition flex flex-col items-center justify-center gap-1.5 cursor-pointer border ${
              activeCalc === 'emergency'
                ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37] shadow-lg'
                : 'bg-white/5 hover:bg-white/10 text-white border-white/10'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Reserva de Emergência</span>
          </button>

          <button
            onClick={() => setActiveCalc('rule503020')}
            className={`py-3 px-3 rounded-2xl text-xs font-black transition flex flex-col items-center justify-center gap-1.5 cursor-pointer border ${
              activeCalc === 'rule503020'
                ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37] shadow-lg'
                : 'bg-white/5 hover:bg-white/10 text-white border-white/10'
            }`}
          >
            <PieChart className="w-4 h-4" />
            <span>Regra 50 / 30 / 20</span>
          </button>

          <button
            onClick={() => setActiveCalc('fire')}
            className={`py-3 px-3 rounded-2xl text-xs font-black transition flex flex-col items-center justify-center gap-1.5 cursor-pointer border ${
              activeCalc === 'fire'
                ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37] shadow-lg'
                : 'bg-white/5 hover:bg-white/10 text-white border-white/10'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Independência Financeira</span>
          </button>
        </div>
      </div>

      {/* 1. CALCULADORA DE JUROS COMPOSTOS */}
      {activeCalc === 'compound' && (
        <div className="bg-white border-2 border-[#D4AF37]/60 rounded-3xl p-6 sm:p-8 shadow-md space-y-6">
          <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-[#121212] font-serif flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-[#00C853]" />
                Simulador de Juros Compostos
              </h2>
              <p className="text-xs text-gray-600 mt-1">Veja o poder dos aportes mensais com rendimento composto ao longo do tempo.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Form Inputs */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#121212] mb-1">Valor Inicial (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-gray-500 font-bold">R$</span>
                  <input
                    type="number"
                    value={initialInvestment || ''}
                    onChange={(e) => setInitialInvestment(Number(e.target.value) || 0)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-[#121212] focus:ring-2 focus:ring-[#D4AF37] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#121212] mb-1">Aporte Mensal (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-gray-500 font-bold">R$</span>
                  <input
                    type="number"
                    value={monthlyContribution || ''}
                    onChange={(e) => setMonthlyContribution(Number(e.target.value) || 0)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-[#121212] focus:ring-2 focus:ring-[#D4AF37] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#121212] mb-1">Taxa de Juros (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={interestRate || ''}
                    onChange={(e) => setInterestRate(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-[#121212] focus:ring-2 focus:ring-[#D4AF37] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#121212] mb-1">Período da Taxa</label>
                  <select
                    value={ratePeriod}
                    onChange={(e) => setRatePeriod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-[#121212] focus:ring-2 focus:ring-[#D4AF37] outline-none cursor-pointer"
                  >
                    <option value="annual">Ao Ano (%)</option>
                    <option value="monthly">Ao Mês (%)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#121212] mb-1">Prazo (em Anos)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={years || ''}
                  onChange={(e) => setYears(Number(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-[#121212] focus:ring-2 focus:ring-[#D4AF37] outline-none"
                />
              </div>
            </div>

            {/* Simulation Results Card */}
            <div className="bg-gradient-to-br from-[#121212] to-[#241E10] text-white p-6 rounded-3xl border border-[#D4AF37]/50 flex flex-col justify-between space-y-4 shadow-xl">
              <div className="space-y-4">
                <span className="text-[10px] uppercase font-black tracking-wider text-[#00C853] bg-[#00C853]/20 px-2.5 py-1 rounded-md inline-block border border-[#00C853]/40">
                  Resultado Estimado em {years} anos ({totalMonths} meses)
                </span>

                <div className="space-y-1">
                  <p className="text-xs text-gray-300 font-bold">Valor Total Acumulado:</p>
                  <p className="text-3xl sm:text-4xl font-black text-[#00C853] font-serif">
                    {formatCurrency(currentBalance)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10 text-xs">
                  <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                    <p className="text-gray-400 text-[11px] font-bold">Total Investido (Do seu bolso):</p>
                    <p className="text-sm font-extrabold text-white font-serif mt-1">
                      {formatCurrency(totalInvested)}
                    </p>
                  </div>

                  <div className="p-3 bg-[#00C853]/10 rounded-2xl border border-[#00C853]/30">
                    <p className="text-emerald-400 text-[11px] font-bold">Total Ganho em Juros:</p>
                    <p className="text-sm font-extrabold text-[#00C853] font-serif mt-1">
                      +{formatCurrency(totalInterestGained)}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-200">
                  <p className="font-bold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                    Renda Mensal Estimada Sem Tocar no Capital:
                  </p>
                  <p className="text-lg font-black text-[#D4AF37] font-serif mt-1">
                    ~{formatCurrency(estimatedMonthlyPassiveIncome)} / mês
                  </p>
                </div>
              </div>

              {/* Visual Proportion Bar */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-[10px] font-bold text-gray-300">
                  <span>Investido ({Math.round((totalInvested / currentBalance) * 100)}%)</span>
                  <span>Juros ({Math.round((totalInterestGained / currentBalance) * 100)}%)</span>
                </div>
                <div className="w-full bg-gray-700 h-3 rounded-full overflow-hidden flex">
                  <div
                    className="bg-blue-500 h-full"
                    style={{ width: `${(totalInvested / currentBalance) * 100}%` }}
                    title="Total do seu bolso"
                  />
                  <div
                    className="bg-[#00C853] h-full"
                    style={{ width: `${(totalInterestGained / currentBalance) * 100}%` }}
                    title="Juros gerados"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Gráfico Dinâmico de Crescimento do Patrimônio */}
          <div className="pt-6 border-t border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[#121212] font-serif flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-[#D4AF37]" />
                Evolução do Patrimônio ao Longo do Tempo ({years} Anos)
              </h3>
              <span className="text-[11px] font-extrabold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full border border-gray-200">
                Visualização Dinâmica
              </span>
            </div>

            <div className="bg-[#121212] p-4 sm:p-6 rounded-3xl border-2 border-[#D4AF37]/40 shadow-inner">
              <div className="h-64 sm:h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartTimelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1} />
                      </linearGradient>
                      <linearGradient id="colorInterest" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00C853" stopOpacity={0.9} />
                        <stop offset="95%" stopColor="#00C853" stopOpacity={0.2} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="year" stroke="#9CA3AF" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                    <YAxis
                      stroke="#9CA3AF"
                      tick={{ fontSize: 10, fontWeight: 'bold' }}
                      tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181B', borderColor: '#D4AF37', borderRadius: '1rem', color: '#FFF' }}
                      formatter={(val: any) => [formatCurrency(Number(val) || 0), '']}
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px', fontWeight: 'bold' }} />
                    <Area
                      type="monotone"
                      dataKey="Total Investido"
                      stackId="1"
                      stroke="#3B82F6"
                      fillOpacity={1}
                      fill="url(#colorInvested)"
                    />
                    <Area
                      type="monotone"
                      dataKey="Juros Compostos"
                      stackId="1"
                      stroke="#00C853"
                      fillOpacity={1}
                      fill="url(#colorInterest)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. CALCULADORA DE RESERVA DE EMERGÊNCIA */}
      {activeCalc === 'emergency' && (
        <div className="bg-white border-2 border-[#D4AF37]/60 rounded-3xl p-6 sm:p-8 shadow-md space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h2 className="text-xl font-extrabold text-[#121212] font-serif flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-emerald-700" />
              Calculadora de Reserva de Emergência
            </h2>
            <p className="text-xs text-gray-600 mt-1">Descubra exatamente de quanto você precisa para ter paz de espírito e segurança financeira.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#121212] mb-1">Custo de Vida Essencial Mensal (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-gray-500 font-bold">R$</span>
                  <input
                    type="number"
                    value={essentialMonthlyExpense || ''}
                    onChange={(e) => setEssentialMonthlyExpense(Number(e.target.value) || 0)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-[#121212] focus:ring-2 focus:ring-[#D4AF37] outline-none"
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">Inclua apenas gastos indispensáveis (Aluguel, Comida, Contas básicas, Saúde).</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#121212] mb-1">Meses de Cobertura Desejados</label>
                <div className="grid grid-cols-3 gap-2">
                  {[3, 6, 12].map((m) => (
                    <button
                      key={m}
                      onClick={() => setTargetMonths(m)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold cursor-pointer transition border ${
                        targetMonths === m
                          ? 'bg-[#121212] text-[#D4AF37] border-[#121212] font-black'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {m} Meses {m === 6 ? '(Recomendado)' : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-[#FAFAFA] border border-gray-200 p-6 rounded-3xl flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <span className="text-[10px] uppercase font-black tracking-wider text-[#121212] bg-[#D4AF37]/30 border border-[#D4AF37]/50 px-2.5 py-1 rounded-md inline-block">
                  Meta da sua Reserva
                </span>

                <div className="space-y-1">
                  <p className="text-xs text-gray-600 font-bold">Valor Alvo para {targetMonths} Meses de Tranquilidade:</p>
                  <p className="text-3xl font-black text-[#121212] font-serif">
                    {formatCurrency(targetReserve)}
                  </p>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#00C853]" />
                    Onde Guardar sua Reserva de Emergência?
                  </p>
                  <p className="text-[11px] leading-relaxed text-gray-700">
                    Sua reserva deve ficar em investimentos com <strong>Liquidez Diária</strong> e baixíssimo risco, como Tesouro SELIC ou CDB 100% do CDI.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. CALCULADORA REGRA 50/30/20 */}
      {activeCalc === 'rule503020' && (
        <div className="bg-white border-2 border-[#D4AF37]/60 rounded-3xl p-6 sm:p-8 shadow-md space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h2 className="text-xl font-extrabold text-[#121212] font-serif flex items-center gap-2">
              <PieChart className="w-6 h-6 text-amber-600" />
              Divisão Ideal de Orçamento (Regra 50 / 30 / 20)
            </h2>
            <p className="text-xs text-gray-600 mt-1">A regra de ouro da saúde financeira para equilibrar necessidades, estilo de vida e futuro.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-[#121212] mb-1">Sua Receita Mensal Líquida (R$)</label>
              <div className="relative max-w-md">
                <span className="absolute left-3 top-2.5 text-xs text-gray-500 font-bold">R$</span>
                <input
                  type="number"
                  value={monthlyIncome || ''}
                  onChange={(e) => setMonthlyIncome(Number(e.target.value) || 0)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-[#121212] focus:ring-2 focus:ring-[#D4AF37] outline-none"
                />
              </div>
            </div>

            {/* 50% Necessidades */}
            <div className="bg-[#FAFAFA] border border-blue-200 p-5 rounded-3xl space-y-3">
              <span className="text-[10px] uppercase font-black tracking-wider text-blue-700 bg-blue-100 px-2.5 py-1 rounded-md inline-block">
                50% - Necessidades Básicas
              </span>
              <p className="text-2xl font-black text-[#121212] font-serif">
                {formatCurrency(needs50)}
              </p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Moradia, mercado, saúde, transporte essencial e contas fixas que não podem ser cortadas.
              </p>
            </div>

            {/* 30% Desejos */}
            <div className="bg-[#FAFAFA] border border-amber-200 p-5 rounded-3xl space-y-3">
              <span className="text-[10px] uppercase font-black tracking-wider text-amber-800 bg-amber-100 px-2.5 py-1 rounded-md inline-block">
                30% - Desejos & Estilo de Vida
              </span>
              <p className="text-2xl font-black text-[#121212] font-serif">
                {formatCurrency(wants30)}
              </p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Lazer, restaurantes, viagens, assinaturas de streaming, compras e hobbies.
              </p>
            </div>

            {/* 20% Poupança/Investimentos */}
            <div className="bg-[#FAFAFA] border border-emerald-200 p-5 rounded-3xl space-y-3">
              <span className="text-[10px] uppercase font-black tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-md inline-block">
                20% - Futuro & Investimentos
              </span>
              <p className="text-2xl font-black text-[#00C853] font-serif">
                {formatCurrency(savings20)}
              </p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Construção da sua Reserva de Emergência, aportes para aposentadoria e metas financeiras.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. CALCULADORA DE INDEPENDÊNCIA FINANCEIRA (FIRE) */}
      {activeCalc === 'fire' && (
        <div className="bg-white border-2 border-[#D4AF37]/60 rounded-3xl p-6 sm:p-8 shadow-md space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h2 className="text-xl font-extrabold text-[#121212] font-serif flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-[#D4AF37]" />
              Calculadora de Independência Financeira (Regra dos 4%)
            </h2>
            <p className="text-xs text-gray-600 mt-1">Descubra qual o montante acumulado você precisa para viver exclusivamente dos rendimentos de seus investimentos.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#121212] mb-1">Renda Mensal Passiva Desejada (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-gray-500 font-bold">R$</span>
                  <input
                    type="number"
                    value={desiredPassiveIncome || ''}
                    onChange={(e) => setDesiredPassiveIncome(Number(e.target.value) || 0)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-[#121212] focus:ring-2 focus:ring-[#D4AF37] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#121212] mb-1">Taxa Segura de Retirada Anual (%)</label>
                <select
                  value={withdrawalRate}
                  onChange={(e) => setWithdrawalRate(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-[#121212] focus:ring-2 focus:ring-[#D4AF37] outline-none cursor-pointer"
                >
                  <option value={4}>4% ao ano (Regra padrão Trinity)</option>
                  <option value={5}>5% ao ano (Agressivo)</option>
                  <option value={3}>3% ao ano (Conservador)</option>
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  A regra dos 4% é baseada no estudo Trinity, sugerindo que uma retirada anual de 4% do patrimônio investido garante sua perpetuidade.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-[#121212] to-black text-white p-6 rounded-3xl border border-[#D4AF37]/50 flex flex-col justify-between space-y-4 shadow-xl">
              <div className="space-y-3">
                <span className="text-[10px] uppercase font-black tracking-wider text-[#D4AF37] bg-[#D4AF37]/20 px-2.5 py-1 rounded-md inline-block border border-[#D4AF37]/40">
                  Patrimônio Necessário para Aposentadoria
                </span>

                <div className="space-y-1">
                  <p className="text-xs text-gray-300 font-bold">Montante Total Acumulado Alvo:</p>
                  <p className="text-3xl sm:text-4xl font-black text-[#00C853] font-serif">
                    {formatCurrency(requiredFireFund)}
                  </p>
                </div>

                <p className="text-xs text-gray-300 leading-relaxed pt-3 border-t border-white/10 font-medium">
                  Com esse valor acumulado investido com retorno líquido seguro, você pode retirar <strong>{formatCurrency(desiredPassiveIncome)}/mês</strong> indefinidamente sem ver seu patrimônio encolher!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
