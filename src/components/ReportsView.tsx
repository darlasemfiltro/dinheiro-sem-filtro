import React, { useState, useMemo } from 'react';
import { Account, Category, FamilyMember, MonthSummary, Subcategory, Transaction, User } from '../types';
import { formatCurrency, formatDateBR, getMonthYearLabel, flattenSubcategories, getSubcategoryIdsTree, findSubcategoryById } from '../utils/finance';
import { FileSpreadsheet, Download, Printer, Filter, Calendar, FolderTree, Wallet, CheckCircle2, UserCheck, Plus, Minus, ChevronRight, RotateCcw, Search, ChevronDown, X, Check } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import darlaLogoImg from '../assets/images/darla_logo_1785015447784.jpg';

// Helper to convert logo image to a circular PNG base64 Data URL with gold border
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

        // Draw outer gold ring
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#D4AF37';
        ctx.fill();

        // Inner circle clip
        const ringWidth = 8;
        const innerRadius = size / 2 - ringWidth;
        ctx.save();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, innerRadius, 0, Math.PI * 2);
        ctx.clip();

        // Draw logo image
        ctx.drawImage(img, ringWidth, ringWidth, innerRadius * 2, innerRadius * 2);
        ctx.restore();

        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };

    const tryFallback = () => {
      const img2 = new Image();
      img2.crossOrigin = 'Anonymous';
      img2.onload = () => {
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
          ctx.drawImage(img2, ringWidth, ringWidth, innerRadius * 2, innerRadius * 2);
          ctx.restore();
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(null);
        }
      };
      img2.onerror = () => resolve(null);
      img2.src = '/logo.png';
    };

    img.onerror = tryFallback;
    img.src = darlaLogoImg;
  });
};

// Recursive Subcategory Node component for reports
interface SubcategoryTreeNodeProps {
  sub: Subcategory;
  transactions: Transaction[];
  depth?: number;
}

