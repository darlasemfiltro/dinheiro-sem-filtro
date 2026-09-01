import React from 'react';
import darlaLogoImg from '../assets/images/darla_logo_v2.jpg';

interface DarlaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTitle?: boolean;
  showSubtext?: boolean;
  centered?: boolean;
  variant?: 'light' | 'dark';
  className?: string;
}

export const DarlaLogo: React.FC<DarlaLogoProps> = ({
  size = 'md',
  showTitle = true,
  showSubtext = true,
  centered = false,
  variant = 'light',
  className = '',
}) => {
  // Size mapping
  const sizeConfig = {
    sm: {
      emblemSize: 'w-8 h-8 sm:w-10 sm:h-10',
      titleSize: 'text-sm sm:text-base md:text-lg',
      subtitleSize: 'text-[9px] sm:text-[10px]',
      spacing: 'gap-2 sm:gap-2.5',
    },
    md: {
      emblemSize: 'w-11 h-11 sm:w-12 sm:h-12',
      titleSize: 'text-lg sm:text-xl md:text-2xl',
      subtitleSize: 'text-[10px] sm:text-xs',
      spacing: 'gap-2.5 sm:gap-3.5',
    },
    lg: {
      emblemSize: 'w-14 h-14 sm:w-18 sm:h-18',
      titleSize: 'text-xl sm:text-2xl md:text-3xl',
      subtitleSize: 'text-xs sm:text-sm',
      spacing: 'gap-3 sm:gap-4',
    },
    xl: {
      emblemSize: 'w-18 h-18 xs:w-22 xs:h-22 sm:w-28 sm:h-28',
      titleSize: 'text-2xl xs:text-3xl sm:text-4xl md:text-5xl',
      subtitleSize: 'text-xs sm:text-sm md:text-base',
      spacing: 'gap-3.5 sm:gap-5',
    },
  }[size];

  const isDark = variant === 'dark';

  return (
    <div
      className={`inline-flex items-center max-w-full ${centered ? 'flex-col text-center justify-center' : 'flex-row'} ${
        sizeConfig.spacing
      } ${className}`}
      id="darla-logo-container"
    >
      {/* Exact Image 1 Logo Emblem */}
      <div
        className={`relative shrink-0 select-none ${sizeConfig.emblemSize} rounded-full overflow-hidden shadow-md shadow-black/30 border border-[#E5C2A5]/50 group`}
        id="darla-logo-emblem-wrapper"
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', touchAction: 'none' }}
      >
        <img
          src={`${darlaLogoImg}?v=10`}
          alt="Dinheiro Sem Filtro Logo"
          className="w-full h-full object-cover rounded-full pointer-events-none block"
        />
      </div>

      {/* Brand Typography */}
      {(showTitle || showSubtext) && (
        <div className={`flex flex-col min-w-0 max-w-full ${centered ? 'items-center text-center' : 'items-start'}`} id="darla-logo-text-wrapper">
          {showTitle && (
            <div className="flex items-center gap-2">
              <span
                className={`${sizeConfig.titleSize} font-extrabold tracking-wide text-[#9E7253] font-serif leading-tight break-words max-w-full`}
                id="darla-logo-title"
              >
                DINHEIRO <span className="text-[#8C5E3C] font-semibold tracking-normal">SEM FILTRO</span>
              </span>
            </div>
          )}
          {showSubtext && (
            <span
              className={`${sizeConfig.subtitleSize} font-bold tracking-[0.05em] sm:tracking-[0.1em] ${
                isDark ? 'text-[#D4AF37]' : 'text-[#D4AF37]'
              } uppercase mt-0.5 flex flex-wrap items-center ${centered ? 'justify-center text-center' : 'justify-start'} gap-1 max-w-full leading-tight`}
              id="darla-logo-subtitle"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${
                  isDark ? 'bg-[#00C853]' : 'bg-[#D4AF37]'
                }`}
              ></span>
              <span className="break-words">DOMINE SEU DINHEIRO ANTES QUE ELE DOMINE VOCÊ!</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};



