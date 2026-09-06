import React, { useState } from 'react';
import { ShieldAlert, Trash2, UserX, AlertTriangle, X, Mail, Headphones } from 'lucide-react';
import { User } from '../types';
import { appwriteDatabases as databases } from '../lib/appwrite';
import { StorageService } from '../services/storage';
import { Query } from 'appwrite';

interface CriticalActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onResetBudgetToZero: () => void;
  onDeleteAccount: () => void;
  activeBudgetId?: string;
  currentBudgetId?: string;
  setTransactions?: (txs: any[]) => void;
  setAccounts?: (accs: any[]) => void;
  setRollover?: (val: number) => void;
  setTotalBalance?: (val: number) => void;
}

export const CriticalActionsModal: React.FC<CriticalActionsModalProps> = ({
  isOpen,
  onClose,
  user,
  onResetBudgetToZero,
  onDeleteAccount,
  activeBudgetId,
  currentBudgetId,
  setTransactions,
  setAccounts,
  setRollover,
  setTotalBalance,
}) => {
  const [confirmingAction, setConfirmingAction] = useState<'reset' | 'delete' | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  if (!isOpen) return null;

  const handleExecuteZerarOrcamento = async () => {
    (window as any).__PAUSE_ALL_SYNCS__ = true;

    const resolvedBudgetId = activeBudgetId || currentBudgetId || StorageService.getEffectiveBudgetId(user);
    const targetDocId = resolvedBudgetId || user?.budgetId || user?.id || user?.$id;
    if (!targetDocId) {
      alert('[DEDO-DURO ERRO] ID do Orçamento está VAZIO ou INDEFINIDO! Operação cancelada.');
      (window as any).__PAUSE_ALL_SYNCS__ = false;
      return;
    }

    const DATABASE_ID = '6a83aa8d0038331e040f';
    const BUDGET_COLLECTION_ID = 'user_financials';
    const TRANSACTIONS_COLLECTION_ID = 'transactions';

    try {
      // 1. Busca e remove todas as transações persistidas na coleção avulsa (se houver)
      try {
        const userTransactions = await databases.listDocuments(
          DATABASE_ID,
          TRANSACTIONS_COLLECTION_ID,
          [Query.equal('budgetId', targetDocId)]
        );

        await Promise.all(
          userTransactions.documents.map((doc) =>
            databases.deleteDocument(DATABASE_ID, TRANSACTIONS_COLLECTION_ID, doc.$id)
          )
        );
      } catch (err) {
        console.warn('Coleção de transações avulsas não encontrada ou já limpa:', err);
      }

      // 2. Obtém o documento atual para inspecionar o schema e chaves de vínculo
      let currentDoc: any = {};
      try {
        currentDoc = await databases.getDocument(DATABASE_ID, BUDGET_COLLECTION_ID, targetDocId);
      } catch (docErr) {
        console.warn('Não foi possível buscar o documento atual, prosseguindo com dados padrão:', docErr);
      }

      const cleanState = {
        transactions: [],
        accounts: [{ id: 'default', name: 'Conta Principal', balance: 0, initialBalance: 0, type: 'checking' }],
        investments: [],
        assets: [],
        goals: [],
        rollover: 0,
        accumulatedRollover: 0,
        previousBalance: 0,
        previousMonthBalance: 0,
        initialBalance: 0,
        carryOver: 0,
        monthlyRollovers: {},
        monthlyClosings: [],
        updatedAt: new Date().toISOString()
      };

      const updatePayload: Record<string, any> = {
        data: JSON.stringify(cleanState),
        updatedAt: new Date().toISOString()
      };

      if (currentDoc.userId) updatePayload.userId = currentDoc.userId;
      if (currentDoc.budgetId) updatePayload.budgetId = currentDoc.budgetId;

      const response = await databases.updateDocument(
        DATABASE_ID,
        BUDGET_COLLECTION_ID,
        targetDocId,
        updatePayload
      );

      console.log('[DEDO-DURO] Retorno do Appwrite:', response);

      // 3. Expurgo local completo de chaves financeiras e recarga seca
      Object.keys(localStorage).forEach((k) => {
        const lower = k.toLowerCase();
        if (!lower.includes('cookie') && !lower.includes('session') && !lower.includes('appwrite')) {
          localStorage.removeItem(k);
        }
      });

      alert('[SUCESSO] Orçamento zerado com sucesso no servidor!');

      if (setTransactions) setTransactions([]);
      if (setAccounts) setAccounts([{ id: 'default', name: 'Conta Principal', balance: 0, initialBalance: 0 }]);
      if (setRollover) setRollover(0);
      if (setTotalBalance) setTotalBalance(0);

      onResetBudgetToZero();
      setConfirmingAction(null);
      onClose();

      window.location.replace(window.location.origin + window.location.pathname);
    } catch (error: any) {
      (window as any).__PAUSE_ALL_SYNCS__ = false;
      alert(`[DEDO-DURO DETECTOU ERRO]\n\nFalha ao gravar no Appwrite!\nCódigo: ${error.code || 'Desconhecido'}\nMensagem: ${error.message || JSON.stringify(error)}\nDoc ID tentado: ${targetDocId}`);
      console.error('[DEDO-DURO EXCEÇÃO]:', error);
    }
  };

  const handleConfirmDelete = () => {
    onDeleteAccount();
    setDeleteConfirmationText('');
    setConfirmingAction(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border-2 border-[#FF3D00] relative my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-100 text-[#FF3D00] rounded-2xl shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#121212] font-serif">
                Menu de Ações Críticas
              </h2>
              <p className="text-xs text-gray-500">
                Operações sensíveis de segurança da conta
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setConfirmingAction(null);
              onClose();
            }}
            className="p-1 text-gray-400 hover:text-black hover:bg-gray-100 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - STRICTLY CONTAINS ONLY THESE TWO OPTIONS */}
        <div className="py-4 space-y-3">
          {confirmingAction === null ? (
            <div className="space-y-3">
              <p className="text-xs text-gray-600 font-medium">
                Selecione uma das opções críticas abaixo:
              </p>

              {/* OPÇÃO 1: Zerar Orçamento */}
              <button
                type="button"
                onClick={() => setConfirmingAction('reset')}
                className="w-full text-left p-4 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 rounded-2xl transition flex items-center justify-between gap-3 cursor-pointer group shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-200 text-amber-800 rounded-xl group-hover:scale-105 transition">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-amber-950">1. Zerar Orçamento</h3>
                    <p className="text-[11px] text-amber-800">Limpar todos os lançamentos e iniciar saldo em R$ 0,00</p>
                  </div>
                </div>
              </button>

              {/* OPÇÃO 2: Excluir Conta */}
              <button
                type="button"
                onClick={() => setConfirmingAction('delete')}
                className="w-full text-left p-4 bg-red-50 hover:bg-red-100 text-[#FF3D00] border border-red-200 rounded-2xl transition flex items-center justify-between gap-3 cursor-pointer group shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-200 text-[#FF3D00] rounded-xl group-hover:scale-105 transition">
                    <UserX className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-[#FF3D00]">2. Excluir Conta</h3>
                    <p className="text-[11px] text-red-700">Excluir permanentemente seu cadastro e dados do sistema</p>
                  </div>
                </div>
              </button>

              {/* OPÇÃO 3: Fale Conosco / Suporte Oficial */}
              <a
                href="mailto:suporte.dinheirosemfiltro@gmail.com?subject=Atendimento%20ao%20Cliente%20-%20Dinheiro%20Sem%20Filtro"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-left p-4 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-2xl transition flex items-center justify-between gap-3 cursor-pointer group shadow-xs block"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-200 text-blue-800 rounded-xl group-hover:scale-105 transition">
                    <Headphones className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-blue-900 flex items-center gap-1.5">
                      <span>3. Fale Conosco</span>
                      <span className="text-[10px] bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full uppercase">Atendimento</span>
                    </h3>
                    <p className="text-[11px] text-blue-700">Dúvidas, suporte ou solicitações (suporte.dinheirosemfiltro@gmail.com)</p>
                  </div>
                </div>
              </a>
            </div>
          ) : confirmingAction === 'reset' ? (
            /* Confirm Modal for Zerar Orçamento */
            <div className="space-y-4 animate-in fade-in bg-amber-50 p-4 rounded-2xl border-2 border-amber-400">
              <div className="flex items-center gap-2 text-amber-900 font-black text-xs sm:text-sm uppercase tracking-wider">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Confirmação de Segurança</span>
              </div>
              <p className="text-xs text-amber-950 leading-relaxed">
                <strong>⚠️ ATENÇÃO:</strong> Esta ação é <strong>irreversível e não poderá ser desfeita</strong>. Todos os seus lançamentos, receitas e despesas serão permanentemente zerados.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmingAction(null)}
                  className="w-full sm:flex-1 py-2.5 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-100 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExecuteZerarOrcamento}
                  className="w-full sm:flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Sim, Zerar Orçamento
                </button>
              </div>
            </div>
          ) : (
            /* Confirm Modal for Excluir Conta */
            <div className="space-y-4 animate-in fade-in bg-red-50 p-4 rounded-2xl border-2 border-red-400">
              <div className="flex items-center gap-2 text-[#FF3D00] font-black text-xs sm:text-sm uppercase tracking-wider">
                <AlertTriangle className="w-5 h-5 text-[#FF3D00] shrink-0 animate-bounce" />
                <span>Confirmação Dupla de Segurança</span>
              </div>
              <p className="text-xs text-red-950 leading-relaxed">
                <strong>⚠️ ATENÇÃO EXTREMA:</strong> A exclusão da conta é <strong>permanente e não poderá ser desfeita</strong>. Seu cadastro ({user.email}), dados e configurações serão excluídos do sistema.
              </p>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-red-900 block">
                  Digite <span className="bg-red-200 px-1 py-0.5 rounded font-mono font-black">EXCLUIR</span> para confirmar:
                </label>
                <input
                  type="text"
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  placeholder="EXCLUIR"
                  className="w-full px-3 py-2 bg-white border border-red-300 rounded-xl text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmationText('');
                    setConfirmingAction(null);
                  }}
                  className="w-full sm:flex-1 py-2.5 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-100 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={deleteConfirmationText.trim().toUpperCase() !== 'EXCLUIR'}
                  onClick={handleConfirmDelete}
                  className={`w-full sm:flex-1 py-2.5 text-xs font-black rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    deleteConfirmationText.trim().toUpperCase() === 'EXCLUIR'
                      ? 'bg-[#FF3D00] hover:bg-red-700 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <UserX className="w-4 h-4" />
                  Sim, Excluir Minha Conta
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Close */}
        <div className="pt-3 border-t border-gray-200 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setConfirmingAction(null);
              onClose();
            }}
            className="py-2 px-4 bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Fechar Menu
          </button>
        </div>
      </div>
    </div>
  );
};
