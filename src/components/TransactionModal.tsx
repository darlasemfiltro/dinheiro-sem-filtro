import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Account, Category, FamilyMember, Subcategory, Transaction, TransactionType, AccountType, RuleGroup, CategoryType } from '../types';
import { generateInstallmentTransactions, flattenSubcategories, findSubcategoryById } from '../utils/finance';
import { StorageService } from '../services/storage';
import {
  X,
  Calendar,
  DollarSign,
  Tag,
  Wallet,
  CreditCard,
  Layers,
  CheckCircle2,
  UserCheck,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  PlusCircle,
  Search,
  Plus,
  ChevronDown,
  Check,
  Sparkles,
  UserPlus,
  Building,
} from 'lucide-react';

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

const isoToPtBr = (iso: string): string => {
  if (!iso || !iso.includes('-')) return iso;
  const [y, m, d] = iso.split('-');
  if (y && m && d) {
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return iso;
};

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSingle: (tx: Omit<Transaction, 'id' | 'createdAt'>, keepOpen?: boolean) => void;
  onSaveMultiple: (txList: Omit<Transaction, 'id' | 'createdAt'>[], keepOpen?: boolean) => void;
  accounts: Account[];
  categories: Category[];
  familyMembers?: FamilyMember[];
  userId: string;
  initialTransaction?: Transaction | null;
  onSaveAccount?: (acc: Account) => void;
  onSaveCategory?: (cat: Category) => void;
  onAddSubcategory?: (cat: Category, parentSubId: string | null, name: string, explicitSubId?: string) => void;
  onSaveFamilyMember?: (fm: FamilyMember) => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSaveSingle,
  onSaveMultiple,
  accounts,
  categories,
  familyMembers = [],
  userId,
  initialTransaction,
  onSaveAccount,
  onSaveCategory,
  onAddSubcategory,
  onSaveFamilyMember,
}) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dateText, setDateText] = useState<string>(() => isoToPtBr(new Date().toISOString().split('T')[0]));
  const datePickerRef = useRef<HTMLInputElement>(null);
  const [accountId, setAccountId] = useState<string>('');
  const [targetAccountId, setTargetAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [subcategoryId, setSubcategoryId] = useState<string>('');
  const [familyMemberId, setFamilyMemberId] = useState<string>('');
  const [isConsolidated, setIsConsolidated] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active categories derived memo to immediately reflect new categories/subcategories without render loops
  const activeCategories = useMemo(() => {
    const stored = StorageService.getCategories(userId);
    if (!stored || stored.length === 0) return categories;
    const map = new Map<string, Category>();
    categories.forEach((c) => map.set(c.id, c));
    stored.forEach((c) => {
      const prev = map.get(c.id);
      if (!prev || (c.subcategories?.length || 0) >= (prev.subcategories?.length || 0)) {
        map.set(c.id, c);
      }
    });
    return Array.from(map.values());
  }, [categories, userId]);

  // Installment States
  const [isInstallment, setIsInstallment] = useState<boolean>(false);
  const [installmentTotal, setInstallmentTotal] = useState<number>(2);
  const [installmentInput, setInstallmentInput] = useState<string>('2');

  // Searchable Picker Modal States
  const [activePicker, setActivePicker] = useState<'account' | 'targetAccount' | 'category' | 'subcategory' | 'familyMember' | null>(null);
  const [pickerSearch, setPickerSearch] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);

  // New Item Form States
  const [newAccName, setNewAccName] = useState<string>('');
  const [newAccType, setNewAccType] = useState<AccountType>('checking');
  const [newAccBalance, setNewAccBalance] = useState<string>('0');
  const [newAccColor, setNewAccColor] = useState<string>('#2563EB');

  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatColor, setNewCatColor] = useState<string>('#E11D48');
  const [newCatType, setNewCatType] = useState<CategoryType>('expense');
  const [newCatRuleGroup, setNewCatRuleGroup] = useState<RuleGroup>('50_essentials');

  const [newSubName, setNewSubName] = useState<string>('');

  const [newMemberName, setNewMemberName] = useState<string>('');
  const [newMemberRelation, setNewMemberRelation] = useState<string>('Cônjuge');

  // Subcategories for selected category (flattened recursively)
  const selectedCategory = activeCategories.find((c) => c.id === categoryId);
  const flatSubcategories = selectedCategory ? flattenSubcategories(selectedCategory.subcategories) : [];
  const selectedAccountObj = accounts.find((a) => a.id === accountId);
  const selectedTargetAccountObj = accounts.find((a) => a.id === targetAccountId);
  const selectedSubcategoryObj = flatSubcategories.find((s) => s.id === subcategoryId);
  const selectedFamilyMemberObj = familyMembers.find((fm) => fm.id === familyMemberId);

  const handleDateTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const digitsOnly = rawVal.replace(/\D/g, '').slice(0, 8);
    let formatted = digitsOnly;
    if (digitsOnly.length > 2 && digitsOnly.length <= 4) {
      formatted = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}`;
    } else if (digitsOnly.length > 4) {
      formatted = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4)}`;
    }

    setDateText(formatted);

    const parsedIso = ptBrToIso(formatted);
    if (parsedIso) {
      setDate(parsedIso);
    }
  };

  const handleNativeDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIso = e.target.value;
    if (newIso) {
      setDate(newIso);
      setDateText(isoToPtBr(newIso));
    }
  };

  const openDatePicker = () => {
    const el = datePickerRef.current;
    if (el) {
      if (typeof (el as any).showPicker === 'function') {
        try {
          (el as any).showPicker();
        } catch {
          el.focus();
          el.click();
        }
      } else {
        el.focus();
        el.click();
      }
    }
  };

  const prevIsOpenRef = useRef(false);
  const prevInitialTxIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (isOpen) {
      const isJustOpened = !prevIsOpenRef.current;
      const initialTxChanged = (initialTransaction?.id || 'new') !== (prevInitialTxIdRef.current || 'new');

      if (isJustOpened || initialTxChanged) {
        if (initialTransaction) {
          setType(initialTransaction.type);
          setAmount(String(initialTransaction.amount));
          setDescription(initialTransaction.description);
          setDate(initialTransaction.date);
          setDateText(isoToPtBr(initialTransaction.date));
          setAccountId(initialTransaction.accountId);
          setTargetAccountId(initialTransaction.targetAccountId || '');
          setCategoryId(initialTransaction.categoryId);
          setSubcategoryId(initialTransaction.subcategoryId || '');
          setFamilyMemberId(initialTransaction.familyMemberId || '');
          setIsConsolidated(initialTransaction.isConsolidated);
          setNotes(initialTransaction.notes || '');
          setIsInstallment(false);
        } else {
          // Default reset when opening fresh
          setType('expense');
          setAmount('');
          setDescription('');
          const todayIso = new Date().toISOString().split('T')[0];
          setDate(todayIso);
          setDateText(isoToPtBr(todayIso));
          setAccountId(accounts.length > 0 ? accounts[0].id : '');
          setTargetAccountId('');

          // Auto select expense category
          const defaultCat = activeCategories.find((c) => c.type === 'expense');
          setCategoryId(defaultCat ? defaultCat.id : activeCategories[0]?.id || '');
          setSubcategoryId('');
          setFamilyMemberId('');
          setIsConsolidated(true);
          setNotes('');
          setIsInstallment(false);
          setInstallmentTotal(2);
        }
      }
    }
    prevIsOpenRef.current = isOpen;
    prevInitialTxIdRef.current = initialTransaction?.id;
  }, [isOpen, initialTransaction]);

  // Fallback defaults if collections finish loading after modal was opened or if accountId is invalid
  useEffect(() => {
    if (isOpen) {
      if (!accountId || !accounts.some((a) => a.id === accountId)) {
        if (accounts.length > 0) {
          setAccountId(accounts[0].id);
        }
      }
    }
  }, [isOpen, accountId, accounts]);

  useEffect(() => {
    if (isOpen && !categoryId && activeCategories.length > 0) {
      const defaultCat = activeCategories.find((c) => c.type === type) || activeCategories[0];
      if (defaultCat) setCategoryId(defaultCat.id);
    }
  }, [isOpen, categoryId, activeCategories, type]);

  // Removed auto-select useEffect to allow selecting 'Geral / Família Toda' (empty string)

  if (!isOpen) return null;

  const resetForm = () => {
    setAmount('');
    setDescription('');
    setNotes('');
    setIsInstallment(false);
    setInstallmentTotal(2);
    setInstallmentInput('2');
  };

  const handleSaveTransaction = (keepOpen: boolean): boolean => {
    const cleanAmountStr = String(amount).trim().replace(',', '.');
    const numAmount = parseFloat(cleanAmountStr);
    if (isNaN(numAmount) || numAmount <= 0) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Por favor, informe um valor maior que zero.' }));
      return false;
    }
    if (!accountId) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Por favor, selecione uma conta.' }));
      return false;
    }

    const parsedDate = ptBrToIso(dateText) || date;
    if (!parsedDate || !/^\d{4}-\d{2}-\d{2}$/.test(parsedDate)) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Por favor, informe uma data válida no formato DD/MM/AAAA.' }));
      return false;
    }

    const selectedFamilyMember = familyMembers.find((fm) => fm.id === familyMemberId);
    const selectedSub = selectedCategory ? findSubcategoryById(selectedCategory.subcategories, subcategoryId) : undefined;
    const fallbackDesc = selectedSub
      ? selectedSub.name
      : selectedCategory
      ? selectedCategory.name
      : type === 'income'
      ? 'Receita'
      : type === 'expense'
      ? 'Despesa'
      : 'Transferência';

    const finalDescription = description.trim() || fallbackDesc;

    const baseTx: Omit<Transaction, 'id' | 'createdAt'> = {
      userId,
      accountId,
      targetAccountId: type === 'transfer' ? targetAccountId : undefined,
      type,
      amount: numAmount,
      date: parsedDate,
      description: finalDescription,
      categoryId: type === 'transfer' ? '' : categoryId,
      subcategoryId: type === 'transfer' ? undefined : subcategoryId,
      familyMemberId: familyMemberId || undefined,
      familyMemberName: selectedFamilyMember ? selectedFamilyMember.name : undefined,
      isConsolidated,
      notes,
    };

    if (isInstallment && installmentTotal > 1 && type !== 'transfer') {
      const list = generateInstallmentTransactions(baseTx, installmentTotal);
      onSaveMultiple(list, keepOpen);
    } else {
      onSaveSingle(baseTx, keepOpen);
    }

    if (keepOpen) {
      resetForm();
      setSuccessMessage(`Lançamento (${finalDescription}) salvo com sucesso!`);
      setTimeout(() => setSuccessMessage(null), 3500);
    } else {
      onClose();
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSaveTransaction(false);
  };

  // Quick Creation Handlers
  const handleCreateAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;
    const parsedInitialBalance = typeof newAccBalance === 'number'
      ? newAccBalance
      : (parseFloat(String(newAccBalance).replace(',', '.')) || 0);

    const created: Account = {
      id: `acc_${Date.now()}`,
      userId,
      name: newAccName.trim(),
      type: newAccType,
      initialBalance: parsedInitialBalance,
      color: newAccColor,
      icon: 'Wallet',
      updatedAt: new Date().toISOString(),
      _pendingSync: true,
    };
    StorageService.saveAccount(created, userId);
    if (onSaveAccount) onSaveAccount(created);
    if (activePicker === 'targetAccount') {
      setTargetAccountId(created.id);
    } else {
      setAccountId(created.id);
    }
    setNewAccName('');
    setIsCreatingNew(false);
    setActivePicker(null);
  };

  const handleCreateCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const catType = newCatType;
    const created: Category = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      userId,
      name: newCatName.trim(),
      type: catType,
      ruleGroup: catType === 'income' ? 'income' : newCatRuleGroup,
      color: newCatColor,
      icon: 'Tag',
      subcategories: [],
    };
    StorageService.saveCategory(created, userId);
    if (onSaveCategory) onSaveCategory(created);
    setCategoryId(created.id);
    setSubcategoryId('');
    setNewCatName('');
    setNewCatRuleGroup('50_essentials');
    setIsCreatingNew(false);
    setActivePicker(null);
  };

  const handleCreateSubcategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedSubName = newSubName.trim();
    if (!trimmedSubName) return;

    // Find target category from activeCategories or StorageService
    let targetCat = activeCategories.find((c) => c.id === categoryId)
      || StorageService.getCategories(userId).find((c) => c.id === categoryId);

    if (!targetCat) {
      if (activeCategories.length > 0) {
        targetCat = activeCategories[0];
      } else {
        const defaultCat: Category = {
          id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          userId,
          name: 'Geral',
          type: type === 'transfer' ? 'expense' : type,
          color: '#D4AF37',
          icon: 'Tag',
          subcategories: [],
        };
        StorageService.saveCategory(defaultCat, userId);
        if (onSaveCategory) onSaveCategory(defaultCat);
        targetCat = defaultCat;
      }
    }

    const newSubId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newSub: Subcategory = {
      id: newSubId,
      categoryId: targetCat.id,
      name: trimmedSubName,
      subcategories: [],
    };
    const updatedCat: Category = {
      ...targetCat,
      subcategories: [...(targetCat.subcategories || []), newSub],
    };

    StorageService.saveCategory(updatedCat, userId);
    if (onSaveCategory) onSaveCategory(updatedCat);

    setCategoryId(targetCat.id);
    setSubcategoryId(newSubId);
    setNewSubName('');
    setIsCreatingNew(false);
    setActivePicker(null);
  };

  const handleCreateFamilyMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    const created: FamilyMember = {
      id: `fm_${Date.now()}`,
      userId,
      name: newMemberName.trim(),
      relationship: newMemberRelation.trim() || 'Dependente',
    };
    StorageService.saveFamilyMember(created);
    if (onSaveFamilyMember) onSaveFamilyMember(created);
    setFamilyMemberId(created.id);
    setNewMemberName('');
    setIsCreatingNew(false);
    setActivePicker(null);
  };

  const openPickerModal = (pickerType: 'account' | 'targetAccount' | 'category' | 'subcategory' | 'familyMember') => {
    setActivePicker(pickerType);
    setPickerSearch('');
    setIsCreatingNew(false);
    if (pickerType === 'category') {
      const initialCatType = type === 'income' ? 'income' : 'expense';
      setNewCatType(initialCatType);
      setNewCatRuleGroup(initialCatType === 'income' ? 'income' : '50_essentials');
      setNewCatColor(initialCatType === 'income' ? '#00C853' : '#E11D48');
      setNewCatName('');
    }
  };

  const getAccountTypeLabel = (accType: AccountType) => {
    switch (accType) {
      case 'credit':
        return 'Cartão de Crédito';
      case 'checking':
        return 'Conta Corrente';
      case 'savings':
        return 'Poupança';
      case 'cash':
        return 'Dinheiro / Carteira';
      default:
        return 'Outro / Investimento';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white border-2 border-[#D4AF37] rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] sm:max-h-[88vh] flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in-95 relative">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4 sm:p-5 bg-white shrink-0">
          <h2 className="text-sm sm:text-base font-extrabold text-[#121212] font-serif">
            {initialTransaction ? 'Editar Lançamento' : 'Novo Lançamento Financeiro'}
          </h2>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="p-1 rounded-xl text-gray-500 hover:bg-gray-100 transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
            {/* Type Selector Tabs - Receita, Despesa ou Transferência */}
            <div className="space-y-2 bg-gray-50 p-3.5 rounded-2xl border border-gray-200 shadow-2xs">
              <label className="text-xs font-extrabold text-[#121212] block uppercase tracking-wider">
                1. Selecione o Tipo:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setType('expense');
                    const cat = activeCategories.find((c) => c.type === 'expense');
                    if (cat) setCategoryId(cat.id);
                  }}
                  className={`min-h-[48px] py-3 px-2 text-xs sm:text-sm font-extrabold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                    type === 'expense'
                      ? 'bg-[#FF3D00] text-white shadow-md font-black'
                      : 'text-[#121212] bg-white hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <ArrowDownRight className={`w-4 h-4 shrink-0 ${type === 'expense' ? 'text-white' : 'text-[#FF3D00]'}`} />
                  <span>Despesa</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setType('income');
                    const cat = activeCategories.find((c) => c.type === 'income');
                    if (cat) setCategoryId(cat.id);
                  }}
                  className={`min-h-[48px] py-3 px-2 text-xs sm:text-sm font-extrabold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                    type === 'income'
                      ? 'bg-[#00C853] text-[#121212] shadow-md font-black border border-[#00A843]'
                      : 'text-[#121212] bg-white hover:bg-emerald-50 border border-gray-200'
                  }`}
                >
                  <ArrowUpRight className={`w-4 h-4 shrink-0 ${type === 'income' ? 'text-[#121212]' : 'text-[#00C853]'}`} />
                  <span>Receita</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType('transfer')}
                  className={`min-h-[48px] py-3 px-2 text-xs sm:text-sm font-extrabold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                    type === 'transfer'
                      ? 'bg-[#D4AF37] text-[#121212] shadow-md font-black'
                      : 'text-[#121212] bg-white hover:bg-amber-50 border border-gray-200'
                  }`}
                >
                  <ArrowRightLeft className={`w-4 h-4 shrink-0 ${type === 'transfer' ? 'text-[#121212]' : 'text-[#D4AF37]'}`} />
                  <span>Transferência</span>
                </button>
              </div>
            </div>

            {/* Amount & Date Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#121212] block">
                    Valor (R$) *
                  </label>
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                      type === 'income'
                        ? 'bg-[#00C853]/10 text-[#00C853] border border-[#00C853]/30'
                        : type === 'expense'
                        ? 'bg-[#FF3D00]/10 text-[#FF3D00] border border-[#FF3D00]/30'
                        : 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30'
                    }`}
                  >
                    {type === 'income' ? '+ Receita' : type === 'expense' ? '- Despesa' : '↔ Transferência'}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-500">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^[0-9]*[.,]?[0-9]*$/.test(val)) {
                        setAmount(val);
                      }
                    }}
                    placeholder="0,00"
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#121212] block mb-1">
                  Data do Lançamento *
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={dateText}
                    onChange={handleDateTextChange}
                    placeholder="DD/MM/AAAA"
                    maxLength={10}
                    required
                    className="w-full pl-3 pr-10 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={openDatePicker}
                    className="absolute right-1.5 p-1 bg-gray-200 hover:bg-[#D4AF37] text-gray-700 hover:text-[#121212] rounded-lg transition cursor-pointer"
                    title="Abrir calendário"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                  </button>
                  <input
                    ref={datePickerRef}
                    type="date"
                    value={date}
                    onChange={handleNativeDateChange}
                    className="sr-only absolute pointer-events-none opacity-0"
                    tabIndex={-1}
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold text-[#121212] block mb-1">
                Descrição / Histórico (Opcional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Supermercado, Salário, Aluguel (Opcional)..."
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:bg-white"
              />
            </div>

            {/* Account Selection Field */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#121212] block mb-1">
                  {type === 'transfer' ? 'Conta de Origem *' : 'Conta *'}
                </label>
                <button
                  type="button"
                  onClick={() => openPickerModal('account')}
                  className="w-full px-3 py-2.5 bg-gray-50 hover:bg-amber-50/50 border border-gray-300 hover:border-[#D4AF37] rounded-xl text-xs text-[#121212] flex items-center justify-between transition cursor-pointer"
                >
                  <div className="flex items-center gap-2 overflow-hidden pr-2">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: selectedAccountObj?.color || '#2563EB' }}
                    />
                    <span className="font-bold truncate">
                      {selectedAccountObj ? selectedAccountObj.name : 'Selecione a conta'}
                    </span>
                    {selectedAccountObj && (
                      <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-md font-semibold shrink-0">
                        {getAccountTypeLabel(selectedAccountObj.type)}
                      </span>
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                </button>
              </div>

              {type === 'transfer' && (
                <div>
                  <label className="text-xs font-semibold text-[#121212] block mb-1">
                    Conta de Destino *
                  </label>
                  <button
                    type="button"
                    onClick={() => openPickerModal('targetAccount')}
                    className="w-full px-3 py-2.5 bg-gray-50 hover:bg-amber-50/50 border border-gray-300 hover:border-[#D4AF37] rounded-xl text-xs text-[#121212] flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 overflow-hidden pr-2">
                      {selectedTargetAccountObj ? (
                        <>
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: selectedTargetAccountObj.color || '#2563EB' }}
                          />
                          <span className="font-bold truncate">{selectedTargetAccountObj.name}</span>
                          <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-md font-semibold shrink-0">
                            {getAccountTypeLabel(selectedTargetAccountObj.type)}
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-400 font-medium">Selecione conta de destino</span>
                      )}
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                  </button>
                </div>
              )}
            </div>

            {/* Category & Subcategory Selection (If not Transfer) */}
            {type !== 'transfer' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#121212] block mb-1">Categoria</label>
                  <button
                    type="button"
                    onClick={() => openPickerModal('category')}
                    className="w-full px-3 py-2.5 bg-gray-50 hover:bg-amber-50/50 border border-gray-300 hover:border-[#D4AF37] rounded-xl text-xs text-[#121212] flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 overflow-hidden pr-2">
                      {selectedCategory && (
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: selectedCategory.color || '#D4AF37' }}
                        />
                      )}
                      <span className="font-bold truncate">
                        {selectedCategory ? selectedCategory.name : 'Selecione a categoria'}
                      </span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                  </button>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#121212] block mb-1">Subcategoria</label>
                  <button
                    type="button"
                    onClick={() => openPickerModal('subcategory')}
                    className="w-full px-3 py-2.5 bg-gray-50 hover:bg-amber-50/50 border border-gray-300 hover:border-[#D4AF37] rounded-xl text-xs text-[#121212] flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 overflow-hidden pr-2">
                      <span className="font-bold truncate text-gray-800">
                        {selectedSubcategoryObj ? selectedSubcategoryObj.fullPath : 'Nenhuma / Geral'}
                      </span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                  </button>
                </div>
              </div>
            )}

            {/* Family Member Assignment */}
            <div>
              <label className="text-xs font-semibold text-[#121212] flex items-center gap-1.5 mb-1">
                <UserCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Membro da Família (Responsável pelo valor)</span>
              </label>
              <button
                type="button"
                onClick={() => openPickerModal('familyMember')}
                className="w-full px-3 py-2.5 bg-gray-50 hover:bg-amber-50/50 border border-gray-300 hover:border-[#D4AF37] rounded-xl text-xs text-[#121212] flex items-center justify-between transition cursor-pointer"
              >
                <div className="flex items-center gap-2 overflow-hidden pr-2">
                  <UserCheck className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                  <span className="font-bold truncate">
                    {selectedFamilyMemberObj
                      ? `${selectedFamilyMemberObj.name} ${selectedFamilyMemberObj.relationship ? `(${selectedFamilyMemberObj.relationship})` : ''}`
                      : 'Geral / Família Toda'}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
              </button>
            </div>

            {/* Notes / Remarks Field */}
            <div>
              <label className="text-xs font-semibold text-[#121212] flex items-center gap-1.5 mb-1">
                <FileText className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Notas / Observações (Opcional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Adicione informações adicionais, detalhes da compra, comprovante, observações..."
                rows={2}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:bg-white resize-none"
              />
            </div>

            {/* Consolidation Checkbox Flag */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#121212] block">Status de Conciliação</span>
                <span className="text-[11px] text-gray-500">
                  {isConsolidated ? 'Consolidado (Já efetivado / pago)' : 'Pendente (Previsto para o futuro)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsConsolidated(!isConsolidated)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  isConsolidated
                    ? 'bg-[#00C853] text-[#121212] shadow-xs'
                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isConsolidated ? 'Efetivado' : 'Previsto'}
              </button>
            </div>

            {/* Installment Transactions (Lançamento Parcelado) */}
            {!initialTransaction && type !== 'transfer' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInstallment}
                    onChange={(e) => setIsInstallment(e.target.checked)}
                    className="w-4 h-4 text-[#D4AF37] rounded focus:ring-[#D4AF37]"
                  />
                  <span className="text-xs font-bold text-[#121212]">
                    Lançamento Parcelado? (Projetar nos meses futuros)
                  </span>
                </label>

                {isInstallment && (
                  <div className="pt-2 flex items-center gap-3">
                    <span className="text-xs text-[#121212] font-medium">Número de parcelas:</span>
                    <input
                      type="number"
                      min="2"
                      max="60"
                      value={installmentInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInstallmentInput(val);
                        if (val === '') {
                          setInstallmentTotal(2);
                        } else {
                          const parsed = parseInt(val);
                          if (!isNaN(parsed)) {
                            setInstallmentTotal(parsed);
                          }
                        }
                      }}
                      onBlur={() => {
                        const parsed = parseInt(installmentInput);
                        const finalVal = isNaN(parsed) || parsed < 2 ? 2 : parsed;
                        setInstallmentTotal(finalVal);
                        setInstallmentInput(finalVal.toString());
                      }}
                      className="w-20 px-3 py-1 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#121212]"
                    />
                    <span className="text-[11px] text-gray-600">
                      Será gerado em {installmentTotal} meses consecutivos.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Success banner if present */}
          {successMessage && (
            <div className="mx-4 sm:mx-6 my-2 p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-between animate-in fade-in">
              <span>{successMessage}</span>
              <span className="text-[10px] text-emerald-600">Pronto para novo cadastro</span>
            </div>
          )}

          {/* Action Buttons (Save & Cancel/Exit) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 p-4 sm:px-6 sm:py-4 border-t border-gray-200 bg-white shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="min-h-[48px] flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-[#121212] border border-gray-300 font-extrabold text-xs sm:text-sm rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4 text-gray-600 shrink-0" />
              <span>Sair / Cancelar</span>
            </button>

            {!initialTransaction && (
              <button
                type="button"
                onClick={() => handleSaveTransaction(true)}
                className="min-h-[48px] flex-1 py-3 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-400 font-extrabold text-xs sm:text-sm rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                <PlusCircle className="w-4 h-4 text-emerald-600 stroke-[2.5] shrink-0" />
                <span>Cadastrar Novo Lançamento</span>
              </button>
            )}

            <button
              type="submit"
              className="min-h-[48px] flex-1 py-3 px-4 bg-[#121212] hover:bg-black text-[#D4AF37] font-black text-xs sm:text-sm rounded-xl shadow-md transition cursor-pointer border border-[#D4AF37]"
            >
              {initialTransaction ? 'Salvar Alterações' : 'Confirmar Lançamento'}
            </button>
          </div>
        </form>

        {/* =========================================
            SEARCHABLE PICKER POPUP / OVERLAY MODAL
           ========================================= */}
        {activePicker && (
          <div className="absolute inset-0 z-50 bg-white flex flex-col animate-in fade-in zoom-in-95">
            {/* Picker Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-[#121212] font-serif">
                  {activePicker === 'account' && 'Selecionar Conta'}
                  {activePicker === 'targetAccount' && 'Selecionar Conta de Destino'}
                  {activePicker === 'category' && 'Selecionar Categoria'}
                  {activePicker === 'subcategory' && 'Selecionar Subcategoria'}
                  {activePicker === 'familyMember' && 'Selecionar Membro da Família'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActivePicker(null);
                  setIsCreatingNew(false);
                }}
                className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Picker Body */}
            <div className="p-4 flex flex-col flex-1 overflow-hidden">
              {/* If user clicked "Cadastrar Novo", render Quick Create Form */}
              {isCreatingNew ? (
                <div className="overflow-y-auto flex-1 space-y-4">
                  <div className="flex items-center justify-between bg-amber-50 p-3 rounded-2xl border border-amber-200">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                      Novo Cadastro Rápido
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCreatingNew(false)}
                      className="text-xs font-bold text-gray-600 hover:underline cursor-pointer"
                    >
                      ← Voltar à lista
                    </button>
                  </div>

                  {/* FORM FOR NEW ACCOUNT */}
                  {(activePicker === 'account' || activePicker === 'targetAccount') && (
                    <form onSubmit={handleCreateAccountSubmit} className="space-y-3">
                      <div>
                        <label className="text-xs font-bold text-[#121212] block mb-1">Nome da Conta / Banco *</label>
                        <input
                          type="text"
                          value={newAccName}
                          onChange={(e) => setNewAccName(e.target.value)}
                          placeholder="Ex: Santander, NuBank, Carteira Dinheiro..."
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#D4AF37]"
                          required
                          autoFocus
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-bold text-[#121212] block mb-1">Tipo de Conta</label>
                          <select
                            value={newAccType}
                            onChange={(e) => setNewAccType(e.target.value as AccountType)}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs"
                          >
                            <option value="checking">Conta Corrente</option>
                            <option value="credit">Cartão de Crédito</option>
                            <option value="savings">Poupança</option>
                            <option value="cash">Dinheiro / Carteira</option>
                            <option value="other">Outro / Investimento</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-[#121212] block mb-1">Saldo Inicial (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={newAccBalance}
                            onChange={(e) => setNewAccBalance(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsCreatingNew(false)}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-[#121212] text-[#D4AF37] text-xs font-extrabold rounded-xl shadow-md border border-[#D4AF37] cursor-pointer"
                        >
                          Salvar e Selecionar
                        </button>
                      </div>
                    </form>
                  )}

                  {/* FORM FOR NEW CATEGORY */}
                  {activePicker === 'category' && (
                    <form onSubmit={handleCreateCategorySubmit} className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-[#121212] block mb-1">Nome da Categoria *</label>
                        <input
                          type="text"
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                          placeholder="Ex: Alimentação, Moradia, Lazer..."
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#D4AF37]"
                          required
                          autoFocus
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-[#121212] block mb-1">Tipo de Lançamento</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setNewCatType('expense');
                              if (newCatRuleGroup === 'income') setNewCatRuleGroup('50_essentials');
                              if (newCatColor === '#00C853') setNewCatColor('#E11D48');
                            }}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer transition ${
                              newCatType === 'expense'
                                ? 'bg-[#121212] text-[#D4AF37] border-[#D4AF37]'
                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            Despesa
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewCatType('income');
                              setNewCatRuleGroup('income');
                              if (newCatColor === '#E11D48') setNewCatColor('#00C853');
                            }}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer transition ${
                              newCatType === 'income'
                                ? 'bg-[#00C853] text-[#121212] border-[#00A843] font-black'
                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            Receita
                          </button>
                        </div>
                      </div>

                      {/* Regra 50/30/20 Selector for Expenses */}
                      {newCatType === 'expense' && (
                        <div>
                          <label className="text-xs font-bold text-[#121212] block mb-1">
                            Classificação Regra 50 / 30 / 20
                          </label>
                          <div className="space-y-2">
                            <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                              newCatRuleGroup === '50_essentials' ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-400' : 'bg-gray-50 border-gray-200'
                            }`}>
                              <input
                                type="radio"
                                name="quickCatRuleGroup"
                                checked={newCatRuleGroup === '50_essentials'}
                                onChange={() => {
                                  setNewCatRuleGroup('50_essentials');
                                  if (newCatColor === '#D97706' || newCatColor === '#059669' || newCatColor === '#00C853') {
                                    setNewCatColor('#E11D48');
                                  }
                                }}
                                className="mt-0.5 accent-rose-600"
                              />
                              <div>
                                <span className="text-xs font-extrabold text-rose-800 block">50% - Necessidades Básicas / Essenciais</span>
                                <span className="text-[10px] text-gray-600 block">Moradia, Aluguel, Feira, Luz, Água, Saúde e Transporte</span>
                              </div>
                            </label>

                            <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                              newCatRuleGroup === '30_lifestyle' ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-400' : 'bg-gray-50 border-gray-200'
                            }`}>
                              <input
                                type="radio"
                                name="quickCatRuleGroup"
                                checked={newCatRuleGroup === '30_lifestyle'}
                                onChange={() => {
                                  setNewCatRuleGroup('30_lifestyle');
                                  if (newCatColor === '#E11D48' || newCatColor === '#059669' || newCatColor === '#00C853') {
                                    setNewCatColor('#D97706');
                                  }
                                }}
                                className="mt-0.5 accent-amber-600"
                              />
                              <div>
                                <span className="text-xs font-extrabold text-amber-800 block">30% - Estilo de Vida & Desejos</span>
                                <span className="text-[10px] text-gray-600 block">Restaurantes, Viagens, Compras, Estética e Streaming</span>
                              </div>
                            </label>

                            <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                              newCatRuleGroup === '20_investment' ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-400' : 'bg-gray-50 border-gray-200'
                            }`}>
                              <input
                                type="radio"
                                name="quickCatRuleGroup"
                                checked={newCatRuleGroup === '20_investment'}
                                onChange={() => {
                                  setNewCatRuleGroup('20_investment');
                                  if (newCatColor === '#E11D48' || newCatColor === '#D97706' || newCatColor === '#00C853') {
                                    setNewCatColor('#059669');
                                  }
                                }}
                                className="mt-0.5 accent-emerald-600"
                              />
                              <div>
                                <span className="text-xs font-extrabold text-emerald-800 block">20% - Reserva & Futuro / Investimentos</span>
                                <span className="text-[10px] text-gray-600 block">Tesouro, CDB, Reserva de Emergência, Ações e Objetivos</span>
                              </div>
                            </label>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-bold text-[#121212] block mb-1">Cor de Identificação</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={newCatColor}
                            onChange={(e) => setNewCatColor(e.target.value)}
                            className="w-9 h-9 rounded-xl cursor-pointer border border-gray-200"
                          />
                          <span className="text-xs text-gray-700 font-mono">{newCatColor}</span>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsCreatingNew(false)}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-[#121212] text-[#D4AF37] text-xs font-extrabold rounded-xl shadow-md border border-[#D4AF37] cursor-pointer"
                        >
                          Salvar e Selecionar
                        </button>
                      </div>
                    </form>
                  )}

                  {/* FORM FOR NEW SUBCATEGORY */}
                  {activePicker === 'subcategory' && (
                    <form onSubmit={handleCreateSubcategorySubmit} className="space-y-3">
                      <div>
                        <div className="mb-2 p-2 bg-amber-50 rounded-xl border border-amber-200">
                          <span className="text-[11px] text-gray-700 block font-medium">
                            Categoria selecionada:{' '}
                            <strong className="text-[#121212]">
                              {selectedCategory?.name || activeCategories.find((c) => c.id === categoryId)?.name || activeCategories[0]?.name || 'Geral'}
                            </strong>
                          </span>
                        </div>

                        {(!selectedCategory || activeCategories.length > 1) && (
                          <div className="mb-2">
                            <label className="text-xs font-bold text-[#121212] block mb-1">Alterar Categoria Pai (Opcional):</label>
                            <select
                              value={categoryId || (selectedCategory?.id || activeCategories[0]?.id || '')}
                              onChange={(e) => {
                                setCategoryId(e.target.value);
                                setSubcategoryId('');
                              }}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-[#121212] focus:ring-2 focus:ring-[#D4AF37]"
                            >
                              {activeCategories
                                .filter((c) => c.type === (type === 'transfer' ? 'expense' : type))
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}

                        <label className="text-xs font-bold text-[#121212] block mb-1">Nome da Subcategoria *</label>
                        <input
                          type="text"
                          value={newSubName}
                          onChange={(e) => setNewSubName(e.target.value)}
                          placeholder="Ex: Veterinário, Ração, Assinaturas..."
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#D4AF37]"
                          required
                          autoFocus
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsCreatingNew(false)}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-[#121212] text-[#D4AF37] text-xs font-extrabold rounded-xl shadow-md border border-[#D4AF37] cursor-pointer"
                        >
                          Salvar e Selecionar
                        </button>
                      </div>
                    </form>
                  )}

                  {/* FORM FOR NEW FAMILY MEMBER */}
                  {activePicker === 'familyMember' && (
                    <form onSubmit={handleCreateFamilyMemberSubmit} className="space-y-3">
                      <div>
                        <label className="text-xs font-bold text-[#121212] block mb-1">Nome do Membro da Família *</label>
                        <input
                          type="text"
                          value={newMemberName}
                          onChange={(e) => setNewMemberName(e.target.value)}
                          placeholder="Ex: Sofia, Lucas, Mãe..."
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#D4AF37]"
                          required
                          autoFocus
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-[#121212] block mb-1">Parentesco / Relação</label>
                        <input
                          type="text"
                          value={newMemberRelation}
                          onChange={(e) => setNewMemberRelation(e.target.value)}
                          placeholder="Ex: Cônjuge, Filho(a), Dependente, Titular..."
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsCreatingNew(false)}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-[#121212] text-[#D4AF37] text-xs font-extrabold rounded-xl shadow-md border border-[#D4AF37] cursor-pointer"
                        >
                          Salvar e Selecionar
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : (
                /* Standard Selection List with Search and "+ Cadastrar Novo" Button */
                <div className="flex flex-col flex-1 overflow-hidden space-y-3">
                  {/* Search Input Bar */}
                  <div className="relative shrink-0">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      placeholder="Pesquisar..."
                      className="w-full pl-9 pr-8 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:bg-white"
                      autoFocus
                    />
                    {pickerSearch && (
                      <button
                        type="button"
                        onClick={() => setPickerSearch('')}
                        className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 p-0.5 rounded-md"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* "+ Cadastrar Novo" Action Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (activePicker === 'category') {
                        const initialCatType = type === 'income' ? 'income' : 'expense';
                        setNewCatType(initialCatType);
                        setNewCatRuleGroup(initialCatType === 'income' ? 'income' : '50_essentials');
                        setNewCatColor(initialCatType === 'income' ? '#00C853' : '#E11D48');
                      }
                      setIsCreatingNew(true);
                    }}
                    className="w-full py-2.5 px-3 bg-[#D4AF37] hover:bg-[#c49f27] text-[#121212] font-extrabold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>
                      {activePicker === 'account' || activePicker === 'targetAccount'
                        ? 'Cadastrar Nova Conta'
                        : activePicker === 'category'
                        ? 'Cadastrar Nova Categoria'
                        : activePicker === 'subcategory'
                        ? 'Cadastrar Nova Subcategoria'
                        : 'Cadastrar Novo Membro da Família'}
                    </span>
                  </button>

                  {/* Scrollable Options List */}
                  <div className="overflow-y-auto flex-1 divide-y divide-gray-100 border border-gray-200 rounded-xl">
                    {/* ACCOUNT OPTIONS LIST */}
                    {(activePicker === 'account' || activePicker === 'targetAccount') && (
                      <>
                        {accounts
                          .filter((a) =>
                            activePicker === 'targetAccount' ? a.id !== accountId : true
                          )
                          .filter((a) =>
                            pickerSearch
                              ? a.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
                                getAccountTypeLabel(a.type).toLowerCase().includes(pickerSearch.toLowerCase())
                              : true
                          )
                          .map((acc) => {
                            const isSelected =
                              activePicker === 'targetAccount'
                                ? acc.id === targetAccountId
                                : acc.id === accountId;

                            return (
                              <button
                                key={acc.id}
                                type="button"
                                onClick={() => {
                                  if (activePicker === 'targetAccount') {
                                    setTargetAccountId(acc.id);
                                  } else {
                                    setAccountId(acc.id);
                                  }
                                  setActivePicker(null);
                                }}
                                className={`w-full p-3 text-left flex items-center justify-between hover:bg-amber-50 transition cursor-pointer ${
                                  isSelected ? 'bg-amber-50/80 font-bold' : ''
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                                    style={{ backgroundColor: acc.color || '#2563EB' }}
                                  />
                                  <div>
                                    <span className="text-xs text-[#121212] font-bold block">
                                      {acc.name}
                                    </span>
                                    <span className="text-[10px] text-gray-500 font-medium">
                                      {getAccountTypeLabel(acc.type)}
                                    </span>
                                  </div>
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-[#D4AF37] stroke-[3]" />}
                              </button>
                            );
                          })}
                      </>
                    )}

                    {/* CATEGORY OPTIONS LIST */}
                    {activePicker === 'category' && (
                      <>
                        {activeCategories
                          .filter((c) => c.type === (type === 'transfer' ? 'expense' : type))
                          .filter((c) =>
                            pickerSearch
                              ? c.name.toLowerCase().includes(pickerSearch.toLowerCase())
                              : true
                          )
                          .map((cat) => {
                            const isSelected = cat.id === categoryId;

                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => {
                                  setCategoryId(cat.id);
                                  setSubcategoryId('');
                                  setActivePicker(null);
                                }}
                                className={`w-full p-3 text-left flex items-center justify-between hover:bg-amber-50 transition cursor-pointer ${
                                  isSelected ? 'bg-amber-50/80 font-bold' : ''
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                                    style={{ backgroundColor: cat.color || '#D4AF37' }}
                                  />
                                  <span className="text-xs text-[#121212] font-bold">
                                    {cat.name}
                                  </span>
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-[#D4AF37] stroke-[3]" />}
                              </button>
                            );
                          })}
                      </>
                    )}

                    {/* SUBCATEGORY OPTIONS LIST */}
                    {activePicker === 'subcategory' && (
                      <>
                        {/* Option 0: Nenhuma / Geral */}
                        {(!pickerSearch || 'nenhuma geral'.includes(pickerSearch.toLowerCase())) && (
                          <button
                            type="button"
                            onClick={() => {
                              setSubcategoryId('');
                              setActivePicker(null);
                            }}
                            className={`w-full p-3 text-left flex items-center justify-between hover:bg-amber-50 transition cursor-pointer ${
                              !subcategoryId ? 'bg-amber-50/80 font-bold' : ''
                            }`}
                          >
                            <span className="text-xs text-gray-700 font-semibold">Nenhuma / Geral</span>
                            {!subcategoryId && <Check className="w-4 h-4 text-[#D4AF37] stroke-[3]" />}
                          </button>
                        )}

                        {flatSubcategories
                          .filter((sub) =>
                            pickerSearch
                              ? sub.fullPath.toLowerCase().includes(pickerSearch.toLowerCase())
                              : true
                          )
                          .map((sub) => {
                            const isSelected = sub.id === subcategoryId;

                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => {
                                  setSubcategoryId(sub.id);
                                  setActivePicker(null);
                                }}
                                className={`w-full p-3 text-left flex items-center justify-between hover:bg-amber-50 transition cursor-pointer ${
                                  isSelected ? 'bg-amber-50/80 font-bold' : ''
                                }`}
                              >
                                <span className="text-xs text-[#121212] font-medium">
                                  {sub.fullPath}
                                </span>
                                {isSelected && <Check className="w-4 h-4 text-[#D4AF37] stroke-[3]" />}
                              </button>
                            );
                          })}
                      </>
                    )}

                    {/* FAMILY MEMBER OPTIONS LIST */}
                    {activePicker === 'familyMember' && (
                      <>
                        {/* Option 0: Geral / Família Toda */}
                        {(!pickerSearch || 'geral família toda'.includes(pickerSearch.toLowerCase())) && (
                          <button
                            type="button"
                            onClick={() => {
                              setFamilyMemberId('');
                              setActivePicker(null);
                            }}
                            className={`w-full p-3 text-left flex items-center justify-between hover:bg-amber-50 transition cursor-pointer ${
                              !familyMemberId ? 'bg-amber-50/80 font-bold' : ''
                            }`}
                          >
                            <div>
                              <span className="text-xs text-[#121212] font-bold block">
                                Geral / Família Toda
                              </span>
                              <span className="text-[10px] text-gray-500">
                                Despesa/Receita de interesse comum
                              </span>
                            </div>
                            {!familyMemberId && <Check className="w-4 h-4 text-[#D4AF37] stroke-[3]" />}
                          </button>
                        )}

                        {familyMembers
                          .filter((fm) =>
                            pickerSearch
                              ? fm.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
                                (fm.relationship && fm.relationship.toLowerCase().includes(pickerSearch.toLowerCase()))
                              : true
                          )
                          .map((fm) => {
                            const isSelected = fm.id === familyMemberId;

                            return (
                              <button
                                key={fm.id}
                                type="button"
                                onClick={() => {
                                  setFamilyMemberId(fm.id);
                                  setActivePicker(null);
                                }}
                                className={`w-full p-3 text-left flex items-center justify-between hover:bg-amber-50 transition cursor-pointer ${
                                  isSelected ? 'bg-amber-50/80 font-bold' : ''
                                }`}
                              >
                                <div>
                                  <span className="text-xs text-[#121212] font-bold block">
                                    {fm.name}
                                  </span>
                                  {fm.relationship && (
                                    <span className="text-[10px] text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-md font-semibold inline-block mt-0.5">
                                      {fm.relationship}
                                    </span>
                                  )}
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-[#D4AF37] stroke-[3]" />}
                              </button>
                            );
                          })}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
