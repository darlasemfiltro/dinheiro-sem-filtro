import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StorageService } from '../services/storage';
import { usePrivacyMode } from '../utils/finance';
import { appwriteDatabases as databases, appwriteClient as client } from '../lib/appwrite';
import {
  saveAppData,
  executeTransactionalGoal,
  mergeRemoteGoalsWithOptimistic,
  recordGoalDeletion,
  mergeRemoteInvestmentTransactionsWithOptimistic,
  executeTransactionalInvestmentTransaction,
  recordInvestmentTxDeletion,
  executeTransactionalTargetAllocations,
  mergeRemoteTargetAllocationsWithOptimistic,
} from '../lib/appwriteSync';
import { CustomAlertModal } from './CustomAlertModal';
import {
  WalletCards,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  Award,
  Download,
  Clock,
  Eye,
  EyeOff,
  ArrowRight,
  Info,
  SlidersHorizontal,
  ArrowUpDown,
  Trash2,
  X,
  LayoutDashboard,
  Edit2,
  Plus,
  Filter,
  Target,
  Edit3,
  MoreHorizontal,
  Calendar,
  Sparkles,
  Zap,
  BarChart3,
  Globe,
  Coins,
  ArrowDown,
  ArrowUp,
  Check,
} from 'lucide-react';

// Helper to format YYYY-MM-DD to DD/MM/AAAA for input display
const formatDateBRInput = (isoDateStr: string) => {
  if (!isoDateStr) return '';
  const parts = isoDateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDateStr;
};

