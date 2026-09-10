import React, { useState } from 'react';
import { Account, AccountType } from '../types';
import { formatCurrency } from '../utils/finance';
import { Wallet, Plus, CreditCard, Building2, PiggyBank, Edit2, Trash2, CheckCircle2, X, Search, ChevronDown, Check } from 'lucide-react';

const ACCOUNT_TYPES: { id: AccountType; label: string }[] = [
  { id: 'checking', label: 'Conta Corrente' },
  { id: 'credit', label: 'Cartão de Crédito' },
  { id: 'savings', label: 'Investimentos / Poupança' },
  { id: 'cash', label: 'Dinheiro em Espécie' },
  { id: 'other', label: 'Outra' },
];

interface AccountsViewProps {
  accounts: Account[];
  accountBalances: Record<string, { currentBalance: number; consolidatedBalance: number }>;
  onSaveAccount: (account: Account, updatedAccounts?: Account[]) => Promise<any> | void;
  onDeleteAccount: (id: string) => Promise<any> | void;
  userId: string;
  isReadOnly?: boolean;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  accounts,
  accountBalances,
  onSaveAccount,
  onDeleteAccount,
  userId,
  isReadOnly = false,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [initialBalance, setInitialBalance] = useState('');
  const [color, setColor] = useState('#E11D48');
  const [isTypePickerOpen, setIsTypePickerOpen] = useState(false);
  const [typeSearch, setTypeSearch] = useState('');

