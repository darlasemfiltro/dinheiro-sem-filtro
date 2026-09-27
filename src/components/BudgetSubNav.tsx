import React from 'react';
import {
  LayoutDashboard,
  ReceiptText,
  Wallet,
  FolderTree,
  Target,
  FileSpreadsheet,
  Sparkles
} from 'lucide-react';

interface BudgetSubNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const BudgetSubNav: React.FC<BudgetSubNavProps> = ({ activeTab, setActiveTab }) => {
  const isBudgetTab = [
    'dashboard',
    'transactions',
    'accounts',
    'categories',
    'goals',
    'reports'
  ].includes(activeTab);

  if (!isBudgetTab) return null;

  const tabs = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'transactions', label: 'Lançamentos', icon: ReceiptText },
    { id: 'accounts', label: 'Contas', icon: Wallet },
    { id: 'categories', label: 'Categorias', icon: FolderTree },
    { id: 'goals', label: 'Objetivos & Sonhos', icon: Target },
    { id: 'reports', label: 'Relatórios', icon: FileSpreadsheet },
  ];

  return (
    <div className="bg-[#121212] border border-[#D4AF37]/50 rounded-lg sm:rounded-xl p-1 sm:p-2 mb-2 shadow-md flex items-center justify-between gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex-nowrap w-full">
      {/* Main Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 shrink-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[36px] sm:min-h-[44px] py-1.5 px-2.5 sm:py-2 sm:px-3.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer border shrink-0 ${
                isActive
                  ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37] font-black shadow-xs'
                  : 'bg-[#18181B] text-gray-200 border-white/20 hover:bg-white/10 hover:text-white font-extrabold'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 stroke-[2.5] ${isActive ? 'text-[#121212]' : 'text-[#D4AF37]'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* AI Tips Shortcut Button */}
      <button
        onClick={() => setActiveTab('ai-tips:orcamento')}
        className="min-h-[36px] sm:min-h-[44px] py-1.5 px-2.5 sm:py-2 sm:px-3.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black bg-gradient-to-r from-[#D4AF37]/20 to-[#D4AF37]/40 text-[#D4AF37] border border-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#121212] transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs whitespace-nowrap"
      >
        <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
        <span>DICAS SEM FILTRO ✨</span>
      </button>
    </div>
  );
};
