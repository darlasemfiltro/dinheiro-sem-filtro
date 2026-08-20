import React from 'react';
import darlaLogoImg from '../assets/images/darla_logo_1785015447784.jpg';

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
      imageSize: 'w-8 h-8 sm:w-10 sm:h-10',
      ringSize: 'p-0.5 sm:p-1',
      titleSize: 'text-xs xs:text-sm sm:text-base md:text-lg',
      subtitleSize: 'text-[9px] sm:text-[10px]',
      spacing: 'gap-1.5 sm:gap-2.5',
    },
    md: {
      imageSize: 'w-12 h-12 sm:w-14 sm:h-14',
      ringSize: 'p-1 sm:p-1.5',
      titleSize: 'text-base sm:text-2xl md:text-3xl',
      subtitleSize: 'text-[10px] sm:text-xs',
      spacing: 'gap-3 sm:gap-4',
    },
    lg: {
      imageSize: 'w-16 h-16 sm:w-20 sm:h-20',
      ringSize: 'p-1 sm:p-2',
      titleSize: 'text-xl sm:text-3xl md:text-4xl',
      subtitleSize: 'text-xs sm:text-sm',
      spacing: 'gap-3.5 sm:gap-5',
    },
    xl: {
      imageSize: 'w-20 h-20 xs:w-24 xs:h-24 sm:w-32 sm:h-32 md:w-36 md:h-36',
      ringSize: 'p-1.5 sm:p-2.5 md:p-3',
      titleSize: 'text-xl xs:text-2xl sm:text-4xl md:text-5xl',
      subtitleSize: 'text-xs xs:text-xs sm:text-sm md:text-base',
      spacing: 'gap-3.5 sm:gap-5 md:gap-6',
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
      {/* Clean Circular Logo Emblem rendered via background-image (no img tag) to block image download popups */}
      <div
        className="relative group shrink-0 select-none"
        id="darla-logo-emblem-wrapper"
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', touchAction: 'none' }}
      >
        <div
          className={`relative rounded-full bg-[#D4AF37] ${sizeConfig.ringSize} border-2 border-[#D4AF37] flex items-center justify-center overflow-hidden`}
        >
          <div
            className={`${sizeConfig.imageSize} bg-cover bg-center rounded-full transition-transform duration-300 group-hover:scale-105 select-none pointer-events-none`}
            style={{
              backgroundImage: `url(${darlaLogoImg}), url(/logo.png)`,
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
            aria-label="DINHEIRO SEM FILTRO Logo"
            role="img"
          />
          {/* Protective overlay blocking mobile image long-press / save */}
          <div
            className="absolute inset-0 z-10 select-none pointer-events-auto"
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
            style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', touchAction: 'none' }}
          />
        </div>
      </div>

      {/* Brand Typography */}
      {(showTitle || showSubtext) && (
        <div className={`flex flex-col min-w-0 max-w-full ${centered ? 'items-center text-center' : 'items-start'}`} id="darla-logo-text-wrapper">
          {showTitle && (
            <span
              className={`${sizeConfig.titleSize} font-extrabold tracking-wider ${
                isDark ? 'text-white' : 'text-[#121212]'
              } font-serif leading-tight break-words max-w-full`}
              id="darla-logo-title"
            >
              DINHEIRO SEM FILTRO
            </span>
          )}
          {showSubtext && (
            <span
              className={`${sizeConfig.subtitleSize} font-bold tracking-[0.03em] sm:tracking-[0.08em] ${
                isDark ? 'text-[#D4AF37]' : 'text-[#D4AF37]'
              } uppercase mt-1 flex flex-wrap items-center ${centered ? 'justify-center text-center' : 'justify-start'} gap-1 max-w-full leading-tight`}
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