  const handleOpenAdd = () => {
    setEditingAccount(null);
    setName('');
    setType('checking');
    setInitialBalance('0');
    setColor('#E11D48');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (acc: Account) => {
    setEditingAccount(acc);
    setName(acc.name);
    setType(acc.type);
    setInitialBalance(acc.initialBalance !== undefined && acc.initialBalance !== null ? String(acc.initialBalance) : '0');
    setColor(acc.color || '#E11D48');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const parsedBalance = typeof initialBalance === 'number' 
      ? initialBalance 
      : parseFloat(String(initialBalance).replace(',', '.')) || 0;

    const accToSave: Account = {
      id: editingAccount ? editingAccount.id : `acc_${Date.now()}`,
      userId: editingAccount?.userId || userId,
      name: name.trim(),
      type,
      initialBalance: parsedBalance,
      color,
      icon: type === 'credit' ? 'CreditCard' : type === 'savings' ? 'PiggyBank' : 'Building2',
      updatedAt: new Date().toISOString(),
      _pendingSync: true,
    };

    const existingIndex = accounts.findIndex(a => a.id === accToSave.id);
    let novaListaDeContas: Account[];
    if (existingIndex >= 0) {
      novaListaDeContas = accounts.map(a => a.id === accToSave.id ? accToSave : a);
    } else {
      novaListaDeContas = [...accounts, accToSave];
    }

    await onSaveAccount(accToSave, novaListaDeContas);
    setIsModalOpen(false);
  };

  const getAccountTypeLabel = (accType: AccountType) => {
    switch (accType) {
      case 'checking':
        return 'Conta Corrente';
      case 'credit':
        return 'Cartão de Crédito';
      case 'savings':
        return 'Investimentos / Poupança';
      case 'cash':
        return 'Dinheiro em Espécie';
      default:
        return 'Outra Conta';
    }
  };

  const totalProjected = accounts.reduce((acc, a) => {
    const bal = accountBalances[a.id];
    return acc + (bal ? bal.currentBalance : a.initialBalance);
  }, 0);

  const totalConsolidated = accounts.reduce((acc, a) => {
    const bal = accountBalances[a.id];
    return acc + (bal ? bal.consolidatedBalance : a.initialBalance);
  }, 0);

  return (
    <div className="space-y-6 pb-12" id="accounts-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-gray-200 rounded-3xl p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#D4AF37]" />
            <h1 className="text-lg font-bold text-[#121212] font-serif">Gerenciamento de Contas Financeiras</h1>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Cadastre e organize suas contas bancárias, cartões e carteiras
          </p>
        </div>

        {!isReadOnly && (
          <button
            onClick={handleOpenAdd}
            className="min-h-[42px] sm:min-h-[44px] py-2.5 px-4 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer border border-[#00A843] shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3] shrink-0" />
            <span>Nova Conta</span>
          </button>
        )}
      </div>

      {/* Total Accounts Summary Box */}
      <div className="bg-[#121212] text-white rounded-3xl p-6 shadow-md border-2 border-[#D4AF37] grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-[#D4AF37] uppercase tracking-wider block">
            Saldo Total Projetado (Geral)
          </span>
          <p
            className={`text-2xl sm:text-3xl font-extrabold font-serif ${
              totalProjected >= 0 ? 'text-[#00C853] font-black drop-shadow-xs' : 'text-[#FF3D00] font-black drop-shadow-xs'
            }`}
          >
            {formatCurrency(totalProjected)}
          </p>
          <p className="text-[11px] text-gray-400">Soma de todas as contas com previstos</p>
        </div>

        <div className="space-y-1 sm:border-l sm:border-gray-800 sm:pl-6">
          <span className="text-[11px] font-bold text-[#D4AF37] uppercase tracking-wider block">
            Saldo Total Efetivado (Geral)
          </span>
          <p
            className={`text-2xl sm:text-3xl font-extrabold font-serif ${
              totalConsolidated >= 0 ? 'text-[#00C853] font-black drop-shadow-xs' : 'text-[#FF3D00] font-black drop-shadow-xs'
            }`}
          >
            {formatCurrency(totalConsolidated)}
          </p>
          <p className="text-[11px] text-gray-400">Soma de todas as contas conciliadas</p>
        </div>
      </div>

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((acc) => {
          const bal = accountBalances[acc.id] || {
            currentBalance: acc.initialBalance,
            consolidatedBalance: acc.initialBalance,
          };

          return (
            <div
              key={acc.id}
              className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs hover:shadow-md transition space-y-4 relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#121212] font-bold shadow-xs"
                    style={{ backgroundColor: acc.color || '#D4AF37' }}
                  >
                    {acc.type === 'credit' ? (
                      <CreditCard className="w-5 h-5" />
                    ) : acc.type === 'savings' ? (
                      <PiggyBank className="w-5 h-5" />
                    ) : (
                      <Building2 className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#121212] font-serif">{acc.name}</h3>
                    <span className="text-[11px] text-gray-600 font-medium">{getAccountTypeLabel(acc.type)}</span>
                  </div>
                </div>

                {!isReadOnly && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(acc)}
                      className="p-1.5 text-gray-600 hover:text-[#121212] hover:bg-gray-100 rounded-xl transition cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {accounts.length > 1 && (
                      <button
                        onClick={() => onDeleteAccount(acc.id)}
                        className="p-1.5 text-gray-400 hover:text-[#FF3D00] hover:bg-[#FF3D00]/10 rounded-xl transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Balance Details */}
              <div className="pt-2 border-t border-gray-100 space-y-2">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Saldo Atual Projetado</span>
                  <p
                    className={`text-xl font-extrabold font-serif ${
                      bal.currentBalance < 0 ? 'text-[#FF3D00] font-black' : 'text-[#00C853]'
                    }`}
                  >
                    {formatCurrency(bal.currentBalance)}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                  <span className="text-gray-600 font-medium">Saldo Efetivado:</span>
                  <span
                    className={`font-bold ${
                      bal.consolidatedBalance < 0 ? 'text-[#FF3D00] font-black' : 'text-[#00C853]'
                    }`}
                  >
                    {formatCurrency(bal.consolidatedBalance)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Account Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#18181B] text-white border-2 border-[#D4AF37] rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-base font-extrabold text-white font-serif">
                {editingAccount ? 'Editar Conta' : 'Nova Conta Financeira'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl text-gray-400 hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Nome da Conta *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Itaú Corrente, Nubank, Investimentos..."
                  className="w-full px-3 py-2 bg-[#18181B] border border-white/20 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Tipo de Conta *</label>
                <button
                  type="button"
                  onClick={() => {
                    setTypeSearch('');
                    setIsTypePickerOpen(true);
                  }}
                  className="w-full px-3 py-2.5 bg-[#18181B] hover:bg-white/5 border border-white/20 hover:border-[#D4AF37] rounded-xl text-xs text-white flex items-center justify-between transition cursor-pointer"
                >
                  <span className="font-bold truncate">
                    {ACCOUNT_TYPES.find((t) => t.id === type)?.label || 'Selecione o tipo'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Saldo Inicial (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  className="w-full px-3 py-2 bg-[#18181B] border border-white/20 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#D4AF37]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Cor do Cartão / Ícone</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer border border-white/20 bg-transparent"
                  />
                  <span className="text-xs text-gray-300 font-mono">{color}</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs rounded-xl shadow-md transition cursor-pointer mt-2 border border-[#00A843]"
              >
                Salvar Conta
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Type Picker Modal */}
      {isTypePickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsTypePickerOpen(false);
          }}
        >
          <div className="bg-[#18181B] border-2 border-[#D4AF37] rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white font-serif">Selecionar Tipo de Conta</h3>
              <button
                type="button"
                onClick={() => setIsTypePickerOpen(false)}
                className="p-1 rounded-xl text-gray-400 hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Pesquisar tipo..."
                value={typeSearch}
                onChange={(e) => setTypeSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-[#18181B] border border-white/20 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
                autoFocus
              />
              {typeSearch && (
                <button
                  type="button"
                  onClick={() => setTypeSearch('')}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1 divide-y divide-white/10 border border-white/10 rounded-xl">
              {ACCOUNT_TYPES
                .filter((t) => t.label.toLowerCase().includes(typeSearch.toLowerCase()))
                .map((t) => {
                  const isSelected = type === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setType(t.id);
                        setIsTypePickerOpen(false);
                      }}
                      className={`w-full p-3 text-left flex items-center justify-between hover:bg-white/10 transition cursor-pointer ${
                        isSelected ? 'bg-white/10 font-bold text-[#D4AF37]' : 'text-gray-200'
                      }`}
                    >
                      <span className="text-xs font-bold">{t.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-[#D4AF37] stroke-[3]" />}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
