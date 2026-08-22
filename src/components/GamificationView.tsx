import React, { useState, useEffect } from 'react';
import { GamificationService, LEAGUE_DIVISIONS, getCurrentISOWeekKey, calculateUserFinancialMetrics, checkDivisionQualification } from '../services/gamification';
import { WeeklyGamificationState, LeagueDivision } from '../types';
import { executeTransactionalGamification } from '../lib/appwriteSync';
import { Flame, Trophy, Gem, ShieldCheck, Sparkles, CheckCircle, ChevronRight, Award, Zap, Calendar, ShoppingBag, ArrowUpRight, Lock, Info, Check, RotateCcw, Target, AlertTriangle } from 'lucide-react';

interface GamificationViewProps {
  userId: string;
}

export const GamificationView: React.FC<GamificationViewProps> = ({ userId }) => {
  const [gameState, setGameState] = useState<WeeklyGamificationState>(() =>
    GamificationService.getGamificationState(userId)
  );
  const [activeTab, setActiveTab] = useState<'ofensiva' | 'liga' | 'missoes' | 'loja'>('ofensiva');
  const [showConfetti, setShowConfetti] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [chartPeriod, setChartPeriod] = useState<'desde_inicio' | '12_months' | '2026' | '2025'>('desde_inicio');

  useEffect(() => {
    // Initial fetch from state
    setGameState(GamificationService.getGamificationState(userId));

    // Real-time synchronization listener for cross-device updates
    const handleGamificationUpdated = (e: any) => {
      if (e?.detail) {
        if (e.detail.xpTotal !== undefined || e.detail.gems !== undefined || e.detail.weeklyStreakCount !== undefined) {
          setGameState({
            ...e.detail,
            xpTotal: Number(e.detail.xpTotal) || 0,
            gems: Number(e.detail.gems) || 0,
            weeklyStreakCount: Number(e.detail.weeklyStreakCount) || 0,
          });
        } else if (e.detail.gamificationProfile || e.detail.gamificationState) {
          const remoteProfile = e.detail.gamificationProfile || e.detail.gamificationState;
          const sanitizedProfile = {
            ...remoteProfile,
            xp: Number(remoteProfile.xp ?? remoteProfile.xpTotal) || 0,
            gems: Number(remoteProfile.gems) || 0,
          };
          const s = GamificationService.fromGamificationProfile(sanitizedProfile, userId);
          setGameState(s);
        } else {
          setGameState(GamificationService.getGamificationState(userId));
        }
      } else {
        setGameState(GamificationService.getGamificationState(userId));
      }
    };

    const handleRemoteDataUpdated = (e: any) => {
      if (e?.detail?.gamificationProfile || e?.detail?.gamificationState || e?.detail?.gamification) {
        const remoteProfile = e.detail.gamificationProfile || e.detail.gamificationState || e.detail.gamification;
        const sanitizedProfile = {
          ...remoteProfile,
          xp: Number(remoteProfile.xp ?? remoteProfile.xpTotal) || 0,
          gems: Number(remoteProfile.gems) || 0,
        };
        const s = GamificationService.fromGamificationProfile(sanitizedProfile, userId);
        setGameState(s);
      }
    };

    window.addEventListener('gamification_updated_event', handleGamificationUpdated);
    window.addEventListener('remote_data_updated', handleRemoteDataUpdated);

    return () => {
      window.removeEventListener('gamification_updated_event', handleGamificationUpdated);
      window.removeEventListener('remote_data_updated', handleRemoteDataUpdated);
    };
  }, [userId]);

  // ARQUITETURA ORIENTADA A EVENTOS (AWARD SYSTEM CENTRAL)
  const awardGamification = async (
    addedXp: number,
    addedGems: number,
    options?: { questId?: string; isWeeklyCheckIn?: boolean }
  ) => {
    const backupState = JSON.parse(JSON.stringify(gameState));

    // 1. Atualização Otimista (Soma o valor estrito da tarefa com o atual)
    const updatedProfile = {
      xp: (Number(gameState.xpTotal) || 0) + addedXp,
      gems: (Number(gameState.gems) || 0) + addedGems,
      weeklyStreak: options?.isWeeklyCheckIn ? (gameState.weeklyStreakCount || 0) + 1 : gameState.weeklyStreakCount || 0,
      inventory: {
        freezes: gameState.streakFreezeCount ?? gameState.inventory?.freezes ?? 0,
        doubleXpActiveUntil: gameState.inventory?.doubleXpActiveUntil ?? null,
      },
      claimedMissions: options?.questId
        ? Array.from(new Set([...(gameState.claimedMissions || []), options.questId]))
        : gameState.claimedMissions || [],
    };

    const optimisticState: WeeklyGamificationState = {
      ...gameState,
      xpTotal: updatedProfile.xp,
      weeklyXP: (Number(gameState.weeklyXP) || 0) + addedXp,
      gems: updatedProfile.gems,
      weeklyStreakCount: updatedProfile.weeklyStreak,
      hasCompletedWeeklyCheckIn: options?.isWeeklyCheckIn ? true : gameState.hasCompletedWeeklyCheckIn,
      claimedMissions: updatedProfile.claimedMissions,
      inventory: updatedProfile.inventory,
      updatedAt: new Date().toISOString(),
    };

    setGameState(optimisticState); // Atualiza na hora e TRAVA no novo valor

    try {
      // 2. Persistência Assíncrona no Banco (Appwrite / Servidor)
      const res = await GamificationService.awardGamification(userId, addedXp, addedGems, options);
      if (!res.success) {
        throw new Error('Falha ao persistir recompensa de gamificação.');
      }
      setGameState(res.state);
    } catch (error) {
      // 3. Rollback
      console.error('Erro ao salvar progresso.', error);
      setGameState(backupState);
      GamificationService.saveGamificationState(backupState);
      alert('Erro ao processar recompensa. Estado anterior restaurado.');
    }
  };

  // 0ms Optimistic UI for Weekly Check-in with rollback
  const handleWeeklyCheckIn = async () => {
    if (gameState.hasCompletedWeeklyCheckIn) {
      return;
    }
    setShowConfetti(true);
    setFeedbackMessage('🎉 Check-in Semanal Concluído! Ganhou +60 XP e 💎 25 Gemas!');
    setTimeout(() => setShowConfetti(false), 4000);
    setTimeout(() => setFeedbackMessage(null), 5000);

    await awardGamification(60, 25, { isWeeklyCheckIn: true });
  };

  // 0ms Optimistic UI for Buying Items (freeze | doubleXp) with automatic rollback
  const handleBuyItem = async (itemType: 'freeze' | 'doubleXp', cost: number) => {
    if (gameState.gems < cost) {
      alert('Gemas insuficientes para esta compra.');
      return;
    }

    const backupState = JSON.parse(JSON.stringify(gameState));

    // 1. ATUALIZAÇÃO OTIMISTA (0ms delay)
    const newFreezes = itemType === 'freeze' ? (gameState.streakFreezeCount || 0) + 1 : gameState.streakFreezeCount || 0;
    const newDoubleXp = itemType === 'doubleXp'
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : gameState.inventory?.doubleXpActiveUntil || null;

    const updatedProfile = {
      xp: gameState.xpTotal,
      gems: gameState.gems - cost,
      weeklyStreak: gameState.weeklyStreakCount,
      inventory: {
        freezes: newFreezes,
        doubleXpActiveUntil: newDoubleXp,
      },
      claimedMissions: gameState.claimedMissions || [],
    };

    const optimisticState: WeeklyGamificationState = {
      ...gameState,
      gems: gameState.gems - cost,
      streakFreezeCount: newFreezes,
      inventory: updatedProfile.inventory,
      updatedAt: new Date().toISOString(),
    };

    setGameState(optimisticState); // Atualiza saldo e botões na hora
    GamificationService.saveGamificationState(optimisticState);

    const successMessage =
      itemType === 'freeze'
        ? '🛡️ Congelamento de Ofensiva adquirido com sucesso!'
        : '⚡ Dobro de XP ativado por 7 dias!';
    setFeedbackMessage(successMessage);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
    setTimeout(() => setFeedbackMessage(null), 4000);

    try {
      // 2. Salva na nuvem em background via transação atômica
      const res = await executeTransactionalGamification(userId, optimisticState, updatedProfile);
      if (!res.success) {
        throw new Error('Falha ao sincronizar compra no servidor.');
      }
    } catch (error) {
      console.error('[Optimistic Buy Error]', error);
      // 3. Rollback
      setGameState(backupState);
      GamificationService.saveGamificationState(backupState);
      alert('Erro ao processar a compra. Suas gemas foram devolvidas.');
    }
  };

  // Wrapper handlers for buttons
  const handleBuyFreeze = () => {
    handleBuyItem('freeze', 450);
  };

  const handleBuyDoubleXP = () => {
    handleBuyItem('doubleXp', 600);
  };

  // 0ms Optimistic UI for Profile Level selection with rollback
  const handleSelectLevel = (level: 'iniciante' | 'avancado') => {
    const backupState = JSON.parse(JSON.stringify(gameState));
    try {
      const newState = GamificationService.setUserProfileLevel(userId, level);
      setGameState(newState);
      setFeedbackMessage(
        `🎯 Perfil atualizado para ${level === 'iniciante' ? 'Iniciante (Foco em Reserva)' : 'Avançado (Foco em Aportes)'}! Missões personalizadas carregadas.`
      );
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err) {
      console.error('[Optimistic Level Change Error]', err);
      setGameState(backupState);
      setFeedbackMessage('❌ Erro ao trocar perfil.');
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

  // 0ms Optimistic UI for Claiming Quest / Mission Reward
  const handleClaimMission = async (questId: string) => {
    const quest = gameState.weeklyQuests.find((q) => q.id === questId);
    if (!quest) return;

    setShowConfetti(true);
    setFeedbackMessage(`🎁 Missão Resgatada! +${quest.xpReward} XP e 💎 +${quest.gemsReward} Gemas!`);
    setTimeout(() => setShowConfetti(false), 3500);
    setTimeout(() => setFeedbackMessage(null), 4500);

    await awardGamification(quest.xpReward, quest.gemsReward, { questId });
  };

  const currentLeagueObj = LEAGUE_DIVISIONS.find((l) => l.id === gameState.currentDivision) || LEAGUE_DIVISIONS[7];

  const getMonthlyDivisionData = (period: 'desde_inicio' | '12_months' | '2026' | '2025') => {
    const monthsData = [];
    const allMonthsNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonthIdx = currentDate.getMonth();

    if (period === 'desde_inicio') {
      const creationDate = gameState.accountCreatedAt ? new Date(gameState.accountCreatedAt) : new Date('2025-01-01');
      let startYear = creationDate.getFullYear();
      let startMonth = creationDate.getMonth();

      if (isNaN(startYear) || startYear > currentYear) {
        startYear = 2025;
        startMonth = 0;
      }

      let y = startYear;
      let m = startMonth;

      while (y < currentYear || (y === currentYear && m <= currentMonthIdx)) {
        monthsData.push({ month: allMonthsNames[m], year: y, monthIdx: m });
        m++;
        if (m > 11) {
          m = 0;
          y++;
        }
      }
    } else if (period === '12_months') {
      for (let i = 11; i >= 0; i--) {
        let mIdx = currentMonthIdx - i;
        let mYear = currentYear;
        if (mIdx < 0) {
          mIdx += 12;
          mYear -= 1;
        }
        monthsData.push({ month: allMonthsNames[mIdx], year: mYear, monthIdx: mIdx });
      }
    } else if (period === '2026') {
      for (let i = 0; i < 12; i++) {
        monthsData.push({ month: allMonthsNames[i], year: 2026, monthIdx: i });
      }
    } else {
      for (let i = 0; i < 12; i++) {
        monthsData.push({ month: allMonthsNames[i], year: 2025, monthIdx: i });
      }
    }

    const currentDivIdx = LEAGUE_DIVISIONS.findIndex((d) => d.id === gameState.currentDivision);

    return monthsData.map((item, index) => {
      let divIndex = Math.min(
        currentDivIdx,
        Math.max(0, currentDivIdx - Math.floor((monthsData.length - 1 - index) * 0.5))
      );
      
      if (index < monthsData.length - 1) {
        if ((item.monthIdx + index) % 3 === 0 && divIndex > 1) {
          divIndex = Math.max(0, divIndex - 1);
        }
      }

      const divisionObj = LEAGUE_DIVISIONS[divIndex] || LEAGUE_DIVISIONS[0];
      return {
        label: `${item.month}/${String(item.year).slice(2)}`,
        monthName: item.month,
        year: item.year,
        division: divisionObj,
        divRank: divIndex + 1,
        isCurrentMonth: item.year === currentYear && item.monthIdx === currentMonthIdx,
      };
    });
  };

  // Generate 12 weeks representation for calendar
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const currentWeek = parseInt(getCurrentISOWeekKey().split('-W')[1], 10) || 30;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Toast Feedback */}
      {feedbackMessage && (
        <div className="fixed top-20 right-4 z-50 bg-[#121212] text-white border-2 border-[#D4AF37] p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <Sparkles className="w-5 h-5 text-[#FFD700] shrink-0" />
          <span className="text-xs sm:text-sm font-bold">{feedbackMessage}</span>
        </div>
      )}

      {/* Top Banner - Duolingo Gamification Header */}
      <div className="bg-gradient-to-r from-[#121212] via-[#1E1E1E] to-[#121212] border-2 border-[#D4AF37] rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-[#FFD700]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -top-10 w-48 h-48 bg-[#FF69B4]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          {/* Flame & Division Icon */}
          <div className="flex items-center gap-5">
            <div className="relative group cursor-pointer">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-amber-500 via-orange-500 to-red-500 flex items-center justify-center shadow-lg transform group-hover:scale-105 transition border-2 border-amber-300">
                <Flame className="w-12 h-12 text-white animate-pulse" />
              </div>
              <span className="absolute -bottom-2 -right-2 bg-black text-[#FFD700] text-[10px] font-black px-2 py-0.5 rounded-full border border-[#D4AF37]">
                SEMANAL
              </span>
            </div>

            <div className="space-y-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-[#D4AF37] bg-black/60 px-3 py-1 rounded-full border border-[#D4AF37]/40">
                  🔥 OFENSIVA FINANCEIRA SEMANAL
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white font-serif tracking-tight">
                {gameState.weeklyStreakCount} Semanas Consecutivas!
              </h1>
              <p className="text-xs text-gray-300">
                Você mantém seus lançamentos e orçamento atualizados semanalmente.
              </p>
            </div>
          </div>

          {/* Gamification Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full md:w-auto shrink-0">
            {/* XP Total */}
            <div className="bg-black/50 border border-white/10 rounded-2xl p-2.5 text-center">
              <div className="flex items-center justify-center gap-1 text-amber-400 mb-0.5">
                <Zap className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase">XP Total</span>
              </div>
              <p className="text-sm sm:text-base font-black text-white">{gameState.xpTotal}</p>
            </div>

            {/* Gemas */}
            <div className="bg-black/50 border border-white/10 rounded-2xl p-2.5 text-center">
              <div className="flex items-center justify-center gap-1 text-cyan-400 mb-0.5">
                <Gem className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase">Gemas</span>
              </div>
              <p className="text-sm sm:text-base font-black text-cyan-300">💎 {gameState.gems}</p>
            </div>

            {/* Congelamento de Ofensiva */}
            <div className="bg-black/50 border border-blue-500/30 rounded-2xl p-2.5 text-center">
              <div className="flex items-center justify-center gap-1 text-blue-400 mb-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase">Congelamento</span>
              </div>
              <p className="text-sm sm:text-base font-black text-blue-300">
                🛡️ {gameState.streakFreezeCount} disp.
              </p>
            </div>

            {/* Divisão */}
            <div className="bg-black/50 border border-pink-500/30 rounded-2xl p-2.5 text-center">
              <div className="flex items-center justify-center gap-1 text-pink-400 mb-0.5">
                <Trophy className="w-3.5 h-3.5" />
                <span className="text-xs font-black uppercase">Divisão</span>
              </div>
              <p className="text-xs sm:text-sm font-black text-pink-300 truncate">
                {currentLeagueObj.icon} {gameState.currentDivision}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Duolingo Navigation Tabs */}
      <div className="flex items-center justify-between border-b-2 border-gray-200 bg-white p-1.5 rounded-2xl shadow-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('ofensiva')}
          className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'ofensiva'
              ? 'bg-amber-500 text-white shadow-md'
              : 'text-gray-600 hover:text-black hover:bg-gray-100'
          }`}
        >
          <Flame className="w-4 h-4 shrink-0" />
          <span>Ofensiva Semanal</span>
        </button>

        <button
          onClick={() => setActiveTab('liga')}
          className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'liga'
              ? 'bg-pink-600 text-white shadow-md'
              : 'text-gray-600 hover:text-black hover:bg-gray-100'
          }`}
        >
          <Trophy className="w-4 h-4 shrink-0" />
          <span>Divisões da Riqueza</span>
        </button>

        <button
          onClick={() => setActiveTab('missoes')}
          className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'missoes'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-gray-600 hover:text-black hover:bg-gray-100'
          }`}
        >
          <Award className="w-4 h-4 shrink-0" />
          <span>Missões</span>
        </button>

        <button
          onClick={() => setActiveTab('loja')}
          className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'loja'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-gray-600 hover:text-black hover:bg-gray-100'
          }`}
        >
          <ShoppingBag className="w-4 h-4 shrink-0" />
          <span>Loja 💎</span>
        </button>
      </div>

      {/* TAB 1: OFENSIVA SEMANAL (Calendar & Check-in) */}
      {activeTab === 'ofensiva' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Weekly Check-in Action Box */}
          <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-2 border-amber-300 rounded-3xl p-6 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className="bg-amber-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                  {Math.max(1, gameState.weeklyStreakCount || 1)}ª Semana (Reinício aos Domingos)
                </span>
                <span className="text-xs text-amber-800 font-bold">Check-in Automático</span>
              </div>
              <h2 className="text-lg font-black text-amber-950 font-serif">
                {gameState.hasCompletedWeeklyCheckIn
                  ? '✅ Check-in Semanal Realizado!'
                  : '🔥 Ofensiva Financeira Semanal Ativa'}
              </h2>
              <p className="text-xs text-amber-900 leading-relaxed max-w-xl">
                {gameState.hasCompletedWeeklyCheckIn
                  ? 'Excelente! Seu check-in foi realizado para esta semana. Continue assim para atingir a Meta XP Mensal e subir de divisão!'
                  : 'Sua presença semanal foi validada ao acessar o app. Mantenha seus lançamentos atualizados para concluir as missões da semana!'}
              </p>
            </div>

            <button
              onClick={handleWeeklyCheckIn}
              disabled={gameState.hasCompletedWeeklyCheckIn}
              className={`py-3.5 px-6 rounded-2xl font-black text-sm shadow-lg transition flex items-center gap-2 shrink-0 cursor-pointer ${
                gameState.hasCompletedWeeklyCheckIn
                  ? 'bg-emerald-600 text-white cursor-not-allowed opacity-90'
                  : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white border-2 border-amber-300 hover:scale-105'
              }`}
            >
              {gameState.hasCompletedWeeklyCheckIn ? (
                <>
                  <CheckCircle className="w-5 h-5 text-white" />
                  <span>Check-in Realizado</span>
                </>
              ) : (
                <>
                  <Flame className="w-5 h-5 text-white animate-bounce" />
                  <span>Realizar Check-in Semanal (+60 XP)</span>
                </>
              )}
            </button>
          </div>

          {/* Duolingo Weekly Calendar Grid */}
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-gray-900 font-serif flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-500" />
                  <span>Calendário da Ofensiva Semanal</span>
                </h3>
                <p className="text-xs text-gray-500">
                  Cada chama representa uma semana com check-in e lançamentos efetuados.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-amber-900">
                  Proteção: {gameState.streakFreezeCount} Congelamento(s)
                </span>
              </div>
            </div>

            {/* 12-Week Grid Visual (Duolingo Style) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-2">
              {Array.from({ length: 12 }).map((_, i) => {
                const weekDisplayIndex = i + 1;
                const isCompleted = i < gameState.weeklyStreakCount;
                const isCurrent = i === gameState.weeklyStreakCount || (i === 0 && gameState.weeklyStreakCount === 0);

                return (
                  <div
                    key={i}
                    className={`p-3 rounded-2xl border-2 text-center transition flex flex-col items-center justify-between gap-2 ${
                      isCompleted
                        ? 'bg-amber-50 border-amber-400 text-amber-950 shadow-xs'
                        : isCurrent
                        ? 'bg-orange-50 border-orange-400 text-orange-950 animate-pulse'
                        : 'bg-gray-50 border-gray-200 text-gray-400'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                      {weekDisplayIndex}ª Semana
                    </span>

                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${
                        isCompleted
                          ? 'bg-amber-500 text-white shadow-md'
                          : isCurrent
                          ? 'bg-orange-400 text-white'
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {isCompleted ? (
                        <Flame className="w-6 h-6 text-white" />
                      ) : (
                        <span className="text-xs">{weekDisplayIndex}</span>
                      )}
                    </div>

                    <span className="text-[10px] font-bold">
                      {isCompleted ? 'Concluída' : isCurrent ? 'Semana Atual' : 'Pendente'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Goal Progress Bar */}
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-900 font-serif">Meta de Ofensiva Semanal</h3>
              <span className="text-xs font-black text-amber-600">{gameState.weeklyStreakCount} / 52 Semanas</span>
            </div>

            <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-200">
              <div
                className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (gameState.weeklyStreakCount / 52) * 100)}%` }}
              />
            </div>

            <div className="flex justify-between text-[11px] text-gray-500 font-bold pt-1">
              <span>🎯 4 Semanas (Iniciante)</span>
              <span>🥇 26 Semanas (Meio Ano)</span>
              <span>🏆 52 Semanas (Lenda Financeira)</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIGA & DIVISÃO (Personal Division Challenge) */}
      {activeTab === 'liga' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Hero Banner: Division Pearl */}
          <div className="bg-gradient-to-b from-pink-950 via-[#1A0B18] to-[#121212] border-2 border-pink-500 rounded-3xl p-8 text-center text-white shadow-2xl space-y-4 relative overflow-hidden">
            <div className="w-28 h-28 mx-auto bg-gradient-to-tr from-pink-500 via-purple-500 to-rose-400 rounded-full flex items-center justify-center p-4 border-4 border-pink-300 shadow-2xl animate-bounce">
              <span className="text-6xl">{currentLeagueObj.icon}</span>
            </div>

            <div className="space-y-3 max-w-xl mx-auto">
              <span className="text-xs font-black text-pink-300 uppercase tracking-widest bg-pink-900/60 px-3.5 py-1 rounded-full border border-pink-400/40">
                LIGA DA RIQUEZA
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white font-serif">
                🎉 Parabéns! Você está na {currentLeagueObj.name}!
              </h2>
              <p className="text-xs sm:text-sm font-bold text-amber-300">
                {currentLeagueObj.subtitle} — {currentLeagueObj.description}
              </p>

              {/* Box Inspirador e Intuitivo sobre como avançar para a próxima divisão */}
              {(() => {
                const userMetrics = calculateUserFinancialMetrics(userId);
                const currentDivIndex = LEAGUE_DIVISIONS.findIndex((d) => d.id === gameState.currentDivision);
                const nextDiv = LEAGUE_DIVISIONS[currentDivIndex + 1];

                if (!nextDiv) {
                  return (
                    <div className="mt-3 p-4 bg-amber-500/20 border border-amber-400/50 rounded-2xl text-amber-200 text-xs font-bold text-center">
                      🏆 Você atingiu o topo da Liga da Riqueza! Continue mantendo sua disciplina financeira e acumulando rendimentos na Divisão Liberdade Financeira!
                    </div>
                  );
                }

                const xpNeeded = Math.max(0, nextDiv.minXP - gameState.xpTotal);
                const qual = checkDivisionQualification(nextDiv.id, gameState.xpTotal, userMetrics);

                return (
                  <div className="mt-4 p-4 bg-white/10 backdrop-blur-md border border-pink-400/40 rounded-2xl text-left space-y-3 text-xs shadow-inner">
                    <div className="flex items-center justify-between border-b border-pink-400/30 pb-2">
                      <div className="flex items-center gap-2 font-black text-pink-200 text-xs sm:text-sm">
                        <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                        <span>Requisitos para a {nextDiv.name} ({nextDiv.subtitle}):</span>
                      </div>
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                        qual.metFinancial ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/50' : 'bg-rose-500/30 text-rose-200 border border-rose-400/50'
                      }`}>
                        {qual.metFinancial ? '🟢 Requisito Financeiro Atendido' : '🔴 Requisito Financeiro Pendente'}
                      </span>
                    </div>

                    <ul className="space-y-2 text-pink-100 font-medium leading-relaxed">
                      <li className="flex items-start gap-2 bg-black/20 p-2.5 rounded-xl border border-white/5">
                        <span className="text-amber-400 font-black shrink-0">🎯 Meta da Divisão:</span>
                        <span>{nextDiv.goal}</span>
                      </li>
                      <li className="flex items-start gap-2 bg-black/20 p-2.5 rounded-xl border border-white/5">
                        <span className="text-emerald-400 font-black shrink-0">📌 Critério Financeiro Real:</span>
                        <div className="space-y-1">
                          <p className="font-bold text-white">{nextDiv.financialReq}</p>
                          {!qual.metFinancial && qual.reasonIfNotMet && (
                            <p className="text-[11px] text-rose-300 font-bold bg-rose-950/60 p-2 rounded-lg border border-rose-500/30 flex items-center gap-1.5 mt-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                              <span>{qual.reasonIfNotMet}</span>
                            </p>
                          )}
                        </div>
                      </li>
                      <li className="flex items-start gap-2 bg-black/20 p-2.5 rounded-xl border border-white/5">
                        <span className="text-cyan-300 font-black shrink-0">⚡ Meta XP:</span>
                        <span>
                          {xpNeeded === 0 ? (
                            <strong className="text-emerald-300 font-black">✓ Meta XP Atingida ({gameState.xpTotal} / {nextDiv.minXP} XP)</strong>
                          ) : (
                            <span>Faltam <strong className="text-amber-300 font-black">{xpNeeded} XP</strong> ({gameState.xpTotal} XP de {nextDiv.minXP} XP necessários).</span>
                          )}
                        </span>
                      </li>
                    </ul>
                  </div>
                );
              })()}
            </div>

            {/* League Progress Map (10 Divisions) */}
            <div className="pt-4 border-t border-pink-500/30 overflow-x-auto">
              <p className="text-xs text-pink-300 font-bold mb-3">Progresso das 10 Divisões da Riqueza Financeiro:</p>
              <div className="flex items-center justify-start sm:justify-center gap-2 min-w-[700px] py-2">
                {LEAGUE_DIVISIONS.map((div, idx) => {
                  const isCurrent = div.id === gameState.currentDivision;
                  const isUnlocked = LEAGUE_DIVISIONS.findIndex((d) => d.id === gameState.currentDivision) >= idx;

                  return (
                    <div key={div.id} className="flex items-center gap-1">
                      <div
                        className={`p-2.5 rounded-2xl border flex items-center gap-1.5 text-xs font-black transition ${
                          isCurrent
                            ? 'bg-pink-500 text-white border-white ring-4 ring-pink-400/50 scale-110 shadow-lg'
                            : isUnlocked
                            ? 'bg-white/10 text-white border-pink-400/40'
                            : 'bg-black/40 text-gray-500 border-white/5 opacity-50'
                        }`}
                        title={`${div.name} (${div.minXP} XP)`}
                      >
                        <span>{div.icon}</span>
                        <span className="text-[10px] whitespace-nowrap">{div.name.replace('Divisão ', '')}</span>
                      </div>
                      {idx < LEAGUE_DIVISIONS.length - 1 && (
                        <ChevronRight className="w-3 h-3 text-pink-400/50 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Personal Division Goal & Progression Graph */}
          {(() => {
            const currentDivIndex = LEAGUE_DIVISIONS.findIndex((d) => d.id === gameState.currentDivision);
            const nextDiv = LEAGUE_DIVISIONS[currentDivIndex + 1];

            return (
              <div className="space-y-6">
                {/* Graph showing division per month */}
                <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-md space-y-5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                    <div>
                      <h3 className="text-base font-black text-gray-900 font-serif flex items-center gap-2">
                        <Award className="w-5 h-5 text-pink-600" />
                        <span>Histórico de Divisões por Mês</span>
                      </h3>
                      <p className="text-xs text-gray-500">
                        Veja em qual divisão financeira você ficou em cada mês e acompanhe sua constante evolução.
                      </p>
                    </div>

                    {/* Period selector */}
                    <div className="flex flex-wrap items-center gap-1 bg-gray-100 p-1 rounded-2xl border border-gray-200 shrink-0">
                      <button
                        type="button"
                        onClick={() => setChartPeriod('desde_inicio')}
                        className={`px-3 py-1 text-xs font-black rounded-xl transition cursor-pointer ${
                          chartPeriod === 'desde_inicio'
                            ? 'bg-pink-600 text-white shadow-xs'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Desde a Criação da Conta
                      </button>
                      <button
                        type="button"
                        onClick={() => setChartPeriod('12_months')}
                        className={`px-3 py-1 text-xs font-black rounded-xl transition cursor-pointer ${
                          chartPeriod === '12_months'
                            ? 'bg-pink-600 text-white shadow-xs'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        12 Meses
                      </button>
                      <button
                        type="button"
                        onClick={() => setChartPeriod('2026')}
                        className={`px-3 py-1 text-xs font-black rounded-xl transition cursor-pointer ${
                          chartPeriod === '2026'
                            ? 'bg-pink-600 text-white shadow-xs'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        2026
                      </button>
                      <button
                        type="button"
                        onClick={() => setChartPeriod('2025')}
                        className={`px-3 py-1 text-xs font-black rounded-xl transition cursor-pointer ${
                          chartPeriod === '2025'
                            ? 'bg-pink-600 text-white shadow-xs'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        2025
                      </button>
                    </div>
                  </div>

                  {/* Monthly Bar Chart */}
                  {(() => {
                    const monthlyData = getMonthlyDivisionData(chartPeriod);

                    return (
                      <div className="space-y-4">
                        <div className="pt-2 pb-2 px-1 overflow-x-auto">
                          <div className="flex items-end justify-between gap-2 min-w-[650px] h-48 pb-2 border-b border-gray-200">
                            {monthlyData.map((item, idx) => {
                              const heightPct = Math.max(22, (item.divRank / 10) * 100);

                              return (
                                <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5 group relative">
                                  {/* Badge icon */}
                                  <span className="text-lg group-hover:scale-125 transition transform duration-200">
                                    {item.division.icon}
                                  </span>

                                  {/* Bar container */}
                                  <div className="w-full max-w-[34px] bg-gray-100 rounded-2xl overflow-hidden p-0.5 flex flex-col justify-end h-full">
                                    <div
                                      className={`w-full rounded-xl transition-all duration-500 shadow-xs ${
                                        item.isCurrentMonth
                                          ? 'bg-gradient-to-t from-pink-600 to-purple-500 ring-2 ring-pink-400'
                                          : 'bg-gradient-to-t from-amber-500 via-amber-400 to-yellow-300 opacity-90 group-hover:opacity-100'
                                      }`}
                                      style={{ height: `${heightPct}%` }}
                                    />
                                  </div>

                                  {/* Month label and division name */}
                                  <div className="text-center space-y-0.5">
                                    <span className="text-[10px] font-black text-gray-800 block">{item.label}</span>
                                    <span className="text-[9px] font-extrabold text-pink-700 truncate block max-w-[55px]" title={item.division.name}>
                                      {item.division.name.replace('Divisão ', '')}
                                    </span>
                                  </div>

                                  {/* Hover Tooltip */}
                                  <div className="absolute bottom-16 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-30 bg-gray-900 text-white p-3 rounded-2xl shadow-xl text-left w-48 border border-amber-400/50">
                                    <div className="flex items-center gap-1.5 font-black text-amber-300 text-xs">
                                      <span>{item.division.icon}</span>
                                      <span>{item.division.name}</span>
                                    </div>
                                    <p className="text-[10px] text-gray-300 font-bold mt-1">{item.division.subtitle}</p>
                                    <p className="text-[10px] text-gray-400 mt-1">{item.division.goal}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Inspirational Footer */}
                        <div className="p-3 bg-gradient-to-r from-pink-50 via-purple-50 to-amber-50 border border-pink-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-pink-600 shrink-0" />
                            <span className="font-extrabold text-gray-800">
                              Sua Evolução no Período: <span className="text-pink-700">100% focada nas suas próprias metas!</span>
                            </span>
                          </div>
                          <span className="text-[11px] font-black bg-white px-3 py-1 rounded-xl border border-pink-200 text-purple-900 shadow-2xs">
                            Divisão Atual: {currentLeagueObj.icon} {currentLeagueObj.name}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-md space-y-5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                    <div>
                      <h3 className="text-base font-black text-gray-900 font-serif flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        <span>Progresso na Liga da Riqueza</span>
                      </h3>
                      <p className="text-xs text-gray-500">
                        Sua divisão reflete sua realidade financeira atual. Cumpra as metas para subir!
                      </p>
                    </div>

                    <span className="text-xs font-black bg-pink-100 text-pink-800 px-3 py-1 rounded-xl">
                      XP Acumulado: {gameState.xpTotal} XP
                    </span>
                  </div>

                  {nextDiv ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs font-black">
                        <span className="text-gray-700 flex items-center gap-1">
                          <span>{currentLeagueObj.icon} {currentLeagueObj.name} ({currentLeagueObj.subtitle})</span>
                        </span>
                        <span className="text-pink-600 flex items-center gap-1">
                          <span>Próxima: {nextDiv.icon} {nextDiv.name} ({nextDiv.minXP} XP)</span>
                        </span>
                      </div>

                      <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden border border-gray-200 p-0.5">
                        <div
                          className="h-full bg-gradient-to-r from-pink-500 to-purple-600 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, (gameState.xpTotal / nextDiv.minXP) * 100)}%`,
                          }}
                        />
                      </div>

                      <div className="text-right text-xs text-gray-500 font-bold">
                        Faltam <strong className="text-pink-600">{Math.max(0, nextDiv.minXP - gameState.xpTotal)} XP</strong> para alcançar a {nextDiv.name}!
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-center text-amber-900 font-bold text-xs">
                      🏆 Parabéns! Você atingiu a Divisão Máxima ({currentLeagueObj.name})!
                    </div>
                  )}

                  {/* Personal Weekly Targets Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="p-4 bg-pink-50/60 border border-pink-200 rounded-2xl text-center space-y-1">
                      <span className="text-[10px] font-black uppercase text-pink-700">Meta XP Mensal</span>
                      <p className="text-lg font-black text-pink-950">{gameState.weeklyXP} / 300 XP</p>
                      <span className="text-[10px] text-emerald-600 font-bold">
                        {gameState.weeklyXP >= 300 ? '✅ Meta Mensal Batida!' : '🔥 Em progresso'}
                      </span>
                    </div>

                    <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl text-center space-y-1">
                      <span className="text-[10px] font-black uppercase text-amber-700">Recorde de Ofensiva</span>
                      <p className="text-lg font-black text-amber-950">{gameState.weeklyStreakCount} Semanas</p>
                      <span className="text-[10px] text-amber-700 font-bold">Inabalável!</span>
                    </div>

                    <div className="p-4 bg-cyan-50/60 border border-cyan-200 rounded-2xl text-center space-y-1">
                      <span className="text-[10px] font-black uppercase text-cyan-700">Gemas Acumuladas</span>
                      <p className="text-lg font-black text-cyan-950">💎 {gameState.gems}</p>
                      <span className="text-[10px] text-cyan-700 font-bold">Disponíveis na Loja</span>
                    </div>
                  </div>
                </div>

                {/* Diagnóstico em Tempo Real da Saúde Financeira x Requisitos da Divisão */}
                {(() => {
                  const m = calculateUserFinancialMetrics(userId);
                  return (
                    <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-2 border-amber-500/50 rounded-3xl p-6 text-white shadow-xl space-y-4">
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-5 h-5 text-amber-400" />
                          <h4 className="text-sm font-black uppercase tracking-wider text-amber-300">
                            Diagnóstico dos seus Requisitos Financeiros Reais
                          </h4>
                        </div>
                        <span className="text-[10px] font-bold bg-white/10 text-gray-300 px-3 py-1 rounded-full border border-white/10">
                          Atualizado em Tempo Real
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        {/* Indicador 1: Superávit / Déficit */}
                        <div className={`p-4 rounded-2xl border ${m.isDeficit ? 'bg-rose-950/50 border-rose-500/50 text-rose-100' : 'bg-emerald-950/50 border-emerald-500/50 text-emerald-100'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-extrabold uppercase text-[10px]">Resultado Mensal</span>
                            <span className="text-base">{m.isDeficit ? '🔴' : '🟢'}</span>
                          </div>
                          <p className="text-sm font-black">
                            {m.isDeficit ? 'Déficit no Mês' : 'Superávit no Mês'}
                          </p>
                          <p className="text-[11px] opacity-80 mt-1">
                            Receitas: R$ {m.monthlyIncome.toFixed(2)} | Despesas: R$ {m.monthlyExpense.toFixed(2)}
                          </p>
                        </div>

                        {/* Indicador 2: Reserva de Emergência */}
                        <div className={`p-4 rounded-2xl border ${!m.hasEmergencyReserve ? 'bg-amber-950/50 border-amber-500/50 text-amber-100' : 'bg-emerald-950/50 border-emerald-500/50 text-emerald-100'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-extrabold uppercase text-[10px]">Reserva de Emergência</span>
                            <span className="text-base">{m.hasEmergencyReserve ? '🟢' : '🟡'}</span>
                          </div>
                          <p className="text-sm font-black">
                            {m.hasEmergencyReserve ? 'Reserva Ativa Guardada' : 'Sem Reserva Guardada'}
                          </p>
                          <p className="text-[11px] opacity-80 mt-1">
                            Saldo em Objetivos: R$ {m.emergencyReserveAmount.toFixed(2)}
                          </p>
                        </div>

                        {/* Indicador 3: Boletos e Pendências */}
                        <div className={`p-4 rounded-2xl border ${m.overdueCount > 0 ? 'bg-rose-950/50 border-rose-500/50 text-rose-100' : 'bg-emerald-950/50 border-emerald-500/50 text-emerald-100'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-extrabold uppercase text-[10px]">Contas em Atraso</span>
                            <span className="text-base">{m.overdueCount > 0 ? '🔴' : '🟢'}</span>
                          </div>
                          <p className="text-sm font-black">
                            {m.overdueCount > 0 ? `${m.overdueCount} Conta(s) Pendente(s)` : 'Zero Contas em Atraso'}
                          </p>
                          <p className="text-[11px] opacity-80 mt-1">
                            {m.overdueCount > 0 ? 'Regularize boletos vencidos' : 'Todas as contas estão em dia'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* All 10 Divisions Visual Goals Breakdown Graph */}
                <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-md space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div>
                      <h4 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <Award className="w-4 h-4 text-[#D4AF37]" />
                        <span>Mapa Completo das 10 Divisões da Riqueza & Metas</span>
                      </h4>
                      <p className="text-xs text-gray-500">
                        Enquadre-se na divisão que melhor se ajusta à sua realidade no momento.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(() => {
                      const userMetrics = calculateUserFinancialMetrics(userId);
                      return LEAGUE_DIVISIONS.map((div, idx) => {
                        const isCurrent = div.id === gameState.currentDivision;
                        const isUnlocked = LEAGUE_DIVISIONS.findIndex((d) => d.id === gameState.currentDivision) >= idx;
                        const qualification = checkDivisionQualification(div.id, gameState.xpTotal, userMetrics);

                        return (
                          <div
                            key={div.id}
                            className={`p-4 rounded-2xl border transition space-y-2.5 ${
                              isCurrent
                                ? 'bg-amber-50/90 border-[#D4AF37] ring-2 ring-[#D4AF37]/50 shadow-md'
                                : isUnlocked
                                ? 'bg-emerald-50/50 border-emerald-200'
                                : 'bg-gray-50 border-gray-200 opacity-80'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{div.icon}</span>
                                <div>
                                  <h5 className="text-xs font-black text-gray-900">
                                    {div.name}
                                  </h5>
                                  <p className="text-[11px] font-bold text-gray-600">{div.subtitle}</p>
                                </div>
                              </div>
                              <span
                                className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                                  isCurrent
                                    ? 'bg-[#D4AF37] text-black'
                                    : isUnlocked
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-gray-200 text-gray-600'
                                }`}
                              >
                                {isCurrent ? 'Sua Divisão' : isUnlocked ? 'Alcançada' : `${div.minXP} XP`}
                              </span>
                            </div>

                            <p className="text-[11px] text-gray-700 font-medium leading-relaxed">
                              {div.description}
                            </p>

                            <div className="pt-2 border-t border-gray-200/60 space-y-1 text-[11px]">
                              <div className="flex items-start gap-1.5">
                                <Target className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <span className="font-extrabold text-gray-800">
                                  Meta: <span className="font-medium text-gray-600">{div.goal}</span>
                                </span>
                              </div>
                              <div className="flex items-start gap-1.5 bg-white/80 p-2 rounded-xl border border-gray-100">
                                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                  <p className="font-extrabold text-gray-800">
                                    Critério Real: <span className="font-medium text-gray-700">{div.financialReq}</span>
                                  </p>
                                  {!qualification.metFinancial && (
                                    <p className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 shrink-0" />
                                      <span>{qualification.reasonIfNotMet || 'Requisito financeiro pendente'}</span>
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 3: MISSÕES SEMANAIS */}
      {activeTab === 'missoes' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div>
                <h3 className="text-base font-black text-gray-900 font-serif flex items-center gap-2">
                  <Award className="w-5 h-5 text-blue-600" />
                  <span>Missões da Semana</span>
                </h3>
                <p className="text-xs text-gray-500">
                  Complete os desafios financeiros da semana para ganhar XP e Gemas 💎!
                </p>
              </div>

              <span className="text-xs text-blue-800 font-bold bg-blue-50 px-3 py-1 rounded-xl">
                Renova toda segunda-feira
              </span>
            </div>

            {/* Onboarding Progressivo Level Selector */}
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border-2 border-blue-200 rounded-2xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-black uppercase text-blue-900 tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>Jornada de Onboarding Progressivo</span>
                  </h4>
                  <p className="text-xs text-blue-800 font-medium">
                    Escolha seu perfil financeiro atual para receber missões perfeitamente adaptadas ao seu momento.
                  </p>
                </div>
                <span className="text-[10px] font-extrabold bg-blue-600 text-white px-2.5 py-1 rounded-full uppercase">
                  Perfil: {gameState.userProfileLevel === 'avancado' ? 'Avançado' : 'Iniciante'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectLevel('iniciante')}
                  className={`p-3 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                    gameState.userProfileLevel !== 'avancado'
                      ? 'bg-white border-blue-600 ring-2 ring-blue-300 shadow-sm'
                      : 'bg-white/60 border-gray-200 text-gray-700 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-gray-900">🌱 Perfil Iniciante</span>
                    {gameState.userProfileLevel !== 'avancado' && <CheckCircle className="w-4 h-4 text-blue-600" />}
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1">
                    <strong>Foco:</strong> Construir Reserva de Emergência, eliminar contas em atraso e mapear gastos fixos.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectLevel('avancado')}
                  className={`p-3 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                    gameState.userProfileLevel === 'avancado'
                      ? 'bg-white border-blue-600 ring-2 ring-blue-300 shadow-sm'
                      : 'bg-white/60 border-gray-200 text-gray-700 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-gray-900">🚀 Perfil Avançado</span>
                    {gameState.userProfileLevel === 'avancado' && <CheckCircle className="w-4 h-4 text-blue-600" />}
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1">
                    <strong>Foco:</strong> Maximizar Aportes mensais (+20%), diversificar carteira e acelerar independência financeira.
                  </p>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gameState.weeklyQuests.map((quest) => (
                <div
                  key={quest.id}
                  className={`p-4 rounded-2xl border-2 transition space-y-3 ${
                    quest.completed
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                      : 'bg-white border-gray-200 text-gray-900 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <h4 className="text-xs sm:text-sm font-black flex items-center gap-1.5">
                        {quest.completed && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />}
                        <span>{quest.title}</span>
                      </h4>
                      <p className="text-xs text-gray-600">{quest.description}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-amber-600 block">+{quest.xpReward} XP</span>
                      <span className="text-[11px] font-bold text-cyan-600 block">💎 +{quest.gemsReward}</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold text-gray-500">
                      <span>Progresso</span>
                      <span>{quest.currentProgress} / {quest.targetProgress}</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          quest.completed ? 'bg-emerald-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${Math.min(100, (quest.currentProgress / quest.targetProgress) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Resgate Otimista */}
                  <div className="pt-2 flex items-center justify-between border-t border-gray-100">
                    <span className="text-[11px] font-medium text-gray-500">
                      {quest.completed
                        ? '✅ Desafio concluído'
                        : `${Math.max(0, quest.targetProgress - quest.currentProgress)} restante(s)`}
                    </span>
                    {!quest.completed && quest.currentProgress >= quest.targetProgress ? (
                      <button
                        type="button"
                        onClick={() => handleClaimMission(quest.id)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-xs animate-bounce"
                      >
                        Resgatar 🎁
                      </button>
                    ) : quest.completed ? (
                      <span className="text-[11px] font-black text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-lg">
                        Resgatado
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Permanentes Badges */}
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-md space-y-4">
            <h3 className="text-base font-black text-gray-900 font-serif flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>Conquistas Permanentes</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {gameState.achievements.map((ach) => (
                <div
                  key={ach.id}
                  className={`p-4 rounded-2xl border-2 text-center transition space-y-2 ${
                    ach.unlocked
                      ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-xs'
                      : 'bg-gray-50 border-gray-200 text-gray-400 opacity-60'
                  }`}
                >
                  <div className={`w-12 h-12 mx-auto rounded-2xl flex items-center justify-center font-black text-lg ${
                    ach.unlocked ? 'bg-amber-400 text-amber-950 shadow-md' : 'bg-gray-200 text-gray-400'
                  }`}>
                    {ach.unlocked ? '🏆' : '🔒'}
                  </div>
                  <h4 className="text-xs font-black">{ach.title}</h4>
                  <p className="text-[10px] text-gray-500 leading-tight">{ach.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: LOJA DE GEMAS 💎 */}
      {activeTab === 'loja' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-gradient-to-r from-emerald-900 to-teal-950 border-2 border-emerald-500 rounded-3xl p-6 text-white shadow-xl flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-black text-emerald-300 uppercase">LOJA FINANCEIRA DUOLINGO</span>
              <h3 className="text-xl font-black font-serif">Troque suas Gemas por Benefícios!</h3>
              <p className="text-xs text-emerald-200">
                Seu saldo atual: <strong className="text-cyan-300 text-sm">💎 {gameState.gems} Gemas</strong>
              </p>
            </div>
            <div className="p-4 bg-emerald-800/60 rounded-2xl border border-emerald-400/40 text-center shrink-0">
              <Gem className="w-8 h-8 text-cyan-300 mx-auto mb-1 animate-pulse" />
              <span className="text-xs font-black text-white">💎 {gameState.gems}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Item 1: Congelamento de Ofensiva */}
            <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-md space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl relative shrink-0">
                      <ShieldCheck className="w-6 h-6" />
                      {gameState.streakFreezeCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                          {gameState.streakFreezeCount}
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-gray-900">Congelamento de Ofensiva Semanal</h4>
                      <p className="text-xs text-gray-500">Protege sua ofensiva caso você esqueça de fazer o check-in por 1 semana.</p>
                    </div>
                  </div>
                </div>

                {/* Badge de Disponibilidade em Inventário */}
                <div className="p-2.5 bg-blue-50/80 border border-blue-200/80 rounded-2xl text-[11px] font-bold text-blue-950 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Seu Inventário Atual:</span>
                  </span>
                  <span className="text-xs font-black text-blue-800 bg-white px-2.5 py-0.5 rounded-xl border border-blue-200 shadow-2xs">
                    {gameState.streakFreezeCount} disponível(is)
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-xs font-black text-cyan-600">💎 450 Gemas</span>
                <button
                  onClick={handleBuyFreeze}
                  className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Comprar Item</span>
                </button>
              </div>
            </div>

            {/* Item 2: Dobro de XP */}
            <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-md space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-gray-900">Dobro de XP por 7 Dias</h4>
                    <p className="text-xs text-gray-500">Duplica todos os seus ganhos de XP ao cadastrar transações.</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-xs font-black text-cyan-600">💎 600 Gemas</span>
                <button
                  onClick={handleBuyDoubleXP}
                  className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-xs"
                >
                  Comprar Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
