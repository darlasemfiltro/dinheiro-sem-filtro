import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard,
  ReceiptText,
  Wallet,
  FolderTree,
  Target,
  FileSpreadsheet,
  Menu,
  Crown,
  X,
  Flame,
  Calculator,
  WalletCards,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  DollarSign,
  PieChart,
  Award,
  Layers,
  Clock,
  Briefcase,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Cloud
} from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  zoomLevel?: number;
  onZoomChange?: (newZoom: number) => void;
  onOpenAppwriteSettings?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  zoomLevel = 100,
  onZoomChange,
  onOpenAppwriteSettings,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [expandedCategories, setExpandedCategories] = React.useState<Record<string, boolean>>({
    orcamento: false,
    investidor: false,
    aiTips: false,
  });

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Get human label for active tab indicator
  const getTabLabel = (id: string) => {
    if (id === 'dashboard') return 'Visão Geral';
    if (id === 'transactions') return 'Lançamentos';
    if (id === 'accounts') return 'Contas';
    if (id === 'categories') return 'Categorias';
    if (id === 'goals') return 'Objetivos & Sonhos';
    if (id === 'reports') return 'Relatórios PDF';
    if (id === 'calculator') return 'Calculadora Financeira';
    if (id === 'gamification') return 'Ofensiva & Divisões';
    if (id === 'plans') return 'Planos & Assinatura VIP';
    if (id.startsWith('ai-tips')) {
      const sub = id.split(':')[1] || 'orcamento';
      return sub === 'investidor' ? 'Dicas Sem Filtro - Carteira do Investidor' : 'Dicas Sem Filtro - Orçamento Familiar';
    }
    if (id.startsWith('portfolio')) {
      const sub = id.split(':')[1] || 'dashboard';
      const labels: Record<string, string> = {
        dashboard: 'Investimentos - Dashboard',
        patrimonio: 'Investimentos - Patrimônio',
        proventos: 'Investimentos - Proventos',
        rentabilidade: 'Investimentos - Rentabilidade',
        composicao: 'Investimentos - Composição',
        metas: 'Investimentos - Metas',
        subcarteira: 'Investimentos - Subcarteira',
        transacoes: 'Investimentos - Transações',
      };
      return labels[sub] || 'Carteira do Investidor';
    }
    return 'Visão Geral';
  };

  return (
    <>
      {/* Top Navigation Bar */}
      <nav className="bg-[#FAFAFA]/95 border-t border-gray-200 border-b border-[#D4AF37] backdrop-blur-md" id="main-navigation">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-1 sm:py-1.5 flex items-center justify-between gap-2">
          {/* Left Aligned Section */}
          <div className="flex items-center gap-2 min-w-0" id="navigation-left-section">
            <div
              className="min-h-[36px] sm:min-h-[42px] flex items-center gap-1.5 px-3 py-1 sm:py-1.5 bg-[#D4AF37] border border-[#121212] rounded-lg sm:rounded-xl text-[#121212] font-black text-[11px] sm:text-xs truncate shadow-xs shrink-0"
              id="active-page-indicator"
            >
              <LayoutDashboard className="w-4 h-4 text-[#121212] shrink-0 stroke-[3]" />
              <span className="truncate">{getTabLabel(activeTab)}</span>
            </div>
          </div>

          {/* Right Aligned Section */}
          <div className="flex items-center gap-1.5 shrink-0" id="navigation-right-section">
            {/* Fixed Zoom Control Pill in Menu Bar */}
            <div className="min-h-[36px] sm:min-h-[42px] py-1 px-2 bg-[#121212] border border-[#D4AF37] rounded-lg sm:rounded-xl shadow-xs transition flex items-center gap-1 shrink-0 whitespace-nowrap text-white" id="sticky-menu-zoom-pill" style={{ zoom: '100%' }}>
              <button
                onClick={() => onZoomChange && onZoomChange(zoomLevel - 10)}
                disabled={zoomLevel <= 50}
                className="p-1 hover:bg-white/20 rounded-md transition disabled:opacity-30 cursor-pointer text-[#D4AF37]"
                title="Diminuir Zoom (-10%)"
                id="sticky-zoom-out-btn"
              >
                <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
              </button>
              <button
                onClick={() => onZoomChange && onZoomChange(100)}
                className="px-1 py-0.5 text-[11px] sm:text-xs font-black text-[#D4AF37] hover:text-white cursor-pointer flex items-center gap-1"
                title="Redefinir Zoom para 100%"
                id="sticky-zoom-reset-btn"
              >
                <span>{zoomLevel}%</span>
                {zoomLevel !== 100 && <RotateCcw className="w-3 h-3 text-[#00E676]" />}
              </button>
              <button
                onClick={() => onZoomChange && onZoomChange(zoomLevel + 10)}
                disabled={zoomLevel >= 200}
                className="p-1 hover:bg-white/20 rounded-md transition disabled:opacity-30 cursor-pointer text-[#D4AF37]"
                title="Aumentar Zoom (+10%)"
                id="sticky-zoom-in-btn"
              >
                <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
              </button>
            </div>

            {activeTab !== 'plans' && (
              <button
                onClick={() => setActiveTab('plans')}
                className="min-h-[36px] sm:min-h-[42px] hidden sm:flex items-center gap-1.5 py-1 px-3 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs rounded-lg sm:rounded-xl transition border border-[#00A843] shadow-xs cursor-pointer shrink-0"
              >
                <Crown className="w-3.5 h-3.5 text-[#121212] stroke-[3]" />
                <span>Ver Planos</span>
              </button>
            )}

            {/* Menu Trigger Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="min-h-[36px] sm:min-h-[42px] py-1 px-3 sm:px-4 bg-[#121212] hover:bg-black text-[#D4AF37] border border-[#D4AF37] font-black text-xs rounded-lg sm:rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
              id="right-menu-drawer-trigger"
              title="Abrir Menu de Navegação"
            >
              <Menu className="w-4 h-4 sm:w-5 sm:h-5 text-[#D4AF37] stroke-[3]" />
              <span className="tracking-wider">MENU</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Right Side Menu Drawer Overlay & Panel */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[999999] flex justify-end" id="right-navigation-drawer-overlay">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity animate-in fade-in"
            onClick={() => setIsOpen(false)}
            id="right-drawer-backdrop"
          />

          <div
            className="relative w-80 max-w-[90vw] bg-[#121212] text-white border-l-2 border-[#D4AF37] h-full shadow-2xl flex flex-col z-[999999] animate-in slide-in-from-right duration-200 overflow-y-auto"
            id="right-drawer-panel"
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#D4AF37]/30 flex items-center justify-between bg-[#121212] sticky top-0 z-20">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#D4AF37] text-[#121212] font-black flex items-center justify-center text-xs shadow-md">
                  DSF
                </div>
                <div>
                  <h2 className="text-xs font-black text-white tracking-wider font-serif">DSF</h2>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-[#D4AF37] text-white hover:text-[#121212] transition cursor-pointer"
                id="close-right-drawer-btn"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Menu Items List Organized by Categories */}
            <div className="p-4 space-y-4 flex-1">
              {/* CATEGORY 1: DICAS SEM FILTRO */}
              <div className="bg-[#18181B] border-2 border-[#D4AF37] rounded-2xl p-3 space-y-2 shadow-lg">
                <div className="flex items-center justify-between p-1 text-[#D4AF37] font-black text-[11px] uppercase tracking-wider">
                  <button
                    onClick={() => {
                      setActiveTab('ai-tips:orcamento');
                      setExpandedCategories((prev) => ({ ...prev, aiTips: true }));
                      setIsOpen(false);
                    }}
                    className="flex items-center gap-2 hover:text-white transition cursor-pointer text-left flex-1 font-black"
                  >
                    <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0" />
                    <span>DICAS SEM FILTRO ✨</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCategory('aiTips');
                    }}
                    className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition cursor-pointer"
                    title={expandedCategories.aiTips ? "Ocultar subcategorias" : "Ver subcategorias"}
                  >
                    {expandedCategories.aiTips ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>

                {expandedCategories.aiTips && (
                  <div className="space-y-1 pl-1 pt-1 border-t border-white/5">
                    {[
                      { id: 'ai-tips:orcamento', label: 'Orçamento Familiar', icon: Briefcase },
                      { id: 'ai-tips:investidor', label: 'Carteira do Investidor', icon: WalletCards },
                    ].map((sub) => {
                      const SubIcon = sub.icon;
                      const isActive = activeTab === sub.id || (activeTab === 'ai-tips' && sub.id === 'ai-tips:orcamento');
                      return (
                        <button
                          key={sub.id}
                          onClick={() => {
                            setActiveTab(sub.id);
                            setIsOpen(false);
                          }}
                          className={`w-full text-left p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer border ${
                            isActive
                              ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37] font-black shadow-md'
                              : 'bg-white/5 hover:bg-white/10 text-gray-200 border-transparent hover:border-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <SubIcon className={`w-3.5 h-3.5 ${isActive ? 'text-[#121212]' : 'text-[#D4AF37]'}`} />
                            <span>{sub.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* CATEGORY 2: ORÇAMENTO FAMILIAR */}
              <div className="bg-[#18181B] border border-white/10 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between p-1 text-[#D4AF37] font-black text-[11px] uppercase tracking-wider">
                  <button
                    onClick={() => {
                      setActiveTab('dashboard');
                      setExpandedCategories((prev) => ({ ...prev, orcamento: true }));
                      setIsOpen(false);
                    }}
                    className="flex items-center gap-2 hover:text-white transition cursor-pointer text-left flex-1 font-bold"
                  >
                    <Briefcase className="w-4 h-4 shrink-0 text-[#D4AF37]" />
                    <span>ORÇAMENTO FAMILIAR</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCategory('orcamento');
                    }}
                    className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition cursor-pointer"
                    title={expandedCategories.orcamento ? "Ocultar subcategorias" : "Ver subcategorias"}
                  >
                    {expandedCategories.orcamento ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>

                {expandedCategories.orcamento && (
                  <div className="space-y-1 pl-1 pt-1 border-t border-white/5">
                    {[
                      { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
                      { id: 'transactions', label: 'Lançamentos', icon: ReceiptText },
                      { id: 'accounts', label: 'Contas', icon: Wallet },
                      { id: 'categories', label: 'Categorias', icon: FolderTree },
                      { id: 'goals', label: 'Objetivos & Sonhos', icon: Target },
                      { id: 'reports', label: 'Relatórios PDF', icon: FileSpreadsheet },
                    ].map((sub) => {
                      const SubIcon = sub.icon;
                      const isActive = activeTab === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => {
                            setActiveTab(sub.id);
                            setIsOpen(false);
                          }}
                          className={`w-full text-left p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer border ${
                            isActive
                              ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37] font-black shadow-md'
                              : 'bg-white/5 hover:bg-white/10 text-gray-200 border-transparent hover:border-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <SubIcon className={`w-3.5 h-3.5 ${isActive ? 'text-[#121212]' : 'text-[#D4AF37]'}`} />
                            <span>{sub.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* CATEGORY 3: CARTEIRA DO INVESTIDOR */}
              <div className="bg-[#18181B] border border-[#D4AF37]/30 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between p-1 text-[#D4AF37] font-black text-[11px] uppercase tracking-wider">
                  <button
                    onClick={() => {
                      setActiveTab('portfolio:dashboard');
                      setExpandedCategories((prev) => ({ ...prev, investidor: true }));
                      setIsOpen(false);
                    }}
                    className="flex items-center gap-2 hover:text-white transition cursor-pointer text-left flex-1 font-bold"
                  >
                    <WalletCards className="w-4 h-4 text-[#D4AF37] shrink-0" />
                    <span>CARTEIRA DO INVESTIDOR</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCategory('investidor');
                    }}
                    className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition cursor-pointer"
                    title={expandedCategories.investidor ? "Ocultar subcategorias" : "Ver subcategorias"}
                  >
                    {expandedCategories.investidor ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>

                {expandedCategories.investidor && (
                  <div className="space-y-1 pl-1 pt-1 border-t border-white/5">
                    {[
                      { id: 'portfolio:dashboard', label: 'Dashboard', icon: LayoutDashboard },
                      { id: 'portfolio:patrimonio', label: 'Patrimônio', icon: WalletCards },
                      { id: 'portfolio:proventos', label: 'Proventos', icon: DollarSign },
                      { id: 'portfolio:rentabilidade', label: 'Rentabilidade', icon: TrendingUp },
                      { id: 'portfolio:composicao', label: 'Composição', icon: PieChart },
                      { id: 'portfolio:metas', label: 'Metas', icon: Award },
                      { id: 'portfolio:transacoes', label: 'Transações', icon: Clock },
                    ].map((sub) => {
                      const SubIcon = sub.icon;
                      const isActive = activeTab === sub.id || (activeTab === 'portfolio' && sub.id === 'portfolio:dashboard');
                      return (
                        <button
                          key={sub.id}
                          onClick={() => {
                            setActiveTab(sub.id);
                            setIsOpen(false);
                          }}
                          className={`w-full text-left p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer border ${
                            isActive
                              ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37] font-black shadow-md'
                              : 'bg-white/5 hover:bg-white/10 text-gray-200 border-transparent hover:border-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <SubIcon className={`w-3.5 h-3.5 ${isActive ? 'text-[#121212]' : 'text-[#D4AF37]'}`} />
                            <span>{sub.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* OTHER TOOLS */}
              <div className="space-y-1.5 pt-2">
                <p className="text-[10px] uppercase font-black tracking-widest text-gray-400 px-1">
                  OUTRAS FERRAMENTAS:
                </p>

                <button
                  onClick={() => {
                    setActiveTab('gamification');
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-3 rounded-2xl text-xs font-black transition flex items-center justify-between cursor-pointer border ${
                    activeTab === 'gamification'
                      ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37]'
                      : 'bg-white/5 hover:bg-white/10 text-white border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Flame className="w-4 h-4 text-[#FF9100]" />
                    <span>Ofensiva & Divisões</span>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider bg-[#FF9100] text-white">
                    OFENSIVA 🔥
                  </span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('calculator');
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-3 rounded-2xl text-xs font-black transition flex items-center justify-between cursor-pointer border ${
                    activeTab === 'calculator'
                      ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37]'
                      : 'bg-white/5 hover:bg-white/10 text-white border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Calculator className="w-4 h-4 text-[#D4AF37]" />
                    <span>Calculadora Financeira</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('plans');
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-3 rounded-2xl text-xs font-black transition flex items-center justify-between cursor-pointer border ${
                    activeTab === 'plans'
                      ? 'bg-[#00C853] text-[#121212] border-[#00C853]'
                      : 'bg-[#00C853]/20 hover:bg-[#00C853]/30 text-[#00E676] border border-[#00C853]/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Crown className="w-4 h-4 text-[#00C853]" />
                    <span>Planos & Assinatura VIP</span>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider bg-[#00C853] text-[#121212]">
                    90D GRÁTIS
                  </span>
                </button>

                {onOpenAppwriteSettings && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onOpenAppwriteSettings();
                    }}
                    className="w-full text-left p-3 bg-amber-500/10 hover:bg-amber-500/20 text-[#D4AF37] border border-[#D4AF37]/40 rounded-2xl text-xs font-black transition flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Cloud className="w-4 h-4 text-[#D4AF37]" />
                      <span>Sincronização Nuvem (Appwrite)</span>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider bg-[#D4AF37] text-[#121212]">
                      CONECTAR
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Drawer Footer Info */}
            <div className="p-4 border-t border-white/10 bg-black/40 text-[11px] text-gray-400 text-center space-y-1">
              <p className="font-bold text-white">Navegação Rápida & Segura</p>
              <p className="text-[10px] text-gray-400">Controle total ao seu alcance</p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

