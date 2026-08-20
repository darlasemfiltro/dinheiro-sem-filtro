import React, { useState, useEffect } from 'react';
import { Sparkles, Briefcase, WalletCards, RefreshCw, CheckCircle2, ShieldAlert, AlertTriangle, ArrowRight, Lightbulb, HeartHandshake } from 'lucide-react';
import { MonthSummary, Transaction, Category, User, AIPortfolioAdvice, AIBudgetAdvice } from '../types';
import { MonthlyAiTipsCard } from './MonthlyAiTipsCard';
import { PortfolioStorageService } from '../services/portfolioStorage';

interface AiTipsViewProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  summary: MonthSummary;
  transactions: Transaction[];
  categories: Category[];
  currentYear: number;
  currentMonth: number;
  user?: User | null;
  userId: string;
}

export const AiTipsView: React.FC<AiTipsViewProps> = ({
  activeTab,
  setActiveTab,
  summary,
  transactions,
  categories,
  currentYear,
  currentMonth,
  user,
  userId,
}) => {
  // Determine initial subtab from activeTab prop (e.g. 'ai-tips:investidor' or default 'orcamento')
  const initialSubTab = activeTab.includes(':') ? activeTab.split(':')[1] : 'orcamento';
  const [subTab, setSubTab] = useState<'orcamento' | 'investidor'>(
    initialSubTab === 'investidor' ? 'investidor' : 'orcamento'
  );

  useEffect(() => {
    if (activeTab.includes(':')) {
      const sub = activeTab.split(':')[1];
      if (sub === 'investidor' || sub === 'orcamento') {
        setSubTab(sub);
      }
    }
  }, [activeTab]);

  const handleSubTabChange = (tab: 'orcamento' | 'investidor') => {
    setSubTab(tab);
    setActiveTab(`ai-tips:${tab}`);
  };

  // State for Portfolio AI Analysis
  const [portfolioAdvice, setPortfolioAdvice] = useState<AIPortfolioAdvice | null>(null);
  const [isGeneratingPortfolio, setIsGeneratingPortfolio] = useState<boolean>(false);

  const assets = PortfolioStorageService.getAssets(userId);
  const targetAllocations = PortfolioStorageService.getTargetAllocations(userId);
  const totalEquity = assets.reduce((acc, a) => acc + (a.currentPrice * a.quantity), 0);
  const dividends = PortfolioStorageService.getDividends(userId);
  const totalReceivedDividends = dividends
    .filter(d => d.status === 'received')
    .reduce((acc, d) => acc + d.totalValue, 0);

  const generateClientPortfolioAnalysis = (): AIPortfolioAdvice => {
    const totalVal = assets.reduce((acc, a) => acc + (a.currentPrice * a.quantity), 0) || 1;
    const cryptoVal = assets.filter((a) => a.category === 'cripto').reduce((acc, a) => acc + (a.currentPrice * a.quantity), 0);
    const cryptoPct = (cryptoVal / totalVal) * 100;

    const stocksVal = assets.filter((a) => a.category === 'acoes').reduce((acc, a) => acc + (a.currentPrice * a.quantity), 0);
    const stocksPct = (stocksVal / totalVal) * 100;

    const fiisVal = assets.filter((a) => a.category === 'fiis').reduce((acc, a) => acc + (a.currentPrice * a.quantity), 0);
    const fiisPct = (fiisVal / totalVal) * 100;

    const usdVal = assets.filter((a) => a.category === 'stocks' || a.category === 'etf_exterior').reduce((acc, a) => acc + (a.currentPrice * a.quantity), 0);
    const usdPct = (usdVal / totalVal) * 100;

    const fixedVal = assets.filter((a) => a.category === 'tesouro').reduce((acc, a) => acc + (a.currentPrice * a.quantity), 0);
    const fixedPct = (fixedVal / totalVal) * 100;

    let score = 85;
    let healthStatus: 'Excelente' | 'Equilibrada' | 'Atenção' | 'Alto Risco' = 'Equilibrada';

    if (cryptoPct > 25) {
      score -= 15;
      healthStatus = 'Atenção';
    } else if (assets.length >= 3 && fixedPct >= 10) {
      healthStatus = 'Excelente';
    }

    const positivePoints: string[] = [
      `Patrimônio total cadastrado de R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} distribuído em ${assets.length} ativos.`,
      fiisPct > 0 ? `Projeção de fluxo de proventos com ${fiisPct.toFixed(1)}% em Fundos Imobiliários.` : 'Carteira em fase de consolidação patrimonial.',
    ];

    if (fixedPct > 10) {
      positivePoints.push(`Reserva e Renda Fixa (${fixedPct.toFixed(1)}%) promovendo resiliência contra volatilidade.`);
    }

    const warningPoints: string[] = [];
    if (cryptoPct > 20) {
      warningPoints.push(`Elevada exposição em Criptoativos (${cryptoPct.toFixed(1)}%), o que aumenta a oscilação no curto prazo.`);
    }
    if (fixedPct < 10) {
      warningPoints.push(`Parcela em Tesouro/Renda Fixa (${fixedPct.toFixed(1)}%) abaixo da margem de proteção recomendada.`);
    }
    if (warningPoints.length === 0) {
      warningPoints.push('Monitore a proporção individual de cada ativo para evitar concentração num único ticker.');
    }

    const studyTips: string[] = [
      'Estudar estratégias de rebalanceamento por novos aportes direcionados aos ativos em deságio.',
      'Avaliar indicadores de sustentabilidade de proventos em Fundos Imobiliários e Ações de dividendos.',
      'Analisar a proteção cambial da carteira através de alocação em ativos globais.',
    ];

    return {
      score,
      healthStatus,
      summary: `Sua carteira possui R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} investidos com foco em rentabilidade e construção patrimonial.`,
      positivePoints,
      warningPoints,
      studyTips,
      disclaimer: "⚠️ Aviso importante: Esta análise e as dicas fornecidas possuem caráter estritamente educacional e informativo, e não constituem recomendação de investimento ou indicação de compra e venda de ativos de acordo com o mercado.",
      diversificationAnalysis: `Sua distribuição conta com ${cryptoPct.toFixed(1)}% em Cripto, ${stocksPct.toFixed(1)}% em Ações BR, ${fiisPct.toFixed(1)}% em FIIs, ${usdPct.toFixed(1)}% em Dólar e ${fixedPct.toFixed(1)}% em Renda Fixa.`,
      riskReturnAnalysis: cryptoPct > 15
        ? 'A exposição a Cripto traz volatilidade relevante. Recomenda-se acompanhamento sistemático de rebalanceamento.'
        : 'Perfil de risco balanceado com volatilidade controlada.',
      dividendAnalysis: 'Projeção contínua de reinvestimento de proventos.',
      currencyExposure: `Proteção em Dólar/Exterior de ${usdPct.toFixed(1)}%.`,
      rebalancingTips: [],
      actionableTips: [
        'Reinvista os proventos para acelerar os juros compostos.',
        'Priorize novos aportes nos ativos que estão mais distantes das suas metas de alocação.',
      ],
      generatedAt: new Date().toISOString(),
    };
  };

  const fetchPortfolioAnalysis = async () => {
    setIsGeneratingPortfolio(true);
    try {
      const res = await fetch('/api/portfolio/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assets,
          totalEquity,
          monthlyDividends: totalReceivedDividends,
          targetAllocations,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.advice) {
          setPortfolioAdvice(data.advice);
          setIsGeneratingPortfolio(false);
          return;
        }
      }
    } catch (err) {
      console.error('[Portfolio AI Analysis Error]', err);
    }

    // Fallback to instant client analysis if server response fails
    setPortfolioAdvice(generateClientPortfolioAnalysis());
    setIsGeneratingPortfolio(false);
  };

  useEffect(() => {
    if (subTab === 'investidor' && !portfolioAdvice && !isGeneratingPortfolio) {
      fetchPortfolioAnalysis();
    }
  }, [subTab]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="p-6 bg-gradient-to-r from-[#121212] via-[#18181B] to-[#121212] border-2 border-[#D4AF37] rounded-3xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#D4AF37] text-[#121212] rounded-xl shadow-md">
              <Sparkles className="w-5 h-5 stroke-[3]" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white font-serif tracking-wide">
              CENTRAL DE DICAS SEM FILTRO
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-300">
            Diagnósticos transparentes, alertas diretos e orientações práticas para seu dinheiro e investimentos.
          </p>
        </div>

        {/* Submenu Pill Nav */}
        <div className="flex items-center gap-2 bg-[#18181B] p-1.5 border border-[#D4AF37]/50 rounded-2xl w-full md:w-auto shadow-inner">
          <button
            onClick={() => handleSubTabChange('orcamento')}
            className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer ${
              subTab === 'orcamento'
                ? 'bg-[#D4AF37] text-[#121212] shadow-lg'
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Briefcase className="w-4 h-4 stroke-[2.5]" />
            <span>ORÇAMENTO FAMILIAR</span>
          </button>

          <button
            onClick={() => handleSubTabChange('investidor')}
            className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer ${
              subTab === 'investidor'
                ? 'bg-[#D4AF37] text-[#121212] shadow-lg'
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <WalletCards className="w-4 h-4 stroke-[2.5]" />
            <span>CARTEIRA DO INVESTIDOR</span>
          </button>
        </div>
      </div>

      {/* Submenu Content 1: ORÇAMENTO FAMILIAR */}
      {subTab === 'orcamento' && (
        <div className="space-y-6 animate-in fade-in">
          <MonthlyAiTipsCard
            summary={summary}
            transactions={transactions}
            categories={categories}
            currentYear={currentYear}
            currentMonth={currentMonth}
            user={user}
            onOpenPlans={() => setActiveTab('plans')}
          />
        </div>
      )}

      {/* Submenu Content 2: CARTEIRA DO INVESTIDOR */}
      {subTab === 'investidor' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="p-5 bg-[#18181B] border border-[#D4AF37]/40 rounded-3xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#D4AF37]/20 border border-[#D4AF37] text-[#D4AF37] rounded-2xl">
                <WalletCards className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-black text-white font-serif">DIAGNÓSTICO DA CARTEIRA DO INVESTIDOR</h3>
                <p className="text-xs text-gray-400">Diagnóstico educacional de diversificação, risco x retorno e rebalanceamento</p>
              </div>
            </div>

            <button
              onClick={fetchPortfolioAnalysis}
              disabled={isGeneratingPortfolio}
              className="w-full sm:w-auto px-4 py-2.5 bg-[#D4AF37] hover:bg-[#FACC15] text-[#121212] font-black text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isGeneratingPortfolio ? 'animate-spin' : ''}`} />
              <span>{isGeneratingPortfolio ? 'Analisando...' : 'Recalcular Análise Sem Filtro'}</span>
            </button>
          </div>

          {/* Disclaimer Bar */}
          <div className="p-3 bg-[#1C180A] border border-[#D4AF37]/30 rounded-2xl flex items-center gap-2.5 text-xs text-amber-200/90 font-medium">
            <AlertTriangle className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span>
              <strong>Aviso:</strong> A análise e as dicas fornecidas têm caráter estritamente educativo e informativo, e <strong>não constituem recomendação de investimento de acordo com o mercado</strong>.
            </span>
          </div>

          {isGeneratingPortfolio ? (
            <div className="py-16 text-center space-y-4 bg-[#18181B] rounded-3xl border border-white/10 shadow-xl">
              <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
              <h3 className="text-base font-bold text-white">Gerando Análise Sem Filtro para a Carteira do Investidor...</h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                Avaliando exposição a ativos, renda fixa, cripto, FIIs e projeção de dividendos.
              </p>
            </div>
          ) : portfolioAdvice ? (
            <div className="space-y-4">
              {/* Score Header Card */}
              <div className="p-5 bg-gradient-to-r from-[#18181B] to-[#27272A] border border-[#D4AF37]/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-black">Score de Saúde da Carteira</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                      portfolioAdvice.healthStatus === 'Excelente' ? 'bg-[#00C853]/20 text-[#00E676] border border-[#00C853]' :
                      portfolioAdvice.healthStatus === 'Equilibrada' ? 'bg-blue-500/20 text-blue-400 border border-blue-500' :
                      'bg-amber-500/20 text-amber-400 border border-amber-500'
                    }`}>
                      {portfolioAdvice.healthStatus}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-200 leading-relaxed max-w-xl">
                    {portfolioAdvice.summary}
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center bg-[#121212] px-6 py-3 rounded-2xl border border-[#D4AF37]/50 shrink-0 shadow-md">
                  <span className="text-3xl font-black text-[#D4AF37]">{portfolioAdvice.score}<span className="text-xs text-gray-500 font-normal">/100</span></span>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Diagnóstico</span>
                </div>
              </div>

              {/* Pontos Fortes da Carteira */}
              <div className="p-5 bg-[#1A231E] border-l-4 border-l-[#00E676] border border-[#00C853]/40 rounded-2xl space-y-3 shadow-lg">
                <div className="flex items-center gap-2.5 text-[#00E676]">
                  <div className="p-1.5 bg-[#00E676]/20 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <h4 className="text-sm font-black uppercase tracking-wider text-white">Pontos Fortes da Carteira</h4>
                </div>
                <ul className="space-y-2 pl-1">
                  {portfolioAdvice.positivePoints && portfolioAdvice.positivePoints.length > 0 ? (
                    portfolioAdvice.positivePoints.map((item, idx) => (
                      <li key={idx} className="text-sm text-gray-100 font-medium leading-relaxed flex items-start gap-2.5">
                        <span className="text-[#00E676] font-extrabold text-base">•</span>
                        <span>{item}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-gray-200 leading-relaxed">• Patrimônio em crescimento continuo.</li>
                  )}
                </ul>
              </div>

              {/* Pontos de Atenção e Riscos */}
              <div className="p-5 bg-[#251A1A] border-l-4 border-l-red-500 border border-red-500/40 rounded-2xl space-y-3 shadow-lg">
                <div className="flex items-center gap-2.5 text-red-400">
                  <div className="p-1.5 bg-red-500/20 rounded-lg">
                    <ShieldAlert className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <h4 className="text-sm font-black uppercase tracking-wider text-white">Pontos de Atenção e Riscos</h4>
                </div>
                <ul className="space-y-2 pl-1">
                  {portfolioAdvice.warningPoints && portfolioAdvice.warningPoints.length > 0 ? (
                    portfolioAdvice.warningPoints.map((item, idx) => (
                      <li key={idx} className="text-sm text-gray-100 font-medium leading-relaxed flex items-start gap-2.5">
                        <span className="text-red-400 font-extrabold text-base">•</span>
                        <span>{item}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-gray-200 leading-relaxed">• Acompanhe a volatilidade dos ativos.</li>
                  )}
                </ul>
              </div>

              {/* Dicas de Estudo para a Sua Alocação */}
              <div className="p-5 bg-gradient-to-r from-[#211E15] via-[#1C1A14] to-[#211E15] border-2 border-[#D4AF37] rounded-2xl space-y-3 shadow-xl">
                <div className="flex items-center gap-2.5 text-[#D4AF37]">
                  <div className="p-1.5 bg-[#D4AF37]/20 rounded-lg">
                    <Sparkles className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <h4 className="text-sm font-black uppercase tracking-wider text-amber-300">💡 Dicas de Estudo em Evidência</h4>
                </div>
                <ul className="space-y-2 pl-1">
                  {portfolioAdvice.studyTips && portfolioAdvice.studyTips.length > 0 ? (
                    portfolioAdvice.studyTips.map((tip, idx) => (
                      <li key={idx} className="text-sm sm:text-base font-bold text-white leading-relaxed flex items-start gap-2.5">
                        <ArrowRight className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                        <span>{tip}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm font-bold text-white">• Pesquise sobre estratégias de rebalanceamento passivo por novos aportes.</li>
                  )}
                </ul>
              </div>

              {/* Disclaimer Legal */}
              <div className="p-5 bg-[#14120C] border-2 border-amber-500/50 rounded-2xl space-y-2 shadow-xl">
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-300">Disclaimer (Aviso Legal)</h4>
                </div>
                <p className="text-xs sm:text-sm text-amber-200/90 leading-relaxed font-medium">
                  {portfolioAdvice.disclaimer || "⚠️ Aviso importante: Esta análise e as dicas fornecidas possuem caráter estritamente educacional e informativo, e não constituem recomendação de investimento ou indicação de compra e venda de ativos de acordo com o mercado."}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-8 bg-[#18181B] border border-[#D4AF37]/30 rounded-3xl text-center space-y-4 shadow-xl max-w-xl mx-auto">
              <p className="text-sm text-gray-200 font-medium">Clique para gerar o diagnóstico Sem Filtro para a sua Carteira de Investimentos.</p>
              <p className="text-xs text-amber-200/80 font-medium">
                ⚠️ As análises e dicas do aplicativo têm caráter estritamente educativo e informativo, e <strong>não são recomendações de investimento de acordo com o mercado</strong>.
              </p>
              <button
                onClick={fetchPortfolioAnalysis}
                className="px-6 py-3 bg-[#D4AF37] hover:bg-[#FACC15] text-[#121212] font-black text-sm rounded-xl transition shadow-lg cursor-pointer"
              >
                Gerar Análise Sem Filtro
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
