import React, { useState } from 'react';
import { X, Sparkles, RefreshCw, AlertTriangle, CheckCircle2, TrendingUp, ShieldAlert, PieChart, DollarSign, ArrowRight } from 'lucide-react';
import { AIPortfolioAdvice, InvestmentAsset } from '../types';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../services/portfolioStorage';

interface AIPortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
  advice: AIPortfolioAdvice | null;
  onRefreshAIAdvice: () => void;
  isGenerating: boolean;
  assets: InvestmentAsset[];
  totalEquity: number;
}

export const AIPortfolioModal: React.FC<AIPortfolioModalProps> = ({
  isOpen,
  onClose,
  advice,
  onRefreshAIAdvice,
  isGenerating,
  assets,
  totalEquity,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#121212] text-white border-2 border-[#D4AF37] w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#D4AF37]/30 flex items-center justify-between bg-[#18181B]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#D4AF37] text-[#121212] rounded-2xl shadow-md">
              <Sparkles className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-wide font-serif text-white">DICAS SEM FILTRO DA CARTEIRA</h2>
              <p className="text-xs text-gray-400">Diagnóstico de diversificação, risco x retorno e rebalanceamento</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefreshAIAdvice}
              disabled={isGenerating}
              className="p-2 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/60 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#121212] transition flex items-center gap-1.5 text-xs font-black cursor-pointer disabled:opacity-50"
              title="Recalcular Análise Sem Filtro"
            >
              <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isGenerating ? 'Analisando...' : 'Recalcular Análise Sem Filtro'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-[#D4AF37] text-white hover:text-[#121212] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>



        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {isGenerating ? (
            <div className="py-16 text-center space-y-4">
              <div className="w-16 h-16 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
              <h3 className="text-base font-bold text-white">Consultando Inteligência Artificial Financeira...</h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                Avaliando exposição a ativos de risco, liquidez, distribuição em moedas fortes e fluxo de proventos.
              </p>
            </div>
          ) : advice ? (
            <>
              {/* Score Header Card */}
              <div className="p-5 bg-gradient-to-r from-[#18181B] to-[#27272A] border border-[#D4AF37]/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-black">Score de Saúde da Carteira</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                      advice.healthStatus === 'Excelente' ? 'bg-[#00C853]/20 text-[#00E676] border border-[#00C853]' :
                      advice.healthStatus === 'Equilibrada' ? 'bg-blue-500/20 text-blue-400 border border-blue-500' :
                      'bg-amber-500/20 text-amber-400 border border-amber-500'
                    }`}>
                      {advice.healthStatus}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed max-w-xl">
                    {advice.summary}
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center bg-[#121212] px-6 py-3 rounded-2xl border border-[#D4AF37]/50 shrink-0">
                  <span className="text-3xl font-black text-[#D4AF37]">{advice.score}<span className="text-xs text-gray-500 font-normal">/100</span></span>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Diagnóstico</span>
                </div>
              </div>

              {/* Grid Analysis Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Diversificação */}
                <div className="p-4 bg-[#18181B] border border-white/10 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-[#D4AF37]">
                    <PieChart className="w-4 h-4 stroke-[2.5]" />
                    <h4 className="text-xs font-black uppercase tracking-wider">Diversificação por Classe</h4>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {advice.diversificationAnalysis}
                  </p>
                </div>

                {/* Risco vs Retorno */}
                <div className="p-4 bg-[#18181B] border border-white/10 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-400">
                    <ShieldAlert className="w-4 h-4 stroke-[2.5]" />
                    <h4 className="text-xs font-black uppercase tracking-wider">Perfil de Risco & Volatilidade</h4>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {advice.riskReturnAnalysis}
                  </p>
                </div>

                {/* Geração de Proventos */}
                <div className="p-4 bg-[#18181B] border border-white/10 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-[#00E676]">
                    <DollarSign className="w-4 h-4 stroke-[2.5]" />
                    <h4 className="text-xs font-black uppercase tracking-wider">Fluxo de Renda Passiva</h4>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {advice.dividendAnalysis}
                  </p>
                </div>

                {/* Proteção Cambial */}
                <div className="p-4 bg-[#18181B] border border-white/10 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-purple-400">
                    <TrendingUp className="w-4 h-4 stroke-[2.5]" />
                    <h4 className="text-xs font-black uppercase tracking-wider">Proteção Cambial (USD)</h4>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {advice.currencyExposure}
                  </p>
                </div>
              </div>

              {/* Rebalancing Suggestions */}
              {advice.rebalancingTips && advice.rebalancingTips.length > 0 && (
                <div className="p-5 bg-[#18181B] border border-[#D4AF37]/30 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-[#D4AF37] uppercase tracking-wider flex items-center gap-2">
                      <RefreshCw className="w-4 h-4" />
                      Sugestões de Rebalanceamento Ideal
                    </h4>
                    <span className="text-[10px] text-gray-400">Objetivo: Alocação Inteligente</span>
                  </div>

                  <div className="space-y-2">
                    {advice.rebalancingTips.map((tip, idx) => (
                      <div key={idx} className="p-3 bg-[#121212] border border-white/10 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{tip.categoryName}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              tip.action === 'comprar' ? 'bg-[#00C853]/20 text-[#00E676]' :
                              tip.action === 'rebalancear' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-gray-800 text-gray-300'
                            }`}>
                              {tip.action}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400">{tip.recommendation}</p>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-xs font-black text-[#D4AF37]">
                            Atual: {tip.currentPct.toFixed(1)}% → Meta: {tip.targetPct.toFixed(1)}%
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {tip.differenceAmount >= 0 ? '+' : ''}R$ {tip.differenceAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sem Filtro Persona Analysis Blocks */}
              <div className="space-y-4">
                {/* Pontos Fortes da Carteira */}
                <div className="p-4 sm:p-5 bg-[#1A231E] border-l-4 border-l-[#00E676] border border-[#00C853]/40 rounded-2xl space-y-3 shadow-lg">
                  <div className="flex items-center gap-2.5 text-[#00E676]">
                    <div className="p-1.5 bg-[#00E676]/20 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <h4 className="text-sm font-black uppercase tracking-wider text-white">Pontos Fortes da Carteira</h4>
                  </div>
                  <ul className="space-y-2 pl-1">
                    {advice.positivePoints && advice.positivePoints.length > 0 ? (
                      advice.positivePoints.map((item, idx) => (
                        <li key={idx} className="text-sm text-gray-100 font-medium leading-relaxed flex items-start gap-2.5">
                          <span className="text-[#00E676] font-extrabold text-base">•</span>
                          <span>{item}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-gray-200 leading-relaxed">• {advice.summary}</li>
                    )}
                  </ul>
                </div>

                {/* Pontos de Atenção e Riscos */}
                <div className="p-4 sm:p-5 bg-[#251A1A] border-l-4 border-l-red-500 border border-red-500/40 rounded-2xl space-y-3 shadow-lg">
                  <div className="flex items-center gap-2.5 text-red-400">
                    <div className="p-1.5 bg-red-500/20 rounded-lg">
                      <ShieldAlert className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <h4 className="text-sm font-black uppercase tracking-wider text-white">Pontos de Atenção e Riscos</h4>
                  </div>
                  <ul className="space-y-2 pl-1">
                    {advice.warningPoints && advice.warningPoints.length > 0 ? (
                      advice.warningPoints.map((item, idx) => (
                        <li key={idx} className="text-sm text-gray-100 font-medium leading-relaxed flex items-start gap-2.5">
                          <span className="text-red-400 font-extrabold text-base">•</span>
                          <span>{item}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-gray-200 leading-relaxed">• {advice.riskReturnAnalysis || 'Acompanhe a oscilação periódica do mercado.'}</li>
                    )}
                  </ul>
                </div>

                {/* Dicas de Estudo para a Sua Alocação */}
                <div className="p-4 sm:p-5 bg-[#211E15] border-l-4 border-l-[#D4AF37] border border-[#D4AF37]/50 rounded-2xl space-y-3 shadow-lg">
                  <div className="flex items-center gap-2.5 text-[#D4AF37]">
                    <div className="p-1.5 bg-[#D4AF37]/20 rounded-lg">
                      <Sparkles className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <h4 className="text-sm font-black uppercase tracking-wider text-amber-300">Dicas de Estudo para a Sua Alocação</h4>
                  </div>
                  <ul className="space-y-2 pl-1">
                    {advice.studyTips && advice.studyTips.length > 0 ? (
                      advice.studyTips.map((tip, idx) => (
                        <li key={idx} className="text-sm text-gray-100 font-medium leading-relaxed flex items-start gap-2.5">
                          <ArrowRight className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                          <span>{tip}</span>
                        </li>
                      ))
                    ) : advice.actionableTips && advice.actionableTips.length > 0 ? (
                      advice.actionableTips.map((tip, idx) => (
                        <li key={idx} className="text-sm text-gray-100 font-medium leading-relaxed flex items-start gap-2.5">
                          <ArrowRight className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                          <span>{tip}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-gray-200 leading-relaxed">• Pesquise sobre alocação inteligente e diversificação internacional.</li>
                    )}
                  </ul>
                </div>

                <div className="p-4 sm:p-5 bg-[#14120C] border-2 border-amber-500/50 rounded-2xl shadow-xl">
                  <p className="text-xs sm:text-sm text-amber-200/90 leading-relaxed font-medium flex items-start gap-2">
                    <span className="shrink-0 mt-0.5">⚠️</span>
                    <span>{advice.disclaimer || "Aviso importante: Esta análise e as dicas fornecidas possuem caráter estritamente educacional e informativo, e não constituem recomendação de investimento ou indicação de compra e venda de ativos de acordo com o mercado."}</span>
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center space-y-4 max-w-md mx-auto">
              <Sparkles className="w-12 h-12 text-[#D4AF37] mx-auto" />
              <div className="space-y-1.5">
                <p className="text-base font-bold text-white">Nenhum diagnóstico gerado ainda.</p>
                <p className="text-xs text-amber-200/80 leading-relaxed font-medium">
                  Esta análise e as dicas do aplicativo possuem caráter estritamente educativo e informativo, e <strong>não são recomendações de investimento de acordo com o mercado</strong>.
                </p>
              </div>
              <button
                onClick={onRefreshAIAdvice}
                className="px-6 py-3 bg-[#D4AF37] text-[#121212] font-black text-xs rounded-xl hover:bg-[#FACC15] shadow-lg transition cursor-pointer"
              >
                Gerar Análise Completa Agora
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