// Helper with retry for Appwrite rate limits (429)
const updateDocumentWithRetry = async (databaseId: string, collectionId: string, documentId: string, data: any, maxRetries = 2, delayMs = 1500) => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await databases.updateDocument(databaseId, collectionId, documentId, data);
    } catch (err: any) {
      const isRateLimit = err?.message?.includes('Rate limit') || err?.code === 429 || err?.status === 429;
      if (isRateLimit && attempt < maxRetries) {
        await new Promise(res => setTimeout(res, delayMs * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
};

// Convert typed DD/MM/AAAA or YYYY-MM-DD to YYYY-MM-DD ISO
const parseDateToISO = (val: string): string => {
  if (!val) return '';
  const clean = val.trim();
  const brMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (brMatch) {
    const d = brMatch[1].padStart(2, '0');
    const m = brMatch[2].padStart(2, '0');
    const y = brMatch[3];
    return `${y}-${m}-${d}`;
  }
  const isoMatch = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
};
import {
  PortfolioStorageService,
  TargetAllocation,
  DEFAULT_TARGET_ALLOCATIONS,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  calculateLivePortfolio,
} from '../services/portfolioStorage';
import { formatNumberToPtBr, parsePtBrNumber, formatDateBR } from '../utils/finance';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import darlaLogoImg from '../assets/images/darla_logo_v2.jpg';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart as RePieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  InvestmentAsset,
  InvestmentTransaction,
  InvestmentDividend,
  PortfolioGoal,
  MarketQuote,
  AssetCategory,
  AIPortfolioAdvice,
} from '../types';
import { AddAssetModal } from './AddAssetModal';
import { AIPortfolioModal } from './AIPortfolioModal';

// Custom Chart Tooltip displaying Reference Date (Mês/Ano) and exact values (Requirement: Images 4 & 7)
const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#09090B]/95 border-2 border-[#D4AF37] p-3 rounded-2xl shadow-2xl text-xs space-y-1.5 z-50 backdrop-blur-md pointer-events-none">
        <p className="font-black text-[#D4AF37] border-b border-white/10 pb-1 uppercase tracking-wider">
          Mês/Ano: {label}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-4 text-white font-bold">
            <span className="flex items-center gap-1.5" style={{ color: entry.color || '#00E676' }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || '#00E676' }} />
              {entry.name || 'Valor'}:
            </span>
            <span className="font-serif font-black text-sm">
              R$ {Number(entry.value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Custom Percentage Chart Tooltip for Rentabilidade Chart (Requirement: Imagem 4)
const CustomPercentageChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#09090B]/95 border-2 border-[#D4AF37] p-3 rounded-2xl shadow-2xl text-xs space-y-1.5 z-50 backdrop-blur-md pointer-events-none">
        <p className="font-black text-[#D4AF37] border-b border-white/10 pb-1 uppercase tracking-wider">
          Mês/Ano: {label}
        </p>
        {payload.map((entry: any, index: number) => {
          const valNum = Number(entry.value || 0);
          const isPos = valNum >= 0;
          return (
            <div key={`item-${index}`} className="flex items-center justify-between gap-4 text-white font-bold">
              <span className="flex items-center gap-1.5" style={{ color: entry.color || '#00E676' }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || '#00E676' }} />
                {entry.name || 'Retorno'}:
              </span>
              <span className={`font-serif font-black text-sm ${isPos ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                {isPos ? '+' : ''}{valNum.toFixed(2).replace('.', ',')}%
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

// Custom Donut Tooltip displaying Categoria, Valor em R$ and Percentual (%) with 2 decimals (Requirement 3: Solid Opaque Black Background)
const CustomDonutTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const categoryName = data.name || data.payload?.name || 'Categoria';
    const rawVal = Number(data.value || data.payload?.value || 0);
    const pctVal = Number(data.payload?.pct || (data.percent ? data.percent * 100 : 0));

    return (
      <div
        className="bg-[#121212] border-2 border-[#00E676] p-3 rounded-xl text-xs space-y-1.5 z-10 pointer-events-none shadow-2xl text-left relative max-w-[220px]"
        style={{ backgroundColor: '#121212', opacity: 1 }}
      >
        <div className="flex items-center gap-2 border-b border-white/20 pb-1">
          <span className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: data.payload?.color || data.color || '#3B82F6' }} />
          <p className="font-black text-white text-xs font-serif truncate">{categoryName}</p>
        </div>
        <div className="space-y-0.5 text-[11px]">
          <p className="text-gray-200 font-bold flex justify-between gap-3">
            <span className="text-gray-400">Valor Alocado:</span>
            <span className="text-white font-black font-serif">
              R$ {rawVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </p>
          <p className="text-[#00E676] font-black flex justify-between gap-3">
            <span className="text-gray-300">Participação (%):</span>
            <span className="text-xs font-black font-serif">{pctVal.toFixed(2).replace('.', ',')}%</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export function getAssetSegment(asset: Partial<InvestmentAsset>): string {
  if (
    asset.segment &&
    asset.segment.trim() !== '' &&
    !['Ações', 'acoes', 'FIIs', 'fiis', 'Tesouro', 'tesouro', 'Stocks', 'stocks', 'FIAGRO', 'fiagro', 'Cripto', 'cripto', 'Criptomoedas', 'ETF Exterior', 'etf_exterior', 'Geral'].includes(asset.segment.trim())
  ) {
    return asset.segment.trim();
  }

  const ticker = (asset.ticker || '').toUpperCase().trim();

  // Known Stock Segments
  if (['BBAS3', 'ITUB4', 'BBDC4', 'BBDC3', 'SANB11', 'ITUB3'].includes(ticker)) return 'Bancos';
  if (['BBSE3', 'PSSA3', 'CXSE3', 'IRBR3'].includes(ticker)) return 'Seguradoras';
  if (['VALE3', 'VALE5', 'BRAP4'].includes(ticker)) return 'Mineração';
  if (['PETR4', 'PETR3', 'PRIO3', 'RRRP3', 'RECV3', 'VBBR3'].includes(ticker)) return 'Petróleo, Gás & Biocombustíveis';
  if (['CMIG4', 'TAEE11', 'ISAE4', 'TRPL4', 'ELET3', 'ELET6', 'CPLE6', 'EGIE3', 'ENGI11', 'NEOE3'].includes(ticker)) return 'Energia Elétrica';
  if (['CSMG3', 'SBSP3', 'SAPR11', 'SAPR4'].includes(ticker)) return 'Água e Saneamento';
  if (['GOAU3', 'GOAU4', 'GGBR4', 'CSNA3', 'USIM5'].includes(ticker)) return 'Siderurgia & Metalurgia';
  if (['LEVE3', 'WEGE3', 'POMO4', 'MYPK3'].includes(ticker)) return 'Bens de Capital & Autopeças';
  if (['SLCE3', 'AGRO3', 'SMTO3', 'TTEN3', 'JBSS3', 'BEEF3', 'MRFG3'].includes(ticker)) return 'Agricultura & Alimentos';
  if (['RENT3', 'MOVI3', 'VAMO3'].includes(ticker)) return 'Locação de Veículos';
  if (['ABEV3', 'CRFB3', 'ASAI3', 'MGLU3', 'LREN3', 'VIIA3'].includes(ticker)) return 'Varejo & Consumo';
  if (['FLRY3', 'HAPV3', 'RADL3', 'RDOR3'].includes(ticker)) return 'Saúde & Farmácia';
  if (['TOTS3', 'INTB3', 'LWSA3'].includes(ticker)) return 'Tecnologia';

  // FII Segments
  if (['MXRF11', 'HCTR11', 'DEVY11', 'KNSC11', 'CPTS11', 'RECR11', 'IRDM11', 'VGIP11'].includes(ticker)) return 'FII Papel';
  if (['HGLG11', 'XPLG11', 'BRLA11', 'VILG11', 'LVBI11'].includes(ticker)) return 'FII Logística';
  if (['KNRI11', 'BRCR11', 'HGRU11', 'JSRE11', 'PVBI11', 'HGBS11', 'VISC11', 'XPML11'].includes(ticker)) return 'FII Tijolo / Híbrido';
  if (asset.category === 'fiis') return 'FII Outros';

  // Tesouro / Renda Fixa
  if (asset.category === 'tesouro' || ['B5P211', 'IMAB11', 'IBOB11'].includes(ticker)) return 'Títulos Públicos / Renda Fixa';

  // Stocks / US
  if (['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA'].includes(ticker)) return 'Tecnologia & IA US';
  if (['SCHD', 'VOO', 'VXUS', 'IVV', 'QQQ', 'SPY'].includes(ticker)) return 'ETFs Internacionais';
  if (['XOP', 'XLE'].includes(ticker)) return 'Energia US';
  if (asset.category === 'stocks' || asset.category === 'etf_exterior') return 'Ações & ETFs Internacionais';

  // FIAGRO
  if (['CPTR11', 'XPCA11', 'RZAG11', 'FGAA11', 'SNAG11', 'KNCA11'].includes(ticker) || asset.category === 'fiagro') return 'Agronegócio / FIAGRO';

  // Cripto
  if (['BTC', 'ETH', 'ADA', 'PENDLE', 'SOL'].includes(ticker) || asset.category === 'cripto') return 'Criptoativos';

  return asset.segment || CATEGORY_LABELS[asset.category || 'other'] || 'Geral';
}

export type PortfolioSubTab =
  | 'dashboard'
  | 'patrimonio'
  | 'proventos'
  | 'rentabilidade'
  | 'composicao'
  | 'metas'
  | 'transacoes';

interface PortfolioViewProps {
  userId?: string;
  initialSubTab?: PortfolioSubTab;
  onSubTabChange?: (subTab: PortfolioSubTab) => void;
  onDataChanged?: () => Promise<any> | void;
  investmentTransactions?: any[];
  onSaveInvestmentTransaction?: (item: any) => Promise<any> | void;
  onDeleteInvestmentTransaction?: (id: string) => Promise<any> | void;
  isReadOnly?: boolean;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  userId = 'default',
  initialSubTab = 'dashboard',
  onSubTabChange,
  onDataChanged,
  investmentTransactions,
  onSaveInvestmentTransaction,
  onDeleteInvestmentTransaction,
  isReadOnly = false,
}) => {
  const checkReadOnly = () => {
    if (isReadOnly) {
      alert('Ação bloqueada: Você possui apenas permissão de LEITURA neste orçamento.');
      return true;
    }
    return false;
  };
  const [activeSubTab, setActiveSubTab] = useState<PortfolioSubTab>(initialSubTab);
  const isPrivacyActive = usePrivacyMode();
  const showValues = !isPrivacyActive;
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [dividends, setDividends] = useState<InvestmentDividend[]>([]);
  const [goals, setGoals] = useState<PortfolioGoal[]>([]);
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [selectedQuotePeriod, setSelectedQuotePeriod] = useState<
    'daily' | 'monthly' | 'semiannual' | 'annual' | 'allTime' | 'custom'
  >('daily');
  const [chartCustomStartDate, setChartCustomStartDate] = useState<string>('2026-01-01');
  const [chartCustomEndDate, setChartCustomEndDate] = useState<string>('2026-08-17');
  const [chartCustomPeriodLabel, setChartCustomPeriodLabel] = useState<string>('Personalizado (Jan - Ago)');
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);
  const [selectedChartQuoteId, setSelectedChartQuoteId] = useState<string>('');
  const [isRefreshingQuotes, setIsRefreshingQuotes] = useState<boolean>(false);

  const livePortfolio = useMemo(() => {
    const txs = investmentTransactions !== undefined ? investmentTransactions : transactions;
    return calculateLivePortfolio(txs, goals);
  }, [investmentTransactions, transactions, goals]);

  const assets = livePortfolio.positions;
  const totalEquity = livePortfolio.totalPortfolioValue;
  const totalInvested = livePortfolio.totalInvested;
  const totalProfitPercent = livePortfolio.totalProfitPercent;
  const totalDividends = livePortfolio.totalDividends;
  const categoryAllocation = livePortfolio.categoryAllocation;
  const calculatedGoals = livePortfolio.calculatedGoals;

  // Selected Asset Details & Transaction History Panel (Requirement 2)
  const [selectedAssetForDetail, setSelectedAssetForDetail] = useState<InvestmentAsset | null>(null);
  const [showAssetTxDrawer, setShowAssetTxDrawer] = useState<boolean>(false);

  // Target Allocations State (Requirement 7)
  const [targetAllocations, setTargetAllocations] = useState<TargetAllocation[]>(() => {
    const loaded = PortfolioStorageService.getTargetAllocations(userId);
    return Array.isArray(loaded) && loaded.length > 0 ? loaded : DEFAULT_TARGET_ALLOCATIONS;
  });
  const [isEditingTargetModalOpen, setIsEditingTargetModalOpen] = useState<boolean>(false);
  const [editingAllocations, setEditingAllocations] = useState<TargetAllocation[]>([]);

  // AI Portfolio Advice State (Sem Filtro Persona)
  const [isAIModalOpen, setIsAIModalOpen] = useState<boolean>(false);
  const [aiAdvice, setAiAdvice] = useState<AIPortfolioAdvice | null>(null);
  const [isGeneratingAIAdvice, setIsGeneratingAIAdvice] = useState<boolean>(false);

  const fetchSemFiltroPortfolioAnalysis = async () => {
    setIsGeneratingAIAdvice(true);
    try {
      const res = await fetch('/api/portfolio/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assets,
          totalEquity: totalEquity,
          monthlyDividends: calculateTotalReceivedDividends(),
          targetAllocations,
        }),
      });
      const data = await res.json();
      if (data.success && data.advice) {
        setAiAdvice(data.advice);
        PortfolioStorageService.saveAIAdvice(data.advice, userId);
      }
    } catch (err) {
      console.error('[Sem Filtro Portfolio Error]', err);
    } finally {
      setIsGeneratingAIAdvice(false);
    }
  };

  const handleSubTabSwitch = (tab: PortfolioSubTab) => {
    setActiveSubTab(tab);
    if (onSubTabChange) {
      onSubTabChange(tab);
    }
  };

  // Period Filter for Dashboard
  const [globalPeriodFilter, setGlobalPeriodFilter] = useState<'ALL' | 'PREV_MONTH' | 'PREV_YEAR' | 'CUSTOM'>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [customStartText, setCustomStartText] = useState<string>('');
  const [customEndText, setCustomEndText] = useState<string>('');

  // Desempenho de Patrimônio Custom Period State
  const [patCustomStartDate, setPatCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().split('T')[0];
  });
  const [patCustomEndDate, setPatCustomEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [patStartText, setPatStartText] = useState<string>(() => formatDateBRInput(patCustomStartDate));
  const [patEndText, setPatEndText] = useState<string>(() => formatDateBRInput(patCustomEndDate));

  // Proventos Subtab Period Filter State
  const [proventosPeriodFilter, setProventosPeriodFilter] = useState<'CURRENT_MONTH' | '6M' | '12M' | 'ALL' | 'CUSTOM'>('ALL');
  const [proventosCustomStartDate, setProventosCustomStartDate] = useState<string>('');
  const [proventosCustomEndDate, setProventosCustomEndDate] = useState<string>('');
  const [proventosAppliedStartDate, setProventosAppliedStartDate] = useState<string>('');
  const [proventosAppliedEndDate, setProventosAppliedEndDate] = useState<string>('');
  const [proventosStartText, setProventosStartText] = useState<string>('');
  const [proventosEndText, setProventosEndText] = useState<string>('');

  // Proventos Recebidos por Ativo Block Filter State
  const [assetProventosFilter, setAssetProventosFilter] = useState<'CURRENT_MONTH' | '6M' | '12M' | 'ALL' | 'CUSTOM'>('ALL');
  const [assetProventosCustomStartDate, setAssetProventosCustomStartDate] = useState<string>('');
  const [assetProventosCustomEndDate, setAssetProventosCustomEndDate] = useState<string>('');
  const [assetProventosAppliedStartDate, setAssetProventosAppliedStartDate] = useState<string>('');
  const [assetProventosAppliedEndDate, setAssetProventosAppliedEndDate] = useState<string>('');
  const [assetProventosStartText, setAssetProventosStartText] = useState<string>('');
  const [assetProventosEndText, setAssetProventosEndText] = useState<string>('');

  // Rentabilidade Subtab Custom Date State
  const [rentCustomStartDate, setRentCustomStartDate] = useState<string>('');
  const [rentCustomEndDate, setRentCustomEndDate] = useState<string>('');
  const [rentAppliedStartDate, setRentAppliedStartDate] = useState<string>('');
  const [rentAppliedEndDate, setRentAppliedEndDate] = useState<string>('');
  const [rentStartText, setRentStartText] = useState<string>('');
  const [rentEndText, setRentEndText] = useState<string>('');
  const [rentabilitySortOrder, setRentabilitySortOrder] = useState<'DESC' | 'ASC'>('DESC');
  const [proventosSortOrder, setProventosSortOrder] = useState<'DESC' | 'ASC'>('DESC');
  const [assetSortField, setAssetSortField] = useState<'totalRent' | 'proventosVal'>('totalRent');
  const [assetSortOrder, setAssetSortOrder] = useState<'DESC' | 'ASC'>('DESC');

  // Applied filter state for calculations and performance cards display
  const [appliedPeriodFilter, setAppliedPeriodFilter] = useState<'ALL' | 'PREV_MONTH' | 'PREV_YEAR' | 'CUSTOM'>('ALL');
  const [appliedStartDate, setAppliedStartDate] = useState<string>('');
  const [appliedEndDate, setAppliedEndDate] = useState<string>('');

  const handleSelectPeriod = (filterId: 'ALL' | 'PREV_MONTH' | 'PREV_YEAR' | 'CUSTOM') => {
    setGlobalPeriodFilter(filterId);
    if (filterId !== 'CUSTOM') {
      setAppliedPeriodFilter(filterId);
    }
  };

  const handleApplyCustomFilter = () => {
    setAppliedPeriodFilter('CUSTOM');
    setAppliedStartDate(customStartDate);
    setAppliedEndDate(customEndDate);
  };

  const getPerformanceData = () => {
    let periodText = 'em relação a todo o período';
    if (appliedPeriodFilter === 'PREV_MONTH') {
      periodText = 'em relação ao mês anterior';
    } else if (appliedPeriodFilter === 'PREV_YEAR') {
      periodText = 'em relação ao ano anterior';
    } else if (appliedPeriodFilter === 'CUSTOM') {
      if (appliedStartDate && appliedEndDate) {
        const startFmt = appliedStartDate.split('-').reverse().join('/');
        const endFmt = appliedEndDate.split('-').reverse().join('/');
        periodText = `em relação ao período (${startFmt} a ${endFmt})`;
      } else {
        periodText = 'em relação ao período personalizado';
      }
    }

    if (assets.length === 0) {
      return {
        periodText,
        rentPct: 0,
        rentPositive: true,
        patPct: 0,
        patPositive: true,
        provPct: 0,
        provPositive: true,
      };
    }

    let rentPct = returnPct || 0;
    let rentPositive = rentPct >= 0;

    let patPct = 0;
    let patPositive = true;

    let provPct = 0;
    let provPositive = true;

    if (appliedPeriodFilter === 'ALL') {
      rentPct = returnPct || 0;
      rentPositive = rentPct >= 0;
      patPct = totalInvested > 0 ? ((totalEquity - totalInvested) / totalInvested) * 100 : 0;
      patPositive = patPct >= 0;
      provPct = receivedDividends > 0 ? 100 : 0;
      provPositive = provPct >= 0;
    } else if (appliedPeriodFilter === 'PREV_MONTH') {
      rentPct = returnPct || 0;
      rentPositive = rentPct >= 0;
      patPct = 0;
      patPositive = true;
      provPct = 0;
      provPositive = true;
    } else if (appliedPeriodFilter === 'PREV_YEAR') {
      rentPct = returnPct || 0;
      rentPositive = rentPct >= 0;
      patPct = 0;
      patPositive = true;
      provPct = 0;
      provPositive = true;
    } else if (appliedPeriodFilter === 'CUSTOM') {
      rentPct = returnPct || 0;
      rentPositive = rentPct >= 0;
      patPct = 0;
      patPositive = true;
      provPct = 0;
      provPositive = true;
    }

    return {
      periodText,
      rentPct,
      rentPositive,
      patPct,
      patPositive,
      provPct,
      provPositive,
    };
  };

  // Rentabilidade Period Filter
  const [rentPeriod, setRentPeriod] = useState<'1M' | '3M' | '6M' | '1Y' | '2Y' | 'ALL' | 'CUSTOM'>('1Y');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Goal Modal State
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingGoal, setEditingGoal] = useState<PortfolioGoal | null>(null);
  const [goalForm, setGoalForm] = useState({
    title: '',
    targetAmount: '',
    currentAmount: '',
    startDate: '',
    targetDate: '',
    category: 'Patrimônio Total',
  });
  const [startDateText, setStartDateText] = useState('');
  const [targetDateText, setTargetDateText] = useState('');
  const startDatePickerRef = useRef<HTMLInputElement>(null);
  const targetDatePickerRef = useRef<HTMLInputElement>(null);
  const [isGoalCategoryOpen, setIsGoalCategoryOpen] = useState(false);
  const [goalCategorySearch, setGoalCategorySearch] = useState('');
  const goalCategoryContainerRef = useRef<HTMLDivElement>(null);

  // Transaction Edit Modal State
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<InvestmentTransaction | null>(null);
  const [txForm, setTxForm] = useState({
    assetTicker: '',
    assetCategory: 'acoes' as AssetCategory,
    type: 'buy' as 'buy' | 'sell',
    quantity: '',
    unitPrice: '',
    broker: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Delete Confirmation State
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);
  const [portfolioAlert, setPortfolioAlert] = useState<{
    isOpen: boolean;
    message: string;
    title?: string;
    type?: 'success' | 'error' | 'warning' | 'info' | 'confirm';
  } | null>(null);

  // Category Collapsed/Expanded State (Hidden by default per Image 2 requirement)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [expandedSegments, setExpandedSegments] = useState<Record<string, boolean>>({});

  const [categorySorts, setCategorySorts] = useState<Record<string, { field: string; direction: 'asc' | 'desc' }>>({});
  const [segmentSorts, setSegmentSorts] = useState<Record<string, { field: string; direction: 'asc' | 'desc' }>>({});

  const handleCategorySort = (catKey: string, field: string) => {
    setCategorySorts((prev) => {
      const current = prev[catKey] || { field: 'pctCart', direction: 'desc' };
      if (current.field === field) {
        return { ...prev, [catKey]: { field, direction: current.direction === 'desc' ? 'asc' : 'desc' } };
      }
      return { ...prev, [catKey]: { field, direction: 'desc' } };
    });
  };

  const handleSegmentSort = (segKey: string, field: string) => {
    setSegmentSorts((prev) => {
      const current = prev[segKey] || { field: 'pctCart', direction: 'desc' };
      if (current.field === field) {
        return { ...prev, [segKey]: { field, direction: current.direction === 'desc' ? 'asc' : 'desc' } };
      }
      return { ...prev, [segKey]: { field, direction: 'desc' } };
    });
  };

  // Selected chart slices for inline info box
  const [selectedCategorySlice, setSelectedCategorySlice] = useState<any | null>(null);
  const [selectedSegmentSlice, setSelectedSegmentSlice] = useState<any | null>(null);

  const toggleSegment = (segName: string) => {
    setExpandedSegments((prev) => ({ ...prev, [segName]: !(prev[segName] ?? true) }));
  };

  // Filter Modal & Chart Controls State (Images 4 & 5)
  const [filterChartType, setFilterChartType] = useState<'diagrama' | 'donut'>('diagrama');
  const [filterLastCol, setFilterLastCol] = useState<'segmento' | 'corretora' | 'vencimento'>('segmento');
  const [filterCategory, setFilterCategory] = useState<string>('completo');

  // Desempenho de patrimônio Chart Filters (Images 1, 2, 3, 4)
  const [patSegmentFilter, setPatSegmentFilter] = useState<string[]>(['completo']);
  const [isPatSegmentDropdownOpen, setIsPatSegmentDropdownOpen] = useState(false);
  const [patSegmentSearch, setPatSegmentSearch] = useState('');
  const patSegmentContainerRef = useRef<HTMLDivElement>(null);

  const availableSegments = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((a) => {
      if (a.quantity > 0) {
        set.add(getAssetSegment(a));
      }
    });
    return Array.from(set).sort();
  }, [assets]);

  const [patMetricType, setPatMetricType] = useState<'patrimonio' | 'investimento'>('patrimonio');
  const [isPatMetricDropdownOpen, setIsPatMetricDropdownOpen] = useState(false);
  const patMetricContainerRef = useRef<HTMLDivElement>(null);

  const [patPeriodFilter, setPatPeriodFilter] = useState<'6M' | '1Y' | '2Y' | 'ALL' | 'CUSTOM'>('1Y');
  const [isPatPeriodDropdownOpen, setIsPatPeriodDropdownOpen] = useState(false);
  const [patPeriodSearch, setPatPeriodSearch] = useState('');
  const patPeriodContainerRef = useRef<HTMLDivElement>(null);

  // Transacoes filters
  const [txSearchTerm, setTxSearchTerm] = useState('');
  const [txCategoryFilter, setTxCategoryFilter] = useState<string>('all');

  // Sync subtab if prop changes
  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Load Initial Data
  const loadData = () => {
    const loadedTx = investmentTransactions !== undefined
      ? investmentTransactions
      : PortfolioStorageService.getTransactions(userId);
    const loadedDivs = PortfolioStorageService.getDividends(userId);
    const loadedGoals = StorageService.getGoals(userId);
    const loadedQuotes = PortfolioStorageService.getMarketQuotes();
    const savedAdvice = PortfolioStorageService.getAIAdvice(userId);
    const loadedTargets = PortfolioStorageService.getTargetAllocations(userId);

    setTransactions(loadedTx);
    setDividends(loadedDivs);
    setGoals(loadedGoals);
    setQuotes(loadedQuotes);
    if (loadedTargets && Array.isArray(loadedTargets) && loadedTargets.length > 0) {
      setTargetAllocations(loadedTargets);
    } else {
      setTargetAllocations(DEFAULT_TARGET_ALLOCATIONS);
    }
    if (savedAdvice) {
      setAiAdvice(savedAdvice);
    }
  };

  useEffect(() => {
    loadData();
  }, [investmentTransactions, userId]);

  useEffect(() => {
    async function loadCloudData() {
      try {
        await PortfolioStorageService.loadPortfolioFromRemote(userId);
        loadData();
      } catch (err) {
        console.error('Erro ao carregar dados da nuvem:', err);
      }
    }
    loadCloudData();
  }, [userId]);

  // Price Refresh & Quote Helpers
  const handleRefreshPrices = async () => {
    setIsRefreshingQuotes(true);
    try {
      const { quotes: updatedQuotes } = await PortfolioStorageService.refreshMarketPrices(userId);
      setQuotes(updatedQuotes);
    } finally {
      setIsRefreshingQuotes(false);
    }
  };

  const getQuoteMetric = (
    q: MarketQuote,
    period: 'daily' | 'monthly' | 'semiannual' | 'annual' | 'allTime' | 'custom'
  ) => {
    switch (period) {
      case 'daily':
        return {
          label: 'Diário (24h)',
          pct: q.variationDaily ?? q.changePct ?? 0,
          val: q.changeDailyValue ?? q.price * ((q.changePct || 0) / 100),
        };
      case 'monthly':
      case 'custom':
        return {
          label: period === 'custom' ? 'Personalizado' : 'Mensal (30d)',
          pct: q.variationMonthly ?? 1.85,
          val: q.changeMonthlyValue ?? q.price * 0.0185,
        };
      case 'semiannual':
        return {
          label: 'Semestral (6m)',
          pct: q.variationSemiannual ?? -2.1,
          val: q.changeSemiannualValue ?? q.price * -0.021,
        };
      case 'annual':
        return {
          label: 'Anual (12m)',
          pct: q.variationAnnual ?? 8.45,
          val: q.changeAnnualValue ?? q.price * 0.0845,
        };
      case 'allTime':
        return {
          label: 'Todo o Período',
          pct: q.variationAllTime ?? 61.88,
          val: q.changeAllTimeValue ?? q.price * 0.6188,
        };
      default:
        return {
          label: 'Diário (24h)',
          pct: q.variationDaily ?? q.changePct ?? 0,
          val: q.changeDailyValue ?? q.price * ((q.changePct || 0) / 100),
        };
    }
  };

  const formatLastUpdatedTime = (isoString?: string) => {
    if (!isoString) {
      return `${new Date().toLocaleTimeString('pt-BR')} - ${new Date().toLocaleDateString('pt-BR')}`;
    }
    try {
      const date = new Date(isoString);
      return `${date.toLocaleTimeString('pt-BR')} - ${date.toLocaleDateString('pt-BR')}`;
    } catch {
      return `${new Date().toLocaleTimeString('pt-BR')} - ${new Date().toLocaleDateString('pt-BR')}`;
    }
  };

  useEffect(() => {
    loadData();
    // Load fresh data from remote server immediately on mount
    PortfolioStorageService.loadPortfolioFromRemote(userId).then(() => {
      loadData();
    });

    const handlePortfolioUpdate = (e?: any) => {
      const detail = e?.detail;
      if (detail && Array.isArray(detail.targetAllocations) && detail.targetAllocations.length > 0) {
        const mergedTargets = mergeRemoteTargetAllocationsWithOptimistic(detail.targetAllocations);
        setTargetAllocations(mergedTargets);
        (PortfolioStorageService as any).saveToAllAliasKeys('darla_target_allocations', userId, mergedTargets);
      }
      loadData();
    };

    window.addEventListener('portfolio_updated', handlePortfolioUpdate);
    window.addEventListener('remote_data_updated', handlePortfolioUpdate);
    window.addEventListener('financial_data_mutated', handlePortfolioUpdate);

    // Active Appwrite Realtime WebSocket subscription for instant cross-device goal updates
    let unsubscribeAppwrite: (() => void) | null = null;
    try {
      const centralChannel = `databases.6a83aa8d0038331e040f.collections.user_financials.documents.6a849358002db9e638ce`;
      unsubscribeAppwrite = client.subscribe(centralChannel, (response: any) => {
        if (response.payload?.data) {
          try {
            const raw = response.payload.data;
            const remoteData = typeof raw === 'string' ? JSON.parse(raw) : raw;
            const rawGoals = remoteData.investorGoals || remoteData.goals;
            if (Array.isArray(rawGoals)) {
              const mergedGoals = mergeRemoteGoalsWithOptimistic(rawGoals);
              setGoals(mergedGoals);
              StorageService.setGoals(mergedGoals as any);
              PortfolioStorageService.saveGoals(mergedGoals, userId);
            }
            if (Array.isArray(remoteData.investmentTransactions)) {
              const mergedInvTxs = mergeRemoteInvestmentTransactionsWithOptimistic(remoteData.investmentTransactions);
              setTransactions(mergedInvTxs);
              (PortfolioStorageService as any).saveToAllAliasKeys('darla_portfolio_transactions', userId, mergedInvTxs);
            }
            if (Array.isArray(remoteData.investorPortfolio)) {
              PortfolioStorageService.saveAssets(remoteData.investorPortfolio, userId);
            }
            if (Array.isArray(remoteData.targetAllocations) && remoteData.targetAllocations.length > 0) {
              const mergedTargets = mergeRemoteTargetAllocationsWithOptimistic(remoteData.targetAllocations);
              setTargetAllocations(mergedTargets);
              (PortfolioStorageService as any).saveToAllAliasKeys('darla_target_allocations', userId, mergedTargets);
            }
          } catch (e) {
            console.error('[PortfolioView Realtime Parse Error]', e);
          }
        }
      });
    } catch (subErr) {
      console.warn('[PortfolioView Realtime Sub Notice]', subErr);
    }

    // Auto-update asset prices and market quotes on mount
    handleRefreshPrices();

    return () => {
      if (unsubscribeAppwrite) {
        try {
          unsubscribeAppwrite();
        } catch {}
      }
      window.removeEventListener('portfolio_updated', handlePortfolioUpdate);
      window.removeEventListener('remote_data_updated', handlePortfolioUpdate);
      window.removeEventListener('financial_data_mutated', handlePortfolioUpdate);
    };
  }, [userId]);

  // Disparo Automático: Análise Sem Filtro quando a Carteira do Investidor é aberta
  useEffect(() => {
    if (assets.length > 0 && !aiAdvice && !isGeneratingAIAdvice) {
      fetchSemFiltroPortfolioAnalysis();
    }
  }, [assets]);

  // Handle click outside goal category and pat filter dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (goalCategoryContainerRef.current && !goalCategoryContainerRef.current.contains(event.target as Node)) {
        setIsGoalCategoryOpen(false);
      }
      if (patSegmentContainerRef.current && !patSegmentContainerRef.current.contains(event.target as Node)) {
        setIsPatSegmentDropdownOpen(false);
      }
      if (patMetricContainerRef.current && !patMetricContainerRef.current.contains(event.target as Node)) {
        setIsPatMetricDropdownOpen(false);
      }
      if (patPeriodContainerRef.current && !patPeriodContainerRef.current.contains(event.target as Node)) {
        setIsPatPeriodDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add / Edit Asset / Transaction via AddAssetModal
  const handleSaveAssetTransaction = (tx: Omit<InvestmentTransaction, 'id' | 'createdAt'> | InvestmentTransaction) => {
    const tempId = ('id' in tx && tx.id) ? tx.id : `tx_inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const txItem: InvestmentTransaction = {
      ...tx,
      id: tempId,
      userId,
      assetTicker: ((tx as any).assetTicker || (tx as any).ticker || '').toUpperCase().trim(),
      assetCategory: (tx as any).assetCategory || (tx as any).category || 'acoes',
      type: tx.type || 'buy',
      quantity: Number(tx.quantity) || 0,
      unitPrice: Number(tx.unitPrice) || Number((tx as any).price) || 0,
      totalAmount: Number(tx.totalAmount) || Number((tx as any).totalValue) || (Number(tx.quantity) * Number(tx.unitPrice || (tx as any).price)) || 0,
      broker: (tx as any).broker || (tx as any).institution || 'RICO INVESTIMENTOS',
      date: tx.date || new Date().toISOString().split('T')[0],
      notes: tx.notes || '',
      createdAt: (tx as any).createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Snapshot previous state for rollback
    const previousTxs = [...transactions];

    // 2. OPTIMISTIC UI: Update local state immediately (0ms delay)
    setTransactions(prev => {
      const exists = prev.some(t => t.id === txItem.id);
      return exists ? prev.map(t => (t.id === txItem.id ? txItem : t)) : [txItem, ...prev];
    });

    if ('id' in tx && tx.id) {
      PortfolioStorageService.updateTransaction(txItem, userId);
    } else {
      PortfolioStorageService.addTransaction(txItem, userId);
    }

    // 3. Instant modal close & visual event triggers (0ms delay)
    setEditingTx(null);
    setIsAddModalOpen(false);
    setIsTxModalOpen(false);
    window.dispatchEvent(new Event('portfolio_updated'));
    window.dispatchEvent(new Event('remote_data_updated'));
    window.dispatchEvent(new CustomEvent('financial_data_mutated'));

    // 4. Background Sync without freezing UI
    (async () => {
      try {
        if (onSaveInvestmentTransaction) {
          await onSaveInvestmentTransaction(txItem);
        } else {
          const action = ('id' in tx && tx.id) ? 'updateInvestmentTransaction' : 'addInvestmentTransaction';
          await executeTransactionalInvestmentTransaction(userId, action, {
            transactionData: txItem,
            transactionId: txItem.id,
          });
        }
      } catch (err: any) {
        console.error('Erro na sincronização de investimento em background:', err);
        // Rollback on failure
        setTransactions(previousTxs);
        setPortfolioAlert({ isOpen: true, message: 'Falha ao sincronizar com a nuvem. Alteração revertida.', type: 'error' });
      }
    })();
  };

  // Calculations
  const activeAssetsMap = useMemo(() => {
    const map = new Map<string, InvestmentAsset>();
    assets.forEach((a) => {
      if (a && a.quantity > 0) {
        map.set(String(a.ticker || '').trim().toUpperCase(), a);
      }
    });
    return map;
  }, [assets]);

  const uniqueSegments = useMemo(() => {
    const usdRate = quotes.find((q) => q.symbol === 'USD/BRL')?.price || 5.06;
    const active = assets.filter((a) => {
      if (a.quantity <= 0) return false;
      if (patSegmentFilter.includes('completo') || patSegmentFilter.length === 0) return true;
      return patSegmentFilter.includes(getAssetSegment(a));
    });
    const map: Record<string, InvestmentAsset[]> = {};
    active.forEach((a) => {
      const seg = getAssetSegment(a);
      if (!map[seg]) map[seg] = [];
      map[seg].push(a);
    });
    return Object.entries(map)
      .map(([seg, segAssets]) => {
        const segVal = segAssets.reduce((acc, a) => {
          const mult = a.currency === 'USD' ? usdRate : 1;
          return acc + a.currentPrice * a.quantity * mult;
        }, 0);
        return { seg, segAssets, segVal };
      })
      .sort((a, b) => b.segVal - a.segVal);
  }, [assets, quotes, patSegmentFilter]);

  const segmentPieChartData = useMemo(() => {
    const dotColors = [
      '#D4AF37', '#00E676', '#29B6F6', '#AB47BC', '#FF7043',
      '#EC407A', '#26A69A', '#FFCA28', '#78909C', '#8D6E63',
      '#5C6BC0', '#9CCC65', '#26C6DA', '#FFA726', '#8E24AA'
    ];

    const filteredTotal = uniqueSegments.reduce((acc, s) => acc + s.segVal, 0);

    return uniqueSegments
      .map((s, idx) => {
        const pct = filteredTotal > 0 ? (s.segVal / filteredTotal) * 100 : 0;
        return {
          name: s.seg,
          segment: s.seg,
          value: Number(s.segVal.toFixed(2)),
          pct: Number(pct.toFixed(1)),
          color: dotColors[idx % dotColors.length],
        };
      })
      .filter((d) => d.value > 0);
  }, [uniqueSegments]);

  const activeDividends = useMemo(() => {
    return dividends
      .filter((d) => {
        if (!d) return false;
        const ticker = String(d.assetTicker || d.ticker || d.asset || '').trim().toUpperCase();
        return activeAssetsMap.has(ticker);
      })
      .map((d) => {
        const ticker = String(d.assetTicker || d.ticker || d.asset || '').trim().toUpperCase();
        const asset = activeAssetsMap.get(ticker);
        if (asset && asset.quantity > 0) {
          const qty = asset.quantity;
          const totalVal = d.valuePerShare > 0 ? d.valuePerShare * qty : d.totalValue;
          return {
            ...d,
            quantity: qty,
            totalValue: Number(totalVal.toFixed(2)),
          };
        }
        return d;
      });
  }, [dividends, activeAssetsMap]);

  const calculateTotalReceivedDividends = () => {
    return activeDividends
      .filter((d) => d.status === 'received')
      .reduce((acc, d) => acc + d.totalValue, 0);
  };

  const calculateTotalProvisionedDividends = () => {
    return activeDividends
      .filter((d) => d.status === 'future')
      .reduce((acc, d) => acc + d.totalValue, 0);
  };

  const totalProfit = totalEquity - totalInvested;
  const returnPct = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  const filteredDividends = useMemo(() => {
    if (proventosPeriodFilter === 'ALL') {
      return activeDividends;
    }
    const now = new Date();
    if (proventosPeriodFilter === 'CURRENT_MONTH') {
      const year = now.getFullYear();
      const month = now.getMonth();
      return activeDividends.filter((d) => {
        const dtStr = d.paymentDate || d.dateCom;
        if (!dtStr) return false;
        const dt = new Date(dtStr);
        return dt.getFullYear() === year && dt.getMonth() === month;
      });
    }
    if (proventosPeriodFilter === '6M') {
      const limit = new Date();
      limit.setMonth(limit.getMonth() - 6);
      return activeDividends.filter((d) => {
        const dtStr = d.paymentDate || d.dateCom;
        if (!dtStr) return false;
        return new Date(dtStr) >= limit;
      });
    }
    if (proventosPeriodFilter === '12M') {
      const limit = new Date();
      limit.setFullYear(limit.getFullYear() - 1);
      return activeDividends.filter((d) => {
        const dtStr = d.paymentDate || d.dateCom;
        if (!dtStr) return false;
        return new Date(dtStr) >= limit;
      });
    }
    if (proventosPeriodFilter === 'CUSTOM') {
      if (!proventosAppliedStartDate && !proventosAppliedEndDate) return activeDividends;
      return activeDividends.filter((d) => {
        const dtStr = d.paymentDate || d.dateCom;
        if (!dtStr) return true;
        let ok = true;
        if (proventosAppliedStartDate && dtStr < proventosAppliedStartDate) ok = false;
        if (proventosAppliedEndDate && dtStr > proventosAppliedEndDate) ok = false;
        return ok;
      });
    }
    return activeDividends;
  }, [activeDividends, proventosPeriodFilter, proventosAppliedStartDate, proventosAppliedEndDate]);

  const receivedDividends = useMemo(() => {
    return filteredDividends
      .filter((d) => d.status === 'received')
      .reduce((acc, d) => acc + d.totalValue, 0);
  }, [filteredDividends]);

  const provisionedDividends = useMemo(() => {
    return filteredDividends
      .filter((d) => d.status === 'future')
      .reduce((acc, d) => acc + d.totalValue, 0);
  }, [filteredDividends]);

  // Proventos Recebidos por Ativo Calculation
  const proventosByAsset = useMemo(() => {
    let list = activeDividends;
    const now = new Date();

    if (assetProventosFilter === 'CURRENT_MONTH') {
      const year = now.getFullYear();
      const month = now.getMonth();
      list = list.filter((d) => {
        const dtStr = d.paymentDate || d.dateCom;
        if (!dtStr) return false;
        const dt = new Date(dtStr);
        return dt.getFullYear() === year && dt.getMonth() === month;
      });
    } else if (assetProventosFilter === '6M') {
      const limit = new Date();
      limit.setMonth(limit.getMonth() - 6);
      list = list.filter((d) => {
        const dtStr = d.paymentDate || d.dateCom;
        if (!dtStr) return false;
        return new Date(dtStr) >= limit;
      });
    } else if (assetProventosFilter === '12M') {
      const limit = new Date();
      limit.setFullYear(limit.getFullYear() - 1);
      list = list.filter((d) => {
        const dtStr = d.paymentDate || d.dateCom;
        if (!dtStr) return false;
        return new Date(dtStr) >= limit;
      });
    } else if (assetProventosFilter === 'CUSTOM') {
      if (assetProventosAppliedStartDate || assetProventosAppliedEndDate) {
        list = list.filter((d) => {
          const dtStr = d.paymentDate || d.dateCom;
          if (!dtStr) return true;
          let ok = true;
          if (assetProventosAppliedStartDate && dtStr < assetProventosAppliedStartDate) ok = false;
          if (assetProventosAppliedEndDate && dtStr > assetProventosAppliedEndDate) ok = false;
          return ok;
        });
      }
    }

    const map: Record<string, {
      ticker: string;
      category?: AssetCategory;
      segment?: string;
      totalReceived: number;
      totalProvisioned: number;
      countReceived: number;
      countProvisioned: number;
    }> = {};

    list.forEach((d) => {
      if (!d) return;
      const rawTicker = d.assetTicker || d.ticker || d.asset || '';
      const ticker = String(rawTicker).trim().toUpperCase();
      if (!map[ticker]) {
        const assetObj = activeAssetsMap.get(ticker) || assets.find((a) => String(a.ticker || '').trim().toUpperCase() === ticker);
        map[ticker] = {
          ticker,
          category: d.assetCategory || assetObj?.category,
          segment: assetObj?.segment || 'Ativo',
          totalReceived: 0,
          totalProvisioned: 0,
          countReceived: 0,
          countProvisioned: 0,
        };
      }

      if (d.status === 'received') {
        map[ticker].totalReceived += d.totalValue;
        map[ticker].countReceived += 1;
      } else {
        map[ticker].totalProvisioned += d.totalValue;
        map[ticker].countProvisioned += 1;
      }
    });

    const array = Object.values(map);
    array.sort((a, b) => (proventosSortOrder === 'DESC' ? b.totalReceived - a.totalReceived : a.totalReceived - b.totalReceived));
    return array;
  }, [activeDividends, activeAssetsMap, assets, assetProventosFilter, assetProventosAppliedStartDate, assetProventosAppliedEndDate, proventosSortOrder]);

  const assetProventosTotalReceived = useMemo(() => {
    return proventosByAsset.reduce((acc, item) => acc + item.totalReceived, 0);
  }, [proventosByAsset]);

  // Category Total
  const getCategoryTotal = (cat: AssetCategory) => {
    const usdRate = quotes.find((q) => q.symbol === 'USD/BRL')?.price || 5.06;
    return assets
      .filter((a) => a.category === cat)
      .reduce((acc, a) => {
        const val = a.currency === 'USD' ? a.currentPrice * usdRate * a.quantity : a.currentPrice * a.quantity;
        return acc + val;
      }, 0);
  };

  // Target Allocations calculation (Requirement 7)
  const calculatedTargetAllocations = useMemo(() => {
    const usdRate = quotes.find((q) => q.symbol === 'USD/BRL')?.price || 5.08;

    let tesouroBrl = 0;
    let fiisBrl = 0;
    let fiagroBrl = 0;
    let etfBrl = 0;
    let acoesBrl = 0;
    let etfUsd = 0;
    let acoesUsd = 0;
    let criptoEth = 0;
    let criptoBtc = 0;
    let criptoAlt = 0;

    assets.forEach((a) => {
      if (!a) return;
      const valBrl = a.currency === 'USD' ? (a.currentPrice || 0) * usdRate * (a.quantity || 0) : (a.currentPrice || 0) * (a.quantity || 0);
      const tickerUpper = String(a.ticker || '').toUpperCase();
      const cat = a.category;

      if (cat === 'tesouro') {
        tesouroBrl += valBrl;
      } else if (cat === 'fiis') {
        fiisBrl += valBrl;
      } else if (cat === 'fiagro') {
        fiagroBrl += valBrl;
      } else if (cat === 'etf_exterior' || cat === 'etfs' || (cat as string) === 'etf') {
        if (a.currency === 'USD') etfUsd += valBrl;
        else etfBrl += valBrl;
      } else if (cat === 'acoes') {
        if (a.currency === 'USD') acoesUsd += valBrl;
        else acoesBrl += valBrl;
      } else if (cat === 'stocks') {
        acoesUsd += valBrl;
      } else if (cat === 'cripto') {
        if (tickerUpper === 'ETH' || (a.name || '').toLowerCase().includes('ethereum')) {
          criptoEth += valBrl;
        } else if (tickerUpper === 'BTC' || (a.name || '').toLowerCase().includes('bitcoin')) {
          criptoBtc += valBrl;
        } else {
          criptoAlt += valBrl;
        }
      } else {
        if (a.currency === 'USD') acoesUsd += valBrl;
        else acoesBrl += valBrl;
      }
    });

    const categoryTotals: Record<string, number> = {
      tesouro_brl: tesouroBrl,
      fiis_brl: fiisBrl,
      fiagro_brl: fiagroBrl,
      etf_brl: etfBrl,
      acoes_brl: acoesBrl,
      etf_usd: etfUsd,
      acoes_usd: acoesUsd,
      cripto_eth: criptoEth,
      cripto_btc: criptoBtc,
      cripto_altcoins: criptoAlt,
    };

    const activeTargets = Array.isArray(targetAllocations) && targetAllocations.length > 0
      ? targetAllocations
      : DEFAULT_TARGET_ALLOCATIONS;

    return activeTargets.map((item) => {
      const rawVal = categoryTotals[item.categoryKey] || 0;
      const currentPct = totalEquity > 0 ? (rawVal / totalEquity) * 100 : 0;
      const diff = currentPct - item.targetPct;
      const isOver = currentPct > item.targetPct;

      return {
        ...item,
        currentVal: rawVal,
        currentPct,
        diff,
        isOver,
      };
    });
  }, [assets, quotes, totalEquity, targetAllocations]);

  const handleOpenEditTargets = () => {
    setEditingAllocations(JSON.parse(JSON.stringify(targetAllocations)));
    setIsEditingTargetModalOpen(true);
  };

  const handleSaveTargetAllocations = () => {
    const newAllocations = [...editingAllocations];

    // 1. Backup do estado atual caso a requisição falhe (Rollback)
    const previousAllocations = [...targetAllocations];

    // 2. ATUALIZAÇÃO OTIMISTA (0ms delay): Atualiza a tela e cálculos imediatamente
    setTargetAllocations(newAllocations);
    PortfolioStorageService.saveTargetAllocations(newAllocations, userId);
    setIsEditingTargetModalOpen(false);

    // Dispara eventos imediatamente para recalcular na hora o gráfico e as barras de progresso
    window.dispatchEvent(new Event('portfolio_updated'));
    window.dispatchEvent(new Event('remote_data_updated'));
    window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId } }));

    // 3. Processamento em Background (Sem travar a tela)
    (async () => {
      try {
        const result = await executeTransactionalTargetAllocations(userId, newAllocations);
        if (!result || !result.success) {
          throw new Error('Falha ao sincronizar metas de alocação na nuvem.');
        }
      } catch (error) {
        console.error('Erro ao salvar alocações. Revertendo...', error);
        // 4. ROLLBACK: Se a nuvem falhar, devolve os valores antigos
        setTargetAllocations(previousAllocations);
        PortfolioStorageService.saveTargetAllocations(previousAllocations, userId);
        window.dispatchEvent(new Event('portfolio_updated'));
        window.dispatchEvent(new Event('remote_data_updated'));
        window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId } }));
        setPortfolioAlert({
          isOpen: true,
          message: 'Erro ao salvar as metas de alocação. Verifique sua conexão.',
          type: 'error',
        });
      }
    })();
  };

  // Format value with visibility toggle (standardized strictly to 2 decimal places)
  const formatValue = (val: number, prefix: string = 'R$ ', decimals: number = 2) => {
    if (!showValues) return '••••••••';
    if (isNaN(val) || !isFinite(val)) return `${prefix}0,00`;
    const rounded = Math.round((val + Number.EPSILON) * 100) / 100;
    return `${prefix}${rounded.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  };

  // Pie Chart Data
  const pieChartData = (Object.keys(CATEGORY_LABELS) as AssetCategory[])
    .map((cat) => {
      const value = getCategoryTotal(cat);
      const pct = totalEquity > 0 ? (value / totalEquity) * 100 : 0;
      return {
        name: CATEGORY_LABELS[cat],
        value: Number(value.toFixed(2)),
        pct: Number(pct.toFixed(1)),
        category: cat,
        color: CATEGORY_COLORS[cat],
      };
    })
    .filter((d) => d.value > 0);

  // Composition Card List for Dashboard with clearly separated Rentabilidade Total and Rentabilidade Hoje
  const compositionCardList = useMemo(() => {
    const usdRate = quotes.find((q) => q.symbol === 'USD/BRL')?.price || 5.06;
    const allCatKeys = Object.keys(CATEGORY_LABELS) as AssetCategory[];

    return allCatKeys
      .map((catKey) => {
        const catName = CATEGORY_LABELS[catKey];
        const catColor = CATEGORY_COLORS[catKey] || '#3B82F6';
        const catAssets = assets.filter((a) => a.category === catKey);

        if (catAssets.length > 0) {
          let totalVal = 0;
          let todayVal = 0;
          let totalCost = 0;

          catAssets.forEach((a) => {
            const mult = a.currency === 'USD' ? usdRate : 1;
            const val = a.currentPrice * a.quantity * mult;
            const cost = a.averagePrice * a.quantity * mult;
            const todayVar = (a.currentPrice * ((a.priceChange24h || 0) / 100)) * a.quantity * mult;
            totalVal += val;
            totalCost += cost;
            todayVal += todayVar;
          });

          const todayPct = (totalVal - todayVal) > 0 ? (todayVal / (totalVal - todayVal)) * 100 : 0;
          const totalRentPct = totalCost > 0 ? ((totalVal - totalCost) / totalCost) * 100 : 0;
          const allocPct = totalEquity > 0 ? (totalVal / totalEquity) * 100 : 0;

          return {
            name: catName,
            key: catKey,
            value: totalVal,
            todayVal,
            todayPct,
            totalRentPct,
            pct: allocPct,
            color: catColor,
            hasAssets: true,
          };
        }

        return {
          name: catName,
          key: catKey,
          value: 0,
          todayVal: 0,
          todayPct: 0,
          totalRentPct: 0,
          pct: 0,
          color: catColor,
          hasAssets: false,
        };
      })
      .filter((item) => item.hasAssets);
  }, [assets, quotes, totalEquity]);

  const currentFilteredValue = useMemo(() => {
    if (patSegmentFilter.includes('completo') || patSegmentFilter.length === 0) {
      return patMetricType === 'patrimonio' ? totalEquity : totalInvested;
    }
    const catAssets = assets.filter((a) => patSegmentFilter.includes(getAssetSegment(a)));
    const usdRate = quotes.find((q) => q.symbol === 'USD/BRL')?.price || 5.06;
    if (patMetricType === 'patrimonio') {
      return catAssets.length > 0
        ? catAssets.reduce((acc, a) => acc + (a.currency === 'USD' ? a.currentPrice * usdRate * a.quantity : a.currentPrice * a.quantity), 0)
        : 0;
    } else {
      return catAssets.reduce((acc, a) => acc + (a.currency === 'USD' ? a.averagePrice * usdRate * a.quantity : a.averagePrice * a.quantity), 0);
    }
  }, [patSegmentFilter, patMetricType, totalEquity, totalInvested, assets, quotes]);

  // Dynamic Rentabilidade Chart Data driven by rentPeriod, rentAppliedStartDate, rentAppliedEndDate
  const rentabilityPercentageChartData = useMemo(() => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date(now.getFullYear(), now.getMonth(), 1);

    if (rentPeriod === '1M') {
      startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1);
    } else if (rentPeriod === '3M') {
      startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 3, 1);
    } else if (rentPeriod === '6M') {
      startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 5, 1);
    } else if (rentPeriod === '1Y') {
      startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1);
    } else if (rentPeriod === '2Y') {
      startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 23, 1);
    } else if (rentPeriod === 'ALL') {
      startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1);
      if (transactions.length > 0) {
        const dates = transactions.map((t) => new Date(t.date)).filter((d) => !isNaN(d.getTime()));
        if (dates.length > 0) {
          const earliest = new Date(Math.min(...dates.map((d) => d.getTime())));
          if (earliest < startDate) startDate = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
        }
      }
    } else if (rentPeriod === 'CUSTOM') {
      if (rentAppliedStartDate) startDate = new Date(rentAppliedStartDate);
      if (rentAppliedEndDate) {
        const p = rentAppliedEndDate.split('-');
        if (p.length === 3) endDate = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, 1);
      }
    }

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const points: { key: string; monthLabel: string; date: Date }[] = [];
    let curr = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (curr <= last && points.length < 60) {
      const label = `${monthNames[curr.getMonth()]}/${curr.getFullYear()}`;
      points.push({ key: `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}`, monthLabel: label, date: new Date(curr) });
      curr.setMonth(curr.getMonth() + 1);
    }

    if (points.length === 0) {
      const label = `${monthNames[endDate.getMonth()]}/${endDate.getFullYear()}`;
      points.push({ key: `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`, monthLabel: label, date: new Date(endDate) });
    }

    const usdRate = quotes.find((q) => q.symbol === 'USD/BRL')?.price || 5.06;

    // Monthly benchmark yields
    const cdiMonthly = 0.0083;  // ~10.4% p.a.
    const ibovMonthly = 0.0095; // ~12.0% p.a.
    const ipcaMonthly = 0.0037; // ~4.5% p.a.

    const totalInvestedOverall = totalInvested;
    const totalEquityOverall = totalEquity;

    let initialPointReturn: number | null = null;

    return points.map((pt, idx) => {
      const endOfMonth = new Date(pt.date.getFullYear(), pt.date.getMonth() + 1, 0, 23, 59, 59);

      const txsUpToDate = transactions.filter((t) => new Date(t.date) <= endOfMonth);
      const cumulativeQtyMap: Record<string, number> = {};
      let investedUpToDate = 0;

      txsUpToDate.forEach((t) => {
        const tTicker = t.assetTicker || (t as any).ticker;
        if (tTicker) {
          const asset = assets.find((a) => a.ticker === tTicker);
          const mult = asset?.currency === 'USD' ? usdRate : 1;
          const uPrice = t.unitPrice || (t as any).price || 0;
          const val = uPrice * t.quantity * mult;
          const isBuy = t.type === 'buy' || (t.type as any) === 'BUY';
          if (isBuy) {
            cumulativeQtyMap[tTicker] = (cumulativeQtyMap[tTicker] || 0) + t.quantity;
            investedUpToDate += val;
          } else {
            cumulativeQtyMap[tTicker] = (cumulativeQtyMap[tTicker] || 0) - t.quantity;
            investedUpToDate -= val;
          }
        }
      });

      let equityUpToDate = Object.entries(cumulativeQtyMap).reduce((sum, [ticker, qty]) => {
        if (qty <= 0) return sum;
        const asset = assets.find((a) => a.ticker === ticker);
        const price = asset ? asset.currentPrice : 10;
        const mult = asset?.currency === 'USD' ? usdRate : 1;
        return sum + price * qty * mult;
      }, 0);

      if (idx === points.length - 1 && assets.length > 0) {
        equityUpToDate = totalEquityOverall;
        if (totalInvestedOverall > 0) investedUpToDate = totalInvestedOverall;
      }

      let rawReturn = 0;
      if (investedUpToDate > 0) {
        rawReturn = ((equityUpToDate - investedUpToDate) / investedUpToDate) * 100;
      }

      if (initialPointReturn === null) {
        initialPointReturn = rawReturn;
      }

      const patrimonio = rentPeriod === 'ALL'
        ? Number(rawReturn.toFixed(2))
        : Number((rawReturn - (initialPointReturn || 0)).toFixed(2));
      const cdi = Number(((Math.pow(1 + cdiMonthly, idx) - 1) * 100).toFixed(2));
      const ibov = Number(((Math.pow(1 + ibovMonthly, idx) - 1) * 100).toFixed(2));
      const ipca = Number(((Math.pow(1 + ipcaMonthly, idx) - 1) * 100).toFixed(2));

      return {
        month: pt.monthLabel,
        patrimonio: isNaN(patrimonio) ? 0 : patrimonio,
        cdi,
        ibov,
        ipca,
      };
    });
  }, [rentPeriod, rentAppliedStartDate, rentAppliedEndDate, transactions, assets, quotes, totalEquity, totalInvested]);

  const rentabilitySummary = useMemo(() => {
    if (rentabilityPercentageChartData.length === 0) {
      return { patrimonio: 0, cdi: 0, ibov: 0, ipca: 0, cdiPctOf: 0, ibovDiff: 0, realGain: 0 };
    }
    const lastPoint = rentabilityPercentageChartData[rentabilityPercentageChartData.length - 1];
    const patrimonio = lastPoint.patrimonio;
    const cdi = lastPoint.cdi;
    const ibov = lastPoint.ibov;
    const ipca = lastPoint.ipca;

    const cdiPctOf = cdi > 0 ? (patrimonio / cdi) * 100 : 0;
    const ibovDiff = patrimonio - ibov;
    const realGain = patrimonio - ipca;

    return {
      patrimonio,
      cdi,
      ibov,
      ipca,
      cdiPctOf,
      ibovDiff,
      realGain,
    };
  }, [rentabilityPercentageChartData]);

  const activePatrimonioChartData = useMemo(() => {
    const now = new Date();
    if (currentFilteredValue === 0 && assets.length === 0) {
      return [
        { month: 'Jan/2026', patrimonio: 0 },
        { month: 'Fev/2026', patrimonio: 0 },
        { month: 'Mar/2026', patrimonio: 0 },
        { month: 'Abr/2026', patrimonio: 0 },
        { month: 'Mai/2026', patrimonio: 0 },
        { month: 'Jun/2026', patrimonio: 0 },
        { month: 'Jul/2026', patrimonio: 0 },
        { month: 'Ago/2026', patrimonio: 0 },
      ];
    }

    // Determine target start and end dates
    let startDate = new Date();
    let endDate = new Date(now.getFullYear(), now.getMonth(), 1);

    if (patPeriodFilter === '6M') {
      startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 5, 1);
    } else if (patPeriodFilter === '1Y') {
      startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1);
    } else if (patPeriodFilter === '2Y') {
      startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 23, 1);
    } else if (patPeriodFilter === 'ALL') {
      startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1);
      if (transactions.length > 0) {
        const dates = transactions.map((t) => new Date(t.date)).filter((d) => !isNaN(d.getTime()));
        if (dates.length > 0) {
          const earliest = new Date(Math.min(...dates.map((d) => d.getTime())));
          if (earliest < startDate) startDate = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
        }
      }
    } else if (patPeriodFilter === 'CUSTOM') {
      if (patCustomStartDate) startDate = new Date(patCustomStartDate);
      if (patCustomEndDate) {
        const p = patCustomEndDate.split('-');
        if (p.length === 3) endDate = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, 1);
      }
    }

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const points: { key: string; monthLabel: string; date: Date }[] = [];
    let curr = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (curr <= last && points.length < 60) {
      const label = `${monthNames[curr.getMonth()]}/${curr.getFullYear()}`;
      points.push({ key: `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}`, monthLabel: label, date: new Date(curr) });
      curr.setMonth(curr.getMonth() + 1);
    }

    if (points.length === 0) {
      const label = `${monthNames[endDate.getMonth()]}/${endDate.getFullYear()}`;
      points.push({ key: `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`, monthLabel: label, date: new Date(endDate) });
    }

    const usdRate = quotes.find((q) => q.symbol === 'USD/BRL')?.price || 5.06;
    const catFilteredTxs = transactions.filter((t) => {
      if (patSegmentFilter.includes('completo')) return true;
      const tTicker = t.assetTicker || (t as any).ticker;
      const tAssetId = (t as any).assetId;
      const asset = assets.find((a) => a.id === tAssetId || a.ticker === tTicker);
      return asset ? patSegmentFilter.includes(getAssetSegment(asset)) : true;
    });

    if (catFilteredTxs.length > 0) {
      let lastVal = 0;
      return points.map((pt) => {
        const year = pt.date.getFullYear();
        const month = pt.date.getMonth();
        const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

        let totalForMonth = 0;
        if (patMetricType === 'investimento') {
          totalForMonth = catFilteredTxs
            .filter((t) => new Date(t.date) <= endOfMonth)
            .reduce((sum, t) => {
              const tTicker = t.assetTicker || (t as any).ticker;
              const asset = assets.find((a) => a.ticker === tTicker);
              const mult = asset?.currency === 'USD' ? usdRate : 1;
              const uPrice = t.unitPrice || (t as any).price || 0;
              const val = uPrice * t.quantity * mult;
              const isBuy = t.type === 'buy' || (t.type as any) === 'BUY';
              return isBuy ? sum + val : sum - val;
            }, 0);
        } else {
          const cumulativeQtyMap: Record<string, number> = {};
          catFilteredTxs
            .filter((t) => new Date(t.date) <= endOfMonth)
            .forEach((t) => {
              const tTicker = t.assetTicker || (t as any).ticker;
              if (tTicker) {
                const isBuy = t.type === 'buy' || (t.type as any) === 'BUY';
                cumulativeQtyMap[tTicker] = (cumulativeQtyMap[tTicker] || 0) + (isBuy ? t.quantity : -t.quantity);
              }
            });

          totalForMonth = Object.entries(cumulativeQtyMap).reduce((sum, [ticker, qty]) => {
            if (qty <= 0) return sum;
            const asset = assets.find((a) => a.ticker === ticker);
            const price = asset ? asset.currentPrice : 10;
            const mult = asset?.currency === 'USD' ? usdRate : 1;
            return sum + price * qty * mult;
          }, 0);
        }

        if (totalForMonth > 0) {
          lastVal = totalForMonth;
        } else if (lastVal > 0) {
          totalForMonth = lastVal;
        } else if (currentFilteredValue > 0) {
          totalForMonth = currentFilteredValue;
        }

        return {
          month: pt.monthLabel,
          patrimonio: Math.max(0, Math.round(totalForMonth)),
        };
      });
    }

    const targetVal = currentFilteredValue;
    const count = points.length;
    return points.map((pt, idx) => {
      let factor = 1;
      if (count > 1) {
        factor = 0.4 + 0.6 * (idx / (count - 1));
      }
      return {
        month: pt.monthLabel,
        patrimonio: Math.round(targetVal * factor),
      };
    });
  }, [
    patSegmentFilter,
    patMetricType,
    patPeriodFilter,
    patCustomStartDate,
    patCustomEndDate,
    currentFilteredValue,
    transactions,
    assets,
    quotes,
  ]);

  // Monthly Comparison (Receitas x Despesas x Saldo) for Patrimônio
  const monthlyComparisonData = [
    { month: 'Jan/2025', receitas: 12500, despesas: 8200, saldo: 4300 },
    { month: 'Fev/2025', receitas: 13100, despesas: 7900, saldo: 5200 },
    { month: 'Mar/2025', receitas: 14200, despesas: 8500, saldo: 5700 },
    { month: 'Abr/2025', receitas: 13800, despesas: 9100, saldo: 4700 },
    { month: 'Mai/2025', receitas: 15500, despesas: 8800, saldo: 6700 },
    { month: 'Jun/2025', receitas: 16200, despesas: 9400, saldo: 6800 },
    { month: 'Jul/2025', receitas: 17000, despesas: 9200, saldo: 7800 },
  ];

  const { monthlyDividendsChartData, dividendTimelineMonthsCount } = useMemo(() => {
    const now = new Date();
    let startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    let endDate = new Date(now.getFullYear(), now.getMonth(), 1);

    if (proventosPeriodFilter === 'CURRENT_MONTH') {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else if (proventosPeriodFilter === '6M') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    } else if (proventosPeriodFilter === '12M') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    } else if (proventosPeriodFilter === 'ALL') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      if (dividends.length > 0) {
        const dates = dividends
          .map((d) => d.paymentDate || d.dateCom)
          .filter(Boolean)
          .map((dt) => new Date(dt));
        if (dates.length > 0) {
          const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
          if (minDate < startDate) {
            startDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
          }
        }
      }
    } else if (proventosPeriodFilter === 'CUSTOM') {
      if (proventosAppliedStartDate) {
        const p = proventosAppliedStartDate.split('-');
        if (p.length === 3) startDate = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, 1);
      }
      if (proventosAppliedEndDate) {
        const p = proventosAppliedEndDate.split('-');
        if (p.length === 3) endDate = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, 1);
      }
    }

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthMap: Record<string, number> = {};
    const chartPoints: { month: string; key: string }[] = [];

    let curr = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (curr <= last && chartPoints.length < 120) {
      const y = curr.getFullYear();
      const mIdx = curr.getMonth();
      const key = `${y}-${String(mIdx + 1).padStart(2, '0')}`;
      const label = `${monthNames[mIdx]}/${y}`;
      chartPoints.push({ month: label, key });
      monthMap[key] = 0;
      curr.setMonth(curr.getMonth() + 1);
    }

    if (chartPoints.length === 0) {
      const y = endDate.getFullYear();
      const mIdx = endDate.getMonth();
      const key = `${y}-${String(mIdx + 1).padStart(2, '0')}`;
      const label = `${monthNames[mIdx]}/${y}`;
      chartPoints.push({ month: label, key });
      monthMap[key] = 0;
    }

    const receivedList = filteredDividends.filter((d) => d.status === 'received');
    receivedList.forEach((d) => {
      const dtStr = d.paymentDate || d.dateCom;
      if (!dtStr) return;
      const parts = dtStr.split('-');
      if (parts.length === 3) {
        const y = parts[0];
        const m = parts[1];
        const key = `${y}-${m}`;
        if (monthMap[key] !== undefined) {
          monthMap[key] += d.totalValue;
        } else {
          monthMap[key] = (monthMap[key] || 0) + d.totalValue;
        }
      }
    });

    const chartData = chartPoints.map((pt) => ({
      month: pt.month,
      valor: Number((monthMap[pt.key] || 0).toFixed(2)),
    }));

    return {
      monthlyDividendsChartData: chartData,
      dividendTimelineMonthsCount: Math.max(1, chartPoints.length),
    };
  }, [filteredDividends, dividends, proventosPeriodFilter, proventosAppliedStartDate, proventosAppliedEndDate]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Goal CRUD handlers
  const ptBrToIso = (text: string): string | null => {
    const digits = text.replace(/\D/g, '');
    if (digits.length === 8) {
      const day = parseInt(digits.slice(0, 2), 10);
      const month = parseInt(digits.slice(2, 4), 10);
      const year = parseInt(digits.slice(4, 8), 10);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    return null;
  };

  const handleStartDateTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 8) val = val.substring(0, 8);
    let formatted = val;
    if (val.length >= 5) {
      formatted = `${val.substring(0, 2)}/${val.substring(2, 4)}/${val.substring(4, 8)}`;
    } else if (val.length >= 3) {
      formatted = `${val.substring(0, 2)}/${val.substring(2)}`;
    }
    setStartDateText(formatted);
    const iso = ptBrToIso(formatted);
    if (iso) {
      setGoalForm(prev => ({ ...prev, startDate: iso }));
    } else if (val.length === 0) {
      setGoalForm(prev => ({ ...prev, startDate: '' }));
    }
  };

  const handleTargetDateTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 8) val = val.substring(0, 8);
    let formatted = val;
    if (val.length >= 5) {
      formatted = `${val.substring(0, 2)}/${val.substring(2, 4)}/${val.substring(4, 8)}`;
    } else if (val.length >= 3) {
      formatted = `${val.substring(0, 2)}/${val.substring(2)}`;
    }
    setTargetDateText(formatted);
    const iso = ptBrToIso(formatted);
    if (iso) {
      setGoalForm(prev => ({ ...prev, targetDate: iso }));
    } else if (val.length === 0) {
      setGoalForm(prev => ({ ...prev, targetDate: '' }));
    }
  };

  const handleOpenNewGoalModal = () => {
    setEditingGoal(null);
    const todayIso = new Date().toISOString().split('T')[0];
    setGoalForm({
      title: '',
      targetAmount: '',
      currentAmount: '',
      startDate: todayIso,
      targetDate: '',
      category: 'Patrimônio Total',
    });
    setStartDateText(formatDateBRInput(todayIso));
    setTargetDateText('');
    setIsGoalModalOpen(true);
  };

  const handleOpenEditGoalModal = (goal: PortfolioGoal) => {
    setEditingGoal(goal);
    setGoalForm({
      title: goal.title,
      targetAmount: String(goal.targetAmount),
      currentAmount: String(goal.currentAmount),
      startDate: goal.startDate,
      targetDate: goal.targetDate,
      category: goal.category,
    });
    setStartDateText(goal.startDate ? formatDateBRInput(goal.startDate) : '');
    setTargetDateText(goal.targetDate ? formatDateBRInput(goal.targetDate) : '');
    setIsGoalModalOpen(true);
  };

  const handleSaveGoalForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!goalForm.title || !goalForm.targetAmount) return;

    setIsSubmitting(true);

    try {
      // a) Garanta a conversão numérica do valor-alvo (parseFloat ou Number) para evitar NaNs
      const rawTarget = typeof goalForm.targetAmount === 'string'
        ? goalForm.targetAmount.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
        : String(goalForm.targetAmount);
      const parsedTargetAmount = parseFloat(rawTarget) || 0;

      const rawCurrent = typeof goalForm.currentAmount === 'string'
        ? goalForm.currentAmount.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
        : String(goalForm.currentAmount || '0');
      const parsedCurrentAmount = parseFloat(rawCurrent) || 0;

      // b) Crie o objeto da meta atualizada
      const goalData: PortfolioGoal = {
        id: editingGoal ? editingGoal.id : `goal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId,
        title: goalForm.title.trim(),
        targetAmount: parsedTargetAmount,
        currentAmount: parsedCurrentAmount,
        startDate: goalForm.startDate || new Date().toISOString().split('T')[0],
        targetDate: goalForm.targetDate || '',
        category: goalForm.category || 'Patrimônio Total',
        color: '#D4AF37',
        icon: 'Target',
        updatedAt: new Date().toISOString(),
      };

      // c) Crie a nova lista unificada de metas no estado local
      const currentList = StorageService.getGoals(userId);
      const updatedGoals = editingGoal
        ? currentList.map((g: any) => (g.id === goalData.id ? goalData : g))
        : [...currentList.filter((g: any) => g.id !== goalData.id), goalData];

      // Update local storage and in-memory caches
      StorageService.saveGoal(goalData as any);
      if (editingGoal) {
        PortfolioStorageService.updateGoal(goalData, userId);
      } else {
        PortfolioStorageService.addGoal(goalData, userId);
      }
      StorageService.setGoals(updatedGoals as any);
      PortfolioStorageService.saveGoals(updatedGoals, userId);

      // Instant React state update
      setGoals(updatedGoals);

      // Execute atomic server transaction and direct Appwrite write
      await executeTransactionalGoal(
        userId,
        editingGoal ? 'updateGoal' : 'addGoal',
        {
          goalData,
          goalId: goalData.id,
        }
      );

      // Sync with server mutation & Firestore
      await StorageService.syncUserMutationToServer(userId);
      await onDataChanged?.();

      window.dispatchEvent(new Event('portfolio_updated'));
      window.dispatchEvent(new Event('remote_data_updated'));
      window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId } }));

      // Close modal and reset form
      setIsGoalModalOpen(false);
      setEditingGoal(null);
    } catch (err: any) {
      console.error('Erro ao salvar meta no Appwrite:', err);
      window.dispatchEvent(new CustomEvent('sync-status-change', { detail: 'error' }));
      if (err?.code === 429 || err?.message?.includes('Rate limit')) {
        window.dispatchEvent(new CustomEvent('app-toast', { detail: 'O servidor está processando muitas requisições. Aguarde 30 segundos e tente salvar novamente.' }));
      } else {
        window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Erro ao salvar meta: ' + (err?.message || JSON.stringify(err)) }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGoal = (id: string) => {
    setDeletingGoalId(id);
  };

  const confirmDeleteGoal = async () => {
    if (deletingGoalId) {
      const idToDelete = deletingGoalId;
      setDeletingGoalId(null);
      
      // Guard against race-condition resurrection
      recordGoalDeletion(idToDelete);

      const currentList = StorageService.getGoals(userId);
      const updatedGoals = currentList.filter((g: any) => g.id !== idToDelete);
      
      StorageService.deleteGoal(idToDelete);
      PortfolioStorageService.deleteGoal(idToDelete, userId);
      StorageService.setGoals(updatedGoals as any);
      PortfolioStorageService.saveGoals(updatedGoals as any, userId);
      setGoals(updatedGoals as any);

      // Execute atomic server transaction and direct Appwrite deletion
      await executeTransactionalGoal(userId, 'deleteGoal', {
        goalId: idToDelete,
      });

      await StorageService.syncUserMutationToServer(userId);
      await onDataChanged?.();
      window.dispatchEvent(new Event('portfolio_updated'));
      window.dispatchEvent(new Event('remote_data_updated'));
      window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId } }));
      loadData();
    }
  };

  // Transaction CRUD handlers
  const handleOpenNewTxModal = () => {
    setEditingTx(null);
    setTxForm({
      assetTicker: '',
      assetCategory: 'acoes',
      type: 'buy',
      quantity: '',
      unitPrice: '',
      broker: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setIsTxModalOpen(true);
  };

  const handleOpenEditTxModal = (tx: InvestmentTransaction) => {
    setEditingTx(tx);
    setTxForm({
      assetTicker: tx.assetTicker,
      assetCategory: tx.assetCategory,
      type: tx.type,
      quantity: String(tx.quantity),
      unitPrice: String(tx.unitPrice),
      broker: tx.broker || '',
      date: tx.date,
      notes: tx.notes || '',
    });
    setIsTxModalOpen(true);
  };

  const handleSaveTxForm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!txForm.assetTicker || !txForm.quantity || !txForm.unitPrice) return;

    const qty = parsePtBrNumber(txForm.quantity);
    const price = parsePtBrNumber(txForm.unitPrice);
    const total = qty * price;

    const DATABASE_ID = '6a83aa8d0038331e040f';
    const COLLECTION_ID = 'user_financials';
    const DOCUMENT_ID = '6a849358002db9e638ce';
    const USER_ID = '6a83b38ed065c08efa49';

    const formData = {
      id: editingTx ? editingTx.id : 'inv_' + Date.now(),
      date: txForm.date || new Date().toISOString().split('T')[0],
      ticker: txForm.assetTicker.toUpperCase().trim(),
      assetTicker: txForm.assetTicker.toUpperCase().trim(),
      assetName: txForm.assetTicker.toUpperCase().trim(),
      category: txForm.assetCategory || 'Ações',
      assetCategory: txForm.assetCategory || 'Ações',
      type: txForm.type || 'buy',
      price: price,
      unitPrice: price,
      quantity: qty,
      totalValue: total,
      totalAmount: total,
      institution: txForm.broker || 'RICO INVESTIMENTOS',
      broker: txForm.broker || 'RICO INVESTIMENTOS',
      notes: txForm.notes || '',
      createdAt: editingTx?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 1. Snapshot previous state for rollback
    const previousTxs = [...transactions];

    // 2. OPTIMISTIC UI: Update local state immediately (0ms delay)
    setTransactions(prev => {
      const exists = prev.some(t => t.id === formData.id);
      return exists ? prev.map(t => (t.id === formData.id ? (formData as any) : t)) : [(formData as any), ...prev];
    });

    if (editingTx) {
      PortfolioStorageService.updateTransaction(formData as any, userId);
    } else {
      PortfolioStorageService.addTransaction(formData as any, userId);
    }

    // 3. Instant modal close & visual event triggers (0ms delay)
    setIsTxModalOpen(false);
    setEditingTx(null);
    window.dispatchEvent(new Event('portfolio_updated'));
    window.dispatchEvent(new Event('remote_data_updated'));
    window.dispatchEvent(new CustomEvent('financial_data_mutated'));

    // 4. Background Sync without freezing UI
    (async () => {
      try {
        if (onSaveInvestmentTransaction) {
          await onSaveInvestmentTransaction(formData);
        } else {
          const action = editingTx ? 'updateInvestmentTransaction' : 'addInvestmentTransaction';
          await executeTransactionalInvestmentTransaction(userId, action, {
            transactionData: formData,
            transactionId: formData.id,
          });
        }
      } catch (err: any) {
        console.error('Erro na sincronização de investimento em background:', err);
        // Rollback on failure
        setTransactions(previousTxs);
        setPortfolioAlert({ isOpen: true, message: 'Falha ao sincronizar com a nuvem. Alteração revertida.', type: 'error' });
      }
    })();
  };

  const handleDeleteTx = (id: string) => {
    setDeletingTxId(id);
  };

  const confirmDeleteTx = () => {
    if (!deletingTxId) return;
    const targetId = deletingTxId;

    // 1. Snapshot previous state for rollback
    const previousTxs = [...transactions];

    // 2. OPTIMISTIC UI: Remove from local state immediately (0ms delay)
    recordInvestmentTxDeletion(targetId);
    PortfolioStorageService.deleteTransaction(targetId, userId);
    setTransactions(prev => prev.filter(t => t.id !== targetId));

    // 3. Instant modal close & visual event triggers (0ms delay)
    setDeletingTxId(null);
    window.dispatchEvent(new Event('portfolio_updated'));
    window.dispatchEvent(new Event('remote_data_updated'));
    window.dispatchEvent(new CustomEvent('financial_data_mutated'));

    // 4. Background Deletion Sync without freezing UI
    (async () => {
      try {
        if (onDeleteInvestmentTransaction) {
          await onDeleteInvestmentTransaction(targetId);
        } else {
          await executeTransactionalInvestmentTransaction(userId, 'deleteInvestmentTransaction', {
            transactionId: targetId,
          });
          if (onDataChanged) {
            await onDataChanged();
          }
        }
      } catch (err: any) {
        console.error('Erro ao excluir investimento na nuvem em background:', err);
        // Rollback on failure
        setTransactions(previousTxs);
        setPortfolioAlert({ isOpen: true, message: 'Falha ao excluir na nuvem. Alteração revertida.', type: 'error' });
      }
    })();
  };

  const loadLogoAsDataUrl = (): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const size = 300;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
          ctx.fillStyle = '#D4AF37';
          ctx.fill();
          const ringWidth = 8;
          const innerRadius = size / 2 - ringWidth;
          ctx.save();
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, innerRadius, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, 0, 0, size, size);
          ctx.restore();
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = darlaLogoImg;
    });
  };

  const handleExportTransactionsPDF = async () => {
    try {
      const logoDataUrl = await loadLogoAsDataUrl();
      const doc = new jsPDF();

      doc.setFillColor(18, 18, 18);
      doc.rect(0, 0, 210, 32, 'F');
      doc.setFillColor(212, 175, 55);
      doc.rect(0, 30.5, 210, 1.5, 'F');

      let textStartX = 14;
      if (logoDataUrl) {
        try {
          doc.addImage(logoDataUrl, 'PNG', 12, 5.5, 20, 20);
          textStartX = 36;
        } catch (e) {
          console.warn('Logo error:', e);
        }
      }

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('DINHEIRO SEM FILTRO', textStartX, 16);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(212, 175, 55);
      doc.text('Relatório de Transações de Ativos e Investimentos', textStartX, 24);

      doc.setTextColor(220, 220, 220);
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 135, 24);

      const tableRows = filteredTransactions.map((tx) => [
        formatDateBR(tx.date),
        tx.assetTicker,
        CATEGORY_LABELS[tx.assetCategory] || tx.assetCategory,
        tx.type === 'buy' ? 'COMPRA' : 'VENDA',
        `${tx.quantity} un.`,
        formatValue(tx.unitPrice),
        formatValue(tx.totalAmount),
        tx.broker || '-'
      ]);

      autoTable(doc, {
        startY: 40,
        head: [['Data', 'Ativo', 'Categoria', 'Tipo', 'Qtd', 'Preço Unit.', 'Total', 'Corretora']],
        body: tableRows,
        theme: 'grid',
        headStyles: {
          fillColor: [18, 18, 18],
          textColor: [212, 175, 55],
          fontStyle: 'bold',
          fontSize: 9
        },
        bodyStyles: {
          textColor: [40, 40, 40],
          fontSize: 8.5
        },
        alternateRowStyles: {
          fillColor: [245, 245, 247]
        },
        margin: { left: 14, right: 14 }
      });

      doc.save(`DINHEIRO_SEM_FILTRO_Transacoes_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      console.error('Error generating PDF:', e);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Erro ao gerar PDF de transações.' }));
    }
  };

  // Filter Transactions
  const filteredTransactions = transactions.filter((tx) => {
    const search = (txSearchTerm || '').toLowerCase();
    const matchesSearch =
      String(tx.assetTicker || '').toLowerCase().includes(search) ||
      String(tx.broker || '').toLowerCase().includes(search) ||
      (tx.notes && String(tx.notes).toLowerCase().includes(search));
    const matchesCat =
      txCategoryFilter === 'all' ||
      tx.assetCategory === txCategoryFilter ||
      (filterCategory !== 'completo' && tx.assetCategory === filterCategory);
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {activeSubTab === 'dashboard' && (
      <div className="bg-[#121212] border-2 border-[#D4AF37]/60 rounded-3xl p-4 sm:p-5 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />

        {/* Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-white/10 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00E676] animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider text-[#D4AF37] font-serif">
                Cotações do Mercado
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 bg-[#18181B] px-2.5 py-1 rounded-full border border-white/10 w-fit">
              <Clock className="w-3 h-3 text-[#D4AF37]" />
              <span>
                Sincronizado: <strong className="text-white font-mono">{formatLastUpdatedTime(quotes[0]?.lastUpdated)}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setIsAIModalOpen(true);
                if (!aiAdvice) {
                  fetchSemFiltroPortfolioAnalysis();
                }
              }}
              className="px-3.5 py-2 bg-[#D4AF37]/20 border border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#121212] font-black text-xs rounded-xl shadow-lg transition flex items-center gap-1.5 cursor-pointer"
              title="Análise Sem Filtro da Carteira por IA"
            >
              <Sparkles className="w-4 h-4 fill-current" />
              <span className="hidden sm:inline">Análise Sem Filtro IA</span>
            </button>

            <button
              onClick={() => StorageService.setPrivacyMode(showValues)}
              className="p-2 bg-[#18181B] border border-white/20 hover:border-[#D4AF37] text-white hover:text-[#D4AF37] rounded-xl transition cursor-pointer"
              title={showValues ? 'Ocultar Valores' : 'Mostrar Valores'}
            >
              {showValues ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>

            {!isReadOnly && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-3.5 py-2 bg-[#D4AF37] hover:bg-[#FACC15] text-[#121212] font-black text-xs rounded-xl shadow-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 stroke-[2.5]" />
                <span>Cadastrar Ativo</span>
              </button>
            )}

            <button
              onClick={handleRefreshPrices}
              disabled={isRefreshingQuotes}
              className={`p-2 bg-[#18181B] border border-white/20 hover:border-[#D4AF37] text-white hover:text-[#D4AF37] rounded-xl transition cursor-pointer ${
                isRefreshingQuotes ? 'opacity-50 animate-spin' : ''
              }`}
              title="Sincronizar com AwesomeAPI e CoinGecko"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Period Selection Bar */}
        <div className="pt-3 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-white/10 relative z-10">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pr-1 shrink-0">
            Período:
          </span>
          {[
            { id: 'daily', label: 'Diário (24h)', icon: Zap },
            { id: 'monthly', label: 'Mensal (30d)', icon: Calendar },
            { id: 'semiannual', label: 'Semestral (6m)', icon: BarChart3 },
            { id: 'annual', label: 'Anual (12m)', icon: TrendingUp },
            { id: 'allTime', label: 'Todo o Período', icon: Globe },
          ].map((p) => {
            const Icon = p.icon;
            const active = selectedQuotePeriod === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedQuotePeriod(p.id as any)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#D4AF37] text-[#121212] shadow-md font-black'
                    : 'bg-[#18181B] text-gray-300 hover:text-white border border-white/10 hover:border-[#D4AF37]/50'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* Market Quotes Detailed Performance Area Chart (Google Finance Style) */}
        {(() => {
          const activeQuote = quotes.find(q => q.id === selectedChartQuoteId) || quotes[0];
          if (!activeQuote) return null;

          const metric = getQuoteMetric(activeQuote, selectedQuotePeriod);
          const isPositive = metric.pct >= 0;

          // Generate detailed points for the chart with real dates/times and realistic market volatility
          const pointsCount = 18;
          const currentPrice = activeQuote.price;
          const pct = metric.pct;
          const startPrice = currentPrice / (1 + pct / 100);
          const chartData = [];
          
          const now = new Date();
          for (let i = 0; i < pointsCount; i++) {
            const progress = i / (pointsCount - 1);
            const wave = (Math.sin(progress * Math.PI * 4 + activeQuote.id.length) * 0.65 + Math.cos(progress * Math.PI * 7) * 0.35);
            const amplitude = currentPrice * 0.015;
            const interpolated = startPrice + (currentPrice - startPrice) * progress + wave * amplitude;
            
            // Format time / date label
            let timeLabel = '';
            if (selectedQuotePeriod === 'daily') {
              const hour = 9 + Math.floor((i / (pointsCount - 1)) * 9);
              const minute = i % 2 === 0 ? '00' : '30';
              timeLabel = `${String(hour).padStart(2, '0')}:${minute}`;
            } else if (selectedQuotePeriod === 'monthly' || selectedQuotePeriod === 'semiannual') {
              const d = new Date(now.getTime() - (pointsCount - 1 - i) * 24 * 3600 * 1000 * (selectedQuotePeriod === 'monthly' ? 1 : 10));
              timeLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
            } else if (selectedQuotePeriod === 'custom') {
              const start = new Date(chartCustomStartDate || '2026-01-01');
              const end = new Date(chartCustomEndDate || '2026-08-17');
              const diffTime = end.getTime() - start.getTime();
              const d = new Date(start.getTime() + progress * diffTime);
              timeLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            } else {
              const d = new Date(now.getTime() - (pointsCount - 1 - i) * 24 * 3600 * 1000 * 30);
              timeLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            }

            chartData.push({
              index: i,
              time: timeLabel,
              price: Number(interpolated.toFixed(2))
            });
          }
          if (chartData.length > 0) {
            chartData[0].price = Number(startPrice.toFixed(2));
            chartData[chartData.length - 1].price = currentPrice;
          }

          return (
            <div className="pt-4 mt-4 border-t border-white/10 relative z-10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#D4AF37]" />
                  <span className="text-xs font-black uppercase tracking-wider text-white font-serif">
                    Gráfico de Desempenho
                  </span>
                </div>
                {/* Asset selector tabs */}
                <div className="flex flex-wrap items-center gap-1.5 bg-[#18181B] p-1 rounded-xl border border-white/10">
                  {quotes.map(q => (
                    <button
                      key={q.id}
                      onClick={() => setSelectedChartQuoteId(q.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        (selectedChartQuoteId === q.id || (!selectedChartQuoteId && q === quotes[0]))
                          ? 'bg-[#D4AF37] text-black shadow-md'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {q.symbol || q.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Google Finance Card Container */}
              <div className="bg-[#18181B] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
                {/* Header Information */}
                <div>
                  <p className="text-xs sm:text-sm text-gray-400 font-medium">
                    1 {activeQuote.name} igual a
                  </p>
                  <div className="flex items-baseline gap-3 mt-1 flex-wrap">
                    <h2 className="text-2xl sm:text-3xl font-black text-white font-serif tracking-tight">
                      {formatNumberToPtBr(activeQuote.price)} <span className="text-base sm:text-lg font-normal text-gray-300">{activeQuote.currency === 'USD' ? 'Dólar americano' : activeQuote.currency === 'BRL' ? 'Real brasileiro' : activeQuote.currency}</span>
                    </h2>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold ${
                      isPositive ? 'bg-[#00E676]/15 text-[#00E676]' : 'bg-[#FF5252]/15 text-[#FF5252]'
                    }`}>
                      {isPositive ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                      {isPositive ? '+' : ''}{metric.pct.toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1 font-mono">
                    Atualizado em tempo real · Fonte: {activeQuote.source || 'Morningstar & AwesomeAPI'}
                  </p>
                </div>

                {/* Timeframe Selector & Custom Period Inputs */}
                <div className="space-y-3 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {[
                      { id: 'daily', label: '1 D' },
                      { id: 'monthly', label: '1 M' },
                      { id: 'semiannual', label: '6 M' },
                      { id: 'annual', label: '1 A' },
                      { id: 'allTime', label: 'Máx' },
                      { id: 'custom', label: 'Personalizado' },
                    ].map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedQuotePeriod(p.id as any)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                          selectedQuotePeriod === p.id
                            ? 'bg-white/15 text-white border border-white/20 shadow-inner'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {selectedQuotePeriod === 'custom' && (
                    <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 bg-[#121214] p-3.5 rounded-xl border border-white/10">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                        <span className="text-xs text-gray-400 font-bold whitespace-nowrap">Título / Período:</span>
                        <input
                          type="text"
                          value={chartCustomPeriodLabel}
                          onChange={(e) => setChartCustomPeriodLabel(e.target.value)}
                          placeholder="Ex: Q1 2026, Rally"
                          className="bg-[#18181B] text-white text-xs px-3 py-1.5 rounded-lg border border-white/10 focus:border-[#D4AF37] outline-none w-full sm:w-40"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 font-bold whitespace-nowrap">De:</span>
                        <input
                          type="date"
                          value={chartCustomStartDate}
                          onChange={(e) => setChartCustomStartDate(e.target.value)}
                          className="bg-[#18181B] text-white text-xs px-2.5 py-1.5 rounded-lg border border-white/10 focus:border-[#D4AF37] outline-none w-full sm:w-auto"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 font-bold whitespace-nowrap">Até:</span>
                        <input
                          type="date"
                          value={chartCustomEndDate}
                          onChange={(e) => setChartCustomEndDate(e.target.value)}
                          className="bg-[#18181B] text-white text-xs px-2.5 py-1.5 rounded-lg border border-white/10 focus:border-[#D4AF37] outline-none w-full sm:w-auto"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Main Area Chart Container */}
                <div className="h-64 sm:h-72 w-full bg-[#121214] rounded-xl p-2 border border-white/5 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="mainQuoteGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={isPositive ? '#00E676' : '#FF5252'} stopOpacity={0.45}/>
                          <stop offset="95%" stopColor={isPositive ? '#00E676' : '#FF5252'} stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                      <XAxis dataKey="time" stroke="#71717A" fontSize={11} tickLine={false} />
                      <YAxis stroke="#71717A" fontSize={11} tickLine={false} domain={['auto', 'auto']} tickFormatter={(v) => `R$ ${formatNumberToPtBr(v)}`} />
                      <Tooltip
                        content={({ active, payload }: any) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const periodLabel = selectedQuotePeriod === 'daily'
                              ? '1 Dia (Intraday)'
                              : selectedQuotePeriod === 'monthly'
                              ? '1 Mês (30 dias)'
                              : selectedQuotePeriod === 'semiannual'
                              ? '6 Meses'
                              : selectedQuotePeriod === 'annual'
                              ? '1 Ano'
                              : selectedQuotePeriod === 'custom'
                              ? `${chartCustomPeriodLabel || 'Personalizado'} (${chartCustomStartDate} a ${chartCustomEndDate})`
                              : 'Todo o Período (Máx)';

                            const baseStartPrice = chartData[0]?.price || startPrice;
                            const pointPct = baseStartPrice > 0 ? ((data.price - baseStartPrice) / baseStartPrice) * 100 : metric.pct;
                            const pointIsPositive = pointPct >= 0;

                            return (
                              <div className="bg-[#18181B] border-2 border-[#D4AF37] p-3 rounded-xl shadow-2xl text-xs space-y-1.5 z-50">
                                <p className="font-bold text-[#D4AF37]">{activeQuote.name} ({activeQuote.symbol})</p>
                                <p className="text-gray-300">Data / Hora: <span className="text-white font-mono font-bold">{data.time}</span></p>
                                <p className="text-gray-300">Valor: <span className="text-white font-mono font-bold">R$ {formatNumberToPtBr(data.price)}</span></p>
                                <p className="text-gray-300">Variação do Período: <span className={pointIsPositive ? 'text-[#00E676] font-bold' : 'text-[#FF5252] font-bold'}>{pointIsPositive ? '+' : ''}{pointPct.toFixed(2)}%</span></p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke={isPositive ? '#00E676' : '#FF5252'}
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#mainQuoteGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Live Market Tickers Grid */}
        <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 relative z-10">
          {quotes.map((q) => {
            const metric = getQuoteMetric(q, selectedQuotePeriod);
            const isExpanded = expandedQuoteId === q.id;
            const isPositive = metric.pct >= 0;

            return (
              <div
                key={q.id}
                className={`p-3 bg-[#18181B] border rounded-2xl space-y-2 transition-all duration-200 ${
                  isExpanded
                    ? 'border-[#D4AF37] bg-[#1F1F23] shadow-xl sm:col-span-2 lg:col-span-5'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[11px] font-black uppercase text-gray-200 font-serif tracking-wider truncate">
                    {q.name}
                  </p>
                  <button
                    onClick={() => setExpandedQuoteId(isExpanded ? null : q.id)}
                    className="p-1 text-gray-400 hover:text-[#D4AF37] transition rounded cursor-pointer"
                    title={
                      isExpanded
                        ? 'Recolher detalhes'
                        : 'Ver variação Diária, Mensal, Semestral, Anual e Todo o Período'
                    }
                  >
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Price and Percentage Badge */}
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold text-gray-400">
                    Valor {q.category === 'index' ? 'pts' : 'R$'}
                  </span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                      isPositive ? 'bg-[#00C853]/20 text-[#00E676]' : 'bg-[#FF5252]/20 text-[#FF5252]'
                    }`}
                  >
                    {isPositive ? '+' : ''}
                    {metric.pct.toFixed(2)}%
                  </span>
                </div>

                {/* Current Value & Period Variation Value */}
                <div className="flex items-baseline justify-between gap-1 pt-0.5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-[10px] font-bold text-gray-500">Atual:</span>
                    <span className="text-xs sm:text-sm font-black text-white font-serif">
                      {q.price.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold ${
                      isPositive ? 'text-[#00E676]' : 'text-[#FF5252]'
                    }`}
                  >
                    {isPositive ? '+' : ''}
                    {q.category === 'index'
                      ? `${metric.val.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} pts`
                      : `R$ ${Math.abs(metric.val).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`}
                  </span>
                </div>

                {/* Google Finance / Apple Stocks Style Mini Area Chart */}
                {(() => {
                  const pointsCount = 12;
                  const currentPrice = q.price;
                  const pct = metric.pct;
                  const startPrice = currentPrice / (1 + pct / 100);
                  const data = [];
                  const now = new Date();
                  for (let i = 0; i < pointsCount; i++) {
                    const progress = i / (pointsCount - 1);
                    const wave = (Math.sin(progress * Math.PI * 3 + q.id.length) * 0.7 + Math.cos(progress * Math.PI * 5) * 0.3);
                    const amplitude = currentPrice * 0.01;
                    const interpolated = startPrice + (currentPrice - startPrice) * progress + wave * amplitude;
                    
                    const pointDate = new Date(now.getTime() - (pointsCount - 1 - i) * 30 * 24 * 3600 * 1000);
                    const timeLabel = pointDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

                    data.push({ time: timeLabel, price: Number(interpolated.toFixed(2)) });
                  }
                  if (data.length > 0) {
                    data[0].price = Number(startPrice.toFixed(2));
                    data[data.length - 1].price = currentPrice;
                  }

                  return (
                    <div className="h-20 w-full my-1.5 bg-[#121214]/70 rounded-xl p-1 border border-white/5 relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`gradient-${q.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={isPositive ? '#00E676' : '#FF5252'} stopOpacity={0.45}/>
                              <stop offset="95%" stopColor={isPositive ? '#00E676' : '#FF5252'} stopOpacity={0.0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="2 2" stroke="#27272A" vertical={false} />
                          <YAxis domain={['auto', 'auto']} hide />
                          <Tooltip
                            content={({ active, payload }: any) => {
                              if (active && payload && payload.length) {
                                const ptData = payload[0].payload;
                                const baseStartPrice = data[0]?.price || startPrice;
                                const pointPct = baseStartPrice > 0 ? ((ptData.price - baseStartPrice) / baseStartPrice) * 100 : metric.pct;
                                const pointIsPositive = pointPct >= 0;

                                return (
                                  <div className="bg-[#18181B] border-2 border-[#D4AF37] p-2.5 rounded-xl shadow-2xl text-[11px] space-y-1 z-50">
                                    <p className="font-bold text-[#D4AF37]">{q.name} ({q.symbol})</p>
                                    <p className="text-gray-300">Data / Hora: <span className="text-white font-mono font-bold">{ptData.time}</span></p>
                                    <p className="text-gray-300">Valor: <span className="text-white font-mono font-bold">{q.category === 'index' ? `${ptData.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pts` : `R$ ${ptData.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span></p>
                                    <p className="text-gray-300">Variação do Período: <span className={pointIsPositive ? 'text-[#00E676] font-bold' : 'text-[#FF5252] font-bold'}>{pointIsPositive ? '+' : ''}{pointPct.toFixed(2)}%</span></p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Area type="monotone" dataKey="price" stroke={isPositive ? '#00E676' : '#FF5252'} strokeWidth={1.75} fillOpacity={1} fill={`url(#gradient-${q.id})`} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}

                {/* Footer with Source & Toggle */}
                <div className="pt-1.5 flex items-center justify-between text-[9px] text-gray-400 border-t border-white/5">
                  <span className="truncate">Via: {q.source || 'AwesomeAPI & CoinGecko'}</span>
                  <button
                    onClick={() => setExpandedQuoteId(isExpanded ? null : q.id)}
                    className="text-[#D4AF37] font-bold hover:underline cursor-pointer"
                  >
                    {isExpanded ? 'Ocultar' : 'Todos Períodos'}
                  </button>
                </div>

                {/* Expanded Multi-Period Breakdown */}
                {isExpanded && (
                  <div className="pt-3 mt-2 border-t border-white/10 space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase text-[#D4AF37] tracking-wider">
                        Histórico e Variações Completas por Período
                      </p>
                      <span className="text-[9px] text-gray-400">
                        Fonte: {q.source || 'AwesomeAPI & CoinGecko'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {[
                        { id: 'daily', label: 'Diário (24h)' },
                        { id: 'monthly', label: 'Mensal (30d)' },
                        { id: 'semiannual', label: 'Semestral (6m)' },
                        { id: 'annual', label: 'Anual (12m)' },
                        { id: 'allTime', label: 'Todo o Período' },
                      ].map((p) => {
                        const pMetric = getQuoteMetric(q, p.id as any);
                        const pPos = pMetric.pct >= 0;
                        return (
                          <div
                            key={p.id}
                            className="p-2.5 bg-[#121212] border border-white/10 rounded-xl space-y-1"
                          >
                            <p className="text-[9px] font-bold text-gray-400">{p.label}</p>
                            <p
                              className={`text-xs font-black ${
                                pPos ? 'text-[#00E676]' : 'text-[#FF5252]'
                              }`}
                            >
                              {pPos ? '+' : ''}
                              {pMetric.pct.toFixed(2)}%
                            </p>
                            <p className="text-[9px] font-bold text-gray-300">
                              {q.category === 'index'
                                ? `${pMetric.val >= 0 ? '+' : ''}${pMetric.val.toLocaleString('pt-BR', {
                                    maximumFractionDigits: 2,
                                  })} pts`
                                : `${pMetric.val >= 0 ? '+R$' : '-R$'} ${Math.abs(pMetric.val).toLocaleString(
                                    'pt-BR',
                                    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                                  )}`}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Main Sub-Navigation Tabs */}
      <div className="bg-[#121212] border-2 border-[#D4AF37]/50 rounded-2xl p-2.5 sm:p-3 mb-6 shadow-xl">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'patrimonio', label: 'Patrimônio', icon: WalletCards },
            { id: 'proventos', label: 'Proventos', icon: DollarSign },
            { id: 'rentabilidade', label: 'Rentabilidade', icon: TrendingUp },
            { id: 'composicao', label: 'Composição', icon: PieChart },
            { id: 'metas', label: 'Metas', icon: Award },
            { id: 'transacoes', label: 'Transações', icon: Clock },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleSubTabSwitch(tab.id as PortfolioSubTab)}
                className={`py-2 px-3.5 sm:px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer border ${
                  isActive
                    ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37] font-black shadow-md'
                    : 'bg-[#18181B] text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#121212]' : 'text-[#D4AF37]'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUBTAB 0: DASHBOARD (Matching Images 1 & 2) */}
      {/* ========================================================================= */}
      {activeSubTab === 'dashboard' && (() => {
        const perf = getPerformanceData();
        return (
          <div className="space-y-6 animate-in fade-in">
            {/* PAINEL DE PERCENTUAL DESEJADO VS. ATUAL (REQ 7 - Primeiro Bloco Principal do Dashboard) */}
            <div className="bg-[#18181B] border border-white/10 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#00E676]/10 border border-[#00E676]/30 rounded-xl text-[#00E676]">
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white font-serif uppercase tracking-wider">
                      Meta de Alocação: Percentual Desejado x Atual
                    </h3>
                    <p className="text-[11px] text-gray-400">
                      Acompanhamento em tempo real. Em <span className="text-[#00E676] font-bold">verde</span> = abaixo do desejado (oportunidade de aporte); Em <span className="text-[#FF5252] font-bold">vermelho</span> = meta atingida/excedida.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleOpenEditTargets}
                  className="py-2 px-3.5 bg-[#D4AF37] hover:bg-[#c4a02e] text-[#121212] font-black text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-md self-start sm:self-auto shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Editar Percentuais</span>
                </button>
              </div>

              <div className="space-y-3">
                {calculatedTargetAllocations.map((item) => {
                  const isOver = item.currentPct > item.targetPct;
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border transition space-y-2.5 relative ${
                        isOver
                          ? 'bg-[#FF5252]/10 border-[#FF5252]/40 text-[#FF5252]'
                          : 'bg-[#00E676]/10 border-[#00E676]/40 text-[#00E676]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black uppercase font-serif text-white tracking-wide">
                          {item.label}
                        </span>
                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase shrink-0 ${
                            isOver ? 'bg-[#FF5252] text-white' : 'bg-[#00E676] text-[#121212]'
                          }`}
                        >
                          {isOver ? 'Excedido' : 'Abaixo'}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between pt-1">
                        <div>
                          <span className="text-[10px] text-gray-400 block font-bold uppercase">Atual</span>
                          <span className="text-lg font-black font-serif text-white">
                            {item.currentPct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 block font-bold uppercase">Desejado</span>
                          <span className="text-base font-black font-serif text-gray-300">
                            {item.targetPct}%
                          </span>
                        </div>
                      </div>

                      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isOver ? 'bg-[#FF5252]' : 'bg-[#00E676]'
                          }`}
                          style={{
                            width: `${Math.min(100, item.targetPct > 0 ? (item.currentPct / item.targetPct) * 100 : 0)}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Card 1: Visão geral do desempenho (Imagem 1 & 2 - Todos os cards sincronizados com o Filtro) */}
            <div className="bg-[#18181B] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white font-serif">Visão geral do desempenho</h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Rentabilidade atual */}
                <div className="p-5 bg-[#121212] border border-white/10 rounded-2xl space-y-2 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-400">Rentabilidade atual</span>
                    <div className={`w-7 h-7 rounded-full ${perf.rentPositive ? 'bg-[#00C853]/20 text-[#00E676]' : 'bg-red-500/20 text-red-400'} flex items-center justify-center`}>
                      {perf.rentPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    </div>
                  </div>
                  <p className="text-3xl font-black text-white font-serif">{perf.rentPct.toFixed(2)}%</p>
                  <div className={`flex items-center gap-1 text-[11px] font-bold ${perf.rentPositive ? 'text-[#00E676]' : 'text-red-400'}`}>
                    {perf.rentPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    <span>{perf.rentPositive ? '+' : ''}{perf.rentPct.toFixed(2)}% {perf.periodText}</span>
                  </div>
                </div>

                {/* Patrimônio atual */}
                <div className="p-5 bg-[#121212] border border-white/10 rounded-2xl space-y-2 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-400">Patrimônio atual</span>
                    <div className={`w-7 h-7 rounded-full ${perf.patPositive ? 'bg-[#00C853]/20 text-[#00E676]' : 'bg-red-500/20 text-red-400'} flex items-center justify-center`}>
                      {perf.patPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    </div>
                  </div>
                  <p className="text-3xl font-black text-white font-serif">{formatValue(totalEquity)}</p>
                  <div className={`flex items-center gap-1 text-[11px] font-bold ${perf.patPositive ? 'text-[#00E676]' : 'text-red-400'}`}>
                    {perf.patPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    <span>{perf.patPositive ? '+' : ''}{perf.patPct.toFixed(2)}% {perf.periodText}</span>
                  </div>
                </div>

                {/* Proventos */}
                <div className="p-5 bg-[#121212] border border-white/10 rounded-2xl space-y-2 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-400">Proventos</span>
                    <div className={`w-7 h-7 rounded-full ${perf.provPositive ? 'bg-[#00C853]/20 text-[#00E676]' : 'bg-red-500/20 text-red-400'} flex items-center justify-center`}>
                      {perf.provPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    </div>
                  </div>
                  <p className="text-3xl font-black text-white font-serif">{formatValue(receivedDividends)}</p>
                  <div className={`flex items-center gap-1 text-[11px] font-bold ${perf.provPositive ? 'text-[#00E676]' : 'text-red-400'}`}>
                    {perf.provPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    <span>{perf.provPositive ? '+' : ''}{perf.provPct.toFixed(2)}% {perf.periodText}</span>
                  </div>
                </div>
              </div>
            </div>



          {/* Card 2: Composição (Confira a alocação dos seus ativos.) (Image 2) */}
          <div className="bg-[#18181B] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-black text-white font-serif">Composição</h3>
                <p className="text-xs text-gray-400">Confira a alocação dos seus ativos e rentabilidades.</p>
              </div>
              <button
                onClick={() => setActiveSubTab('composicao')}
                className="p-2 text-gray-400 hover:text-[#D4AF37] transition cursor-pointer"
                title="Ver detalhamento da composição"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {compositionCardList.map((item) => (
                <div key={item.name} className="p-3.5 bg-[#121212] border border-white/5 rounded-xl space-y-2">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-white flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-sm font-black">{item.name}</span>
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-white text-sm mr-1">{formatValue(item.value)}</span>

                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                          item.totalRentPct >= 0
                            ? 'bg-[#00C853]/15 text-[#00E676] border-[#00C853]/30'
                            : 'bg-[#FF5252]/15 text-[#FF5252] border-[#FF5252]/30'
                        }`}
                      >
                        Rentab. Total: {item.totalRentPct >= 0 ? '+' : ''}{item.totalRentPct.toFixed(2)}%
                      </span>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          item.todayPct >= 0
                            ? 'bg-[#00C853]/15 text-[#00E676] border-[#00C853]/30'
                            : 'bg-[#FF5252]/15 text-[#FF5252] border-[#FF5252]/30'
                        }`}
                      >
                        Hoje: {item.todayVal >= 0 ? '+' : ''}R$ {item.todayVal.toFixed(2)} ({item.todayPct >= 0 ? '+' : ''}{item.todayPct.toFixed(2)}%)
                      </span>

                      <span className="text-[10px] font-black text-gray-300 bg-white/10 px-2 py-0.5 rounded border border-white/10">
                        {item.pct.toFixed(1)}% alocação
                      </span>
                    </div>
                  </div>

                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, item.pct))}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: Metas */}
          <div className="bg-[#18181B] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-black text-white font-serif">Metas</h3>
                <p className="text-xs text-gray-400">Progresso das suas metas</p>
              </div>
              <button
                onClick={() => setActiveSubTab('metas')}
                className="p-2 text-gray-400 hover:text-[#D4AF37] transition cursor-pointer"
                title="Ver todas as metas"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {goals.map((g) => {
                const pct = Math.min(100, Math.round((totalEquity / g.targetAmount) * 100));
                return (
                  <div key={g.id} className="p-4 bg-[#121212] border border-white/10 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-black text-white">{g.title}</span>
                      </div>
                      <span className="text-xs font-bold text-gray-300">
                        Valor atual {formatValue(totalEquity)}
                      </span>
                    </div>

                    <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden relative">
                      <div className="h-full bg-gradient-to-r from-[#FF5252] via-[#FACC15] to-[#00E676] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>

                    <div className="flex items-center justify-between text-xs font-bold text-gray-400">
                      <span>Objetivo: {formatValue(g.targetAmount)}</span>
                      <span className="text-[#00E676] font-black">{pct}% concluído</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
      })()}

      {/* ========================================================================= */}
      {/* SUBTAB 1: PATRIMÔNIO (Desempenho de Patrimônio & Ativos por Categoria) */}
      {/* ========================================================================= */}
      {activeSubTab === 'patrimonio' && (
        <div className="space-y-6 animate-in fade-in">
          {assets && assets.length > 0 ? (
            <>
          {/* Unificado: Bloco único para Desempenho de patrimônio, Crescimento e Gráfico */}
          <div className="bg-[#18181B] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
            {/* Header Bar with Title & Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <h2 className="text-xl font-black text-white font-serif">Desempenho de patrimônio</h2>
                <p className="text-xs text-gray-400">Evolução do seu saldo acumulado ao longo do tempo</p>
              </div>

              {/* Top Right Custom Dropdowns / Filters with Search & Multi-Selection */}
              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Tipo de Ativo - Multiple Selection with Search */}
                <div className="relative" ref={patSegmentContainerRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPatSegmentDropdownOpen(!isPatSegmentDropdownOpen);
                      setIsPatMetricDropdownOpen(false);
                      setIsPatPeriodDropdownOpen(false);
                    }}
                    className="bg-[#121212] border border-white/20 hover:border-[#D4AF37] text-white text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer"
                  >
                    <span>
                      {patSegmentFilter.includes('completo') || patSegmentFilter.length === 0
                        ? 'Segmentos'
                        : `${patSegmentFilter.length} selecionado(s)`}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-[#D4AF37] transition-transform ${isPatSegmentDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isPatSegmentDropdownOpen && (
                    <div className="absolute left-0 sm:right-0 mt-2 w-64 bg-[#18181B] border-2 border-[#D4AF37] rounded-xl shadow-2xl p-2.5 z-50 space-y-2 animate-in fade-in duration-150">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Pesquisar segmento..."
                          value={patSegmentSearch}
                          onChange={(e) => setPatSegmentSearch(e.target.value)}
                          className="w-full bg-[#121212] border border-white/20 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                        />
                      </div>

                      <div className="max-h-56 overflow-y-auto space-y-1 no-scrollbar">
                        <div
                          onClick={() => {
                            setPatSegmentFilter(['completo']);
                          }}
                          className={`flex items-center justify-between p-2 rounded-lg text-xs font-bold cursor-pointer transition ${
                            patSegmentFilter.includes('completo') ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'hover:bg-white/5 text-gray-300'
                          }`}
                        >
                          <span>Completo (Geral)</span>
                          {patSegmentFilter.includes('completo') && <Check className="w-3.5 h-3.5 text-[#D4AF37]" />}
                        </div>

                        {availableSegments
                          .filter((seg) => seg.toLowerCase().includes(patSegmentSearch.toLowerCase()))
                          .map((seg) => {
                            const isSelected = patSegmentFilter.includes(seg);
                            return (
                              <div
                                key={seg}
                                onClick={() => {
                                  let updated: string[];
                                  if (patSegmentFilter.includes('completo')) {
                                    updated = [seg];
                                  } else if (isSelected) {
                                    updated = patSegmentFilter.filter((c) => c !== seg);
                                    if (updated.length === 0) updated = ['completo'];
                                  } else {
                                    updated = [...patSegmentFilter, seg];
                                  }
                                  setPatSegmentFilter(updated);
                                }}
                                className={`flex items-center justify-between p-2 rounded-lg text-xs font-bold cursor-pointer transition ${
                                  isSelected ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'hover:bg-white/5 text-gray-300'
                                }`}
                              >
                                <span>{seg}</span>
                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-[#D4AF37] border-[#D4AF37] text-[#121212]' : 'border-white/30'}`}>
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      <div className="pt-2 border-t border-white/10 flex justify-between items-center text-[10px]">
                        <button
                          onClick={() => setPatSegmentFilter(['completo'])}
                          className="text-gray-400 hover:text-white underline cursor-pointer"
                        >
                          Limpar
                        </button>
                        <button
                          onClick={() => setIsPatSegmentDropdownOpen(false)}
                          className="px-3 py-1 bg-[#D4AF37] text-[#121212] font-black rounded-md hover:bg-[#c4a02e] cursor-pointer"
                        >
                          Aplicar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Patrimônio ou Investimento - Custom Standard Dropdown */}
                <div className="relative" ref={patMetricContainerRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPatMetricDropdownOpen(!isPatMetricDropdownOpen);
                      setIsPatSegmentDropdownOpen(false);
                      setIsPatPeriodDropdownOpen(false);
                    }}
                    className="bg-[#121212] border border-white/20 hover:border-[#D4AF37] text-white text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer"
                  >
                    <span>{patMetricType === 'patrimonio' ? 'Patrimônio' : 'Investimento'}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-[#D4AF37] transition-transform ${isPatMetricDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isPatMetricDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-44 bg-[#18181B] border-2 border-[#D4AF37] rounded-xl shadow-2xl p-1.5 z-50 space-y-1 animate-in fade-in duration-150">
                      {[
                        { id: 'patrimonio', label: 'Patrimônio' },
                        { id: 'investimento', label: 'Investimento' },
                      ].map((m) => {
                        const isSelected = patMetricType === m.id;
                        return (
                          <div
                            key={m.id}
                            onClick={() => {
                              setPatMetricType(m.id as any);
                              setIsPatMetricDropdownOpen(false);
                            }}
                            className={`flex items-center justify-between p-2 rounded-lg text-xs font-bold cursor-pointer transition ${
                              isSelected ? 'bg-[#D4AF37] text-[#121212] font-black' : 'hover:bg-white/10 text-gray-200'
                            }`}
                          >
                            <span>{m.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Período - Custom Searchable Dropdown */}
                <div className="relative" ref={patPeriodContainerRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPatPeriodDropdownOpen(!isPatPeriodDropdownOpen);
                      setIsPatSegmentDropdownOpen(false);
                      setIsPatMetricDropdownOpen(false);
                    }}
                    className="bg-[#121212] border border-white/20 hover:border-[#D4AF37] text-white text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer"
                  >
                    <span>
                      {patPeriodFilter === '6M' && '6 Meses'}
                      {patPeriodFilter === '1Y' && '1 Ano (12M)'}
                      {patPeriodFilter === '2Y' && '2 Anos (24M)'}
                      {patPeriodFilter === 'ALL' && 'Todo o Período'}
                      {patPeriodFilter === 'CUSTOM' && 'Personalizado'}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-[#D4AF37] transition-transform ${isPatPeriodDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isPatPeriodDropdownOpen && (
                    <div className="absolute left-0 sm:right-0 mt-2 w-56 bg-[#18181B] border-2 border-[#D4AF37] rounded-xl shadow-2xl p-2.5 z-50 space-y-2 animate-in fade-in duration-150">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Pesquisar período..."
                          value={patPeriodSearch}
                          onChange={(e) => setPatPeriodSearch(e.target.value)}
                          className="w-full bg-[#121212] border border-white/20 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                        />
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-1 no-scrollbar">
                        {[
                          { id: '6M', label: '6 Meses' },
                          { id: '1Y', label: '1 Ano (12M)' },
                          { id: '2Y', label: '2 Anos (24M)' },
                          { id: 'ALL', label: 'Todo o Período' },
                          { id: 'CUSTOM', label: 'Período Personalizado' },
                        ]
                          .filter((p) => p.label.toLowerCase().includes(patPeriodSearch.toLowerCase()))
                          .map((p) => {
                            const isSelected = patPeriodFilter === p.id;
                            return (
                              <div
                                key={p.id}
                                onClick={() => {
                                  setPatPeriodFilter(p.id as any);
                                  setIsPatPeriodDropdownOpen(false);
                                }}
                                className={`flex items-center justify-between p-2 rounded-lg text-xs font-bold cursor-pointer transition ${
                                  isSelected ? 'bg-[#D4AF37] text-[#121212] font-black' : 'hover:bg-white/10 text-gray-200'
                                }`}
                              >
                                <span>{p.label}</span>
                                {isSelected && <Check className="w-3.5 h-3.5" />}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Custom Date Inputs Range Selector (Optimized for mobile screen layout) */}
            {patPeriodFilter === 'CUSTOM' && (
              <div className="bg-[#121212] border border-[#D4AF37]/30 rounded-xl p-3 flex flex-col gap-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                  {/* Data Início */}
                  <div className="flex items-center justify-between gap-2 bg-[#18181B] border border-white/20 rounded-xl p-2.5">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Calendar className="w-4 h-4 text-[#D4AF37]" />
                      <span className="font-bold text-gray-300">Início:</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="DD/MM/AAAA"
                        value={patStartText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPatStartText(val);
                          const parsedISO = parseDateToISO(val);
                          if (parsedISO) {
                            setPatCustomStartDate(parsedISO);
                          }
                        }}
                        className="w-24 bg-[#121212] border border-white/20 rounded-lg px-2 py-1 text-[#D4AF37] font-bold text-center focus:outline-none focus:border-[#D4AF37]"
                      />
                      <div className="relative w-8 h-8 bg-[#121212] border border-white/20 rounded-lg flex items-center justify-center cursor-pointer hover:border-[#D4AF37] transition">
                        <ChevronDown className="w-4 h-4 text-[#D4AF37] pointer-events-none" />
                        <input
                          type="date"
                          value={patCustomStartDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPatCustomStartDate(val);
                            setPatStartText(formatDateBRInput(val));
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          title="Selecionar data no calendário"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Data Fim */}
                  <div className="flex items-center justify-between gap-2 bg-[#18181B] border border-white/20 rounded-xl p-2.5">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Calendar className="w-4 h-4 text-[#D4AF37]" />
                      <span className="font-bold text-gray-300">Fim:</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="DD/MM/AAAA"
                        value={patEndText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPatEndText(val);
                          const parsedISO = parseDateToISO(val);
                          if (parsedISO) {
                            setPatCustomEndDate(parsedISO);
                          }
                        }}
                        className="w-24 bg-[#121212] border border-white/20 rounded-lg px-2 py-1 text-[#D4AF37] font-bold text-center focus:outline-none focus:border-[#D4AF37]"
                      />
                      <div className="relative w-8 h-8 bg-[#121212] border border-white/20 rounded-lg flex items-center justify-center cursor-pointer hover:border-[#D4AF37] transition">
                        <ChevronDown className="w-4 h-4 text-[#D4AF37] pointer-events-none" />
                        <input
                          type="date"
                          value={patCustomEndDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPatCustomEndDate(val);
                            setPatEndText(formatDateBRInput(val));
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          title="Selecionar data no calendário"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-[#D4AF37] font-medium text-center">
                  Ativado de {formatDateBRInput(patCustomStartDate) || 'Início'} até {formatDateBRInput(patCustomEndDate) || 'Hoje'}
                </div>
              </div>
            )}

            {/* Metrics Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Patrimônio Metric */}
              <div className="p-4 bg-[#121212] border border-white/10 rounded-xl space-y-1">
                <span className="text-xs font-bold text-gray-400">
                  {patMetricType === 'patrimonio' ? 'Patrimônio Total' : 'Valor Investido'} (
                  {patSegmentFilter.includes('completo') || patSegmentFilter.length === 0
                    ? 'Geral'
                    : patSegmentFilter.join(', ')})
                </span>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl sm:text-3xl font-black text-white font-serif">{formatValue(currentFilteredValue)}</p>
                  <span className="text-xs font-bold text-gray-400">(Total filtrado)</span>
                </div>
              </div>

              {/* Crescimento Metric */}
              <div className="p-4 bg-[#121212] border border-white/10 rounded-xl space-y-1">
                <span className="text-xs font-bold text-gray-400">Crescimento Acumulado</span>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {assets.length > 0 ? (
                    <>
                      <button
                        onClick={() => setPatPeriodFilter('6M')}
                        className={`flex items-center gap-1 text-xs font-black px-2.5 py-1.5 rounded-lg transition ${
                          patPeriodFilter === '6M' ? 'bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/50' : 'text-[#00E676] bg-white/5'
                        }`}
                      >
                        <span>{returnPct >= 0 ? '+' : ''}{(returnPct * 0.7).toFixed(2)}%</span>
                        <span className="text-[10px] text-gray-400 font-normal">Últ. 6m</span>
                      </button>
                      <button
                        onClick={() => setPatPeriodFilter('1Y')}
                        className={`flex items-center gap-1 text-xs font-black px-2.5 py-1.5 rounded-lg transition ${
                          patPeriodFilter === '1Y' ? 'bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/50' : 'text-[#00E676] bg-white/5'
                        }`}
                      >
                        <span>{returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}%</span>
                        <span className="text-[10px] text-gray-400 font-normal">Últ. 12m</span>
                      </button>
                      <button
                        onClick={() => setPatPeriodFilter('2Y')}
                        className={`flex items-center gap-1 text-xs font-black px-2.5 py-1.5 rounded-lg transition ${
                          patPeriodFilter === '2Y' ? 'bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/50' : 'text-[#00E676] bg-white/5'
                        }`}
                      >
                        <span>{returnPct >= 0 ? '+' : ''}{(returnPct * 1.2).toFixed(2)}%</span>
                        <span className="text-[10px] text-gray-400 font-normal">Últ. 24m</span>
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-gray-400 py-1">
                      <span className="px-2.5 py-1 bg-white/5 rounded-lg">0,00% (Últ. 6m)</span>
                      <span className="px-2.5 py-1 bg-white/5 rounded-lg">0,00% (Últ. 12m)</span>
                      <span className="px-2.5 py-1 bg-white/5 rounded-lg">0,00% (Últ. 24m)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Desempenho de patrimônio Chart */}
            <div className="space-y-3 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
                  <span className="text-xs font-black text-[#3B82F6] uppercase tracking-wider">
                    | {patMetricType === 'patrimonio' ? 'Patrimônio' : 'Investimento'}
                    {!patSegmentFilter.includes('completo') && patSegmentFilter.length > 0 && ` - ${patSegmentFilter.join(', ')}`}
                  </span>
                </div>
                <span className="text-[11px] text-gray-400 font-bold">Valores consolidados em R$</span>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activePatrimonioChartData}>
                    <defs>
                      <linearGradient id="patrimonioGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                    <XAxis dataKey="month" stroke="#A1A1AA" fontSize={11} tickLine={false} />
                    <YAxis stroke="#A1A1AA" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tickLine={false} axisLine={false} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const val = payload[0].value;
                          const metricName = patMetricType === 'patrimonio' ? 'Patrimônio' : 'Investimento';
                          return (
                            <div className="bg-[#121212] border border-[#3B82F6] p-3 rounded-xl shadow-2xl space-y-1 font-sans">
                              <p className="text-[11px] font-bold text-gray-400">
                                Período: <span className="text-white font-black">{label}</span>
                              </p>
                              <p className="text-xs font-black text-[#3B82F6]">
                                {metricName}: <span className="text-white">R$ {Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="patrimonio"
                      stroke="#3B82F6"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#patrimonioGrad)"
                      dot={{ r: 4, fill: '#FFFFFF', stroke: '#3B82F6', strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: '#3B82F6', stroke: '#FFFFFF', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Bloco 1: Total por categoria */}
          <div className="bg-[#18181B] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row items-center justify-between border-b border-white/10 pb-4 gap-3 text-center sm:text-left">
              <div>
                <h3 className="text-sm font-black uppercase text-white tracking-wider">Total por categoria</h3>
                <p className="text-xs text-gray-400">Distribuição financeira entre as categorias cadastradas</p>
              </div>
              <div className="bg-[#121212] border border-[#D4AF37]/40 px-5 py-2.5 rounded-xl shadow-lg flex flex-col items-center sm:items-end">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">Total Geral</span>
                <span className="text-base sm:text-lg font-black text-white font-serif">
                  {formatValue((Object.keys(CATEGORY_LABELS) as AssetCategory[]).reduce((acc, c) => acc + getCategoryTotal(c), 0))}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(Object.keys(CATEGORY_LABELS) as AssetCategory[])
                .filter((cat) => assets.some((a) => a.category === cat && a.quantity > 0))
                .map((cat) => {
                  const val = getCategoryTotal(cat);
                  const pct = totalEquity > 0 ? (val / totalEquity) * 100 : 0;
                  const color = CATEGORY_COLORS[cat] || '#3B82F6';
                  const catAssets = assets.filter((a) => a.category === cat && a.quantity > 0);

                  return (
                    <div key={cat} className="p-4 bg-[#121212] border border-white/10 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="truncate">{CATEGORY_LABELS[cat]}</span>
                        </span>
                        <span className="text-xs font-black text-gray-300 ml-1">{pct.toFixed(1)}%</span>
                      </div>
                      <p className="text-lg font-black text-white font-serif">{formatValue(val)}</p>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }} />
                      </div>
                      <p className="text-[10px] text-gray-400 font-medium">
                        {catAssets.length} ativo(s)
                      </p>
                    </div>
                  );
                })}
              {assets.filter((a) => a.quantity > 0).length === 0 && (
                <div className="col-span-full text-center py-6 text-gray-400 text-xs italic bg-[#121212] rounded-xl border border-white/5">
                  Nenhum ativo cadastrado com saldo na carteira.
                </div>
              )}
            </div>
          </div>

          {/* Bloco 2: Posições na Carteira por Classe */}
          <div className="bg-[#18181B] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] shadow-sm shadow-[#D4AF37]/50" />
                <h3 className="text-sm sm:text-base font-black uppercase text-[#D4AF37] tracking-wider font-serif">
                  Posições na Carteira por Classe
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(Object.keys(CATEGORY_LABELS) as AssetCategory[])
                .filter((cat) => assets.some((a) => a.category === cat && a.quantity > 0))
                .map((cat) => {
                  const catAssets = assets.filter((a) => a.category === cat && a.quantity > 0);
                  const catTotal = getCategoryTotal(cat);
                  const catPct = totalEquity > 0 ? (catTotal / totalEquity) * 100 : 0;
                  const isExpanded = expandedCategories[cat] ?? true;

                  // Calculate category performance variation
                  const catPerformance = catAssets.length > 0
                    ? catAssets.reduce((acc, a) => acc + (a.priceChange24h || 0), 0) / catAssets.length
                    : 0;
                  const isCategoryPositive = catPerformance >= 0;

                  return (
                    <div key={cat} className="bg-[#121212] border border-white/10 rounded-2xl overflow-hidden shadow-lg">
                      <div
                        onClick={() => toggleCategory(cat)}
                        className="p-4 bg-[#18181B] border-b border-white/10 cursor-pointer hover:bg-white/5 transition space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            {/* Dot indicator: Green if positive, Red if negative */}
                            <div
                              className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                                catTotal > 0 ? (isCategoryPositive ? 'bg-[#00E676]' : 'bg-[#FF5252]') : 'bg-gray-600'
                              }`}
                            />
                            <h4 className="text-sm font-black text-white font-serif">{CATEGORY_LABELS[cat]}</h4>
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>

                        <div className="pl-6 flex items-baseline justify-between">
                          <div>
                            <p className="text-lg font-black text-white font-serif">{formatValue(catTotal)}</p>
                            <p className={`text-[10px] font-black ${catTotal > 0 ? (isCategoryPositive ? 'text-[#00E676]' : 'text-[#FF5252]') : 'text-gray-400'}`}>
                              {catPct.toFixed(1)}% da carteira
                            </p>
                          </div>
                          <p className="text-[10px] text-gray-400 font-medium">{catAssets.length} ativo(s) cadastrado(s)</p>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-3 space-y-2">
                          {catAssets.length > 0 ? (
                            catAssets.map((asset) => {
                              const usdRate = quotes.find((q) => q.symbol === 'USD/BRL')?.price || 5.06;
                              const currentVal =
                                asset.currency === 'USD' ? asset.currentPrice * usdRate * asset.quantity : asset.currentPrice * asset.quantity;
                              const assetPct = totalEquity > 0 ? (currentVal / totalEquity) * 100 : 0;
                              const change24h = asset.priceChange24h || 0;
                              const isPositive = change24h >= 0;
                              const avg = asset.averagePrice || 0;
                              const cur = asset.currentPrice || 0;
                              const totalRentPct = avg > 0 ? ((cur - avg) / avg) * 100 : (asset.returnPct || 0);
                              const isTotalRentPos = totalRentPct >= 0;

                              return (
                                <div
                                  key={asset.id}
                                  onClick={() => setSelectedAssetForDetail(asset)}
                                  className="p-3.5 bg-[#18181B] border border-white/5 rounded-xl space-y-2.5 hover:border-[#D4AF37]/60 hover:bg-white/5 transition cursor-pointer group"
                                  title="Clique para ver Detalhes e Transações"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-black text-white group-hover:text-[#D4AF37] transition">{asset.ticker}</span>
                                      <span className="text-[10px] px-1.5 py-0.5 bg-white/10 text-gray-300 rounded font-semibold">
                                        {asset.segment}
                                      </span>
                                    </div>

                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedAssetForDetail(asset);
                                      }}
                                      className="p-1.5 text-gray-400 hover:text-[#D4AF37] hover:bg-white/10 rounded-lg transition cursor-pointer"
                                      title="Ver Mais Informações"
                                    >
                                      <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                  </div>

                                  <div className="text-[10px] text-gray-400">
                                    {asset.quantity} un. x {asset.currency === 'USD' ? 'US$' : 'R$'} {(asset.currentPrice || 0).toFixed(2)}
                                  </div>

                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-white/5 gap-1.5">
                                    <p className="text-xs font-black text-white">{formatValue(currentVal)}</p>
                                    <div className="text-[10px] font-black flex items-center flex-wrap gap-2">
                                      <span className="text-gray-300">{assetPct.toFixed(1)}% da carteira</span>
                                      <span className={isTotalRentPos ? 'text-[#00E676]' : 'text-[#FF5252]'} title="Rentabilidade Total">
                                        Tot: {isTotalRentPos ? '+' : ''}{totalRentPct.toFixed(1)}%
                                      </span>
                                      <span className={isPositive ? 'text-[#00E676]' : 'text-[#FF5252]'} title="Rentabilidade Hoje">
                                        Hoje: {isPositive ? '+' : ''}{change24h.toFixed(1)}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-[11px] text-gray-500 text-center py-2 italic">Nenhum ativo nesta classe</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              {assets.filter((a) => a.quantity > 0).length === 0 && (
                <div className="col-span-full text-center py-6 text-gray-400 text-xs italic bg-[#121212] rounded-xl border border-white/5">
                  Nenhum ativo cadastrado com saldo na carteira.
                </div>
              )}
            </div>
          </div>
          </>
          ) : (
            <p className="text-center py-6 text-gray-400">Nenhum dado encontrado</p>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 2: PROVENTOS */}
      {/* ========================================================================= */}
      {activeSubTab === 'proventos' && (
        <div className="space-y-6">
          {assets && assets.length > 0 ? (
            <>
          {/* Proventos Global Period Filter Bar (Requirement: Em Proventos, Filtro de Proventos ajustar layout Imagem 1) */}
          <div className="bg-[#18181B] border border-white/10 p-5 rounded-2xl space-y-4 shadow-xl">
            <div>
              <h2 className="text-xl font-black text-white font-serif">Filtro de Proventos</h2>
              <p className="text-xs text-gray-400">Filtrar proventos e dividendos em toda a página</p>
            </div>

            <div className="bg-[#121212] p-2 rounded-2xl border border-white/10 flex flex-wrap items-center gap-2">
              {[
                { id: 'CURRENT_MONTH', label: 'Mês Atual' },
                { id: '6M', label: '6 Meses' },
                { id: '12M', label: '12 Meses' },
                { id: 'ALL', label: 'Todo o Período' },
                { id: 'CUSTOM', label: 'Personalizado' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProventosPeriodFilter(p.id as any)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    proventosPeriodFilter === p.id
                      ? 'bg-[#00C853] text-[#121212] font-black shadow-md'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {proventosPeriodFilter === 'CUSTOM' && (
              <div className="p-4 rounded-2xl border border-[#00C853] bg-[#121212]/80 space-y-4">
                {/* Data Inicial */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-200">
                    <Calendar className="w-4 h-4 text-[#00E676]" />
                    <span>Data Inicial (DD/MM/AAAA):</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="DD/MM/AAAA"
                      value={proventosStartText}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProventosStartText(val);
                        const iso = parseDateToISO(val);
                        if (iso) {
                          setProventosCustomStartDate(iso);
                          setProventosAppliedStartDate(iso);
                        }
                      }}
                      className="w-36 bg-[#18181B] border border-[#00C853]/60 rounded-xl px-3 py-2 text-xs text-[#00E676] font-bold focus:outline-none focus:border-[#00E676]"
                    />
                    <div className="relative w-8 h-8 bg-[#18181B] border border-[#00C853]/60 rounded-xl flex items-center justify-center cursor-pointer hover:border-[#00C853] transition">
                      <ChevronDown className="w-4 h-4 text-[#00E676] pointer-events-none" />
                      <input
                        type="date"
                        value={proventosCustomStartDate}
                        onChange={(e) => {
                          const val = e.target.value;
                          setProventosCustomStartDate(val);
                          setProventosAppliedStartDate(val);
                          setProventosStartText(formatDateBRInput(val));
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        title="Selecionar no calendário"
                      />
                    </div>
                  </div>
                </div>

                {/* Data Final */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs font-bold text-gray-200 pl-6 sm:pl-6">
                    <span>Data Final (DD/MM/AAAA):</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="DD/MM/AAAA"
                      value={proventosEndText}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProventosEndText(val);
                        const iso = parseDateToISO(val);
                        if (iso) {
                          setProventosCustomEndDate(iso);
                          setProventosAppliedEndDate(iso);
                        }
                      }}
                      className="w-36 bg-[#18181B] border border-[#00C853]/60 rounded-xl px-3 py-2 text-xs text-[#00E676] font-bold focus:outline-none focus:border-[#00E676]"
                    />
                    <div className="relative w-8 h-8 bg-[#18181B] border border-[#00C853]/60 rounded-xl flex items-center justify-center cursor-pointer hover:border-[#00C853] transition">
                      <ChevronDown className="w-4 h-4 text-[#00E676] pointer-events-none" />
                      <input
                        type="date"
                        value={proventosCustomEndDate}
                        onChange={(e) => {
                          const val = e.target.value;
                          setProventosCustomEndDate(val);
                          setProventosAppliedEndDate(val);
                          setProventosEndText(formatDateBRInput(val));
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        title="Selecionar no calendário"
                      />
                    </div>
                  </div>
                </div>

                {/* Aplicar Button */}
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => {
                      setProventosAppliedStartDate(proventosCustomStartDate);
                      setProventosAppliedEndDate(proventosCustomEndDate);
                    }}
                    className="px-6 py-2 bg-[#00C853] text-[#121212] font-black rounded-xl hover:bg-[#00E676] transition cursor-pointer uppercase text-xs shadow-md"
                  >
                    APLICAR
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Consolidated Proventos Financial Summary Block (Requirement 4) */}
          <div className="bg-[#18181B] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="border-b border-white/10 pb-3">
              <h3 className="text-base font-black text-white font-serif uppercase tracking-wider">
                Resumo Consolidado de Proventos
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* TOTAL RECEBIDO */}
              <div className="p-4 bg-[#121212] border border-[#00C853]/50 rounded-xl space-y-1.5 shadow-md">
                <span className="text-xs font-black uppercase text-[#00E676] tracking-wider block">
                  TOTAL RECEBIDO
                </span>
                <p className="text-3xl font-black text-white font-serif">
                  {formatValue(receivedDividends)}
                </p>
                <p className="text-xs text-gray-400 font-medium">
                  Proventos já creditados na conta
                </p>
              </div>

              {/* TOTAL PROVISIONADO */}
              <div className="p-4 bg-[#121212] border border-amber-500/50 rounded-xl space-y-1.5 shadow-md">
                <span className="text-xs font-black uppercase text-amber-400 tracking-wider block">
                  TOTAL PROVISIONADO
                </span>
                <p className="text-3xl font-black text-white font-serif">
                  {formatValue(provisionedDividends)}
                </p>
                <p className="text-xs text-gray-400 font-medium">
                  Proventos anunciados com pagamento futuro
                </p>
              </div>
            </div>

            {/* MÉDIA MENSAL ESTIMADA NO PERÍODO */}
            <div className="p-4 bg-[#121212] border border-[#D4AF37]/50 rounded-xl space-y-1.5 shadow-md">
              <span className="text-xs font-black uppercase text-[#D4AF37] tracking-wider block">
                Média Mensal Estimada no Período
              </span>
              <p className="text-3xl font-black text-white font-serif">
                {formatValue(receivedDividends > 0 ? receivedDividends / 12 : 0)}
              </p>
              <p className="text-xs text-gray-400 font-medium">
                Média calculada no período selecionado
              </p>
            </div>
          </div>

          <div className="p-6 bg-[#18181B] border border-white/10 rounded-2xl shadow-xl space-y-4">
            <h3 className="text-sm font-black uppercase text-white tracking-wider">Proventos Recebidos Mês a Mês</h3>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyDividendsChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                  <XAxis dataKey="month" stroke="#A1A1AA" fontSize={11} />
                  <YAxis stroke="#A1A1AA" fontSize={11} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const val = payload[0].value;
                        return (
                          <div className="bg-[#121212] border-2 border-[#00C853] p-3.5 rounded-2xl shadow-2xl space-y-1 font-sans z-50">
                            <p className="text-xs font-black text-[#00E676] border-b border-white/10 pb-1 uppercase tracking-wider">
                              Período: <span className="text-white font-serif">{label}</span>
                            </p>
                            <p className="text-xs font-bold text-gray-300 pt-1">
                              Proventos: <span className="text-white font-black font-serif text-sm ml-1">R$ {Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="valor" fill="#00C853" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bloco: Valor Recebido por Ativo */}
          <div className="bg-[#18181B] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-base font-black text-white font-serif uppercase tracking-wider flex items-center gap-2">
                  <Coins className="w-5 h-5 text-[#00E676]" />
                  Valor Recebido por Ativo
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Consolidado de proventos creditados agrupados por cada ativo da carteira
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setProventosSortOrder(proventosSortOrder === 'DESC' ? 'ASC' : 'DESC')}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-300 hover:text-[#00E676] bg-[#121212] px-3.5 py-2 rounded-xl border border-white/10 font-black cursor-pointer transition"
                  title="Clique para alternar ordenação"
                >
                  <span>Proventos</span>
                  {proventosSortOrder === 'DESC' ? (
                    <ArrowDown className="w-3.5 h-3.5 text-[#00E676]" />
                  ) : (
                    <ArrowUp className="w-3.5 h-3.5 text-[#FF5252]" />
                  )}
                </button>

                {/* Filtro: Mensal, Semestre, Anual, Total e Personalizado */}
                <div className="flex flex-wrap items-center gap-1.5 bg-[#121212] p-1.5 rounded-xl border border-white/10">
                  {[
                    { id: 'CURRENT_MONTH', label: 'Mensal' },
                    { id: '6M', label: 'Semestre' },
                    { id: '12M', label: 'Anual' },
                    { id: 'ALL', label: 'Total' },
                    { id: 'CUSTOM', label: 'Personalizado' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setAssetProventosFilter(p.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        assetProventosFilter === p.id
                          ? 'bg-[#00C853] text-[#121212] font-black shadow-md'
                          : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Selector de Período Personalizado para o Bloco de Ativos */}
            {assetProventosFilter === 'CUSTOM' && (
              <div className="p-4 rounded-xl border border-[#00C853] bg-[#121212] space-y-3 text-xs">
                <p className="text-[#00E676] font-bold flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  Filtrar Período Personalizado por Ativo:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-300 font-bold">Data Inicial:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="DD/MM/AAAA"
                        value={assetProventosStartText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAssetProventosStartText(val);
                          const iso = parseDateToISO(val);
                          if (iso) {
                            setAssetProventosCustomStartDate(iso);
                            setAssetProventosAppliedStartDate(iso);
                          }
                        }}
                        className="w-32 bg-[#18181B] border border-[#00C853]/60 rounded-lg px-2.5 py-1.5 text-xs text-[#00E676] font-bold focus:outline-none"
                      />
                      <div className="relative w-8 h-8 bg-[#18181B] border border-[#00C853]/60 rounded-lg flex items-center justify-center cursor-pointer hover:border-[#00C853] transition">
                        <ChevronDown className="w-4 h-4 text-[#00E676] pointer-events-none" />
                        <input
                          type="date"
                          value={assetProventosCustomStartDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAssetProventosCustomStartDate(val);
                            setAssetProventosAppliedStartDate(val);
                            setAssetProventosStartText(formatDateBRInput(val));
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          title="Selecionar no calendário"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-300 font-bold">Data Final:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="DD/MM/AAAA"
                        value={assetProventosEndText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAssetProventosEndText(val);
                          const iso = parseDateToISO(val);
                          if (iso) {
                            setAssetProventosCustomEndDate(iso);
                            setAssetProventosAppliedEndDate(iso);
                          }
                        }}
                        className="w-32 bg-[#18181B] border border-[#00C853]/60 rounded-lg px-2.5 py-1.5 text-xs text-[#00E676] font-bold focus:outline-none"
                      />
                      <div className="relative w-8 h-8 bg-[#18181B] border border-[#00C853]/60 rounded-lg flex items-center justify-center cursor-pointer hover:border-[#00C853] transition">
                        <ChevronDown className="w-4 h-4 text-[#00E676] pointer-events-none" />
                        <input
                          type="date"
                          value={assetProventosCustomEndDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAssetProventosCustomEndDate(val);
                            setAssetProventosAppliedEndDate(val);
                            setAssetProventosEndText(formatDateBRInput(val));
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          title="Selecionar no calendário"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => {
                      setAssetProventosAppliedStartDate(assetProventosCustomStartDate);
                      setAssetProventosAppliedEndDate(assetProventosCustomEndDate);
                    }}
                    className="px-4 py-1.5 bg-[#00C853] text-[#121212] font-black rounded-lg hover:bg-[#00E676] transition cursor-pointer text-xs uppercase"
                  >
                    Aplicar Filtro
                  </button>
                </div>
              </div>
            )}

            {/* Resumo Rápido em Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-[#121212] border border-white/10 rounded-xl">
                <span className="text-[11px] font-bold text-gray-400 block">Total Recebido no Período</span>
                <p className="text-xl font-black text-[#00E676] font-serif mt-0.5">
                  {formatValue(assetProventosTotalReceived)}
                </p>
              </div>
              <div className="p-3.5 bg-[#121212] border border-white/10 rounded-xl">
                <span className="text-[11px] font-bold text-gray-400 block">Ativos com Pagamentos</span>
                <p className="text-xl font-black text-white font-serif mt-0.5">
                  {proventosByAsset.filter((item) => item.totalReceived > 0).length} ativo(s)
                </p>
              </div>
              <div className="p-3.5 bg-[#121212] border border-white/10 rounded-xl">
                <span className="text-[11px] font-bold text-gray-400 block">Maior Pagador</span>
                <p className="text-xl font-black text-[#D4AF37] font-serif mt-0.5 truncate">
                  {proventosByAsset.length > 0 && proventosByAsset[0].totalReceived > 0
                    ? `${proventosByAsset[0].ticker} (${formatValue(proventosByAsset[0].totalReceived)})`
                    : 'Nenhum'}
                </p>
              </div>
            </div>

            {/* Lista Detalhada de Ativos */}
            {proventosByAsset.length > 0 ? (
              <div className="space-y-2.5 pt-1">
                {proventosByAsset.map((item) => {
                  const pctOfTotal = assetProventosTotalReceived > 0 ? (item.totalReceived / assetProventosTotalReceived) * 100 : 0;
                  const maxVal = proventosByAsset[0]?.totalReceived || 1;
                  const relativeBarWidth = maxVal > 0 ? (item.totalReceived / maxVal) * 100 : 0;
                  const categoryLabel = item.category ? CATEGORY_LABELS[item.category] || item.category : 'Ativo';
                  const categoryColor = item.category ? CATEGORY_COLORS[item.category] || '#3B82F6' : '#3B82F6';

                  return (
                    <div
                      key={item.ticker}
                      className="p-4 bg-[#121212] border border-white/5 hover:border-white/20 rounded-xl transition space-y-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: categoryColor }} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-white font-mono">{item.ticker}</span>
                              <span className="text-[10px] px-2 py-0.5 bg-white/10 text-gray-300 rounded-md font-semibold">
                                {categoryLabel}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-400">
                              {item.countReceived} recebimento(s)
                              {item.totalProvisioned > 0 && (
                                <span className="text-amber-400 ml-1.5 font-medium">
                                  (+ {formatValue(item.totalProvisioned)} a receber)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-sm sm:text-base font-black text-[#00E676] font-serif">
                            {formatValue(item.totalReceived)}
                          </p>
                          <p className="text-[11px] font-bold text-gray-400">
                            {pctOfTotal.toFixed(1)}% do total
                          </p>
                        </div>
                      </div>

                      {/* Barra de Proporção Relativa */}
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#00E676] rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(2, relativeBarWidth))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-xs italic bg-[#121212] rounded-xl border border-white/5">
                Nenhum provento recebido cadastrado para o período selecionado.
              </div>
            )}
          </div>
          </>
          ) : (
            <p className="text-center py-6 text-gray-400">Nenhum dado encontrado</p>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 3: RENTABILIDADE (Grouped into a Single Block) */}
      {/* ========================================================================= */}
      {activeSubTab === 'rentabilidade' && (
        <div className="space-y-6">
          {assets && assets.length > 0 ? (
            <>
          {/* Unified Rentabilidade & Benchmarks Block (Requirement Imagem 3) */}
          <div className="bg-[#18181B] border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
            {/* Rentabilidade Control Bar with Period Selector */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-base font-black text-white font-serif">Rentabilidade & Benchmarks</h2>
                <p className="text-xs text-gray-400">Desempenho acumulado em relação aos índices de mercado</p>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex flex-wrap items-center gap-1 bg-[#121212] p-1 rounded-xl border border-white/10">
                  {[
                    { id: '1M', label: '1M' },
                    { id: '3M', label: '3M' },
                    { id: '6M', label: '6M' },
                    { id: '1Y', label: '1 Ano' },
                    { id: '2Y', label: '2 Anos' },
                    { id: 'ALL', label: 'Tudo' },
                    { id: 'CUSTOM', label: 'Personalizado' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setRentPeriod(p.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        rentPeriod === p.id
                          ? 'bg-[#D4AF37] text-[#121212] font-black shadow-sm'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {rentPeriod === 'CUSTOM' && (
                  <div className="w-full bg-[#121212] p-4 rounded-xl border border-[#D4AF37]/40 space-y-3 text-xs shadow-lg mt-2">
                    <p className="text-gray-300 font-bold text-xs border-b border-white/10 pb-2 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
                      Período Personalizado (digite manualmente em DD/MM/AAAA ou escolha no calendário):
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Data Inicial */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-xs font-bold text-gray-200">Data Inicial (DD/MM/AAAA):</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="DD/MM/AAAA"
                            value={rentStartText}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRentStartText(val);
                              const iso = parseDateToISO(val);
                              if (iso) {
                                setRentCustomStartDate(iso);
                                setRentAppliedStartDate(iso);
                              }
                            }}
                            className="w-36 bg-[#18181B] border border-[#D4AF37]/60 rounded-xl px-3 py-2 text-xs text-[#D4AF37] font-bold focus:outline-none focus:border-[#D4AF37] font-mono"
                          />
                          <div className="relative w-8 h-8 bg-[#18181B] border border-[#D4AF37]/60 rounded-xl flex items-center justify-center cursor-pointer hover:border-[#D4AF37] transition">
                            <ChevronDown className="w-4 h-4 text-[#D4AF37] pointer-events-none" />
                            <input
                              type="date"
                              value={rentCustomStartDate}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRentCustomStartDate(val);
                                setRentAppliedStartDate(val);
                                setRentStartText(formatDateBRInput(val));
                              }}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              title="Selecionar no calendário"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Data Final */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-xs font-bold text-gray-200">Data Final (DD/MM/AAAA):</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="DD/MM/AAAA"
                            value={rentEndText}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRentEndText(val);
                              const iso = parseDateToISO(val);
                              if (iso) {
                                setRentCustomEndDate(iso);
                                setRentAppliedEndDate(iso);
                              }
                            }}
                            className="w-36 bg-[#18181B] border border-[#D4AF37]/60 rounded-xl px-3 py-2 text-xs text-[#D4AF37] font-bold focus:outline-none focus:border-[#D4AF37] font-mono"
                          />
                          <div className="relative w-8 h-8 bg-[#18181B] border border-[#D4AF37]/60 rounded-xl flex items-center justify-center cursor-pointer hover:border-[#D4AF37] transition">
                            <ChevronDown className="w-4 h-4 text-[#D4AF37] pointer-events-none" />
                            <input
                              type="date"
                              value={rentCustomEndDate}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRentCustomEndDate(val);
                                setRentAppliedEndDate(val);
                                setRentEndText(formatDateBRInput(val));
                              }}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              title="Selecionar no calendário"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Aplicar Button */}
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => {
                          setRentAppliedStartDate(rentCustomStartDate);
                          setRentAppliedEndDate(rentCustomEndDate);
                        }}
                        className="px-6 py-2 bg-[#D4AF37] text-[#121212] font-black rounded-xl hover:bg-[#C5A028] transition cursor-pointer uppercase text-xs shadow-md"
                      >
                        APLICAR
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Benchmark Comparison Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-[#121212] border border-[#D4AF37]/50 rounded-xl shadow-md space-y-1">
                <span className="text-[10px] font-black uppercase text-[#D4AF37] tracking-wider">Carteira</span>
                <p className={`text-2xl font-black font-serif ${rentabilitySummary.patrimonio >= 0 ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                  {rentabilitySummary.patrimonio >= 0 ? '+' : ''}{rentabilitySummary.patrimonio.toFixed(2)}%
                </p>
                <p className="text-[10px] text-gray-400">Rendimento Acumulado</p>
              </div>

              <div className="p-4 bg-[#121212] border border-[#10B981]/40 rounded-xl shadow-md space-y-1">
                <span className="text-[10px] font-black uppercase text-[#10B981] tracking-wider">CDI</span>
                <p className="text-2xl font-black text-white font-serif">+{rentabilitySummary.cdi.toFixed(2)}%</p>
                <p className="text-[10px] text-gray-400">
                  Carteira vs CDI:{' '}
                  <strong className={rentabilitySummary.patrimonio >= rentabilitySummary.cdi ? 'text-[#00E676]' : 'text-[#FF5252]'}>
                    {rentabilitySummary.cdiPctOf.toFixed(2)}% do CDI
                  </strong>
                </p>
              </div>

              <div className="p-4 bg-[#121212] border border-[#3B82F6]/40 rounded-xl shadow-md space-y-1">
                <span className="text-[10px] font-black uppercase text-[#3B82F6] tracking-wider">IBOVESPA</span>
                <p className="text-2xl font-black text-white font-serif">+{rentabilitySummary.ibov.toFixed(2)}%</p>
                <p className="text-[10px] text-gray-400">
                  Carteira vs Ibov:{' '}
                  <strong className={rentabilitySummary.ibovDiff >= 0 ? 'text-[#00E676]' : 'text-[#FF5252]'}>
                    {rentabilitySummary.ibovDiff >= 0 ? '+' : ''}{rentabilitySummary.ibovDiff.toFixed(2)}%
                  </strong>
                </p>
              </div>

              <div className="p-4 bg-[#121212] border border-[#EC4899]/40 rounded-xl shadow-md space-y-1">
                <span className="text-[10px] font-black uppercase text-[#EC4899] tracking-wider">IPCA (Inflação)</span>
                <p className="text-2xl font-black text-white font-serif">+{rentabilitySummary.ipca.toFixed(2)}%</p>
                <p className="text-[10px] text-gray-400">
                  Ganho Real:{' '}
                  <strong className={rentabilitySummary.realGain >= 0 ? 'text-[#00E676]' : 'text-[#FF5252]'}>
                    {rentabilitySummary.realGain >= 0 ? '+' : ''}{rentabilitySummary.realGain.toFixed(2)}%
                  </strong>
                </p>
              </div>
            </div>

            {/* Area Chart comparing Carteira vs Benchmarks */}
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-black uppercase text-white tracking-wider font-serif">Evolução da Carteira vs Índices (% de Retorno)</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={rentabilityPercentageChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                    <XAxis dataKey="month" stroke="#A1A1AA" fontSize={11} />
                    <YAxis
                      stroke="#A1A1AA"
                      fontSize={11}
                      tickFormatter={(val) => `${val >= 0 ? '+' : ''}${val.toString().replace('.', ',')}%`}
                    />
                    <Tooltip content={<CustomPercentageChartTooltip />} />
                    <Legend />
                    <Area type="monotone" name="Sua Carteira (%)" dataKey="patrimonio" stroke="#D4AF37" fill="#D4AF37" fillOpacity={0.2} strokeWidth={3} />
                    <Area type="monotone" name="Ibovespa (%)" dataKey="ibov" stroke="#3B82F6" fill="transparent" strokeWidth={2} />
                    <Area type="monotone" name="CDI (%)" dataKey="cdi" stroke="#10B981" fill="transparent" strokeWidth={2} />
                    <Area type="monotone" name="IPCA (%)" dataKey="ipca" stroke="#EC4899" fill="transparent" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Individual Assets Rentabilidade Table */}
          <div className="p-6 bg-[#18181B] border border-white/10 rounded-2xl shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-black uppercase text-white tracking-wider">Rentabilidade por Ativo</h3>
                <p className="text-xs text-gray-400">Rendimento percentual individual de cada ativo em carteira</p>
              </div>


            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 font-black uppercase text-[10px]">
                    <th className="py-3 px-2">Ativo</th>
                    <th className="py-3 px-2">Categoria</th>
                    <th className="py-3 px-2">Preço Médio</th>
                    <th className="py-3 px-2">Preço Atual</th>
                    <th className="py-3 px-2">Valorização (%)</th>
                    <th className="py-3 px-2">
                      <button
                        onClick={() => {
                          if (assetSortField === 'proventosVal') {
                            setAssetSortOrder(assetSortOrder === 'DESC' ? 'ASC' : 'DESC');
                          } else {
                            setAssetSortField('proventosVal');
                            setAssetSortOrder('DESC');
                          }
                        }}
                        className="inline-flex items-center gap-1.5 text-gray-300 hover:text-[#D4AF37] cursor-pointer font-black uppercase text-[10px] transition"
                        title="Clique para alternar ordenação por Proventos"
                      >
                        <span>Proventos</span>
                        {assetSortField === 'proventosVal' ? (
                          assetSortOrder === 'DESC' ? (
                            <ArrowDown className="w-3.5 h-3.5 text-[#00E676]" />
                          ) : (
                            <ArrowUp className="w-3.5 h-3.5 text-[#FF5252]" />
                          )
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-gray-500 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-2 text-right">
                      <button
                        onClick={() => {
                          if (assetSortField === 'totalRent') {
                            setAssetSortOrder(assetSortOrder === 'DESC' ? 'ASC' : 'DESC');
                          } else {
                            setAssetSortField('totalRent');
                            setAssetSortOrder('DESC');
                          }
                        }}
                        className="inline-flex items-center gap-1.5 text-gray-300 hover:text-[#D4AF37] cursor-pointer font-black uppercase text-[10px] ml-auto transition"
                        title="Clique para alternar ordenação por Rentabilidade Total"
                      >
                        <span>Rentabilidade Total (%)</span>
                        {assetSortField === 'totalRent' ? (
                          assetSortOrder === 'DESC' ? (
                            <ArrowDown className="w-3.5 h-3.5 text-[#00E676]" />
                          ) : (
                            <ArrowUp className="w-3.5 h-3.5 text-[#FF5252]" />
                          )
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-gray-500 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-2 text-center w-12">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {assets.filter((a) => a.quantity > 0).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-gray-400">
                        Nenhum ativo na carteira para exibir rentabilidade.
                      </td>
                    </tr>
                  ) : (
                    assets
                      .filter((a) => a.quantity > 0)
                      .map((a) => {
                        const avg = a.averagePrice || 0;
                        const current = a.currentPrice || 0;
                        const capGainPct = avg > 0 ? ((current - avg) / avg) * 100 : (a.returnPct || 0);

                        const tickerUpper = String(a.ticker || '').trim().toUpperCase();
                        const usdRate = quotes.find((q) => q.symbol === 'USD/BRL')?.price || 5.06;
                        const mult = a.currency === 'USD' ? usdRate : 1;
                        const totalInvestedBrl = avg * a.quantity * mult;

                        let divs = activeDividends.filter(
                          (d) => String(d.assetTicker || d.ticker || '').trim().toUpperCase() === tickerUpper && d.status === 'received'
                        );

                        if (rentPeriod === '1M') {
                          const limit = new Date();
                          limit.setMonth(limit.getMonth() - 1);
                          divs = divs.filter((d) => (d.paymentDate || d.dateCom) && new Date(d.paymentDate || d.dateCom) >= limit);
                        } else if (rentPeriod === '3M') {
                          const limit = new Date();
                          limit.setMonth(limit.getMonth() - 3);
                          divs = divs.filter((d) => (d.paymentDate || d.dateCom) && new Date(d.paymentDate || d.dateCom) >= limit);
                        } else if (rentPeriod === '6M') {
                          const limit = new Date();
                          limit.setMonth(limit.getMonth() - 6);
                          divs = divs.filter((d) => (d.paymentDate || d.dateCom) && new Date(d.paymentDate || d.dateCom) >= limit);
                        } else if (rentPeriod === '1Y') {
                          const limit = new Date();
                          limit.setFullYear(limit.getFullYear() - 1);
                          divs = divs.filter((d) => (d.paymentDate || d.dateCom) && new Date(d.paymentDate || d.dateCom) >= limit);
                        } else if (rentPeriod === '2Y') {
                          const limit = new Date();
                          limit.setFullYear(limit.getFullYear() - 2);
                          divs = divs.filter((d) => (d.paymentDate || d.dateCom) && new Date(d.paymentDate || d.dateCom) >= limit);
                        } else if (rentPeriod === 'CUSTOM') {
                          if (rentAppliedStartDate || rentAppliedEndDate) {
                            divs = divs.filter((d) => {
                              const dtStr = d.paymentDate || d.dateCom;
                              if (!dtStr) return true;
                              let ok = true;
                              if (rentAppliedStartDate && dtStr < rentAppliedStartDate) ok = false;
                              if (rentAppliedEndDate && dtStr > rentAppliedEndDate) ok = false;
                              return ok;
                            });
                          }
                        }

                        const proventosVal = divs.reduce((sum, d) => sum + d.totalValue, 0);
                        const proventosPct = totalInvestedBrl > 0 ? (proventosVal / totalInvestedBrl) * 100 : 0;
                        const totalRent = capGainPct + proventosPct;

                        return {
                          asset: a,
                          capGainPct,
                          proventosVal,
                          proventosPct,
                          totalRent,
                        };
                      })
                      .sort((a, b) => {
                        const valA = assetSortField === 'proventosVal' ? a.proventosVal : a.totalRent;
                        const valB = assetSortField === 'proventosVal' ? b.proventosVal : b.totalRent;
                        return assetSortOrder === 'DESC' ? valB - valA : valA - valB;
                      })
                      .map(({ asset: a, capGainPct, proventosVal, proventosPct, totalRent }) => {
                        const isCapPos = capGainPct >= 0;
                        const isTotalPos = totalRent >= 0;
                        return (
                          <tr
                            key={a.id}
                            onClick={() => setSelectedAssetForDetail(a)}
                            className="hover:bg-white/5 transition font-bold cursor-pointer group"
                            title="Clique para ver Detalhes e Transações"
                          >
                            <td className="py-3 px-2 text-white flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[a.category] }} />
                              <div>
                                <span className="font-mono text-xs font-black group-hover:text-[#D4AF37] transition">{a.ticker}</span>
                                <p className="text-[10px] text-gray-400">{getAssetSegment(a)}</p>
                              </div>
                            </td>
                            <td className="py-3 px-2 text-gray-300">{CATEGORY_LABELS[a.category]}</td>
                            <td className="py-3 px-2 text-gray-400">{formatValue(a.averagePrice, a.currency === 'USD' ? 'US$ ' : 'R$ ')}</td>
                            <td className="py-3 px-2 text-white">{formatValue(a.currentPrice, a.currency === 'USD' ? 'US$ ' : 'R$ ')}</td>
                            <td className={`py-3 px-2 font-mono ${isCapPos ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                              {isCapPos ? '+' : ''}{capGainPct.toFixed(2)}%
                            </td>
                            <td className="py-3 px-2 text-gray-300">
                              {proventosVal > 0 ? (
                                <div>
                                  <span className="text-[#00E676] font-bold">R$ {proventosVal.toFixed(2)}</span>
                                  <span className="text-[10px] text-gray-400 ml-1">(+{proventosPct.toFixed(2)}%)</span>
                                </div>
                              ) : (
                                <span className="text-gray-500">-</span>
                              )}
                            </td>
                            <td className={`py-3 px-2 text-right font-serif font-black ${isTotalPos ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                              <span className={`px-2 py-1 rounded-lg text-xs font-black ${isTotalPos ? 'bg-[#00E676]/15 text-[#00E676]' : 'bg-[#FF5252]/15 text-[#FF5252]'}`}>
                                {isTotalPos ? '+' : ''}{totalRent.toFixed(2)}%
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setSelectedAssetForDetail(a)}
                                className="p-1.5 text-gray-400 hover:text-[#D4AF37] hover:bg-white/10 rounded-lg transition cursor-pointer"
                                title="Ver Detalhes do Ativo"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </>
          ) : (
            <p className="text-center py-6 text-gray-400">Nenhum dado encontrado</p>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 4: COMPOSIÇÃO (Matching Images 6 to 15) */}
      {/* ========================================================================= */}
      {activeSubTab === 'composicao' && (
        <div className="space-y-6 animate-in fade-in">
          {assets && assets.length > 0 ? (
            <>
          {/* UNIFIED SINGLE BLOCK: Posição na Carteira & Alocação, Posição na Carteira, Detalhamento Percentual por Classe */}
          <div className="bg-[#18181B] border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
            {/* Block Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-xl font-black text-white font-serif">Posição na Carteira & Alocação</h2>
                <p className="text-xs text-gray-400">Detalhamento completo de cada classe, segmento e porcentagem</p>
              </div>

              <button
                onClick={() => setIsFilterModalOpen(true)}
                className="px-3.5 py-2 bg-[#121212] border border-white/20 hover:border-[#D4AF37] text-white rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shrink-0"
              >
                <SlidersHorizontal className="w-4 h-4 text-[#D4AF37]" />
                <span>Filtros</span>
              </button>
            </div>

            {/* Inner Grid: Donut Chart & Category Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Donut Chart with Centered Total */}
              <div className="p-5 bg-[#121212] border border-white/10 rounded-2xl flex flex-col items-center justify-center space-y-4 relative overflow-hidden">
                <h3 className="text-sm font-black uppercase text-white tracking-wider">Posição na Carteira</h3>
                
                <div className="h-64 w-full relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={pieChartData.length > 0 ? pieChartData : [{ name: 'Sem Saldo', value: 1, color: '#27272A' }]}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={90}
                        paddingAngle={pieChartData.length > 0 ? 3 : 0}
                        dataKey="value"
                        onClick={(entry) => {
                          if (entry && entry.name !== 'Sem Saldo') {
                            setSelectedCategorySlice(selectedCategorySlice?.name === entry.name ? null : entry);
                          }
                        }}
                        className="cursor-pointer"
                      >
                        {(pieChartData.length > 0 ? pieChartData : [{ name: 'Sem Saldo', value: 1, color: '#27272A' }]).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      {pieChartData.length > 0 && (
                        <Tooltip wrapperStyle={{ zIndex: 10, outline: 'none' }} allowEscapeViewBox={{ x: false, y: false }} content={<CustomDonutTooltip />} />
                      )}
                    </RePieChart>
                  </ResponsiveContainer>

                  {/* Centered Total inside Donut */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total</span>
                    <p className="text-base sm:text-lg font-black text-white font-serif">
                      {formatValue(totalEquity)}
                    </p>
                    {pieChartData.length === 0 && (
                      <span className="text-[10px] text-gray-400 font-bold mt-1 max-w-[140px] leading-tight">
                        Nenhum ativo com saldo cadastrado
                      </span>
                    )}
                  </div>
                </div>

                {selectedCategorySlice && (
                  <div className="w-full bg-[#18181B] border border-[#00E676]/40 p-2.5 rounded-xl text-xs space-y-1 mt-1 flex items-center justify-between shadow-md z-10">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: selectedCategorySlice.color || '#00E676' }} />
                      <div className="truncate">
                        <p className="font-black text-white font-serif truncate">{selectedCategorySlice.name}</p>
                        <p className="text-[11px] text-gray-300 font-bold">
                          {formatValue(selectedCategorySlice.value)} ({selectedCategorySlice.pct || 0}%)
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedCategorySlice(null)}
                      className="text-gray-400 hover:text-white p-1 text-xs shrink-0 cursor-pointer"
                      title="Fechar"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Category Slices Breakdown */}
              <div className="lg:col-span-2 p-5 bg-[#121212] border border-white/10 rounded-2xl space-y-4">
                <h3 className="text-sm font-black uppercase text-white tracking-wider">Detalhamento Percentual por Classe</h3>
                {pieChartData.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-10 font-bold">
                    Nenhuma classe de ativo cadastrada com saldo positivo.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {pieChartData.map((item) => (
                      <div key={item.category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-white flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                            {item.name}
                          </span>
                          <span className="text-gray-300">
                            {formatValue(item.value)} ({item.pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[#18181B] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* UNIFIED SINGLE BLOCK: Posição na Carteira & Alocação por Segmento */}
          <div className="bg-[#18181B] border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
            {/* Block Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-xl font-black text-white font-serif">Posição na Carteira & Alocação por Segmento</h2>
                <p className="text-xs text-gray-400">Detalhamento completo da distribuição por segmento de mercado e porcentagem</p>
              </div>

              <button
                onClick={() => setIsFilterModalOpen(true)}
                className="px-3.5 py-2 bg-[#121212] border border-white/20 hover:border-[#D4AF37] text-white rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shrink-0"
              >
                <SlidersHorizontal className="w-4 h-4 text-[#D4AF37]" />
                <span>Filtros</span>
              </button>
            </div>

            {/* Inner Grid: Donut Chart & Segment Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Donut Chart with Centered Total */}
              <div className="p-5 bg-[#121212] border border-white/10 rounded-2xl flex flex-col items-center justify-center space-y-4 relative overflow-hidden">
                <h3 className="text-sm font-black uppercase text-white tracking-wider">Posição por Segmento</h3>
                
                <div className="h-64 w-full relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={segmentPieChartData.length > 0 ? segmentPieChartData : [{ name: 'Sem Saldo', value: 1, color: '#27272A' }]}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={90}
                        paddingAngle={segmentPieChartData.length > 0 ? 3 : 0}
                        dataKey="value"
                        onClick={(entry) => {
                          if (entry && entry.name !== 'Sem Saldo') {
                            setSelectedSegmentSlice(selectedSegmentSlice?.name === entry.name ? null : entry);
                          }
                        }}
                        className="cursor-pointer"
                      >
                        {(segmentPieChartData.length > 0 ? segmentPieChartData : [{ name: 'Sem Saldo', value: 1, color: '#27272A' }]).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      {segmentPieChartData.length > 0 && (
                        <Tooltip wrapperStyle={{ zIndex: 10, outline: 'none' }} allowEscapeViewBox={{ x: false, y: false }} content={<CustomDonutTooltip />} />
                      )}
                    </RePieChart>
                  </ResponsiveContainer>

                  {/* Centered Total inside Donut */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total</span>
                    <p className="text-base sm:text-lg font-black text-white font-serif">
                      {formatValue(totalEquity)}
                    </p>
                    {segmentPieChartData.length === 0 && (
                      <span className="text-[10px] text-gray-400 font-bold mt-1 max-w-[140px] leading-tight">
                        Nenhum ativo com saldo cadastrado
                      </span>
                    )}
                  </div>
                </div>

                {selectedSegmentSlice && (
                  <div className="w-full bg-[#18181B] border border-[#00E676]/40 p-2.5 rounded-xl text-xs space-y-1 mt-1 flex items-center justify-between shadow-md z-10">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: selectedSegmentSlice.color || '#00E676' }} />
                      <div className="truncate">
                        <p className="font-black text-white font-serif truncate">{selectedSegmentSlice.name}</p>
                        <p className="text-[11px] text-gray-300 font-bold">
                          {formatValue(selectedSegmentSlice.value)} ({selectedSegmentSlice.pct || 0}%)
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedSegmentSlice(null)}
                      className="text-gray-400 hover:text-white p-1 text-xs shrink-0 cursor-pointer"
                      title="Fechar"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Segment Slices Breakdown */}
              <div className="lg:col-span-2 p-5 bg-[#121212] border border-white/10 rounded-2xl space-y-4">
                <h3 className="text-sm font-black uppercase text-white tracking-wider">Detalhamento Percentual por Segmento</h3>
                {segmentPieChartData.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-10 font-bold">
                    Nenhum segmento de ativo cadastrado com saldo positivo.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                    {segmentPieChartData.map((item) => (
                      <div key={item.segment} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-white flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            {item.name}
                          </span>
                          <span className="text-gray-300">
                            {formatValue(item.value)} ({item.pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[#18181B] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* UNIFIED SINGLE BLOCK: Ativos Agrupados por Categoria (Ações, Tesouro, FIIs, Stocks, FIAGRO, Criptomoedas e ETF Exterior) */}
          <div className="bg-[#18181B] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-black uppercase text-white tracking-wider font-serif border-b border-white/10 pb-3">
              Ativos Agrupados por Categoria
            </h3>

            <div className="space-y-4">
              {[
                { cat: 'acoes' as AssetCategory, label: 'Ações' },
                { cat: 'tesouro' as AssetCategory, label: 'Tesouro' },
                { cat: 'fiis' as AssetCategory, label: 'FIIs' },
                { cat: 'etfs' as AssetCategory, label: 'ETFs' },
                { cat: 'stocks' as AssetCategory, label: 'Stocks' },
                { cat: 'fiagro' as AssetCategory, label: 'FIAGRO' },
                { cat: 'cripto' as AssetCategory, label: 'Criptomoedas' },
                { cat: 'etf_exterior' as AssetCategory, label: 'ETF Exterior' },
              ].map((c) => {
                const usdRate = quotes.find((q) => q.symbol === 'USD/BRL')?.price || 5.06;
                const catAssets = assets.filter((a) => a.category === c.cat && a.quantity > 0);

                const val = catAssets.reduce((acc, a) => {
                  const mult = a.currency === 'USD' ? usdRate : 1;
                  return acc + a.currentPrice * a.quantity * mult;
                }, 0);

                const totalInvestedCat = catAssets.reduce((acc, a) => {
                  const mult = a.currency === 'USD' ? usdRate : 1;
                  return acc + a.averagePrice * a.quantity * mult;
                }, 0);

                const totalVarVal = val - totalInvestedCat;
                const totalVarPct = totalInvestedCat > 0 ? (totalVarVal / totalInvestedCat) * 100 : 0;

                const todayVarVal = catAssets.reduce((acc, a) => {
                  const mult = a.currency === 'USD' ? usdRate : 1;
                  const changePct = a.priceChange24h || 0;
                  const currVal = a.currentPrice * a.quantity * mult;
                  const prevVal = changePct !== 0 ? currVal / (1 + changePct / 100) : currVal;
                  return acc + (currVal - prevVal);
                }, 0);

                const prevTotalCat = val - todayVarVal;
                const todayVarPct = prevTotalCat > 0 ? (todayVarVal / prevTotalCat) * 100 : 0;

                const isExpanded = expandedCategories[c.cat] ?? false;
                const isTotalPos = totalVarVal >= 0;
                const isTodayPos = todayVarVal >= 0;

                return (
                  <div key={c.cat} className="bg-[#121212] border border-white/10 rounded-2xl overflow-hidden shadow-md">
                    {/* Category Card Header */}
                    <div
                      onClick={() => toggleCategory(c.cat)}
                      className="p-4 bg-[#18181B] border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-white/5 transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c.cat] }} />
                        <div>
                          <h4 className="text-base font-black text-white font-serif">{c.label}</h4>
                          <p className="text-xs text-gray-400 font-bold">{formatValue(val)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs">
                        {/* Variação Total */}
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-gray-500 uppercase font-bold block">Variação Total</span>
                          <span className={`font-black ${isTotalPos ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                            {isTotalPos ? '↑ ' : '↓ '}
                            {totalVarPct.toFixed(2)}% ({formatValue(totalVarVal)})
                          </span>
                        </div>

                        {/* Variação Hoje */}
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-gray-500 uppercase font-bold block">Variação Hoje</span>
                          <span className={`font-black ${isTodayPos ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                            {isTodayPos ? '↑ ' : '↓ '}
                            {todayVarPct.toFixed(2)}% ({formatValue(todayVarVal)})
                          </span>
                        </div>

                        {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                      </div>
                    </div>

                    {/* Expanded Table */}
                    {isExpanded && (
                      <div className="p-4 overflow-x-auto">
                        {(() => {
                          const sortConfig = categorySorts[c.cat] || { field: 'pctCart', direction: 'desc' };
                          const sortedCatAssets = [...catAssets].sort((a, b) => {
                            let valA = 0;
                            let valB = 0;

                            if (sortConfig.field === 'ticker') {
                              return sortConfig.direction === 'asc' 
                                ? a.ticker.localeCompare(b.ticker) 
                                : b.ticker.localeCompare(a.ticker);
                            }
                            if (sortConfig.field === 'segment') {
                              return sortConfig.direction === 'asc'
                                ? getAssetSegment(a).localeCompare(getAssetSegment(b))
                                : getAssetSegment(b).localeCompare(getAssetSegment(a));
                            }
                            if (sortConfig.field === 'price') {
                              valA = a.currentPrice * (a.currency === 'USD' ? usdRate : 1);
                              valB = b.currentPrice * (b.currency === 'USD' ? usdRate : 1);
                            } else if (sortConfig.field === 'quantity') {
                              valA = a.quantity;
                              valB = b.quantity;
                            } else if (sortConfig.field === 'totalRent') {
                              const avgA = a.averagePrice || 0;
                              valA = avgA > 0 ? ((a.currentPrice - avgA) / avgA) * 100 : (a.returnPct || 0);
                              const avgB = b.averagePrice || 0;
                              valB = avgB > 0 ? ((b.currentPrice - avgB) / avgB) * 100 : (b.returnPct || 0);
                            } else if (sortConfig.field === 'todayRent') {
                              valA = a.priceChange24h || 0;
                              valB = b.priceChange24h || 0;
                            } else if (sortConfig.field === 'pctCat') {
                              const curA = a.currency === 'USD' ? a.currentPrice * usdRate * a.quantity : a.currentPrice * a.quantity;
                              const curB = b.currency === 'USD' ? b.currentPrice * usdRate * b.quantity : b.currentPrice * b.quantity;
                              valA = val > 0 ? (curA / val) * 100 : 0;
                              valB = val > 0 ? (curB / val) * 100 : 0;
                            } else if (sortConfig.field === 'pctCart') {
                              const curA = a.currency === 'USD' ? a.currentPrice * usdRate * a.quantity : a.currentPrice * a.quantity;
                              const curB = b.currency === 'USD' ? b.currentPrice * usdRate * b.quantity : b.currentPrice * b.quantity;
                              valA = totalEquity > 0 ? (curA / totalEquity) * 100 : 0;
                              valB = totalEquity > 0 ? (curB / totalEquity) * 100 : 0;
                            }

                            return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
                          });

                          return (
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-white/10 text-gray-400 font-black uppercase text-[10px]">
                                  <th 
                                    className="py-2.5 px-2 cursor-pointer hover:text-white transition select-none"
                                    onClick={() => handleCategorySort(c.cat, 'ticker')}
                                  >
                                    <div className="flex items-center gap-1">
                                      Ativo
                                      {sortConfig.field === 'ticker' ? (
                                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D4AF37]" /> : <ArrowDown className="w-3 h-3 text-[#D4AF37]" />
                                      ) : (
                                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                                      )}
                                    </div>
                                  </th>
                                  <th 
                                    className="py-2.5 px-2 cursor-pointer hover:text-white transition select-none"
                                    onClick={() => handleCategorySort(c.cat, 'segment')}
                                  >
                                    <div className="flex items-center gap-1">
                                      Segmento
                                      {sortConfig.field === 'segment' ? (
                                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D4AF37]" /> : <ArrowDown className="w-3 h-3 text-[#D4AF37]" />
                                      ) : (
                                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                                      )}
                                    </div>
                                  </th>
                                  <th 
                                    className="py-2.5 px-2 cursor-pointer hover:text-white transition select-none"
                                    onClick={() => handleCategorySort(c.cat, 'price')}
                                  >
                                    <div className="flex items-center gap-1">
                                      Preço Atual
                                      {sortConfig.field === 'price' ? (
                                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D4AF37]" /> : <ArrowDown className="w-3 h-3 text-[#D4AF37]" />
                                      ) : (
                                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                                      )}
                                    </div>
                                  </th>
                                  <th 
                                    className="py-2.5 px-2 cursor-pointer hover:text-white transition select-none"
                                    onClick={() => handleCategorySort(c.cat, 'quantity')}
                                  >
                                    <div className="flex items-center gap-1">
                                      Quantidade
                                      {sortConfig.field === 'quantity' ? (
                                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D4AF37]" /> : <ArrowDown className="w-3 h-3 text-[#D4AF37]" />
                                      ) : (
                                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                                      )}
                                    </div>
                                  </th>
                                  <th 
                                    className="py-2.5 px-2 cursor-pointer hover:text-white transition select-none"
                                    onClick={() => handleCategorySort(c.cat, 'totalRent')}
                                  >
                                    <div className="flex items-center gap-1">
                                      Rent. Total
                                      {sortConfig.field === 'totalRent' ? (
                                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D4AF37]" /> : <ArrowDown className="w-3 h-3 text-[#D4AF37]" />
                                      ) : (
                                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                                      )}
                                    </div>
                                  </th>
                                  <th 
                                    className="py-2.5 px-2 cursor-pointer hover:text-white transition select-none"
                                    onClick={() => handleCategorySort(c.cat, 'todayRent')}
                                  >
                                    <div className="flex items-center gap-1">
                                      Rent. Hoje
                                      {sortConfig.field === 'todayRent' ? (
                                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D4AF37]" /> : <ArrowDown className="w-3 h-3 text-[#D4AF37]" />
                                      ) : (
                                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                                      )}
                                    </div>
                                  </th>
                                  <th 
                                    className="py-2.5 px-2 cursor-pointer hover:text-white transition select-none"
                                    onClick={() => handleCategorySort(c.cat, 'pctCat')}
                                  >
                                    <div className="flex items-center gap-1">
                                      % na Categoria
                                      {sortConfig.field === 'pctCat' ? (
                                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D4AF37]" /> : <ArrowDown className="w-3 h-3 text-[#D4AF37]" />
                                      ) : (
                                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                                      )}
                                    </div>
                                  </th>
                                  <th 
                                    className="py-2.5 px-2 text-right cursor-pointer hover:text-white transition select-none"
                                    onClick={() => handleCategorySort(c.cat, 'pctCart')}
                                  >
                                    <div className="flex items-center justify-end gap-1">
                                      % na Carteira
                                      {sortConfig.field === 'pctCart' ? (
                                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D4AF37]" /> : <ArrowDown className="w-3 h-3 text-[#D4AF37]" />
                                      ) : (
                                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                                      )}
                                    </div>
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {sortedCatAssets.map((a) => {
                              const currentVal =
                                a.currency === 'USD' ? a.currentPrice * usdRate * a.quantity : a.currentPrice * a.quantity;
                              const assetPctCart = totalEquity > 0 ? (currentVal / totalEquity) * 100 : 0;
                              const assetPctCat = val > 0 ? (currentVal / val) * 100 : 0;

                              const avg = a.averagePrice || 0;
                              const cur = a.currentPrice || 0;
                              const totalRentPct = avg > 0 ? ((cur - avg) / avg) * 100 : (a.returnPct || 0);
                              const isTotalRentPos = totalRentPct >= 0;

                              const todayChangePct = a.priceChange24h || 0;
                              const isTodayPos = todayChangePct >= 0;

                              return (
                                <tr
                                  key={a.id}
                                  onClick={() => setSelectedAssetForDetail(a)}
                                  className="hover:bg-white/10 transition font-bold cursor-pointer group"
                                  title="Clique para ver Detalhes e Histórico de Transações"
                                >
                                  <td className="py-2.5 px-2 text-white font-black flex items-center gap-1.5">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedAssetForDetail(a);
                                        setShowAssetTxDrawer(true);
                                      }}
                                      className="p-1 text-gray-400 hover:text-[#D4AF37] hover:bg-white/10 rounded transition"
                                      title="Ver Transações"
                                    >
                                      <MoreHorizontal className="w-3.5 h-3.5" />
                                    </button>
                                    <span>{a.ticker}</span>
                                  </td>
                                  <td className="py-2.5 px-2 text-gray-300">{getAssetSegment(a)}</td>
                                  <td className="py-2.5 px-2 text-white">
                                    {formatValue(a.currentPrice, a.currency === 'USD' ? 'US$ ' : 'R$ ')}
                                  </td>
                                  <td className="py-2.5 px-2 text-gray-300">{a.quantity} un.</td>
                                  <td className={`py-2.5 px-2 font-mono ${isTotalRentPos ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                                    {isTotalRentPos ? '+' : ''}{totalRentPct.toFixed(2)}%
                                  </td>
                                  <td className={`py-2.5 px-2 font-mono ${isTodayPos ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                                    {isTodayPos ? '+' : ''}{todayChangePct.toFixed(2)}%
                                  </td>
                                  <td className="py-2.5 px-2 text-[#D4AF37]">{assetPctCat.toFixed(1)}%</td>
                                  <td className="py-2.5 px-2 text-right text-white font-black">{assetPctCart.toFixed(1)}%</td>
                                </tr>
                              );
                            })}

                            {catAssets.length === 0 && (
                              <tr>
                                <td colSpan={8} className="py-4 text-center text-gray-500 text-xs font-bold">
                                  Nenhum ativo cadastrado nesta categoria.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* UNIFIED SINGLE BLOCK: Ativos Agrupados por Segmento de Mercado */}
          <div className="bg-[#18181B] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-black uppercase text-white tracking-wider font-serif border-b border-white/10 pb-3">
              Ativos Agrupados por Segmento
            </h3>

            <div className="space-y-4">
              {uniqueSegments.length === 0 ? (
                <p className="text-xs text-gray-400 font-bold italic py-2">
                  Nenhum ativo com saldo cadastrado para agrupamento por segmento.
                </p>
              ) : (
                uniqueSegments.map(({ seg, segAssets, segVal }, idx) => {
                  const usdRate = quotes.find((q) => q.symbol === 'USD/BRL')?.price || 5.06;

                  const totalInvestedSeg = segAssets.reduce((acc, a) => {
                    const mult = a.currency === 'USD' ? usdRate : 1;
                    return acc + a.averagePrice * a.quantity * mult;
                  }, 0);

                  const totalVarVal = segVal - totalInvestedSeg;
                  const totalVarPct = totalInvestedSeg > 0 ? (totalVarVal / totalInvestedSeg) * 100 : 0;

                  const todayVarVal = segAssets.reduce((acc, a) => {
                    const mult = a.currency === 'USD' ? usdRate : 1;
                    const changePct = a.priceChange24h || 0;
                    const currVal = a.currentPrice * a.quantity * mult;
                    const prevVal = changePct !== 0 ? currVal / (1 + changePct / 100) : currVal;
                    return acc + (currVal - prevVal);
                  }, 0);

                  const prevTotalSeg = segVal - todayVarVal;
                  const todayVarPct = prevTotalSeg > 0 ? (todayVarVal / prevTotalSeg) * 100 : 0;

                  const isExpanded = expandedSegments[seg] ?? false;
                  const isTotalPos = totalVarVal >= 0;
                  const isTodayPos = todayVarVal >= 0;

                  const dotColors = [
                    '#D4AF37', '#00E676', '#29B6F6', '#AB47BC', '#FF7043',
                    '#EC407A', '#26A69A', '#FFCA28', '#78909C', '#8D6E63'
                  ];
                  const segColor = dotColors[idx % dotColors.length];

                  return (
                    <div key={seg} className="bg-[#121212] border border-white/10 rounded-2xl overflow-hidden shadow-md">
                      {/* Segment Card Header */}
                      <div
                        onClick={() => toggleSegment(seg)}
                        className="p-4 bg-[#18181B] border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-white/5 transition"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: segColor }} />
                          <div>
                            <h4 className="text-base font-black text-white font-serif">{seg}</h4>
                            <p className="text-xs text-gray-400 font-bold">{formatValue(segVal)}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs">
                          {/* Variação Total */}
                          <div className="text-left sm:text-right">
                            <span className="text-[10px] text-gray-500 uppercase font-bold block">Variação Total</span>
                            <span className={`font-black ${isTotalPos ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                              {isTotalPos ? '↑ ' : '↓ '}
                              {totalVarPct.toFixed(2)}% ({formatValue(totalVarVal)})
                            </span>
                          </div>

                          {/* Variação Hoje */}
                          <div className="text-left sm:text-right">
                            <span className="text-[10px] text-gray-500 uppercase font-bold block">Variação Hoje</span>
                            <span className={`font-black ${isTodayPos ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                              {isTodayPos ? '↑ ' : '↓ '}
                              {todayVarPct.toFixed(2)}% ({formatValue(todayVarVal)})
                            </span>
                          </div>

                          {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                        </div>
                      </div>

                      {/* Expanded Table */}
                      {isExpanded && (
                        <div className="p-4 overflow-x-auto">
                          {(() => {
                            const sortConfig = segmentSorts[seg] || { field: 'pctCart', direction: 'desc' };
                            const sortedSegAssets = [...segAssets].sort((a, b) => {
                              let valA = 0;
                              let valB = 0;

                              if (sortConfig.field === 'ticker') {
                                return sortConfig.direction === 'asc' 
                                  ? a.ticker.localeCompare(b.ticker) 
                                  : b.ticker.localeCompare(a.ticker);
                              }
                              if (sortConfig.field === 'category') {
                                return sortConfig.direction === 'asc'
                                  ? (a.category || '').localeCompare(b.category || '')
                                  : (b.category || '').localeCompare(a.category || '');
                              }
                              if (sortConfig.field === 'price') {
                                valA = a.currentPrice * (a.currency === 'USD' ? usdRate : 1);
                                valB = b.currentPrice * (b.currency === 'USD' ? usdRate : 1);
                              } else if (sortConfig.field === 'quantity') {
                                valA = a.quantity;
                                valB = b.quantity;
                              } else if (sortConfig.field === 'totalRent') {
                                const avgA = a.averagePrice || 0;
                                valA = avgA > 0 ? ((a.currentPrice - avgA) / avgA) * 100 : (a.returnPct || 0);
                                const avgB = b.averagePrice || 0;
                                valB = avgB > 0 ? ((b.currentPrice - avgB) / avgB) * 100 : (b.returnPct || 0);
                              } else if (sortConfig.field === 'todayRent') {
                                valA = a.priceChange24h || 0;
                                valB = b.priceChange24h || 0;
                              } else if (sortConfig.field === 'pctSeg') {
                                const curA = a.currency === 'USD' ? a.currentPrice * usdRate * a.quantity : a.currentPrice * a.quantity;
                                const curB = b.currency === 'USD' ? b.currentPrice * usdRate * b.quantity : b.currentPrice * b.quantity;
                                valA = segVal > 0 ? (curA / segVal) * 100 : 0;
                                valB = segVal > 0 ? (curB / segVal) * 100 : 0;
                              } else if (sortConfig.field === 'pctCart') {
                                const curA = a.currency === 'USD' ? a.currentPrice * usdRate * a.quantity : a.currentPrice * a.quantity;
                                const curB = b.currency === 'USD' ? b.currentPrice * usdRate * b.quantity : b.currentPrice * b.quantity;
                                valA = totalEquity > 0 ? (curA / totalEquity) * 100 : 0;
                                valB = totalEquity > 0 ? (curB / totalEquity) * 100 : 0;
                              }

                              return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
                            });

                            return (
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="border-b border-white/10 text-gray-400 font-black uppercase text-[10px]">
                                    <th 
                                      className="py-2.5 px-2 cursor-pointer hover:text-white transition select-none"
                                      onClick={() => handleSegmentSort(seg, 'ticker')}
                                    >
                                      <div className="flex items-center gap-1">
                                        Ativo
                                        {sortConfig.field === 'ticker' ? (
                                          sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D4AF37]" /> : <ArrowDown className="w-3 h-3 text-[#D4AF37]" />
                                        ) : (
                                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                                        )}
                                      </div>
                                    </th>
                                    <th 
                                      className="py-2.5 px-2 cursor-pointer hover:text-white transition select-none"
                                      onClick={() => handleSegmentSort(seg, 'category')}
                                    >
                                      <div className="flex items-center gap-1">
                                        Categoria
                                        {sortConfig.field === 'category' ? (
                                          sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D4AF37]" /> : <ArrowDown className="w-3 h-3 text-[#D4AF37]" />
                                        ) : (
                                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                                        )}
                                      </div>
                                    </th>
                                    <th 
                                      className="py-2.5 px-2 cursor-pointer hover:text-white transition select-none"
                                      onClick={() => handleSegmentSort(seg, 'price')}
                                    >
                                      <div className="flex items-center gap-1">
                                        Preço Atual
                                        {sortConfig.field === 'price' ? (
                                          sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D4AF37]" /> : <ArrowDown className="w-3 h-3 text-[#D4AF37]" />
                                        ) : (
                                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                                        )}
                                      </div>
                                    </th>
                                    <th 
                                      className="py-2.5 px-2 cursor-pointer hover:text-white transition select-none"
                                      onClick={() => handleSegmentSort(seg, 'quantity')}
                                    >
                                      <div className="flex items-center gap-1">
                                        Quantidade
                                        {sortConfig.field === 'quantity' ? (
                                          sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D4AF37]" /> : <ArrowDown className="w-3 h-3 text-[#D4AF37]" />
                                        ) : (
                                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                                        )}
                                      </div>
                                    </th>
                                    <th 
                                      className="py-2.5 px-2 cursor-pointer hover:text-white transition select-none"
                                      onClick={() => handleSegmentSort(seg, 'totalRent')}
                                    >
                                      <div className="flex items-center gap-1">
                                        Rent. Total
                                        {sortConfig.field === 'totalRent' ? (
                                          sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D4AF37]" /> : <ArrowDown className="w-3 h-3 text-[#D4AF37]" />
                                        ) : (
                                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                                        )}
                                      </div>
                                    </th>
                                    <th 
                                      className="py-2.5 px-2 cursor-pointer hover:text-white transition select-none"
                                      onClick={() => handleSegmentSort(seg, 'todayRent')}
                                    >
                                      <div className="flex items-center gap-1">
                                        Rent. Hoje
                                        {sortConfig.field === 'todayRent' ? (
                                          sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D4AF37]" /> : <ArrowDown className="w-3 h-3 text-[#D4AF37]" />
                                        ) : (
                                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                                        )}
                                      </div>
                                    </th>
                                    <th 
                                      className="py-2.5 px-2 cursor-pointer hover:text-white transition select-none"
                                      onClick={() => handleSegmentSort(seg, 'pctSeg')}
                                    >
                                      <div className="flex items-center gap-1">
                                        % no Segmento
                                        {sortConfig.field === 'pctSeg' ? (
                                          sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D4AF37]" /> : <ArrowDown className="w-3 h-3 text-[#D4AF37]" />
                                        ) : (
                                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                                        )}
                                      </div>
                                    </th>
                                    <th 
                                      className="py-2.5 px-2 text-right cursor-pointer hover:text-white transition select-none"
                                      onClick={() => handleSegmentSort(seg, 'pctCart')}
                                    >
                                      <div className="flex items-center justify-end gap-1">
                                        % na Carteira
                                        {sortConfig.field === 'pctCart' ? (
                                          sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D4AF37]" /> : <ArrowDown className="w-3 h-3 text-[#D4AF37]" />
                                        ) : (
                                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                                        )}
                                      </div>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                  {sortedSegAssets.map((a) => {
                                const currentVal =
                                  a.currency === 'USD' ? a.currentPrice * usdRate * a.quantity : a.currentPrice * a.quantity;
                                const assetPctCart = totalEquity > 0 ? (currentVal / totalEquity) * 100 : 0;
                                const assetPctSeg = segVal > 0 ? (currentVal / segVal) * 100 : 0;

                                const avg = a.averagePrice || 0;
                                const cur = a.currentPrice || 0;
                                const totalRentPct = avg > 0 ? ((cur - avg) / avg) * 100 : (a.returnPct || 0);
                                const isTotalRentPos = totalRentPct >= 0;

                                const todayChangePct = a.priceChange24h || 0;
                                const isTodayPos = todayChangePct >= 0;

                                return (
                                  <tr
                                    key={a.id}
                                    onClick={() => setSelectedAssetForDetail(a)}
                                    className="hover:bg-white/10 transition font-bold cursor-pointer group"
                                    title="Clique para ver Detalhes e Histórico de Transações"
                                  >
                                    <td className="py-2.5 px-2 text-white font-black flex items-center gap-1.5">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedAssetForDetail(a);
                                          setShowAssetTxDrawer(true);
                                        }}
                                        className="p-1 text-gray-400 hover:text-[#D4AF37] hover:bg-white/10 rounded transition"
                                        title="Ver Transações"
                                      >
                                        <MoreHorizontal className="w-3.5 h-3.5" />
                                      </button>
                                      <span>{a.ticker}</span>
                                    </td>
                                    <td className="py-2.5 px-2 text-gray-300">{CATEGORY_LABELS[a.category] || a.category}</td>
                                    <td className="py-2.5 px-2 text-white">
                                      {formatValue(a.currentPrice, a.currency === 'USD' ? 'US$ ' : 'R$ ')}
                                    </td>
                                    <td className="py-2.5 px-2 text-gray-300">{a.quantity} un.</td>
                                    <td className={`py-2.5 px-2 font-mono ${isTotalRentPos ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                                      {isTotalRentPos ? '+' : ''}{totalRentPct.toFixed(2)}%
                                    </td>
                                    <td className={`py-2.5 px-2 font-mono ${isTodayPos ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                                      {isTodayPos ? '+' : ''}{todayChangePct.toFixed(2)}%
                                    </td>
                                    <td className="py-2.5 px-2 text-[#D4AF37]">{assetPctSeg.toFixed(1)}%</td>
                                    <td className="py-2.5 px-2 text-right text-white font-black">{assetPctCart.toFixed(1)}%</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
          </>
          ) : (
            <p className="text-center py-6 text-gray-400">Nenhum dado encontrado</p>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 5: METAS (With Add, Edit, Delete options) */}
      {/* ========================================================================= */}
      {activeSubTab === 'metas' && (
        <div className="space-y-6">
          <div className="p-6 bg-[#18181B] border border-white/10 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-black uppercase text-white font-serif tracking-wider">Metas do Investidor</h3>
                <p className="text-xs text-gray-400">Acompanhe e gerencie a evolução das suas metas financeiras</p>
              </div>
              {!isReadOnly && (
                <button
                  onClick={handleOpenNewGoalModal}
                  className="px-3.5 py-2 bg-[#D4AF37] hover:bg-[#FACC15] text-[#121212] font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Nova Meta</span>
                </button>
              )}
            </div>

            <div className="space-y-4">
              {calculatedGoals.map((g: any) => {
                const pct = g.progressPercent || 0;
                const currentAmt = g.currentAmount || 0;
                return (
                  <div key={g.id} className="p-5 bg-[#121212] border border-[#D4AF37]/40 rounded-2xl space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-black uppercase text-[#D4AF37] tracking-wider">{g.category}</span>
                        <h4 className="text-base font-black text-white font-serif">{g.title}</h4>
                        {g.targetDate && <p className="text-xs text-gray-400 mt-0.5">Prazo estipulado: {g.targetDate}</p>}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-white">{pct}%</span>
                        {!isReadOnly && (
                          <>
                            <button
                              onClick={() => handleOpenEditGoalModal(g)}
                              className="p-1.5 bg-[#18181B] hover:bg-white/10 text-gray-300 border border-white/10 rounded-lg transition cursor-pointer"
                              title="Editar Meta"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteGoal(g.id);
                              }}
                              className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 rounded-lg transition cursor-pointer"
                              title="Excluir Meta"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="w-full h-3 bg-[#18181B] rounded-full overflow-hidden border border-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-[#FF5252] via-[#FACC15] to-[#00E676] rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-xs font-bold text-gray-300">
                      <span>Atual: {formatValue(currentAmt)}</span>
                      <span>Objetivo: {formatValue(g.targetAmount)}</span>
                    </div>
                  </div>
                );
              })}

              {goals.length === 0 && (
                <div className="py-8 text-center text-gray-400 text-xs">
                  Nenhuma meta cadastrada. Clique em "+ Nova Meta" para começar!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 6: TRANSAÇÕES (Interactive CRUD with Edit & Delete options) */}
      {/* ========================================================================= */}
      {activeSubTab === 'transacoes' && (
        <div className="p-6 bg-[#18181B] border border-white/10 rounded-2xl shadow-xl space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-white font-serif">Todas as transações</h2>
              <p className="text-xs text-gray-400">Histórico de compras e vendas de ativos</p>
            </div>

            <div className="flex items-center gap-2">
              {!isReadOnly && (
                <button
                  onClick={handleOpenNewTxModal}
                  className="px-3.5 py-2 bg-[#D4AF37] hover:bg-[#FACC15] text-[#121212] font-black text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Nova Transação</span>
                </button>
              )}

              <button
                onClick={() => setIsFilterModalOpen(true)}
                className="px-3.5 py-2 bg-[#121212] border border-white/20 hover:border-[#00E676] text-white hover:text-[#00E676] rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4 text-[#00E676]" />
                <span>Filtros</span>
              </button>
            </div>
          </div>

          {/* Search bar & control icons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#121212] p-3 rounded-2xl border border-white/10">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                value={txSearchTerm}
                onChange={(e) => setTxSearchTerm(e.target.value)}
                placeholder="Pesquise por ticker, corretora..."
                className="w-full bg-[#18181B] border border-white/20 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00E676]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={handleExportTransactionsPDF}
                className="p-2 bg-[#18181B] border border-white/10 hover:border-[#00E676] text-gray-300 rounded-xl transition cursor-pointer flex items-center gap-1.5 px-3"
                title="Baixar PDF de Transações"
              >
                <Download className="w-4 h-4 text-[#D4AF37]" />
                <span className="text-xs font-bold text-white">Baixar PDF</span>
              </button>
            </div>
          </div>

          {/* Transactions Table with Edit & Delete Options */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 font-black uppercase text-[10px]">
                  <th className="py-3 px-2">Data</th>
                  <th className="py-3 px-2">Ativo</th>
                  <th className="py-3 px-2">Categoria</th>
                  <th className="py-3 px-2">Tipo</th>
                  <th className="py-3 px-2">Qtd</th>
                  <th className="py-3 px-2">Preço Unit.</th>
                  <th className="py-3 px-2">Total</th>
                  <th className="py-3 px-2">Corretora</th>
                  {!isReadOnly && <th className="py-3 px-2 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/5 transition font-bold">
                    <td className="py-3 px-2 text-gray-400">{tx.date}</td>
                    <td className="py-3 px-2 font-black text-[#D4AF37]">{tx.assetTicker}</td>
                    <td className="py-3 px-2 text-gray-300">{CATEGORY_LABELS[tx.assetCategory] || tx.assetCategory}</td>
                    <td className="py-3 px-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          tx.type === 'buy'
                            ? 'bg-[#00C853]/20 text-[#00E676]'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {tx.type === 'buy' ? 'Compra' : 'Venda'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-white">{tx.quantity}</td>
                    <td className="py-3 px-2 text-gray-300">{formatValue(tx.unitPrice)}</td>
                    <td className="py-3 px-2 text-white">{formatValue(tx.totalAmount)}</td>
                    <td className="py-3 px-2 text-gray-400">{tx.broker}</td>
                    {!isReadOnly && (
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditTxModal(tx)}
                            className="p-1.5 bg-[#121212] hover:bg-white/10 text-gray-300 border border-white/20 rounded-lg transition cursor-pointer"
                            title="Editar Transação"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTx(tx.id)}
                            className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 rounded-lg transition cursor-pointer"
                            title="Excluir Transação"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}

                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-400 text-xs">
                      Nenhuma transação encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FILTROS MODAL (Matching Image 4) */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full sm:w-[480px] bg-[#121212] border border-white/20 rounded-t-3xl sm:rounded-3xl text-white shadow-2xl p-6 space-y-6 animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-black text-white font-serif">Filtros da Carteira</h3>
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Section: Período de Análise */}
            <div className="space-y-3">
              <label className="text-xs font-black text-gray-300 uppercase tracking-wider">Período de Análise</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'ALL', label: 'Desde o Início' },
                  { id: 'PREV_MONTH', label: 'Mês Anterior' },
                  { id: 'PREV_YEAR', label: 'Ano Anterior' },
                  { id: 'CUSTOM', label: 'Personalizado' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPeriod(p.id as any)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-black transition cursor-pointer border text-center ${
                      globalPeriodFilter === p.id
                        ? 'bg-[#00C853] text-[#121212] border-[#00C853] shadow-md'
                        : 'bg-[#18181B] text-gray-400 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {globalPeriodFilter === 'CUSTOM' && (
                <div className="p-3.5 bg-[#18181B] border border-[#00C853]/40 rounded-2xl space-y-3 mt-2">
                  <p className="text-xs font-bold text-[#00E676]">Selecione ou digite o intervalo de datas:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-400 font-bold block mb-1">Data Inicial (DD/MM/AAAA):</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="DD/MM/AAAA"
                          value={customStartText}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomStartText(val);
                            const iso = parseDateToISO(val);
                            if (iso) setCustomStartDate(iso);
                          }}
                          className="w-full bg-[#121212] border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00C853]"
                        />
                        <div className="relative w-8 h-8 bg-[#121212] border border-white/20 rounded-xl flex items-center justify-center cursor-pointer hover:border-[#00C853] transition flex-shrink-0">
                          <ChevronDown className="w-4 h-4 text-[#00C853] pointer-events-none" />
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomStartDate(val);
                              setCustomStartText(formatDateBRInput(val));
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            title="Selecionar no calendário"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 font-bold block mb-1">Data Final (DD/MM/AAAA):</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="DD/MM/AAAA"
                          value={customEndText}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomEndText(val);
                            const iso = parseDateToISO(val);
                            if (iso) setCustomEndDate(iso);
                          }}
                          className="w-full bg-[#121212] border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00C853]"
                        />
                        <div className="relative w-8 h-8 bg-[#121212] border border-white/20 rounded-xl flex items-center justify-center cursor-pointer hover:border-[#00C853] transition flex-shrink-0">
                          <ChevronDown className="w-4 h-4 text-[#00C853] pointer-events-none" />
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomEndDate(val);
                              setCustomEndText(formatDateBRInput(val));
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            title="Selecionar no calendário"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section: Tipo de Métrica */}
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-300 uppercase tracking-wider">Visualização</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPatMetricType('patrimonio')}
                  className={`py-2.5 rounded-xl text-xs font-black transition cursor-pointer border ${
                    patMetricType === 'patrimonio'
                      ? 'bg-[#00C853] text-[#121212] border-[#00C853]'
                      : 'bg-[#18181B] text-gray-400 border-white/10 hover:bg-white/10'
                  }`}
                >
                  Patrimônio
                </button>
                <button
                  onClick={() => setPatMetricType('investimento')}
                  className={`py-2.5 rounded-xl text-xs font-black transition cursor-pointer border ${
                    patMetricType === 'investimento'
                      ? 'bg-[#00C853] text-[#121212] border-[#00C853]'
                      : 'bg-[#18181B] text-gray-400 border-white/10 hover:bg-white/10'
                  }`}
                >
                  Investimento
                </button>
              </div>
            </div>

            {/* Section: Segmentos */}
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-300 uppercase tracking-wider">Segmentos</label>
              <div className="bg-[#18181B] border border-white/20 rounded-xl p-2.5 space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Pesquisar segmento..."
                    value={patSegmentSearch}
                    onChange={(e) => setPatSegmentSearch(e.target.value)}
                    className="w-full bg-[#121212] border border-white/20 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00C853]"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 no-scrollbar">
                  <div
                    onClick={() => {
                      setPatSegmentFilter(['completo']);
                      setFilterCategory('completo');
                    }}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs font-bold cursor-pointer transition ${
                      patSegmentFilter.includes('completo') ? 'bg-[#00C853]/20 text-[#00C853]' : 'hover:bg-white/5 text-gray-300'
                    }`}
                  >
                    <span>Completo (Todos os Segmentos)</span>
                    {patSegmentFilter.includes('completo') && <Check className="w-3.5 h-3.5 text-[#00C853]" />}
                  </div>

                  {availableSegments
                    .filter((seg) => seg.toLowerCase().includes(patSegmentSearch.toLowerCase()))
                    .map((seg) => {
                      const isSelected = patSegmentFilter.includes(seg);
                      return (
                        <div
                          key={seg}
                          onClick={() => {
                            let updated: string[];
                            if (patSegmentFilter.includes('completo')) {
                              updated = [seg];
                            } else if (isSelected) {
                              updated = patSegmentFilter.filter((c) => c !== seg);
                              if (updated.length === 0) updated = ['completo'];
                            } else {
                              updated = [...patSegmentFilter, seg];
                            }
                            setPatSegmentFilter(updated);
                            setFilterCategory(updated[0] || 'completo');
                          }}
                          className={`flex items-center justify-between p-2 rounded-lg text-xs font-bold cursor-pointer transition ${
                            isSelected ? 'bg-[#00C853]/20 text-[#00C853]' : 'hover:bg-white/5 text-gray-300'
                          }`}
                        >
                          <span>{seg}</span>
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-[#00C853] border-[#00C853] text-[#121212]' : 'border-white/30'}`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Button: Aplicar */}
            <button
              onClick={() => {
                if (globalPeriodFilter === 'CUSTOM') {
                  handleApplyCustomFilter();
                } else {
                  setAppliedPeriodFilter(globalPeriodFilter);
                }
                setIsFilterModalOpen(false);
              }}
              className="w-full py-3.5 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-sm rounded-xl shadow-xl transition cursor-pointer uppercase tracking-wider"
            >
              Aplicar Filtro
            </button>
          </div>
        </div>
      )}

      {/* GOAL MODAL (Add / Edit Goal) */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#121212] border border-[#D4AF37]/50 rounded-3xl text-white shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-black text-white font-serif">
                {editingGoal ? 'Editar Meta' : 'Nova Meta do Investidor'}
              </h3>
              <button
                onClick={() => setIsGoalModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGoalForm} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-300 font-bold mb-1">Título da Meta</label>
                <input
                  type="text"
                  value={goalForm.title}
                  onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                  placeholder="Ex: DESAFIO 15K"
                  required
                  className="w-full bg-[#18181B] border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Valor Objetivo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={goalForm.targetAmount}
                    onChange={(e) => setGoalForm({ ...goalForm, targetAmount: e.target.value })}
                    placeholder="15000"
                    required
                    className="w-full bg-[#18181B] border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Valor Atual (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={goalForm.currentAmount}
                    onChange={(e) => setGoalForm({ ...goalForm, currentAmount: e.target.value })}
                    placeholder="5557.25"
                    className="w-full bg-[#18181B] border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Data Inicial</label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={startDateText}
                      onChange={handleStartDateTextChange}
                      placeholder="dd/mm/aaaa"
                      maxLength={10}
                      className="w-full bg-[#18181B] border border-white/20 rounded-xl pl-3 pr-9 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
                    />
                    <button
                      type="button"
                      onClick={() => startDatePickerRef.current?.showPicker?.()}
                      className="absolute right-2 p-1 text-gray-400 hover:text-[#D4AF37]"
                      title="Abrir calendário"
                    >
                      <Calendar className="w-4 h-4" />
                    </button>
                    <input
                      ref={startDatePickerRef}
                      type="date"
                      value={goalForm.startDate}
                      onChange={(e) => {
                        const newIso = e.target.value;
                        setGoalForm({ ...goalForm, startDate: newIso });
                        setStartDateText(formatDateBRInput(newIso));
                      }}
                      className="sr-only absolute pointer-events-none opacity-0"
                      tabIndex={-1}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Prazo Meta</label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={targetDateText}
                      onChange={handleTargetDateTextChange}
                      placeholder="dd/mm/aaaa"
                      maxLength={10}
                      className="w-full bg-[#18181B] border border-white/20 rounded-xl pl-3 pr-9 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
                    />
                    <button
                      type="button"
                      onClick={() => targetDatePickerRef.current?.showPicker?.()}
                      className="absolute right-2 p-1 text-gray-400 hover:text-[#D4AF37]"
                      title="Abrir calendário"
                    >
                      <Calendar className="w-4 h-4" />
                    </button>
                    <input
                      ref={targetDatePickerRef}
                      type="date"
                      value={goalForm.targetDate}
                      onChange={(e) => {
                        const newIso = e.target.value;
                        setGoalForm({ ...goalForm, targetDate: newIso });
                        setTargetDateText(formatDateBRInput(newIso));
                      }}
                      className="sr-only absolute pointer-events-none opacity-0"
                      tabIndex={-1}
                    />
                  </div>
                </div>
              </div>

              {/* Asset Category Selection for Goals with Search */}
              <div className="relative" ref={goalCategoryContainerRef}>
                <label className="block text-gray-300 font-bold mb-1">Categoria do Ativo da Meta</label>
                <div
                  onClick={() => setIsGoalCategoryOpen(!isGoalCategoryOpen)}
                  className="w-full bg-[#18181B] border border-white/20 rounded-xl px-3 py-2.5 text-white flex items-center justify-between cursor-pointer hover:border-[#D4AF37] transition"
                >
                  <span className="truncate">{goalForm.category || 'Selecione a categoria'}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isGoalCategoryOpen ? 'rotate-180' : ''}`} />
                </div>

                {isGoalCategoryOpen && (
                  <div className="absolute z-40 top-full left-0 right-0 mt-1 bg-[#121212] border-2 border-[#D4AF37]/80 rounded-xl shadow-2xl max-h-60 overflow-hidden flex flex-col animate-in fade-in duration-150">
                    <div className="p-2 border-b border-white/10 bg-[#121212]">
                      <div className="relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          value={goalCategorySearch}
                          onChange={(e) => setGoalCategorySearch(e.target.value)}
                          placeholder="Pesquisar categoria..."
                          className="w-full bg-[#18181B] border border-white/20 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto divide-y divide-white/5 flex-1 max-h-48">
                      {[
                        'Patrimônio Total',
                        'Ações',
                        'FIIs',
                        'Tesouro Direto',
                        'Criptomoedas',
                        'Stocks',
                        'ETF Exterior',
                        'FIAGRO',
                        'BDR',
                        'ETF',
                        'Renda Fixa',
                        'Outros'
                      ]
                        .filter((cat) => cat.toLowerCase().includes((goalCategorySearch || '').toLowerCase()))
                        .map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              setGoalForm({ ...goalForm, category: cat });
                              setGoalCategorySearch('');
                              setIsGoalCategoryOpen(false);
                            }}
                            className={`w-full text-left px-4 py-3 text-xs sm:text-sm font-medium transition flex items-center justify-between cursor-pointer ${
                              goalForm.category === cat
                                ? 'bg-[#D4AF37]/20 text-[#D4AF37] font-bold'
                                : 'text-gray-200 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <span>{cat}</span>
                            {goalForm.category === cat && <span className="text-[#D4AF37] font-bold">✓</span>}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-4 py-2 bg-[#D4AF37] hover:bg-[#FACC15] text-[#121212] font-black rounded-xl ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Meta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Asset Modal */}
      <AddAssetModal
        isOpen={isAddModalOpen || isTxModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setIsTxModalOpen(false);
          setEditingTx(null);
        }}
        onSaveTransaction={handleSaveAssetTransaction}
        userId={userId}
        editingTransaction={editingTx}
      />

      {/* MODAL DE EDIÇÃO DOS PERCENTUAIS DESEJADOS (REQ 7) */}
      {isEditingTargetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#18181B] border-2 border-[#D4AF37] rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#D4AF37]/20 text-[#D4AF37] rounded-xl">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white font-serif">Editar Percentuais Desejados</h3>
                  <p className="text-[11px] text-gray-400">Ajuste as metas de alocação da sua carteira (Total ideal: 100%)</p>
                </div>
              </div>
              <button onClick={() => setIsEditingTargetModalOpen(false)} className="text-gray-400 hover:text-white p-1 font-bold cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-none">
              {editingAllocations.map((item, idx) => (
                <div key={item.id} className="p-3 bg-[#121212] border border-white/10 rounded-xl flex items-center justify-between gap-3">
                  <span className="text-xs font-black text-white font-serif">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={item.targetPct}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value));
                        const updated = [...editingAllocations];
                        updated[idx] = { ...updated[idx], targetPct: val };
                        setEditingAllocations(updated);
                      }}
                      className="w-20 bg-[#18181B] border border-white/20 text-white font-black text-center py-1.5 px-2 rounded-lg text-xs focus:border-[#D4AF37] outline-none"
                    />
                    <span className="text-xs font-bold text-gray-400">%</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
              <div className="text-xs">
                <span className="text-gray-400 font-bold">Soma Total: </span>
                <span className={`font-black ${editingAllocations.reduce((acc, curr) => acc + curr.targetPct, 0) === 100 ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                  {editingAllocations.reduce((acc, curr) => acc + curr.targetPct, 0)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingTargetModalOpen(false)}
                  className="py-2 px-4 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveTargetAllocations}
                  className="py-2 px-5 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs rounded-xl transition cursor-pointer shadow-lg"
                >
                  Salvar Percentuais
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Asset Detail & Transaction History Modal (Matching Image 2 - StatusInvest style) */}
      {selectedAssetForDetail && (() => {
        const a = selectedAssetForDetail;
        const usdRate = quotes.find((q) => q.symbol === 'USD/BRL')?.price || 5.06;
        const currentVal = a.currency === 'USD' ? a.currentPrice * usdRate * a.quantity : a.currentPrice * a.quantity;
        const avgVal = a.currency === 'USD' ? a.averagePrice * usdRate * a.quantity : a.averagePrice * a.quantity;
        const diffVal = currentVal - avgVal;
        const diffPct = a.averagePrice > 0 ? ((a.currentPrice - a.averagePrice) / a.averagePrice) * 100 : 0;
        const catTotal = assets.filter((x) => x.category === a.category).reduce((acc, curr) => {
          const v = curr.currency === 'USD' ? curr.currentPrice * usdRate * curr.quantity : curr.currentPrice * curr.quantity;
          return acc + v;
        }, 0);
        const pctInCat = catTotal > 0 ? (currentVal / catTotal) * 100 : 0;
        const pctInCart = totalEquity > 0 ? (currentVal / totalEquity) * 100 : 0;
        const assetTxs = transactions.filter(
          (t) => t.assetTicker === a.ticker || (t as any).ticker === a.ticker || (t as any).assetId === a.id
        );

        return (
          <div className="fixed inset-0 z-50 bg-[#121212]/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-[#18181B] border-2 border-[#D4AF37] rounded-3xl max-w-4xl w-full p-5 sm:p-6 space-y-6 animate-in fade-in shadow-2xl max-h-[92vh] overflow-y-auto">
              {/* Header (Matching Image 2) */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00BFA5]/20 border border-[#00BFA5] flex items-center justify-center text-[#00E676] font-black text-xs font-serif shadow-md">
                    {a.ticker.substring(0, 4)}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white font-serif">{a.ticker}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-black text-[#00E676]">
                        {formatValue(a.currentPrice, a.currency === 'USD' ? 'US$ ' : 'R$ ')}
                      </span>
                      {(() => {
                        const change24 = a.priceChange24h || 0;
                        return (
                          <span className={`text-xs font-bold ${change24 >= 0 ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                            ({change24 >= 0 ? '+' : ''}{change24.toFixed(2)}% hoje)
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Detalhes do Ativo & Detalhamento das Transações
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedAssetForDetail(null);
                    setShowAssetTxDrawer(false);
                  }}
                  className="text-gray-400 hover:text-white p-2 font-bold cursor-pointer bg-white/5 rounded-xl transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Visão Geral (Grid of 9 Metrics matching Image 2) */}
              <div className="p-4 bg-[#121212] border border-white/10 rounded-2xl space-y-3">
                <h4 className="text-xs font-black uppercase text-white tracking-wider font-serif border-b border-white/10 pb-2">
                  Visão Geral
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  {/* 1. Preço médio */}
                  <div className="space-y-0.5">
                    <span className="text-gray-400 font-bold block text-[11px]">Preço médio</span>
                    <p className="text-white font-black text-sm font-serif">
                      {formatValue(a.averagePrice, a.currency === 'USD' ? 'US$ ' : 'R$ ')}
                    </p>
                  </div>

                  {/* 2. Preço atual */}
                  <div className="space-y-0.5">
                    <span className="text-gray-400 font-bold block text-[11px]">Preço atual</span>
                    <p className="text-white font-black text-sm font-serif">
                      {formatValue(a.currentPrice, a.currency === 'USD' ? 'US$ ' : 'R$ ')}
                    </p>
                  </div>

                  {/* 3. Diferença */}
                  <div className="space-y-0.5">
                    <span className="text-gray-400 font-bold block text-[11px]">Diferença</span>
                    <p className={`font-black text-sm font-serif flex items-center gap-1 ${diffVal >= 0 ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                      {diffVal >= 0 ? '↑ ' : '↓ '}
                      {formatValue(Math.abs(diffVal))}
                    </p>
                  </div>

                  {/* 4. Quantidade */}
                  <div className="space-y-0.5">
                    <span className="text-gray-400 font-bold block text-[11px]">Quantidade</span>
                    <p className="text-white font-black text-sm font-serif">{a.quantity}</p>
                  </div>

                  {/* 5. Patrimônio */}
                  <div className="space-y-0.5">
                    <span className="text-gray-400 font-bold block text-[11px]">Patrimônio</span>
                    <p className="text-white font-black text-sm font-serif">{formatValue(currentVal)}</p>
                  </div>

                  {/* 6. Variação hoje */}
                  <div className="space-y-0.5">
                    <span className="text-gray-400 font-bold block text-[11px]">Variação hoje</span>
                    {(() => {
                      const change24 = a.priceChange24h || 0;
                      return (
                        <p className={`font-black text-sm font-serif ${change24 >= 0 ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                          {change24 >= 0 ? '+' : ''}{change24.toFixed(2)}%
                        </p>
                      );
                    })()}
                  </div>

                  {/* 7. Variação total */}
                  <div className="space-y-0.5">
                    <span className="text-gray-400 font-bold block text-[11px]">Variação total</span>
                    <p className={`font-black text-sm font-serif ${diffPct >= 0 ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                      {diffPct >= 0 ? '+' : ''}{diffPct.toFixed(2)}%
                    </p>
                  </div>

                  {/* 8. % em Categoria */}
                  <div className="space-y-0.5">
                    <span className="text-gray-400 font-bold block text-[11px]">% em {CATEGORY_LABELS[a.category]}</span>
                    <p className="text-[#D4AF37] font-black text-sm font-serif">{pctInCat.toFixed(2)}%</p>
                  </div>

                  {/* 9. % na carteira */}
                  <div className="space-y-0.5">
                    <span className="text-gray-400 font-bold block text-[11px]">% na carteira</span>
                    <p className="text-white font-black text-sm font-serif">{pctInCart.toFixed(2)}%</p>
                  </div>
                </div>
              </div>

              {/* Price Evolution Chart */}
              <div className="p-4 bg-[#121212] border border-white/10 rounded-2xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-300">Evolução da Cotação</span>
                  {(() => {
                    const change24 = a.priceChange24h || 0;
                    return (
                      <span className={`font-black ${change24 >= 0 ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                        {change24 >= 0 ? '+' : ''}{change24.toFixed(2)}% (24h)
                      </span>
                    );
                  })()}
                </div>

                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={[
                        { date: 'Jan/2026', price: a.averagePrice * 0.9 },
                        { date: 'Fev/2026', price: a.averagePrice * 0.95 },
                        { date: 'Mar/2026', price: a.averagePrice * 1.02 },
                        { date: 'Abr/2026', price: a.averagePrice },
                        { date: 'Mai/2026', price: a.currentPrice * 0.98 },
                        { date: 'Jun/2026', price: a.currentPrice * 0.99 },
                        { date: 'Jul/2026', price: a.currentPrice * 1.01 },
                        { date: 'Ago/2026', price: a.currentPrice },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                      <XAxis dataKey="date" stroke="#A1A1AA" fontSize={11} />
                      <YAxis stroke="#A1A1AA" fontSize={11} domain={['auto', 'auto']} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const val = payload[0].value;
                            return (
                              <div className="bg-[#121212] border border-[#00E676] p-2.5 rounded-xl text-xs space-y-1 shadow-2xl">
                                <p className="text-gray-400 font-bold">Data: <span className="text-white font-black">{label}</span></p>
                                <p className="text-[#00E676] font-black">Preço: <span className="text-white">R$ {Number(val).toFixed(2)}</span></p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area type="monotone" dataKey="price" stroke="#00E676" fill="#00E676" fillOpacity={0.15} strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Transações Section (Matching Image 2) */}
              <div className="p-4 bg-[#121212] border border-white/10 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <h4 className="text-xs font-black uppercase text-white tracking-wider font-serif">
                    Transações ({a.ticker})
                  </h4>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400 font-black uppercase text-[10px]">
                        <th className="py-2.5 px-3">Ordem</th>
                        <th className="py-2.5 px-3">Corretora</th>
                        <th className="py-2.5 px-3">Negociação</th>
                        <th className="py-2.5 px-3">Quantidade</th>
                        <th className="py-2.5 px-3">Preço (R$)</th>
                        <th className="py-2.5 px-3">Total (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {assetTxs.map((t) => {
                        const isBuy = t.type === 'buy' || (t.type as any) === 'BUY';
                        const uPrice = t.unitPrice || (t as any).price || 0;
                        const tVal = t.totalAmount || (t as any).totalValue || (uPrice * t.quantity);
                        return (
                          <tr key={t.id} className="hover:bg-white/5 transition font-bold">
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  isBuy ? 'bg-[#00C853]/20 text-[#00E676]' : 'bg-red-500/20 text-red-400'
                                }`}
                              >
                                {isBuy ? 'Compra' : 'Venda'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-[#D4AF37] uppercase">{t.broker || 'RICO INVESTIMENTOS'}</td>
                            <td className="py-2.5 px-3 text-gray-300">{t.date}</td>
                            <td className="py-2.5 px-3 text-white font-bold">{t.quantity}</td>
                            <td className="py-2.5 px-3 text-white">R$ {uPrice.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-white font-black font-serif">R$ {tVal.toFixed(2)}</td>
                          </tr>
                        );
                      })}

                      {assetTxs.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-gray-500 text-xs">
                            Nenhuma transação individual registrada para {a.ticker}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination (Matching Image 2) */}
                <div className="flex items-center justify-end gap-3 text-xs text-gray-400 pt-2 border-t border-white/5">
                  <span>5 por página</span>
                  <div className="flex items-center gap-1 font-bold">
                    <button className="px-2 py-1 bg-white/5 rounded hover:bg-white/10 cursor-pointer">&lt;</button>
                    <span className="px-2 py-1 bg-[#D4AF37] text-[#121212] rounded font-black">1</span>
                    <button className="px-2 py-1 bg-white/5 rounded hover:bg-white/10 cursor-pointer">&gt;</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* AIPortfolioModal for Sem Filtro Persona Analysis */}
      <AIPortfolioModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        advice={aiAdvice}
        onRefreshAIAdvice={fetchSemFiltroPortfolioAnalysis}
        isGenerating={isGeneratingAIAdvice}
        assets={assets}
        totalEquity={totalEquity}
      />

      {/* Delete Confirmation Modal for Transactions */}
      {deletingTxId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeletingTxId(null);
          }}
        >
          <div className="bg-[#18181B] text-white border-2 border-[#D4AF37] w-full max-w-sm rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center gap-5">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white mb-1">
                Deseja realmente excluir?
              </h3>
            </div>
            <div className="flex items-center justify-center gap-3 w-full pt-1">
              <button
                type="button"
                onClick={() => setDeletingTxId(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-white/20 text-xs font-bold text-gray-300 hover:bg-white/10 transition cursor-pointer"
              >
                Não
              </button>
              <button
                type="button"
                onClick={confirmDeleteTx}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs transition cursor-pointer shadow-md"
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Goals */}
      {deletingGoalId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeletingGoalId(null);
          }}
        >
          <div className="bg-[#18181B] text-white border-2 border-[#D4AF37] w-full max-w-sm rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center gap-5">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white mb-1">
                Deseja realmente excluir?
              </h3>
            </div>
            <div className="flex items-center justify-center gap-3 w-full pt-1">
              <button
                type="button"
                onClick={() => setDeletingGoalId(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-white/20 text-xs font-bold text-gray-300 hover:bg-white/10 transition cursor-pointer"
              >
                Não
              </button>
              <button
                type="button"
                onClick={confirmDeleteGoal}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs transition cursor-pointer shadow-md"
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      )}

      <CustomAlertModal
        isOpen={!!portfolioAlert?.isOpen}
        message={portfolioAlert?.message || ''}
        title={portfolioAlert?.title}
        type={portfolioAlert?.type || 'info'}
        onClose={() => {
          setPortfolioAlert(null);
          loadData();
          window.dispatchEvent(new Event('portfolio_updated'));
          window.dispatchEvent(new Event('remote_data_updated'));
          window.dispatchEvent(new CustomEvent('financial_data_mutated'));
        }}
      />
    </div>
  );
};