const SubcategoryTreeNode: React.FC<SubcategoryTreeNodeProps> = ({ sub, transactions, depth = 0 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const childSubs = sub.subcategories || [];

  const subtreeIds = useMemo(() => getSubcategoryIdsTree(sub), [sub]);

  const subTxList = useMemo(() => {
    return transactions.filter((t) => t.subcategoryId && subtreeIds.includes(t.subcategoryId));
  }, [transactions, subtreeIds]);

  const totalAmount = subTxList.reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className={`space-y-2 ${depth > 0 ? 'ml-1.5 sm:ml-3 pl-1.5 sm:pl-2.5 border-l-2 border-[#D4AF37]' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-xs transition border border-gray-200 gap-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {childSubs.length > 0 ? (
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="p-1 text-[#121212] bg-white hover:bg-gray-200 rounded-lg transition border border-gray-200 cursor-pointer flex items-center justify-center shrink-0"
              title={isOpen ? 'Recolher subcategorias' : 'Expandir subcategorias'}
            >
              {isOpen ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            </button>
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 ml-0.5" />
          )}

          <span className="font-bold text-[#121212] truncate max-w-[160px] sm:max-w-xs">{sub.name}</span>
          <span className="text-[10px] text-gray-500 font-medium shrink-0">
            ({subTxList.length})
          </span>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-200">
          <span className="font-extrabold text-[#121212]">
            {formatCurrency(totalAmount)}
          </span>
          {childSubs.length > 0 && (
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#D4AF37]/20 hover:bg-[#D4AF37]/40 text-[#121212] transition cursor-pointer shrink-0"
            >
              {isOpen ? 'Ocultar' : `Mais (${childSubs.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Child Subcategories recursively */}
      {isOpen && childSubs.length > 0 && (
        <div className="space-y-2 mt-1">
          {childSubs.map((child) => (
            <SubcategoryTreeNode
              key={child.id}
              sub={child}
              transactions={transactions}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Main Category Accordion component
interface CategoryTreeAccordionProps {
  category: Category;
  transactions: Transaction[];
}

const CategoryTreeAccordion: React.FC<CategoryTreeAccordionProps> = ({ category, transactions }) => {
  const [isOpen, setIsOpen] = useState(false);

  const catTxList = useMemo(() => {
    return transactions.filter((t) => t.categoryId === category.id);
  }, [transactions, category.id]);

  const totalAmount = catTxList.reduce((acc, t) => acc + t.amount, 0);
  const subcategories = category.subcategories || [];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-3 sm:p-4 shadow-2xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#121212] font-bold text-xs shadow-2xs shrink-0"
            style={{ backgroundColor: category.color || '#D4AF37' }}
          >
            {category.name.charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm font-extrabold text-[#121212] truncate">{category.name}</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-800 shrink-0">
                {category.type === 'expense' ? 'Despesa' : 'Receita'}
              </span>
            </div>
            <p className="text-[11px] text-gray-600">
              {catTxList.length} lançamento{catTxList.length !== 1 ? 's' : ''} registrado{catTxList.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
          <div className="text-left sm:text-right">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Subtotal</span>
            <span className="text-sm font-extrabold text-[#121212]">
              {formatCurrency(totalAmount)}
            </span>
          </div>

          {subcategories.length > 0 && (
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="py-1.5 px-3 bg-gray-50 hover:bg-gray-100 text-[#121212] border border-gray-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
            >
              {isOpen ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{isOpen ? 'Recolher' : `Mais (${subcategories.length})`}</span>
            </button>
          )}
        </div>
      </div>

      {/* Expanded Subcategories Tree */}
      {isOpen && subcategories.length > 0 && (
        <div className="pt-3 border-t border-gray-100 space-y-2">
          <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider block mb-2">
            Subcategorias & Sub-subcategorias
          </span>
          {subcategories.map((sub) => (
            <SubcategoryTreeNode
              key={sub.id}
              sub={sub}
              transactions={catTxList}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface ReportsViewProps {
  summary: MonthSummary;
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  familyMembers?: FamilyMember[];
  currentYear: number;
  currentMonth: number;
  user: User;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  summary,
  transactions,
  accounts,
  categories,
  familyMembers = [],
  currentYear,
  currentMonth,
  user,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  // Filter States
  const [periodType, setPeriodType] = useState<
    'current_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'year' | 'last_12_months' | 'last_2_years' | 'all_time' | 'custom'
  >('current_month');
  const [startDate, setStartDate] = useState<string>(`${currentYear}-${String(currentMonth).padStart(2, '0')}-01`);
  const [endDate, setEndDate] = useState<string>(`${currentYear}-${String(currentMonth).padStart(2, '0')}-31`);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<string[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [selectedAccountTypes, setSelectedAccountTypes] = useState<string[]>([]);
  const [selectedTxTypes, setSelectedTxTypes] = useState<string[]>([]);
  const [selectedFamilyMemberIds, setSelectedFamilyMemberIds] = useState<string[]>([]);

  // Active filter modal state for picker modals
  const [activeFilterModal, setActiveFilterModal] = useState<
    'period' | 'txType' | 'category' | 'subcategory' | 'account' | 'accountType' | 'family' | null
  >(null);
  const [modalSearch, setModalSearch] = useState('');

  const allFlatSubcategories = useMemo(() => {
    return categories.flatMap((c) =>
      flattenSubcategories(c.subcategories).map((sub) => ({
        ...sub,
        categoryId: c.id,
        fullPath: `${c.name} › ${sub.fullPath}`,
      }))
    );
  }, [categories]);

  // Allowed subcategories tree set
  const allowedSubcategoryIds = useMemo(() => {
    if (selectedSubcategoryIds.length === 0) return null;
    const allSubs = categories.flatMap((c) => c.subcategories || []);
    const idSet = new Set<string>();
    for (const subId of selectedSubcategoryIds) {
      idSet.add(subId);
      const targetObj = findSubcategoryById(allSubs, subId);
      if (targetObj) {
        getSubcategoryIdsTree(targetObj).forEach((id) => idSet.add(id));
      }
    }
    return idSet;
  }, [selectedSubcategoryIds, categories]);

  // Clear Filter Action
  const handleClearFilters = () => {
    setPeriodType('current_month');
    setStartDate(`${currentYear}-${String(currentMonth).padStart(2, '0')}-01`);
    setEndDate(`${currentYear}-${String(currentMonth).padStart(2, '0')}-31`);
    setSelectedCategoryIds([]);
    setSelectedSubcategoryIds([]);
    setSelectedAccountIds([]);
    setSelectedAccountTypes([]);
    setSelectedTxTypes([]);
    setSelectedFamilyMemberIds([]);
  };

  // Helper to toggle multi selection
  const toggleMultiFilter = (
    id: string,
    currentList: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (currentList.includes(id)) {
      setList(currentList.filter((item) => item !== id));
    } else {
      setList([...currentList, id]);
    }
  };

  // Filtered Transactions Calculation
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Period filter
      if (periodType === 'current_month') {
        const [y, m] = tx.date.split('-').map(Number);
        if (y !== currentYear || m !== currentMonth) return false;
      } else if (periodType === 'last_month') {
        const lastM = currentMonth === 1 ? 12 : currentMonth - 1;
        const lastY = currentMonth === 1 ? currentYear - 1 : currentYear;
        const [y, m] = tx.date.split('-').map(Number);
        if (y !== lastY || m !== lastM) return false;
      } else if (periodType === 'last_3_months') {
        const dateLimit = new Date(currentYear, currentMonth - 3, 1).toISOString().slice(0, 10);
        if (tx.date < dateLimit) return false;
      } else if (periodType === 'last_6_months') {
        const dateLimit = new Date(currentYear, currentMonth - 6, 1).toISOString().slice(0, 10);
        if (tx.date < dateLimit) return false;
      } else if (periodType === 'year') {
        const [y] = tx.date.split('-').map(Number);
        if (y !== currentYear) return false;
      } else if (periodType === 'last_12_months') {
        const dateLimit = new Date(currentYear - 1, currentMonth - 1, 1).toISOString().slice(0, 10);
        if (tx.date < dateLimit) return false;
      } else if (periodType === 'last_2_years') {
        const dateLimit = new Date(currentYear - 2, currentMonth - 1, 1).toISOString().slice(0, 10);
        if (tx.date < dateLimit) return false;
      } else if (periodType === 'all_time') {
        // Sem limite - Todo o histórico de lançamentos
      } else if (periodType === 'custom') {
        if (startDate && tx.date < startDate) return false;
        if (endDate && tx.date > endDate) return false;
      }

      // Category filter (multi-select)
      if (selectedCategoryIds.length > 0 && !selectedCategoryIds.includes(tx.categoryId)) {
        return false;
      }

      // Subcategory filter with tree inheritance (multi-select)
      if (allowedSubcategoryIds && (!tx.subcategoryId || !allowedSubcategoryIds.has(tx.subcategoryId))) {
        return false;
      }

      // Account filter (multi-select)
      if (selectedAccountIds.length > 0 && !selectedAccountIds.includes(tx.accountId)) {
        return false;
      }

      // Account Type filter (multi-select)
      if (selectedAccountTypes.length > 0) {
        const acc = accounts.find((a) => a.id === tx.accountId);
        if (!acc || !selectedAccountTypes.includes(acc.type)) return false;
      }

      // Transaction Type filter (multi-select)
      if (selectedTxTypes.length > 0 && !selectedTxTypes.includes(tx.type)) return false;

      // Family Member filter (multi-select)
      if (selectedFamilyMemberIds.length > 0) {
        if (!tx.familyMemberId || !selectedFamilyMemberIds.includes(tx.familyMemberId)) return false;
      }

      return true;
    });
  }, [
    transactions,
    periodType,
    currentYear,
    currentMonth,
    startDate,
    endDate,
    selectedCategoryIds,
    selectedSubcategoryIds,
    allowedSubcategoryIds,
    selectedAccountIds,
    selectedAccountTypes,
    selectedTxTypes,
    selectedFamilyMemberIds,
    accounts,
  ]);

  // Calculate Filtered Totals
  const totalFilteredIncome = filteredTransactions
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalFilteredExpenses = filteredTransactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const filteredNetBalance = totalFilteredIncome - totalFilteredExpenses;

  // Export PDF Handler using jsPDF
  const handleExportPDF = async () => {
    setIsGenerating(true);

    try {
      const logoDataUrl = await loadLogoAsDataUrl();

      const doc = new jsPDF();
      const periodLabel =
        periodType === 'current_month'
          ? getMonthYearLabel(currentYear, currentMonth)
          : periodType === 'last_month'
          ? 'Mês Anterior'
          : periodType === 'last_3_months'
          ? 'Últimos 3 Meses'
          : periodType === 'last_6_months'
          ? 'Semestre (Últimos 6 Meses)'
          : periodType === 'year'
          ? `Ano ${currentYear}`
          : periodType === 'last_12_months'
          ? '1 Ano (Últimos 12 Meses)'
          : periodType === 'last_2_years'
          ? '2 Anos (Últimos 24 Meses)'
          : periodType === 'all_time'
          ? 'Sem Limite (Todo o Histórico)'
          : `${formatDateBR(startDate)} a ${formatDateBR(endDate)}`;

      // PDF Brand Header - Preto Atitude (#121212) with Gold Line (#D4AF37)
      doc.setFillColor(18, 18, 18); // Preto Atitude #121212
      doc.rect(0, 0, 210, 32, 'F');

      // Gold Accent Bar at bottom of header
      doc.setFillColor(212, 175, 55); // Amarelo Escuro Mostarda #D4AF37
      doc.rect(0, 30.5, 210, 1.5, 'F');

      let textStartX = 14;

      if (logoDataUrl) {
        try {
          doc.addImage(logoDataUrl, 'PNG', 12, 5.5, 20, 20);
          textStartX = 36;
        } catch (e) {
          console.warn('Failed to render logo in PDF:', e);
        }
      }

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('DINHEIRO SEM FILTRO', textStartX, 16);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(212, 175, 55); // Gold
      doc.text(`Relatório Financeiro Filtrado • ${periodLabel}`, textStartX, 24);

      doc.setTextColor(220, 220, 220);
      doc.text(`Usuário: ${user.name}`, 135, 24);

      // Financial Summary Box - Off White (#FAFAFA) with Gold Border (#D4AF37)
      doc.setFillColor(250, 250, 250);
      doc.rect(14, 38, 182, 28, 'F');
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.4);
      doc.rect(14, 38, 182, 28, 'S');

      // Left Accent Strip on Summary Box - Verde Realidade (#00C853)
      doc.setFillColor(0, 200, 83);
      doc.rect(14, 38, 3, 28, 'F');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 150, 60); // Green for Receitas
      doc.text(`(+) Total Receitas: ${formatCurrency(totalFilteredIncome)}`, 22, 48);

      doc.setTextColor(213, 0, 0); // Red for Despesas
      doc.text(`(-) Total Despesas: ${formatCurrency(totalFilteredExpenses)}`, 22, 56);

      doc.setTextColor(18, 18, 18); // Preto Atitude
      doc.text(`(=) Resultado Líquido: ${formatCurrency(filteredNetBalance)}`, 110, 48);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(`Total de Registros: ${filteredTransactions.length}`, 110, 56);

      const sanitizePdfText = (str: string): string => {
        if (!str) return '';
        return str
          .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      };

      // Transactions Table
      const tableRows = filteredTransactions.map((tx) => {
        const cat = categories.find((c) => c.id === tx.categoryId);
        const sub = cat?.subcategories.find((s) => s.id === tx.subcategoryId);
        const acc = accounts.find((a) => a.id === tx.accountId);
        const fam = familyMembers.find((f) => f.id === tx.familyMemberId);

        const catSubStr = cat
          ? sub
            ? `${cat.name} / ${sub.name}`
            : cat.name
          : 'Geral';

        return [
          formatDateBR(tx.date),
          sanitizePdfText(tx.description),
          sanitizePdfText(catSubStr),
          sanitizePdfText(acc ? acc.name : 'Conta'),
          sanitizePdfText(tx.familyMemberName || fam?.name || 'Geral'),
          tx.isConsolidated ? 'Efetivado' : 'Previsto',
          `${tx.type === 'income' ? '+' : '-'} ${formatCurrency(tx.amount)}`,
        ];
      });

      autoTable(doc, {
        startY: 72,
        head: [['Data', 'Descrição', 'Cat / Subcat', 'Conta', 'Membro', 'Status', 'Valor']],
        body: tableRows,
        theme: 'striped',
        rowPageBreak: 'avoid',
        margin: { top: 38, bottom: 20 },
        styles: {
          font: 'helvetica',
          fontStyle: 'normal',
          fontSize: 8,
          overflow: 'linebreak',
          textColor: [18, 18, 18],
        },
        headStyles: {
          font: 'helvetica',
          fontStyle: 'bold',
          fillColor: [18, 18, 18], // Preto Atitude #121212
          textColor: [212, 175, 55], // Amarelo Escuro Mostarda #D4AF37
          fontSize: 8.5,
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250],
        },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 38 },
          2: { cellWidth: 44 },
          3: { cellWidth: 28 },
          4: { cellWidth: 20 },
          5: { cellWidth: 16 },
          6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
        },
        didParseCell: (data) => {
          data.cell.styles.font = 'helvetica';
          if (data.section === 'body') {
            if (data.column.index === 6) {
              const valStr = String(data.cell.raw || '');
              if (valStr.startsWith('+')) {
                data.cell.styles.textColor = [0, 200, 83]; // Verde #00C853
                data.cell.styles.fontStyle = 'bold';
              } else if (valStr.startsWith('-')) {
                data.cell.styles.textColor = [255, 61, 0]; // Vermelho #FF3D00
                data.cell.styles.fontStyle = 'bold';
              }
            }
            if (data.column.index === 5) {
              const statusStr = String(data.cell.raw || '');
              if (statusStr === 'Efetivado') {
                data.cell.styles.textColor = [0, 150, 60];
              } else {
                data.cell.styles.textColor = [180, 100, 0];
              }
            }
          }
        },
      });

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text(
          `Gerado por DINHEIRO SEM FILTRO em ${new Date().toLocaleDateString('pt-BR')} - Página ${i} de ${pageCount}`,
          14,
          285
        );
      }

      doc.save(`DINHEIRO_SEM_FILTRO_Relatorio.pdf`);
    } catch (err) {
      console.error('PDF generation error', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 pb-12" id="reports-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-gray-200 rounded-3xl p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#D4AF37]" />
            <h1 className="text-lg font-bold text-[#121212]">Relatórios & Download PDF</h1>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Filtre por categoria, subcategoria, tipo de conta, período e contas específicas para baixar demonstrativos sob medida em PDF
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportPDF}
            disabled={isGenerating}
            className="min-h-[42px] sm:min-h-[44px] py-2.5 px-4 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border border-[#00A843] shrink-0"
          >
            <Download className="w-4 h-4 stroke-[3] shrink-0" />
            <span>{isGenerating ? 'Gerando PDF...' : 'Baixar Relatório PDF'}</span>
          </button>
        </div>
      </div>

      {/* Download Options & Filters Card */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#D4AF37]" />
            <h2 className="text-sm font-bold text-[#121212]">Opções e Filtros de Exportação</h2>
          </div>
          <button
            type="button"
            onClick={handleClearFilters}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-[#121212] border border-gray-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs hover:shadow-xs"
            id="btn-limpar-filtros-exportacao"
            title="Restaurar todos os filtros para o padrão"
          >
            <RotateCcw className="w-3.5 h-3.5 text-gray-700 shrink-0" />
            <span>Limpar Filtro</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Filter 1: Period Selection */}
          <div>
            <label className="text-xs font-semibold text-[#121212] block mb-1">Período de Análise</label>
            <button
              type="button"
              onClick={() => {
                setActiveFilterModal('period');
                setModalSearch('');
              }}
              className="w-full px-3 py-2 bg-gray-50 hover:bg-amber-50/50 border border-gray-300 hover:border-[#D4AF37] rounded-xl text-xs text-[#121212] flex items-center justify-between transition cursor-pointer font-semibold shadow-2xs"
            >
              <span className="truncate">
                {periodType === 'current_month' && `Mês Atual (${getMonthYearLabel(currentYear, currentMonth)})`}
                {periodType === 'last_month' && 'Mês Anterior'}
                {periodType === 'last_3_months' && 'Últimos 3 Meses'}
                {periodType === 'last_6_months' && 'Semestre (Últimos 6 Meses)'}
                {periodType === 'year' && `Ano Atual (${currentYear})`}
                {periodType === 'last_12_months' && '1 Ano (Últimos 12 Meses)'}
                {periodType === 'last_2_years' && '2 Anos (Últimos 24 Meses)'}
                {periodType === 'all_time' && 'Sem Limite (Todo o Histórico)'}
                {periodType === 'custom' && 'Período Personalizado 🗓️'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0 ml-1" />
            </button>
          </div>

          {/* Custom Date Range inputs if periodType === 'custom' */}
          {periodType === 'custom' && (
            <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-[#121212] block mb-1">Data Inicial</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#121212] block mb-1">Data Final</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
              </div>
            </div>
          )}

          {/* Filter 2: Transaction Type (Multi-select) */}
          <div>
            <label className="text-xs font-semibold text-[#121212] block mb-1">Tipo de Lançamento</label>
            <button
              type="button"
              onClick={() => {
                setActiveFilterModal('txType');
                setModalSearch('');
              }}
              className="w-full px-3 py-2 bg-gray-50 hover:bg-amber-50/50 border border-gray-300 hover:border-[#D4AF37] rounded-xl text-xs text-[#121212] flex items-center justify-between transition cursor-pointer font-semibold shadow-2xs"
            >
              <span className="truncate">
                {selectedTxTypes.length === 0 || selectedTxTypes.length === 3
                  ? 'Todos os Tipos (Receitas & Despesas)'
                  : selectedTxTypes.length === 1
                  ? selectedTxTypes[0] === 'income'
                    ? 'Apenas Receitas (+)'
                    : selectedTxTypes[0] === 'expense'
                    ? 'Apenas Despesas (-)'
                    : 'Apenas Transferências (↔)'
                  : `${selectedTxTypes.length} Tipos selecionados`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0 ml-1" />
            </button>
          </div>

          {/* Filter 3: Category (Multi-select) */}
          <div>
            <label className="text-xs font-semibold text-[#121212] block mb-1">Categoria</label>
            <button
              type="button"
              onClick={() => {
                setActiveFilterModal('category');
                setModalSearch('');
              }}
              className="w-full px-3 py-2 bg-gray-50 hover:bg-amber-50/50 border border-gray-300 hover:border-[#D4AF37] rounded-xl text-xs text-[#121212] flex items-center justify-between transition cursor-pointer font-semibold shadow-2xs"
            >
              <span className="truncate">
                {selectedCategoryIds.length === 0 || selectedCategoryIds.length === categories.length
                  ? 'Todas as Categorias'
                  : selectedCategoryIds.length === 1
                  ? categories.find((c) => selectedCategoryIds.includes(c.id))?.name || '1 Categoria'
                  : `${selectedCategoryIds.length} Categorias selecionadas`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0 ml-1" />
            </button>
          </div>

          {/* Filter 4: Subcategory & Sub-subcategory (+) (Multi-select) */}
          <div>
            <label className="text-xs font-semibold text-[#121212] block mb-1">
              Subcategoria & Nível (+)
            </label>
            <button
              type="button"
              onClick={() => {
                setActiveFilterModal('subcategory');
                setModalSearch('');
              }}
              className="w-full px-3 py-2 bg-gray-50 hover:bg-amber-50/50 border border-gray-300 hover:border-[#D4AF37] rounded-xl text-xs text-[#121212] flex items-center justify-between transition cursor-pointer font-semibold shadow-2xs text-left"
            >
              <span className="truncate">
                {selectedSubcategoryIds.length === 0 || selectedSubcategoryIds.length === allFlatSubcategories.length
                  ? 'Todas as Subcategorias'
                  : selectedSubcategoryIds.length === 1
                  ? allFlatSubcategories.find((s) => selectedSubcategoryIds.includes(s.id))?.fullPath || '1 Subcategoria'
                  : `${selectedSubcategoryIds.length} Subcategorias selecionadas`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0 ml-1" />
            </button>
          </div>

          {/* Filter 5: Accounts (Multi-select) */}
          <div>
            <label className="text-xs font-semibold text-[#121212] block mb-1">Contas (Todas ou Específica)</label>
            <button
              type="button"
              onClick={() => {
                setActiveFilterModal('account');
                setModalSearch('');
              }}
              className="w-full px-3 py-2 bg-gray-50 hover:bg-amber-50/50 border border-gray-300 hover:border-[#D4AF37] rounded-xl text-xs text-[#121212] flex items-center justify-between transition cursor-pointer font-semibold shadow-2xs"
            >
              <span className="truncate">
                {selectedAccountIds.length === 0 || selectedAccountIds.length === accounts.length
                  ? 'Todas as Contas'
                  : selectedAccountIds.length === 1
                  ? accounts.find((a) => selectedAccountIds.includes(a.id))?.name || '1 Conta'
                  : `${selectedAccountIds.length} Contas selecionadas`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0 ml-1" />
            </button>
          </div>

          {/* Filter 6: Account Type (Multi-select) */}
          <div>
            <label className="text-xs font-semibold text-[#121212] block mb-1">Tipo de Conta</label>
            <button
              type="button"
              onClick={() => {
                setActiveFilterModal('accountType');
                setModalSearch('');
              }}
              className="w-full px-3 py-2 bg-gray-50 hover:bg-amber-50/50 border border-gray-300 hover:border-[#D4AF37] rounded-xl text-xs text-[#121212] flex items-center justify-between transition cursor-pointer font-semibold shadow-2xs"
            >
              <span className="truncate">
                {selectedAccountTypes.length === 0 || selectedAccountTypes.length === 5
                  ? 'Todos os Tipos de Conta'
                  : selectedAccountTypes.length === 1
                  ? selectedAccountTypes[0] === 'checking'
                    ? 'Conta Corrente'
                    : selectedAccountTypes[0] === 'savings'
                    ? 'Poupança / Reserva'
                    : selectedAccountTypes[0] === 'credit'
                    ? 'Cartão de Crédito'
                    : selectedAccountTypes[0] === 'investment'
                    ? 'Investimentos'
                    : 'Dinheiro / Carteira'
                  : `${selectedAccountTypes.length} Tipos de Conta selecionados`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0 ml-1" />
            </button>
          </div>

          {/* Filter 7: Family Member (Multi-select) */}
          <div>
            <label className="text-xs font-semibold text-[#121212] block mb-1">Membro da Família</label>
            <button
              type="button"
              onClick={() => {
                setActiveFilterModal('family');
                setModalSearch('');
              }}
              className="w-full px-3 py-2 bg-gray-50 hover:bg-amber-50/50 border border-gray-300 hover:border-[#D4AF37] rounded-xl text-xs text-[#121212] flex items-center justify-between transition cursor-pointer font-semibold shadow-2xs"
            >
              <span className="truncate">
                {selectedFamilyMemberIds.length === 0 || selectedFamilyMemberIds.length === familyMembers.length
                  ? 'Todos os Membros'
                  : selectedFamilyMemberIds.length === 1
                  ? familyMembers.find((fm) => selectedFamilyMemberIds.includes(fm.id))?.name || '1 Membro'
                  : `${selectedFamilyMemberIds.length} Membros selecionados`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0 ml-1" />
            </button>
          </div>
        </div>
      </div>

      {/* Category & Subcategory Tree Breakdown Card */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
          <FolderTree className="w-5 h-5 text-[#D4AF37]" />
          <div>
            <h2 className="text-base font-bold text-[#121212]">
              Detalhamento por Categorias & Subcategorias (Árvore Expansível)
            </h2>
            <p className="text-xs text-gray-600">
              Clique em <strong>Mais</strong> para expandir subcategorias e em <strong>Mais</strong> para abrir sub-subcategorias sucessivamente.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {categories.map((cat) => (
            <CategoryTreeAccordion
              key={cat.id}
              category={cat}
              transactions={filteredTransactions}
            />
          ))}
        </div>
      </div>

      {/* Report Preview Canvas Card */}
      <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-xs space-y-6">
        {/* Printable Report Header */}
        <div className="border-b border-gray-100 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-widest block">
              Demonstrativo Financeiro Selecionado
            </span>
            <h2 className="text-xl font-extrabold text-[#121212]">
              DINHEIRO SEM FILTRO
            </h2>
            <p className="text-xs text-gray-600 mt-0.5">Titular: {user.name} ({user.email})</p>
          </div>

          <div className="text-right sm:border-l sm:border-gray-100 sm:pl-6">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Lançamentos Filtrados</span>
            <span className="text-xl font-extrabold text-[#121212]">{filteredTransactions.length} registros</span>
          </div>
        </div>

        {/* Filtered Summary Box */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 rounded-2xl bg-gray-50 border border-gray-200">
          <div>
            <span className="text-[10px] font-bold text-[#00C853] uppercase block">Total Receitas Filtradas</span>
            <p className="text-base font-extrabold text-[#00C853]">{formatCurrency(totalFilteredIncome)}</p>
          </div>

          <div>
            <span className="text-[10px] font-bold text-[#FF3D00] uppercase block">Total Despesas Filtradas</span>
            <p className="text-base font-extrabold text-[#FF3D00]">{formatCurrency(totalFilteredExpenses)}</p>
          </div>

          <div>
            <span className="text-[10px] font-bold text-[#121212] uppercase block">Resultado Líquido</span>
            <p className={`text-base font-extrabold ${filteredNetBalance >= 0 ? 'text-[#00C853]' : 'text-[#FF3D00]'}`}>
              {formatCurrency(filteredNetBalance)}
            </p>
          </div>
        </div>

        {/* Table Preview */}
        <div className="overflow-x-auto border border-gray-200 rounded-2xl">
          <table translate="no" className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#121212] text-[#D4AF37] font-bold uppercase text-[10px]">
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Descrição</th>
                <th className="py-3 px-4">Categoria / Subcat</th>
                <th className="py-3 px-4">Conta</th>
                <th className="py-3 px-4">Membro</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTransactions.map((tx) => {
                const cat = categories.find((c) => c.id === tx.categoryId);
                const sub = cat?.subcategories.find((s) => s.id === tx.subcategoryId);
                const acc = accounts.find((a) => a.id === tx.accountId);
                const fam = familyMembers.find((f) => f.id === tx.familyMemberId);
                return (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="py-2.5 px-4 font-medium text-gray-800">{formatDateBR(tx.date)}</td>
                    <td className="py-2.5 px-4 font-bold text-[#121212]">
                      {tx.description}
                      {tx.notes && <span className="block text-[10px] text-gray-500 font-normal italic">{tx.notes}</span>}
                    </td>
                    <td className="py-2.5 px-4 text-gray-700">
                      {cat?.name || 'Geral'}
                      {sub && <span className="text-[10px] text-[#D4AF37] font-medium block">› {sub.name}</span>}
                    </td>
                    <td className="py-2.5 px-4 text-gray-700">{acc?.name || 'Conta'}</td>
                    <td className="py-2.5 px-4 text-gray-800 font-medium">{fam?.name || 'Geral'}</td>
                    <td className="py-2.5 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        tx.isConsolidated ? 'bg-[#00C853]/15 text-[#00C853]' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {tx.isConsolidated ? 'Efetivado' : 'Previsto'}
                      </span>
                    </td>
                    <td className={`py-2.5 px-4 text-right font-bold ${
                      tx.type === 'income' ? 'text-[#00C853]' : 'text-[#FF3D00]'
                    }`}>
                      {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                    </td>
                  </tr>
                );
              })}

              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    Nenhum lançamento encontrado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Selection Modal with Real-time Search */}
      {activeFilterModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveFilterModal(null);
          }}
        >
          <div className="bg-white text-[#121212] border-2 border-[#D4AF37] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-4 bg-gray-900 text-white flex items-center justify-between border-b border-gray-800 shrink-0">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#D4AF37]" />
                <h3 className="text-sm font-bold">
                  {activeFilterModal === 'period' && 'Filtrar por Período de Análise'}
                  {activeFilterModal === 'txType' && 'Filtrar por Tipo de Lançamento'}
                  {activeFilterModal === 'category' && 'Filtrar por Categoria'}
                  {activeFilterModal === 'subcategory' && 'Subcategoria & Nível (+)'}
                  {activeFilterModal === 'account' && 'Filtrar por Conta'}
                  {activeFilterModal === 'accountType' && 'Filtrar por Tipo de Conta'}
                  {activeFilterModal === 'family' && 'Filtrar por Membro da Família'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveFilterModal(null)}
                className="p-1 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input & Counter Bar */}
            <div className="p-3 bg-gray-50 border-b border-gray-200 flex flex-col gap-2 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Pesquisar opção..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-300 rounded-xl text-xs text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  autoFocus
                />
                {modalSearch && (
                  <button
                    type="button"
                    onClick={() => setModalSearch('')}
                    className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Sub-bar: Selected Count and Quick Actions for Multi-Select Filters */}
              {activeFilterModal !== 'period' && (
                <div className="flex items-center justify-between text-[11px] px-1 font-semibold">
                  <span className="text-gray-500">
                    {activeFilterModal === 'txType' &&
                      `${selectedTxTypes.length} de 3 selecionado(s)`}
                    {activeFilterModal === 'category' &&
                      `${selectedCategoryIds.length} de ${categories.length} selecionada(s)`}
                    {activeFilterModal === 'subcategory' &&
                      `${selectedSubcategoryIds.length} de ${allFlatSubcategories.length} selecionada(s)`}
                    {activeFilterModal === 'account' &&
                      `${selectedAccountIds.length} de ${accounts.length} selecionada(s)`}
                    {activeFilterModal === 'accountType' &&
                      `${selectedAccountTypes.length} de 5 selecionado(s)`}
                    {activeFilterModal === 'family' &&
                      `${selectedFamilyMemberIds.length} de ${familyMembers.length} selecionado(s)`}
                  </span>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (activeFilterModal === 'txType') setSelectedTxTypes(['income', 'expense', 'transfer']);
                        if (activeFilterModal === 'category') setSelectedCategoryIds(categories.map((c) => c.id));
                        if (activeFilterModal === 'subcategory') setSelectedSubcategoryIds(allFlatSubcategories.map((s) => s.id));
                        if (activeFilterModal === 'account') setSelectedAccountIds(accounts.map((a) => a.id));
                        if (activeFilterModal === 'accountType') setSelectedAccountTypes(['checking', 'savings', 'credit', 'investment', 'cash']);
                        if (activeFilterModal === 'family') setSelectedFamilyMemberIds(familyMembers.map((f) => f.id));
                      }}
                      className="text-[#121212] hover:text-[#D4AF37] cursor-pointer"
                    >
                      Marcar Todas
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (activeFilterModal === 'txType') setSelectedTxTypes([]);
                        if (activeFilterModal === 'category') setSelectedCategoryIds([]);
                        if (activeFilterModal === 'subcategory') setSelectedSubcategoryIds([]);
                        if (activeFilterModal === 'account') setSelectedAccountIds([]);
                        if (activeFilterModal === 'accountType') setSelectedAccountTypes([]);
                        if (activeFilterModal === 'family') setSelectedFamilyMemberIds([]);
                      }}
                      className="text-red-600 hover:text-red-700 cursor-pointer"
                    >
                      Limpar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* List options */}
            <div className="p-3 overflow-y-auto space-y-1 divide-y divide-gray-100 flex-1">
              {/* PERIOD OPTIONS (Single Select) */}
              {activeFilterModal === 'period' &&
                [
                  { id: 'current_month', label: `Mês Atual (${getMonthYearLabel(currentYear, currentMonth)})`, sub: 'Relatório do mês corrente' },
                  { id: 'last_month', label: 'Mês Anterior', sub: 'Relatório do mês passado' },
                  { id: 'last_3_months', label: 'Últimos 3 Meses', sub: 'Análise do último trimestre' },
                  { id: 'last_6_months', label: 'Semestre (Últimos 6 Meses)', sub: 'Análise dos últimos 6 meses' },
                  { id: 'year', label: `Ano Atual (${currentYear})`, sub: 'Análise do ano vigente' },
                  { id: 'last_12_months', label: '1 Ano (Últimos 12 Meses)', sub: 'Visão completa dos últimos 12 meses' },
                  { id: 'last_2_years', label: '2 Anos (Últimos 24 Meses)', sub: 'Análise bienal estendida' },
                  { id: 'all_time', label: 'Sem Limite (Todo o Histórico)', sub: 'Exibe todos os lançamentos registrados' },
                  { id: 'custom', label: 'Período Personalizado (Escolher Datas)', sub: 'Defina datas inicial e final específicas' },
                ]
                  .filter((opt) => opt.label.toLowerCase().includes(modalSearch.toLowerCase()) || opt.sub.toLowerCase().includes(modalSearch.toLowerCase()))
                  .map((opt) => {
                    const isSelected = periodType === opt.id;
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                          isSelected ? 'bg-amber-50/70 border border-[#D4AF37]/30' : 'hover:bg-gray-50 border border-transparent'
                        }`}
                        onClick={() => {
                          setPeriodType(opt.id as any);
                          setActiveFilterModal(null);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="periodTypeOption"
                            checked={isSelected}
                            onChange={() => {
                              setPeriodType(opt.id as any);
                              setActiveFilterModal(null);
                            }}
                            className="w-4 h-4 text-[#D4AF37] focus:ring-[#D4AF37] border-gray-300 cursor-pointer"
                          />
                          <div>
                            <div className="text-xs font-bold text-[#121212]">{opt.label}</div>
                            <div className="text-[10px] text-gray-500">{opt.sub}</div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#D4AF37]" />}
                      </label>
                    );
                  })}

              {/* TRANSACTION TYPE OPTIONS (Multi-Select) */}
              {activeFilterModal === 'txType' &&
                [
                  { id: 'income', label: 'Apenas Receitas (+)', sub: 'Entradas financeiras' },
                  { id: 'expense', label: 'Apenas Despesas (-)', sub: 'Saídas e custos' },
                  { id: 'transfer', label: 'Apenas Transferências (↔)', sub: 'Movimentações entre contas' },
                ]
                  .filter((opt) => opt.label.toLowerCase().includes(modalSearch.toLowerCase()) || opt.sub.toLowerCase().includes(modalSearch.toLowerCase()))
                  .map((opt) => {
                    const isChecked = selectedTxTypes.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                          isChecked ? 'bg-amber-50/70 border border-[#D4AF37]/30' : 'hover:bg-gray-50 border border-transparent'
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          toggleMultiFilter(opt.id, selectedTxTypes, setSelectedTxTypes);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 text-[#D4AF37] focus:ring-[#D4AF37] border-gray-300 rounded cursor-pointer"
                          />
                          <div>
                            <div className="text-xs font-bold text-[#121212]">{opt.label}</div>
                            <div className="text-[10px] text-gray-500">{opt.sub}</div>
                          </div>
                        </div>
                        {isChecked && <Check className="w-4 h-4 text-[#D4AF37]" />}
                      </label>
                    );
                  })}

              {/* CATEGORY OPTIONS (Multi-Select) */}
              {activeFilterModal === 'category' &&
                categories
                  .filter((cat) => cat.name.toLowerCase().includes(modalSearch.toLowerCase()))
                  .map((cat) => {
                    const isChecked = selectedCategoryIds.includes(cat.id);
                    return (
                      <label
                        key={cat.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                          isChecked ? 'bg-amber-50/70 border border-[#D4AF37]/30' : 'hover:bg-gray-50 border border-transparent'
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          toggleMultiFilter(cat.id, selectedCategoryIds, setSelectedCategoryIds);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 text-[#D4AF37] focus:ring-[#D4AF37] border-gray-300 rounded cursor-pointer"
                          />
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color || '#D4AF37' }}
                            />
                            <div>
                              <div className="text-xs font-bold text-[#121212]">{cat.name}</div>
                              <div className="text-[10px] text-gray-500">
                                {cat.type === 'expense' ? 'Despesa' : 'Receita'}
                              </div>
                            </div>
                          </div>
                        </div>
                        {isChecked && <Check className="w-4 h-4 text-[#D4AF37]" />}
                      </label>
                    );
                  })}

              {/* SUBCATEGORY OPTIONS (Multi-Select) */}
              {activeFilterModal === 'subcategory' &&
                allFlatSubcategories
                  .filter((sub) => {
                    if (!modalSearch.trim()) return true;
                    const term = modalSearch.toLowerCase().trim();
                    return sub.fullPath.toLowerCase().includes(term) || sub.name.toLowerCase().includes(term);
                  })
                  .map((sub) => {
                    const isChecked = selectedSubcategoryIds.includes(sub.id);
                    return (
                      <label
                        key={sub.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                          isChecked ? 'bg-amber-50/70 border border-[#D4AF37]/30' : 'hover:bg-gray-50 border border-transparent'
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          toggleMultiFilter(sub.id, selectedSubcategoryIds, setSelectedSubcategoryIds);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 text-[#D4AF37] focus:ring-[#D4AF37] border-gray-300 rounded cursor-pointer"
                          />
                          <div className="text-xs font-bold text-[#121212]">{sub.fullPath}</div>
                        </div>
                        {isChecked && <Check className="w-4 h-4 text-[#D4AF37]" />}
                      </label>
                    );
                  })}

              {/* ACCOUNT OPTIONS (Multi-Select) */}
              {activeFilterModal === 'account' &&
                accounts
                  .filter((acc) => acc.name.toLowerCase().includes(modalSearch.toLowerCase()))
                  .map((acc) => {
                    const isChecked = selectedAccountIds.includes(acc.id);
                    return (
                      <label
                        key={acc.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                          isChecked ? 'bg-amber-50/70 border border-[#D4AF37]/30' : 'hover:bg-gray-50 border border-transparent'
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          toggleMultiFilter(acc.id, selectedAccountIds, setSelectedAccountIds);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 text-[#D4AF37] focus:ring-[#D4AF37] border-gray-300 rounded cursor-pointer"
                          />
                          <div>
                            <div className="text-xs font-bold text-[#121212]">{acc.name}</div>
                            <div className="text-[10px] text-gray-500">{acc.type}</div>
                          </div>
                        </div>
                        {isChecked && <Check className="w-4 h-4 text-[#D4AF37]" />}
                      </label>
                    );
                  })}

              {/* ACCOUNT TYPE OPTIONS (Multi-Select) */}
              {activeFilterModal === 'accountType' &&
                [
                  { id: 'checking', label: 'Conta Corrente', sub: 'Contas bancárias operacionais' },
                  { id: 'savings', label: 'Poupança / Reserva', sub: 'Contas de poupança e reservas' },
                  { id: 'credit', label: 'Cartão de Crédito', sub: 'Faturas e cartões de crédito' },
                  { id: 'investment', label: 'Investimentos', sub: 'Carteiras e aplicações' },
                  { id: 'cash', label: 'Dinheiro / Carteira', sub: 'Dinheiro físico e valores em mãos' },
                ]
                  .filter((opt) => opt.label.toLowerCase().includes(modalSearch.toLowerCase()) || opt.sub.toLowerCase().includes(modalSearch.toLowerCase()))
                  .map((opt) => {
                    const isChecked = selectedAccountTypes.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                          isChecked ? 'bg-amber-50/70 border border-[#D4AF37]/30' : 'hover:bg-gray-50 border border-transparent'
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          toggleMultiFilter(opt.id, selectedAccountTypes, setSelectedAccountTypes);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 text-[#D4AF37] focus:ring-[#D4AF37] border-gray-300 rounded cursor-pointer"
                          />
                          <div>
                            <div className="text-xs font-bold text-[#121212]">{opt.label}</div>
                            <div className="text-[10px] text-gray-500">{opt.sub}</div>
                          </div>
                        </div>
                        {isChecked && <Check className="w-4 h-4 text-[#D4AF37]" />}
                      </label>
                    );
                  })}

              {/* FAMILY MEMBER OPTIONS (Multi-Select) */}
              {activeFilterModal === 'family' &&
                familyMembers
                  .filter((fm) => fm.name.toLowerCase().includes(modalSearch.toLowerCase()))
                  .map((fm) => {
                    const isChecked = selectedFamilyMemberIds.includes(fm.id);
                    return (
                      <label
                        key={fm.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                          isChecked ? 'bg-amber-50/70 border border-[#D4AF37]/30' : 'hover:bg-gray-50 border border-transparent'
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          toggleMultiFilter(fm.id, selectedFamilyMemberIds, setSelectedFamilyMemberIds);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 text-[#D4AF37] focus:ring-[#D4AF37] border-gray-300 rounded cursor-pointer"
                          />
                          <div className="text-xs font-bold text-[#121212]">{fm.name}</div>
                        </div>
                        {isChecked && <Check className="w-4 h-4 text-[#D4AF37]" />}
                      </label>
                    );
                  })}
            </div>

            {/* Footer */}
            <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setActiveFilterModal(null)}
                className="py-2 px-5 bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

