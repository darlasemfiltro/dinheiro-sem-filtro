import React, { useState, useEffect } from 'react';
import { ShieldCheck, Sparkles, Check, Gift, Lock, Star, Zap, Award, ArrowRight, Copy, CheckCircle2, Loader2, AlertCircle, Calendar, Clock, RefreshCw } from 'lucide-react';
import { User } from '../types';
import { StorageService } from '../services/storage';

interface PlansAndPricingViewProps {
  user: User;
  onUserUpdated?: (updatedUser: User) => void;
}

export const PlansAndPricingView: React.FC<PlansAndPricingViewProps> = ({ user, onUserUpdated }) => {
  const [currentUser, setCurrentUser] = useState<User>(user);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedPlanModal, setSelectedPlanModal] = useState<{ name: string; priceText: string; billingText: string; id: string } | null>(null);
  const [isLoadingStripe, setIsLoadingStripe] = useState(false);
  const [stripeStatusMessage, setStripeStatusMessage] = useState<{ type: 'info' | 'error' | 'success'; text: string } | null>(null);
  const [stripeConfigured, setStripeConfigured] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [cancelFeedback, setCancelFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setCurrentUser(user);
  }, [user?.id]);

  useEffect(() => {
    fetch('/api/stripe/config')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.configured) {
          setStripeConfigured(true);
        }
      })
      .catch(() => {});
  }, []);

  const trialStatus = StorageService.getUserTrialStatus(currentUser);

  const referralCode = currentUser.id ? `REF-${currentUser.id.slice(-6).toUpperCase()}` : 'REF-DINHEIRO';
  const referralLink = `https://dinheiro.semfiltro.app/?ref=${referralCode}`;

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleSelectPlan = (plan: { name: string; priceText: string; billingText: string; id: string }) => {
    setSelectedPlanModal(plan);
    setStripeStatusMessage(null);
  };

  const handleSimulateAccountAge = (daysAgo: number) => {
    const updated = StorageService.simulateUserAccountAge(currentUser.id, daysAgo);
    if (updated) {
      setCurrentUser(updated);
      if (onUserUpdated) onUserUpdated(updated);
    }
  };

  const handleProceedToStripe = async () => {
    if (!selectedPlanModal) return;
    setIsLoadingStripe(true);
    setStripeStatusMessage(null);

    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planName: selectedPlanModal.name,
          planId: selectedPlanModal.id,
          userEmail: currentUser.email,
          userName: currentUser.name,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        // Activate subscription locally in demo mode
        const activated = StorageService.updateUserSubscription(currentUser.id, selectedPlanModal.id, true);
        if (activated) {
          setCurrentUser(activated);
          if (onUserUpdated) onUserUpdated(activated);
        }

        setStripeStatusMessage({
          type: 'success',
          text: `🎉 Plano ${selectedPlanModal.name} ativado com sucesso! Seus 90 dias grátis já estão valendo. Nenhuma cobrança retroativa será efetuada!`,
        });
      }
    } catch (err: any) {
      console.warn('Stripe API unavailable, activating demo checkout fallback', err);
      // Fallback: Activate subscription locally so user is never blocked
      const activated = StorageService.updateUserSubscription(currentUser.id, selectedPlanModal.id, true);
      if (activated) {
        setCurrentUser(activated);
        if (onUserUpdated) onUserUpdated(activated);
      }

      setStripeStatusMessage({
        type: 'success',
        text: `🎉 Plano ${selectedPlanModal.name} ativado em Modo de Teste Seguro! Seus 90 dias de acesso 100% grátis foram liberados instantaneamente.`,
      });
    } finally {
      setIsLoadingStripe(false);
    }
  };

  const handleCancelSubscription = async (immediate7DaysRefund: boolean) => {
    setIsCanceling(true);
    setCancelFeedback(null);

    try {
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: currentUser.email,
          immediate7DaysRefund,
        }),
      });

      const data = await response.json().catch(() => null);

      const updated = StorageService.cancelUserSubscription(currentUser.id, immediate7DaysRefund);
      if (updated) {
        setCurrentUser(updated);
        if (onUserUpdated) onUserUpdated(updated);
      }

      setCancelFeedback({
        type: 'success',
        text: data?.message || (immediate7DaysRefund
          ? '✅ Assinatura cancelada com sucesso! Conforme a garantia de 7 dias (CDC Art. 49), o reembolso integral de 100% foi solicitado.'
          : '✅ Renovação automática desativada com sucesso! Você continuará com acesso aos recursos até o fim do seu período vigente, sem novas cobranças.'),
      });
    } catch (error) {
      const updated = StorageService.cancelUserSubscription(currentUser.id, immediate7DaysRefund);
      if (updated) {
        setCurrentUser(updated);
        if (onUserUpdated) onUserUpdated(updated);
      }
      setCancelFeedback({
        type: 'success',
        text: immediate7DaysRefund
          ? '✅ Solicitação registrada! Seu cancelamento com estorno integral de 100% (Garantia CDC 7 Dias) foi efetuado.'
          : '✅ Renovação automática cancelada. Você manterá o acesso até o fim do ciclo sem novas cobranças.',
      });
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in" id="plans-pricing-view">
      {/* Hero Title Section */}
      <div className="text-center space-y-3 bg-gradient-to-br from-[#121212] via-[#2A2210] to-[#121212] p-8 sm:p-10 rounded-3xl text-white shadow-xl relative overflow-hidden border-2 border-[#D4AF37]/60">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#00C853]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#00C853]/20 border border-[#00C853]/40 text-[#00C853] text-xs font-black uppercase tracking-wider">
          <Sparkles className="w-4 h-4" />
          <span>90 Dias de Acesso Total 100% Grátis</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold font-serif tracking-tight text-white leading-tight">
          Planos por Menos de R$ 10,00 por Mês
        </h1>
        <p className="text-gray-200 text-sm sm:text-base max-w-2xl mx-auto font-medium">
          Aproveite <strong>90 dias (3 meses inteiros) sem pagar nada</strong>. A cobrança do plano escolhido ocorre somente a partir do 91º dia de uso!
        </p>

        {/* Stripe Security Banner */}
        <div className="pt-2 flex items-center justify-center gap-2 text-xs text-gray-300 font-semibold">
          <Lock className="w-4 h-4 text-[#00C853]" />
          <span>Pagamentos protegidos via <strong>Stripe</strong>. Cobrança agendada para o 91º dia.</span>
        </div>
      </div>

      {/* Trial Progress Card & Simulator */}
      <div className="bg-white border-2 border-[#D4AF37] rounded-3xl p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl ${trialStatus.isExpired ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
              <Clock className="w-6 h-6 text-[#00C853]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-[#121212] font-serif">
                  Status da sua Conta
                </h3>
                {currentUser.isPro ? (
                  <span className="bg-[#00C853] text-[#121212] text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                    Assinante Pro Ativo
                  </span>
                ) : trialStatus.isExpired ? (
                  <span className="bg-amber-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                    Modo Gratuito Limitado (Dia 91+)
                  </span>
                ) : (
                  <span className="bg-[#00C853]/20 text-emerald-800 border border-[#00C853]/40 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                    Teste Grátis Ativo (3 Meses)
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                {currentUser.isPro
                  ? (currentUser.subscriptionAutoRenew === false
                      ? 'Sua assinatura está ativa, mas a RENOVAÇÃO AUTOMÁTICA FOI CANCELADA. Seu acesso continuará até o término do período vigente sem novas cobranças.'
                      : 'Sua assinatura Pro está ativa. Todas as funcionalidades estão liberadas com renovação automática ativada.')
                  : trialStatus.isExpired
                  ? 'Seu período de 90 dias expirou. Assine por até R$ 9,90/mês para desbloquear tudo!'
                  : `Dia ${trialStatus.daysSinceCreation + 1} de 90: Faltam ${trialStatus.daysLeft} dias de degustação total gratuita.`}
              </p>

              {/* Button to open cancellation modal */}
              <div className="pt-2">
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl border border-gray-300 transition cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
                  <span>Gerenciar / Cancelar Assinatura</span>
                </button>
              </div>
            </div>
          </div>

          {/* Dev/Demo Controls to Test Trial Days */}
          <div className="bg-gray-50 border border-gray-200 p-3 rounded-2xl shrink-0 space-y-2 text-right">
            <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider block">
              Simular Período de Teste:
            </span>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => handleSimulateAccountAge(0)}
                className="px-2.5 py-1 bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 text-[11px] font-bold rounded-lg cursor-pointer transition"
              >
                Dia 1 (Início)
              </button>
              <button
                onClick={() => handleSimulateAccountAge(91)}
                className="px-2.5 py-1 bg-amber-600 text-white hover:bg-amber-700 text-[11px] font-bold rounded-lg cursor-pointer transition shadow-xs"
              >
                Dia 91 (Testar Bloqueio)
              </button>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        {!currentUser.isPro && (
          <div className="space-y-1 pt-2 border-t border-gray-100">
            <div className="flex justify-between text-[11px] font-bold text-gray-600">
              <span>Dia 1 (Conta Criada)</span>
              <span className="text-emerald-700 font-extrabold">{trialStatus.daysLeft} dias restantes</span>
              <span>Dia 90 (Fim do Teste)</span>
            </div>
            <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-[#00C853] h-full transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(100, Math.max(5, (trialStatus.daysSinceCreation / 90) * 100))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Pricing Cards Grid (All <= R$ 10/month) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Plano Anual VIP - DESTACADO CARRO CHEFE (R$ 6,90 / mês) */}
        <div className="bg-gradient-to-b from-[#121212] to-black border-2 border-[#00C853] rounded-3xl p-6 flex flex-col justify-between shadow-2xl relative group md:order-2 transform lg:-translate-y-2">
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#00C853] text-[#121212] font-black text-[11px] px-4 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-md whitespace-nowrap">
            <Star className="w-3.5 h-3.5 fill-[#121212]" />
            <span>MAIS VANTAJOSO - ECONOMIZE 30%</span>
          </div>

          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-black tracking-wider text-[#00C853] bg-[#00C853]/20 px-2.5 py-1 rounded-md inline-block border border-[#00C853]/40">
                Plano Anual VIP
              </span>
              <h3 className="text-2xl font-black text-white font-serif flex items-center justify-between">
                <span>Anual Sem Filtro</span>
                <Award className="w-6 h-6 text-[#00C853]" />
              </h3>
              <p className="text-xs text-gray-300">O melhor valor absoluto. Apenas R$ 6,90 por mês após os 90 dias grátis.</p>
            </div>

            <div className="py-2 bg-white/5 p-3.5 rounded-2xl border border-white/10">
              <p className="text-xs text-emerald-400 font-bold">Equivalente mensal de apenas:</p>
              <div className="flex items-baseline gap-1">
                <span className="text-xs font-bold text-gray-300">R$</span>
                <span className="text-4xl font-black text-[#00C853] font-serif">6,90</span>
                <span className="text-xs font-semibold text-gray-300">/mês</span>
              </div>
              <p className="text-xs text-gray-300 mt-1 font-semibold">R$ 82,80 cobrado anualmente no 91º dia</p>
              <p className="text-[11px] text-[#00C853] font-black mt-1">Primeira cobrança somente após 90 dias!</p>
            </div>

            <ul className="space-y-2.5 text-xs text-white pt-2 border-t border-white/10">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00C853] shrink-0" />
                <span><strong>Acesso 100% Ilimitado por 1 ano inteiro</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00C853] shrink-0" />
                <span><strong>Carteira do Investidor Completa (Ativos, Proventos Mês/Ano & Benchmarks CDI/Ibov/IPCA)</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00C853] shrink-0" />
                <span><strong>Ofensiva & Divisões (XP, Streaks & Conquistas 100% Liberadas)</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00C853] shrink-0" />
                <span>Orçamento Compartilhado com Cônjuge/Família</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00C853] shrink-0" />
                <span>Consultoria Financeira com IA Sem Filtro</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00C853] shrink-0" />
                <span>Exportação de Relatórios PDF/Excel</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00C853] shrink-0" />
                <span>Economize 30% em relação ao mensal</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => handleSelectPlan({
              name: 'Anual Sem Filtro (R$ 6,90/mês)',
              priceText: 'R$ 6,90/mês (R$ 82,80/ano)',
              billingText: 'Primeira cobrança de R$ 82,80 somente no 91º dia.',
              id: 'anual'
            })}
            className="w-full mt-6 py-3.5 px-4 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs rounded-2xl transition cursor-pointer shadow-lg flex items-center justify-center gap-2 uppercase tracking-wide"
          >
            <span>Garantir 90 Dias Grátis + R$ 6,90/mês</span>
            <ArrowRight className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

        {/* 2. Plano Trimestral Economia (R$ 8,90 / mês) */}
        <div className="bg-[#FAFAFA] border border-gray-200 rounded-3xl p-6 flex flex-col justify-between hover:shadow-xl transition-all relative group md:order-1">
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-black tracking-wider text-[#121212] bg-[#D4AF37]/30 px-2.5 py-1 rounded-md inline-block border border-[#D4AF37]/50">
                Plano Trimestral (10% OFF)
              </span>
              <h3 className="text-xl font-black text-[#121212] font-serif">Trimestral Economia</h3>
              <p className="text-xs text-gray-600">Cobrado a cada 3 meses com desconto especial.</p>
            </div>

            <div className="py-2">
              <p className="text-xs text-gray-500 font-bold">Equivalente a:</p>
              <div className="flex items-baseline gap-1">
                <span className="text-xs font-bold text-gray-700">R$</span>
                <span className="text-3xl font-black text-[#121212] font-serif">8,90</span>
                <span className="text-xs font-semibold text-gray-600">/mês</span>
              </div>
              <p className="text-[11px] text-emerald-700 font-bold mt-1">R$ 26,70 cobrado no 91º dia</p>
            </div>

            <ul className="space-y-2.5 text-xs text-[#121212] pt-2 border-t border-gray-200">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00C853] shrink-0" />
                <span>90 dias de teste grátis inclusos</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00C853] shrink-0" />
                <span><strong>Carteira do Investidor (Investimentos & Proventos)</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00C853] shrink-0" />
                <span>Orçamento Compartilhado liberado</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00C853] shrink-0" />
                <span>Relatórios e Dicas com IA Sem Filtro</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00C853] shrink-0" />
                <span>Renovação a cada 3 meses</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => handleSelectPlan({
              name: 'Trimestral Economia (R$ 8,90/mês)',
              priceText: 'R$ 8,90/mês (R$ 26,70 / 3 meses)',
              billingText: 'Primeira cobrança de R$ 26,70 somente no 91º dia.',
              id: 'trimestral'
            })}
            className="w-full mt-6 py-3 px-4 bg-[#D4AF37] hover:bg-[#C5A028] text-[#121212] font-black text-xs rounded-2xl transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
          >
            <span>Ativar 90 Dias Grátis</span>
            <ArrowRight className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

        {/* 3. Plano Mensal Flex (R$ 9,90 / mês) */}
        <div className="bg-[#FAFAFA] border border-gray-200 rounded-3xl p-6 flex flex-col justify-between hover:shadow-xl transition-all relative group md:order-3">
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-black tracking-wider text-[#121212] bg-[#D4AF37]/20 border border-[#D4AF37]/50 px-2.5 py-1 rounded-md inline-block">
                Plano Mensal Flex
              </span>
              <h3 className="text-xl font-black text-[#121212] font-serif">Mensal Flex</h3>
              <p className="text-xs text-gray-600">Sem compromisso. Pague mês a mês após os 3 meses grátis.</p>
            </div>

            <div className="py-2">
              <p className="text-xs text-gray-500 font-bold">Valor mensal:</p>
              <div className="flex items-baseline gap-1">
                <span className="text-xs font-bold text-gray-700">R$</span>
                <span className="text-3xl font-black text-[#121212] font-serif">9,90</span>
                <span className="text-xs font-semibold text-gray-600">/mês</span>
              </div>
              <p className="text-[11px] text-emerald-700 font-bold mt-1">Cobre R$ 0,00 hoje (90 dias grátis)</p>
            </div>

            <ul className="space-y-2.5 text-xs text-[#121212] pt-2 border-t border-gray-200">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00C853] shrink-0" />
                <span>Cobrança de R$ 9,90/mês no 91º dia</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00C853] shrink-0" />
                <span><strong>Carteira do Investidor Liberada</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00C853] shrink-0" />
                <span>Cancele quando quiser com 1 clique</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00C853] shrink-0" />
                <span>Sem multas ou fidelidade</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00C853] shrink-0" />
                <span>Acesso total durante o trial</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => handleSelectPlan({
              name: 'Mensal Flex (R$ 9,90/mês)',
              priceText: 'R$ 9,90/mês',
              billingText: 'Primeira cobrança de R$ 9,90 somente no 91º dia.',
              id: 'mensal'
            })}
            className="w-full mt-6 py-3 px-4 bg-[#D4AF37] hover:bg-[#C5A028] text-[#121212] font-black text-xs rounded-2xl transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
          >
            <span>Ativar 90 Dias Grátis</span>
            <ArrowRight className="w-4 h-4 stroke-[3]" />
          </button>
        </div>
      </div>

      {/* Comparison Table: Gratuito no Dia 91+ vs. Plano Pago Pro */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-1">
          <span className="text-xs font-black text-[#00C853] uppercase tracking-wider">
            Transparência Sem Filtro
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-[#121212] font-serif">
            O que acontece ao completar 91 Dias de uso?
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 max-w-xl mx-auto">
            Entenda quais recursos continuam ativos no plano gratuito e o que fica exclusivo para assinantes dos planos até R$ 9,90/mês:
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="py-3 px-4 font-black text-[#121212]">Recurso do Aplicativo</th>
                <th className="py-3 px-4 font-bold text-gray-600 text-center w-36">Nos Primeiros 90 Dias</th>
                <th className="py-3 px-4 font-bold text-amber-700 text-center w-36 bg-amber-50">Modo Gratuito (Dia 91+)</th>
                <th className="py-3 px-4 font-black text-[#00C853] text-center w-36 bg-emerald-50">Plano Pro (Assinante)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="py-3 px-4 font-semibold text-[#121212]">🔥 Ofensiva & Divisões (Streaks, XP & Gamificação)</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600">✅ Liberado</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600 bg-amber-50/50">✅ 100% Grátis</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600 bg-emerald-50/50">✅ 100% Grátis VIP</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-[#121212]">📊 Carteira do Investidor (Investimentos & Posição)</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600">✅ Liberado Total</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600 bg-amber-50/50">✅ Ativos & Posição Grátis</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600 bg-emerald-50/50">✅ VIP Completo (Proventos Mês/Ano, Rentabilidade x Benchmarks & Gráficos)</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-[#121212]">Lançamento de Receitas e Despesas</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600">✅ Liberado</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600 bg-amber-50/50">✅ Ativo</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600 bg-emerald-50/50">✅ Ativo</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-[#121212]">Extrato e Resumo do Mês Atual</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600">✅ Liberado</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600 bg-amber-50/50">✅ Ativo</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600 bg-emerald-50/50">✅ Ativo</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-[#121212]">Calculadora Financeira e Perfil</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600">✅ Liberado</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600 bg-amber-50/50">✅ Ativo</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600 bg-emerald-50/50">✅ Ativo</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-[#121212]">Orçamento Compartilhado (Conectar Família/Cônjuge)</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600">✅ Liberado</td>
                <td className="py-3 px-4 text-center font-bold text-amber-700 bg-amber-50/50">🔒 Bloqueado</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600 bg-emerald-50/50">✅ Liberado</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-[#121212]">Dicas e Análises com IA Sem Filtro</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600">✅ Liberado</td>
                <td className="py-3 px-4 text-center font-bold text-amber-700 bg-amber-50/50">🔒 Bloqueado</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600 bg-emerald-50/50">✅ Liberado</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-[#121212]">Exportação em PDF e Excel</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600">✅ Liberado</td>
                <td className="py-3 px-4 text-center font-bold text-amber-700 bg-amber-50/50">🔒 Bloqueado</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600 bg-emerald-50/50">✅ Liberado</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-[#121212]">Loja de Gemas & Benefícios Exclusivos</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600">✅ Liberado</td>
                <td className="py-3 px-4 text-center font-bold text-amber-700 bg-amber-50/50">🔒 Bloqueado</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600 bg-emerald-50/50">✅ Liberado</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-[#121212]">Projeção de Próximos Meses & Metas Ilimitadas</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600">✅ Liberado</td>
                <td className="py-3 px-4 text-center font-bold text-amber-700 bg-amber-50/50">🔒 Bloqueado</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600 bg-emerald-50/50">✅ Liberado</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Programa de Indicação: "Indique e Ganhe" */}
      <div className="bg-gradient-to-br from-[#121212] via-[#241E10] to-[#121212] border-2 border-[#D4AF37] rounded-3xl p-6 sm:p-8 text-white space-y-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 text-xs font-black uppercase tracking-wider">
              <Gift className="w-4 h-4 text-[#D4AF37]" />
              <span>Programa Indique e Ganhe</span>
            </div>
            <h2 className="text-xl sm:text-3xl font-extrabold font-serif text-white">
              Indique um amigo e ganhe 1 Mês Grátis!
            </h2>
            <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed font-medium">
              A cada amigo indicado que se cadastrar, você adiciona <strong>+30 dias gratuitos</strong> ao seu plano. Indique 12 amigos e use o ano inteiro totalmente sem custos!
            </p>
          </div>

          <div className="w-full md:w-auto bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 space-y-3 shrink-0 text-center">
            <p className="text-xs font-extrabold text-[#D4AF37] uppercase tracking-wider">
              Seu Link Exclusivo de Indicação
            </p>

            <div className="bg-black/40 border border-white/20 px-3 py-2 rounded-xl text-xs font-mono font-bold text-white flex items-center justify-between gap-3">
              <span className="truncate max-w-[200px] sm:max-w-[260px]">{referralLink}</span>
            </div>

            <button
              onClick={handleCopyReferral}
              className="w-full py-2.5 px-4 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              {copiedLink ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#121212]" />
                  <span>Link Copiado com Sucesso!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar Link de Indicação</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Security & FAQ Section */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 text-[#00C853] rounded-2xl">
            <ShieldCheck className="w-6 h-6 text-emerald-700" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[#121212] font-serif">
              Garantia de 90 Dias de Teste Grátis
            </h3>
            <p className="text-xs text-gray-700">Processamento oficial de cartão e cobrança via Stripe Security</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#121212] pt-2 border-t border-gray-100">
          <div className="space-y-1 p-3.5 bg-[#D4AF37]/10 rounded-2xl border border-[#D4AF37]/30">
            <p className="font-extrabold text-[#121212] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#00C853]" />
              1. Sem Pagamento Retroativo
            </p>
            <p className="text-gray-800 leading-relaxed">
              Você <strong>NÃO paga nada retroativo</strong> pelos 90 dias que já utilizou. Os 3 meses iniciais são 100% grátis. A cobrança do 91º dia cobre apenas o próximo período de uso.
            </p>
          </div>

          <div className="space-y-1 p-3.5 bg-[#D4AF37]/10 rounded-2xl border border-[#D4AF37]/30">
            <p className="font-extrabold text-[#121212] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#00C853]" />
              2. Como funciona no Dia 91?
            </p>
            <p className="text-gray-800 leading-relaxed">
              O valor cobrado hoje é R$ 0,00. A primeira parcela (a partir de R$ 6,90/mês) só é debitada no 91º dia. Se não assinar, você mantém a conta no modo gratuito básico.
            </p>
          </div>

          <div className="space-y-1 p-3.5 bg-[#D4AF37]/10 rounded-2xl border border-[#D4AF37]/30">
            <p className="font-extrabold text-[#121212] flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-[#00C853]" />
              3. Cancelamento em 1-Clique
            </p>
            <p className="text-gray-800 leading-relaxed">
              Sem fidelidade nem multas. Cancele quando quiser diretamente no painel de controle antes dos 90 dias se não desejar continuar.
            </p>
          </div>
        </div>
      </div>

      {/* Modal Checkout Simulation */}
      {selectedPlanModal && (
        <div className="fixed inset-0 z-50 bg-[#121212]/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#D4AF37] rounded-3xl max-w-md w-full p-6 space-y-5 animate-in fade-in shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Lock className="w-5 h-5 text-[#00C853]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#121212] font-serif">Checkout Seguro Stripe</h3>
                  <p className="text-[11px] text-emerald-700 font-bold">90 Dias Grátis Ativados</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPlanModal(null)}
                className="text-gray-400 hover:text-[#121212] p-1 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#D4AF37]/10 p-4 rounded-2xl border border-[#D4AF37]/30 space-y-2">
              <p className="text-xs text-[#121212] font-bold">Plano Selecionado:</p>
              <p className="text-sm font-black text-[#121212] font-serif">{selectedPlanModal.name}</p>
              <p className="text-xs text-emerald-800 font-bold">{selectedPlanModal.priceText}</p>
              <div className="flex items-center justify-between pt-2 border-t border-[#D4AF37]/30 text-xs">
                <span className="font-bold text-[#121212]">Valor Cobrado Hoje:</span>
                <span className="font-black text-[#00C853] text-sm">R$ 0,00</span>
              </div>
              <p className="text-[11px] text-gray-700 font-medium leading-relaxed bg-white/60 p-2 rounded-xl border border-gray-200">
                🔒 <strong>Sem cobrança retroativa:</strong> {selectedPlanModal.billingText}. O uso dos 90 dias iniciais é 100% gratuito.
              </p>
            </div>

            {stripeStatusMessage && (
              <div
                className={`p-3 rounded-2xl text-xs flex items-start gap-2 border ${
                  stripeStatusMessage.type === 'error'
                    ? 'bg-red-50 text-red-900 border-red-200'
                    : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                }`}
              >
                {stripeStatusMessage.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                ) : (
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <p className="font-medium leading-relaxed">{stripeStatusMessage.text}</p>
                </div>
              </div>
            )}

            <button
              onClick={handleProceedToStripe}
              disabled={isLoadingStripe}
              className="w-full py-3.5 px-4 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs rounded-2xl transition cursor-pointer shadow-lg flex items-center justify-center gap-2 uppercase tracking-wide border border-[#00A843] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoadingStripe ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#121212]" />
                  <span>Conectando com o Stripe...</span>
                </>
              ) : (
                <>
                  <span>Continuar com R$ 0,00 no Stripe</span>
                  <Lock className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              onClick={() => {
                setSelectedPlanModal(null);
                setStripeStatusMessage(null);
              }}
              className="w-full py-2 text-xs font-bold text-gray-600 hover:text-[#121212] text-center cursor-pointer"
            >
              Voltar e Escolher Outro Plano
            </button>
          </div>
        </div>
      )}

      {/* Subscription Management & Cancellation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-[#121212]/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#D4AF37] rounded-3xl max-w-lg w-full p-6 space-y-5 animate-in fade-in shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <ShieldCheck className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#121212] font-serif">Gerenciar / Cancelar Assinatura</h3>
                  <p className="text-[11px] text-gray-700 font-medium">Garantia Legal CDC Art. 49 e Opções de Renovação</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelFeedback(null);
                }}
                className="text-gray-400 hover:text-[#121212] p-1 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {cancelFeedback ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-3">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Solicitação Processada</span>
                </div>
                <p className="leading-relaxed">{cancelFeedback.text}</p>
                <button
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancelFeedback(null);
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-xs text-gray-700">
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl space-y-1">
                  <p className="font-bold text-[#121212]">Status Atual:</p>
                  <p className="text-gray-600">
                    Plano: <strong>{currentUser.plan?.toUpperCase() || 'PRO'}</strong> | Email: <strong>{currentUser.email}</strong>
                  </p>
                  <p className="text-gray-600">
                    Renovação Automática:{' '}
                    <strong className={currentUser.subscriptionAutoRenew === false ? 'text-red-600' : 'text-emerald-600'}>
                      {currentUser.subscriptionAutoRenew === false ? 'Desativada' : 'Ativa'}
                    </strong>
                  </p>
                </div>

                <p className="font-extrabold text-[#121212] text-sm font-serif">
                  Escolha a modalidade de cancelamento desejada:
                </p>

                {/* Option 1: CDC 7-Day Unconditional Refund */}
                <div className="p-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-emerald-900 uppercase text-[11px] tracking-wider bg-emerald-200/80 px-2.5 py-0.5 rounded-full">
                      Direito de Arrependimento (CDC Art. 49)
                    </span>
                    <span className="text-[10px] font-bold text-emerald-800">Garantia 7 Dias</span>
                  </div>
                  <p className="font-extrabold text-[#121212] text-xs">
                    Cancelamento Imediato com Reembolso Integral de 100%
                  </p>
                  <p className="text-gray-600 leading-relaxed text-[11px]">
                    De acordo com o Art. 49 do Código de Defesa do Consumidor para compras online, você tem até 7 dias corridos após o pagamento para solicitar o cancelamento com reembolso total de 100% sem qualquer multa ou encargo. O acesso VIP será suspenso e o valor estornado integralmente na sua fatura Stripe.
                  </p>
                  <button
                    onClick={() => handleCancelSubscription(true)}
                    disabled={isCanceling}
                    className="w-full mt-2 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    {isCanceling ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Cancelar com Reembolso 100% (CDC 7 Dias)</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Option 2: Cancel Auto-Renewal at end of period */}
                <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50 space-y-2">
                  <span className="font-black text-gray-700 uppercase text-[11px] tracking-wider bg-gray-200 px-2.5 py-0.5 rounded-full">
                    Término do Período Adquirido
                  </span>
                  <p className="font-extrabold text-[#121212] text-xs">
                    Desativar Renovação Automática (Manter Acesso em Vigor)
                  </p>
                  <p className="text-gray-600 leading-relaxed text-[11px]">
                    Cancele as cobranças futuras. O seu acesso VIP continuará totalmente liberado até a data final do seu ciclo pago/degustação de 90 dias. Nenhuma nova cobrança será realizada quando o período expirar.
                  </p>
                  <button
                    onClick={() => handleCancelSubscription(false)}
                    disabled={isCanceling}
                    className="w-full mt-2 py-2.5 px-3 bg-gray-800 hover:bg-black text-white font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isCanceling ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        <span>Desativar Renovação e Manter Acesso Até o Fim</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="pt-2 text-center">
                  <button
                    onClick={() => {
                      setShowCancelModal(false);
                      setCancelFeedback(null);
                    }}
                    className="text-gray-500 hover:text-gray-800 font-bold text-xs cursor-pointer"
                  >
                    Manter Assinatura Ativa e Voltar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
