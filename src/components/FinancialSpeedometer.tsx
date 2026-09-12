import React, { useState, useEffect, useMemo } from 'react';
import {
  Gauge,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Minus,
  Info,
  Sliders,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  MapPin,
  Users,
} from 'lucide-react';
import { LgpdTermsModal } from './LgpdTermsModal';

export interface FinancialSpeedometerProps {
  /** User's income commitment percentage (0 to 100+%) */
  percentualUsuario: number;
  /** Anonymized regional benchmark percentage (e.g. 68) */
  mediaRegional: number;
  /** City and State (e.g. "Belo Horizonte, MG") */
  localidade: string;
  /** Demographic age group (e.g. "25-34 anos") */
  faixaEtaria: string;
  /** Optional monthly income in BRL for contextual monetary insights */
  rendaMensal?: number;
  /** Optional total expenses in BRL */
  despesasTotais?: number;
  className?: string;
}

/**
 * Calculates SVG arc path from startPct to endPct along the 180° upper semicircle.
 * 0% is at the left (180°), 100% is at the right (0°).
 */
function describeArc(
  cx: number,
  cy: number,
  r: number,
  startPct: number,
  endPct: number
): string {
  const clampedStart = Math.max(0, Math.min(100, startPct));
  const clampedEnd = Math.max(0, Math.min(100, endPct));

  const startAngle = (180 - clampedStart * 1.8) * (Math.PI / 180);
  const endAngle = (180 - clampedEnd * 1.8) * (Math.PI / 180);

  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy - r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy - r * Math.sin(endAngle);

  // In an upper 180° semicircle gauge (0% to 100%), the arc angle span
  // between start and end never exceeds 180°. Therefore, largeArcFlag is ALWAYS 0.
  const largeArcFlag = 0;
  // Sweep flag 1 draws the upper arc clockwise (from left to right in SVG coordinates)
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export const FinancialSpeedometer: React.FC<FinancialSpeedometerProps> = ({
  percentualUsuario,
  mediaRegional,
  localidade,
  faixaEtaria,
  rendaMensal,
  despesasTotais,
  className = '',
}) => {
  // Interactive Simulation state
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedPct, setSimulatedPct] = useState<number>(percentualUsuario);

  // Animated angle for pointer loading transition
  const [animatedPct, setAnimatedPct] = useState<number>(0);

  // LGPD Privacy Modal
  const [isLgpdModalOpen, setIsLgpdModalOpen] = useState(false);

  // Tooltip for regional reference marker
  const [showRegionalTooltip, setShowRegionalTooltip] = useState(false);

  // Current active value (real or simulated)
  const currentPct = isSimulating ? simulatedPct : percentualUsuario;
  const clampedDisplayPct = Math.max(0, Math.round(currentPct));
  const needleClampedPct = Math.min(Math.max(currentPct, 0), 100);

  // Trigger smooth pointer transition on mount and prop updates
  useEffect(() => {
    // Start at 0 and transition to target
    const timer = setTimeout(() => {
      setAnimatedPct(needleClampedPct);
    }, 50);
    return () => clearTimeout(timer);
  }, [needleClampedPct]);

  // Keep simulated value in sync when prop changes and not simulating
  useEffect(() => {
    if (!isSimulating) {
      setSimulatedPct(percentualUsuario);
    }
  }, [percentualUsuario, isSimulating]);

  // SVG Geometry constants
  const cx = 160;
  const cy = 152;
  const radius = 108;
  const strokeWidth = 20;

  // Pointer Needle angle: -90° (at 0%) to +90° (at 100%)
  const needleAngle = (animatedPct / 100) * 180 - 90;

  // Regional Marker geometry
  const clampedRegional = Math.min(Math.max(mediaRegional, 0), 100);
  const regionalAngleRad = (180 - clampedRegional * 1.8) * (Math.PI / 180);
  const regInnerR = radius - strokeWidth / 2 - 3;
  const regOuterR = radius + strokeWidth / 2 + 5;
  const regX1 = cx + regInnerR * Math.cos(regionalAngleRad);
  const regY1 = cy - regInnerR * Math.sin(regionalAngleRad);
  const regX2 = cx + regOuterR * Math.cos(regionalAngleRad);
  const regY2 = cy - regOuterR * Math.sin(regionalAngleRad);

  // Regional marker pin circle coordinate (outer tip)
  const regPinR = radius + strokeWidth / 2 + 9;
  const regPinX = cx + regPinR * Math.cos(regionalAngleRad);
  const regPinY = cy - regPinR * Math.sin(regionalAngleRad);

  // Difference vs regional benchmark
  const diff = Math.round(currentPct - mediaRegional);
  const absDiff = Math.abs(diff);

  // Budget Health Status
  const healthStatus = useMemo(() => {
    if (currentPct <= 60) {
      return {
        level: 'green',
        title: 'Equilíbrio Orçamentário',
        subtitle: 'Zona Segura (0% a 60%)',
        badgeBg: 'bg-emerald-100 text-[#008736] border-emerald-300',
        cardBg: 'bg-emerald-50/70 border-emerald-200 text-emerald-950',
        icon: CheckCircle2,
        needleColor: '#00C853',
        description: 'Seu comprometimento de renda está saudável, permitindo poupança regular e aportes para investimentos.',
      };
    }
    if (currentPct <= 80) {
      return {
        level: 'yellow',
        title: 'Atenção Orçamentária',
        subtitle: 'Zona Moderada (61% a 80%)',
        badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
        cardBg: 'bg-amber-50/70 border-amber-200 text-amber-950',
        icon: AlertTriangle,
        needleColor: '#D4AF37',
        description: 'Seus custos fixos estão consumindo a maior parte da renda. Recomendado revisar assinaturas e gastos variáveis.',
      };
    }
    return {
      level: 'red',
      title: 'Alerta de Endividamento',
      subtitle: 'Zona Crítica (81% a 100%+)',
      badgeBg: 'bg-red-100 text-red-900 border-red-300',
      cardBg: 'bg-red-50/70 border-red-200 text-red-950',
      icon: AlertOctagon,
      needleColor: '#EF4444',
      description: 'Comprometimento elevado! Quase a totalidade da renda está em despesas, aumentando o risco de endividamento.',
    };
  }, [currentPct]);

  const StatusIcon = healthStatus.icon;

  return (
    <div
      className={`bg-white border border-gray-200 rounded-3xl p-4 sm:p-6 shadow-xs hover:shadow-md transition-all relative overflow-hidden ${className}`}
      id="velocimetro-financeiro-card"
    >
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[#121212] flex items-center justify-center text-[#D4AF37] shadow-sm shrink-0">
            <Gauge className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-extrabold text-[#121212] font-serif">
                Velocímetro Financeiro
              </h3>
              <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                Comprometimento
              </span>
            </div>
            <p className="text-[11px] text-gray-500 font-medium">
              Saúde da sua renda vs. referência regional anônima
            </p>
          </div>
        </div>

        {/* Action button: Toggle Simulation Mode */}
        <button
          type="button"
          onClick={() => {
            setIsSimulating((prev) => !prev);
            if (isSimulating) {
              setSimulatedPct(percentualUsuario);
            }
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto border ${
            isSimulating
              ? 'bg-[#121212] text-[#D4AF37] border-[#D4AF37]'
              : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
          }`}
          title="Alternar entre dados reais do mês e simulação livre"
          id="btn-toggle-simulador"
        >
          {isSimulating ? (
            <>
              <RotateCcw className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Voltar aos Dados Reais</span>
            </>
          ) : (
            <>
              <Sliders className="w-3.5 h-3.5 text-gray-600" />
              <span>Simular Cenários</span>
            </>
          )}
        </button>
      </div>

      {/* Interactive Simulation Slider Bar (Active only when simulating) */}
      {isSimulating && (
        <div className="mt-3 p-3 bg-amber-50/80 border border-amber-200 rounded-2xl animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs font-bold text-amber-900 mb-1.5">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Simulador de Comprometimento:</span>
            </span>
            <span className="font-mono text-sm font-black text-[#121212] bg-white px-2 py-0.5 rounded-lg border border-amber-300">
              {simulatedPct}% da renda
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="120"
            step="1"
            value={simulatedPct}
            onChange={(e) => setSimulatedPct(Number(e.target.value))}
            className="w-full h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-[#121212]"
            id="simulador-range-input"
          />
          <div className="flex justify-between text-[10px] text-amber-800 font-bold mt-1">
            <span>0% (Sem gastos)</span>
            <span>60% (Equilíbrio)</span>
            <span>80% (Atenção)</span>
            <span>120% (Déficit)</span>
          </div>
        </div>
      )}

      {/* Main Gauge Visual Stage */}
      <div className="py-4 flex flex-col items-center justify-center relative">
        <div className="relative w-full max-w-[320px] aspect-[320/185]">
          <svg
            viewBox="0 0 320 185"
            className="w-full h-full overflow-visible select-none"
            aria-label={`Velocímetro financeiro indicando ${clampedDisplayPct}% de comprometimento da renda`}
          >
            <defs>
              {/* Drop Shadow for the Needle Pin */}
              <filter id="gaugeShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.25" />
              </filter>

              {/* Gradient for Green Zone */}
              <linearGradient id="gradGreen" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00E676" />
                <stop offset="100%" stopColor="#00C853" />
              </linearGradient>

              {/* Gradient for Yellow Zone */}
              <linearGradient id="gradYellow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FBBF24" />
                <stop offset="100%" stopColor="#D4AF37" />
              </linearGradient>

              {/* Gradient for Red Zone */}
              <linearGradient id="gradRed" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FB7185" />
                <stop offset="100%" stopColor="#EF4444" />
              </linearGradient>

              {/* Needle Tip Gradient */}
              <linearGradient id="gradNeedle" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#121212" />
                <stop offset="80%" stopColor={healthStatus.needleColor} />
                <stop offset="100%" stopColor={healthStatus.needleColor} />
              </linearGradient>
            </defs>

            {/* Background Base Track */}
            <path
              d={describeArc(cx, cy, radius, 0, 100)}
              fill="none"
              stroke="#F3F4F6"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />

            {/* ZONE 1: Verde (Equilíbrio: 0% a 60%) */}
            <path
              d={describeArc(cx, cy, radius, 1.5, 58.5)}
              fill="none"
              stroke="url(#gradGreen)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              className="transition-all duration-300"
            />

            {/* ZONE 2: Amarela (Atenção: 61% a 80%) */}
            <path
              d={describeArc(cx, cy, radius, 61.5, 78.5)}
              fill="none"
              stroke="url(#gradYellow)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              className="transition-all duration-300"
            />

            {/* ZONE 3: Vermelha (Alerta: 81% a 100%) */}
            <path
              d={describeArc(cx, cy, radius, 81.5, 98.5)}
              fill="none"
              stroke="url(#gradRed)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              className="transition-all duration-300"
            />

            {/* Scale Tick Labels */}
            <text x="32" y="172" className="text-[10px] font-black fill-gray-400 select-none">
              0%
            </text>
            <text x="180" y="32" className="text-[10px] font-extrabold fill-emerald-600 select-none">
              60%
            </text>
            <text x="238" y="58" className="text-[10px] font-extrabold fill-amber-600 select-none">
              80%
            </text>
            <text x="272" y="172" className="text-[10px] font-black fill-red-500 select-none">
              100%+
            </text>

            {/* REGIONAL REFERENCE MARKER (Marcador da Média Regional) */}
            <g
              className="cursor-pointer group"
              onMouseEnter={() => setShowRegionalTooltip(true)}
              onMouseLeave={() => setShowRegionalTooltip(false)}
              onClick={() => setShowRegionalTooltip((prev) => !prev)}
            >
              {/* Subtle Dashed Reference Line across the arc */}
              <line
                x1={regX1}
                y1={regY1}
                x2={regX2}
                y2={regY2}
                stroke="#121212"
                strokeWidth="3.5"
                strokeDasharray="2 2"
                className="transition-all"
              />

              {/* Glowing Outer Indicator Pin */}
              <circle
                cx={regPinX}
                cy={regPinY}
                r="5.5"
                fill="#121212"
                stroke="#D4AF37"
                strokeWidth="2"
                filter="url(#gaugeShadow)"
                className="transition-transform group-hover:scale-125"
              />
              <circle cx={regPinX} cy={regPinY} r="2" fill="#D4AF37" />
            </g>

            {/* USER NEEDLE / POINTER (Agulha Estilizada com Animação CSS) */}
            <g
              style={{
                transform: `rotate(${needleAngle}deg)`,
                transformOrigin: `${cx}px ${cy}px`,
                transition: 'transform 1.1s cubic-bezier(0.25, 1, 0.5, 1)',
              }}
              filter="url(#gaugeShadow)"
              id="velocimetro-agulha"
            >
              {/* Needle Tapered Shape pointing straight up at 0 rotation */}
              <path
                d={`M ${cx - 4} ${cy} L ${cx - 1} ${cy - (radius - 8)} L ${cx} ${cy - (radius - 2)} L ${cx + 1} ${cy - (radius - 8)} L ${cx + 4} ${cy} Z`}
                fill="url(#gradNeedle)"
              />
              {/* Needle Center Pivot Cap */}
              <circle cx={cx} cy={cy} r="10" fill="#121212" stroke="#D4AF37" strokeWidth="2.5" />
              <circle cx={cx} cy={cy} r="4" fill={healthStatus.needleColor} />
            </g>

            {/* CENTER DATA DISPLAY (Texto em Destaque) */}
            <text
              x={cx}
              y={cy - 22}
              textAnchor="middle"
              className="text-4xl font-black fill-[#121212] font-mono select-none"
              style={{ letterSpacing: '-0.03em' }}
            >
              {clampedDisplayPct}%
            </text>
            <text
              x={cx}
              y={cy - 4}
              textAnchor="middle"
              className="text-[11px] font-bold fill-gray-500 uppercase tracking-wider select-none"
            >
              da renda comprometida
            </text>
          </svg>

          {/* Interactive Tooltip for the Regional Pin */}
          {showRegionalTooltip && (
            <div className="absolute top-2 right-4 bg-[#121212] text-white text-[11px] p-2.5 rounded-xl shadow-xl border border-[#D4AF37] z-20 animate-in fade-in zoom-in-95 duration-150 max-w-[200px]">
              <div className="flex items-center gap-1.5 font-bold text-[#D4AF37]">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>Média Regional</span>
              </div>
              <p className="mt-1 leading-tight text-gray-200">
                <strong>{mediaRegional}%</strong> em {localidade}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">
                Faixa etária: {faixaEtaria} (dados anônimos agregados).
              </p>
            </div>
          )}
        </div>

        {/* Current Health Status Pill Badge */}
        <div className="mt-1 flex items-center gap-1.5">
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border shadow-2xs ${healthStatus.badgeBg}`}
          >
            <StatusIcon className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
            <span>{healthStatus.title}</span>
          </div>

          {currentPct > 100 && (
            <span className="text-[10px] font-black px-2 py-0.5 bg-red-600 text-white rounded-md uppercase">
              Déficit (+{clampedDisplayPct - 100}%)
            </span>
          )}
        </div>
      </div>

      {/* Dynamic Contextual Feedback Banner */}
      <div className={`mt-2 p-3.5 rounded-2xl border transition-all ${healthStatus.cardBg}`}>
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 rounded-xl bg-white/80 shadow-2xs shrink-0 mt-0.5">
            {diff < -1 ? (
              <TrendingDown className="w-4 h-4 text-[#008736] stroke-[2.5]" />
            ) : diff > 1 ? (
              <TrendingUp className="w-4 h-4 text-red-600 stroke-[2.5]" />
            ) : (
              <Minus className="w-4 h-4 text-amber-600 stroke-[2.5]" />
            )}
          </div>

          <div className="flex-1 space-y-1">
            <p className="text-xs sm:text-sm font-extrabold leading-snug">
              {diff < -1 && (
                <>
                  Muito bem! Seus gastos estão{' '}
                  <span className="underline decoration-[#008736] decoration-2 font-black">
                    {absDiff}% abaixo
                  </span>{' '}
                  da média de {localidade}.
                </>
              )}
              {Math.abs(diff) <= 1 && (
                <>
                  Seu ritmo de gastos acompanha a média dos usuários em {localidade}.
                </>
              )}
              {diff > 1 && (
                <>
                  Atenção: seus gastos estão{' '}
                  <span className="underline decoration-red-600 decoration-2 font-black">
                    {absDiff}% acima
                  </span>{' '}
                  da média de {localidade}.
                </>
              )}
            </p>

            <p className="text-[11px] opacity-85 leading-relaxed font-medium">
              {healthStatus.description}
            </p>
          </div>
        </div>

        {/* Breakdown chips: User vs Regional */}
        <div className="mt-3 pt-2.5 border-t border-black/10 grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 bg-white/70 rounded-xl">
            <span className="text-[10px] text-gray-500 font-bold uppercase block">
              Seu Comprometimento
            </span>
            <span className="font-extrabold text-[#121212] font-mono text-sm">
              {clampedDisplayPct}%
            </span>
            {rendaMensal && despesasTotais ? (
              <span className="text-[10px] text-gray-500 block truncate">
                R$ {despesasTotais.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} de R$ {rendaMensal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            ) : null}
          </div>

          <div className="p-2 bg-white/70 rounded-xl">
            <span className="text-[10px] text-gray-500 font-bold uppercase block">
              Média em {localidade.split(',')[0]}
            </span>
            <span className="font-extrabold text-[#121212] font-mono text-sm">
              {mediaRegional}%
            </span>
            <span className="text-[10px] text-gray-500 block truncate">
              Faixa: {faixaEtaria}
            </span>
          </div>
        </div>
      </div>

      {/* Visual Faixas Legend */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-xs text-gray-600 font-bold">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00C853] shrink-0"></span>
          <span>0-60%: Equilíbrio</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] shrink-0"></span>
          <span>61-80%: Atenção</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] shrink-0"></span>
          <span>81%+: Alerta</span>
        </div>
        <div className="flex items-center gap-1 text-gray-800">
          <span className="w-2.5 h-2.5 rounded-full bg-[#121212] border border-[#D4AF37] shrink-0"></span>
          <span>Média: {mediaRegional}%</span>
        </div>
      </div>

      {/* Rodapé de Conformidade LGPD */}
      <div className="mt-3 pt-2.5 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[10px] text-gray-500">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#00C853] shrink-0" />
          <span>
            Referência calculada a partir de médias agregadas e anônimas de perfis da sua região.
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsLgpdModalOpen(true)}
          className="text-[10px] font-bold text-[#008736] hover:underline cursor-pointer flex items-center gap-1 shrink-0"
        >
          <Info className="w-3 h-3" />
          <span>Privacidade e LGPD</span>
        </button>
      </div>

      {/* LGPD Information Modal */}
      <LgpdTermsModal
        isOpen={isLgpdModalOpen}
        initialTab="privacy"
        onClose={() => setIsLgpdModalOpen(false)}
      />
    </div>
  );
};
