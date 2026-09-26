import React from 'react';
import { User } from '../types';
import { Clock, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

interface TrialCountdownWidgetProps {
  user: User;
  onGoToPlans: () => void;
}

export const TrialCountdownWidget: React.FC<TrialCountdownWidgetProps> = ({ user, onGoToPlans }) => {
  // Check if user is VIP / Pro or subscription is active
  const isVip = user.isPro || user.plan === 'vip' || user.subscriptionStatus === 'active';

  // Calculate days left in 90-day trial
  const calculateDaysLeft = (): number => {
    if (!user.createdAt && !user.trialEndsAt) {
      return 90; // Default 90 days
    }

    const startDate = user.createdAt ? new Date(user.createdAt).getTime() : Date.now();
    const trialEndDate = user.trialEndsAt
      ? new Date(user.trialEndsAt).getTime()
      : startDate + 90 * 24 * 60 * 60 * 1000;

    const now = Date.now();
    const diffMs = trialEndDate - now;
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(90, days));
  };

  const daysLeft = calculateDaysLeft();

  // If user is VIP or trial expired/inactive, do NOT render
  if (isVip || daysLeft <= 0) {
    return null;
  }

  // Calculate percentage of 90 days remaining
  const percentageRemaining = Math.round((daysLeft / 90) * 100);
  const strokeDashoffset = 100 - percentageRemaining;

  return (
    <div
      className="bg-gradient-to-r from-[#121212] via-[#1A1A1E] to-[#121212] border border-[#D4AF37]/40 rounded-lg sm:rounded-xl p-1.5 sm:p-3 shadow-sm my-1 sm:my-2 text-white relative overflow-hidden group hover:border-[#D4AF37] transition duration-300"
      id="trial-countdown-highlight"
    >
      {/* Mobile Ultra-Compact View */}
      <div className="flex sm:hidden items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-[#121212] font-black text-[10px] flex items-center justify-center shrink-0">
            {daysLeft}
          </span>
          <span className="text-[11px] font-bold text-gray-200 truncate">
            Faltam <span className="text-[#D4AF37] font-black">{daysLeft} dias</span> grátis
          </span>
        </div>
        <button
          onClick={onGoToPlans}
          className="px-2 py-1 bg-[#D4AF37] hover:bg-[#FACC15] text-[#121212] font-black text-[10px] rounded transition flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap shadow-xs"
        >
          <span>Acesso VIP</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Desktop Full View */}
      <div className="hidden sm:flex items-center justify-between gap-2 relative z-10">
        {/* Left: Info */}
        <div className="flex items-center gap-2.5 w-auto">
          {/* Circular Countdown Gauge Graphic */}
          <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
            <svg className="w-10 h-10 transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-white/10"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-[#D4AF37] transition-all duration-1000 ease-out"
                strokeDasharray="100, 100"
                strokeDashoffset={strokeDashoffset}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xs font-black text-white leading-none">{daysLeft}</span>
              <span className="text-[7px] font-black uppercase text-[#D4AF37] tracking-tighter">Dias</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#D4AF37] text-[9px] font-black rounded uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-[#D4AF37]" />
                90 Dias Grátis Ativo
              </span>
              <span className="text-xs text-gray-200 font-bold">
                Faltam <span className="text-[#D4AF37] underline">{daysLeft} dias</span> de teste gratuito
              </span>
            </div>
          </div>
        </div>

        {/* Right: CTA Button */}
        <button
          onClick={onGoToPlans}
          className="px-3 py-1.5 bg-[#D4AF37] hover:bg-[#FACC15] text-[#121212] font-black text-xs rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Garantir Acesso VIP</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
