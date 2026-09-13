import React from 'react';
import { Lock, Sparkles, ArrowRight, ShieldAlert } from 'lucide-react';

interface FeatureLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPlans: () => void;
  featureTitle?: string;
  featureDescription?: string;
}

export const FeatureLockModal: React.FC<FeatureLockModalProps> = ({
  isOpen,
  onClose,
  onOpenPlans,
  featureTitle = 'Recurso Exclusivo do Plano Pago',
  featureDescription = 'Seu período de 90 dias de teste grátis foi concluído. Assine por apenas R$ 6,90/mês para continuar utilizando todas as funcionalidades sem restrições!',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#121212]/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-2 border-[#D4AF37] rounded-3xl max-w-md w-full p-6 space-y-5 animate-in fade-in shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-amber-100 text-amber-800 rounded-2xl">
              <Lock className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#121212] font-serif">Modo Gratuito Limitado</h3>
              <p className="text-[11px] text-amber-700 font-bold">Acesso restrito após 90 dias</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-[#121212] p-1 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 text-center py-2">
          <div className="w-12 h-12 bg-gradient-to-br from-[#121212] to-[#2A2210] rounded-2xl mx-auto flex items-center justify-center text-[#D4AF37] shadow-md border border-[#D4AF37]/40">
            <ShieldAlert className="w-6 h-6" />
          </div>

          <h4 className="text-lg font-black text-[#121212] font-serif">
            {featureTitle}
          </h4>

          <p className="text-xs text-gray-600 leading-relaxed max-w-sm mx-auto font-medium">
            {featureDescription}
          </p>
        </div>

        <div className="bg-[#D4AF37]/10 p-4 rounded-2xl border border-[#D4AF37]/30 space-y-1.5 text-center">
          <span className="bg-[#00C853] text-[#121212] font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-block">
            A partir de R$ 6,90 / mês
          </span>
          <p className="text-xs font-bold text-[#121212]">
            Todas as funcionalidades liberadas e ilimitadas!
          </p>
          <p className="text-[11px] text-emerald-800 font-semibold">
            Primeira cobrança somente no 91º dia de cadastro.
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => {
              onClose();
              onOpenPlans();
            }}
            className="w-full py-3.5 px-4 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs rounded-2xl transition cursor-pointer shadow-lg flex items-center justify-center gap-2 uppercase tracking-wide border border-[#00A843]"
          >
            <Sparkles className="w-4 h-4 fill-[#121212]" />
            <span>Ver Planos e Assinar a partir de R$ 6,90</span>
            <ArrowRight className="w-4 h-4 stroke-[3]" />
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 text-xs font-bold text-gray-500 hover:text-[#121212] text-center cursor-pointer"
          >
            Continuar no Modo Gratuito (Apenas Básico)
          </button>
        </div>
      </div>
    </div>
  );
};
