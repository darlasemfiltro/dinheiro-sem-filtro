import React, { useState, useEffect } from 'react';
import {
  getAppwriteConfig,
  saveAppwriteConfig,
  checkAppwriteConnection,
  AppwriteStatus,
  appwriteAccount,
} from '../lib/appwrite';
import {
  syncUserDataWithAppwrite,
  fetchUserDataFromAppwrite,
  syncPortfolioWithAppwrite,
  fetchPortfolioFromAppwrite,
  getCanonicalAppwriteDocId,
} from '../lib/appwriteSync';
import { StorageService, getCanonicalUserId } from '../services/storage';
import { PortfolioStorageService } from '../services/portfolioStorage';
import {
  Cloud,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  X,
  UploadCloud,
  DownloadCloud,
  Shield,
  HelpCircle,
  Database,
  ExternalLink,
  Key,
  Layers,
} from 'lucide-react';

interface AppwriteSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSyncComplete?: () => void;
}

export const AppwriteSettingsModal: React.FC<AppwriteSettingsModalProps> = ({
  isOpen,
  onClose,
  userId,
  onSyncComplete,
}) => {
  const [config, setConfig] = useState(() => getAppwriteConfig());
  const [status, setStatus] = useState<AppwriteStatus | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const current = getAppwriteConfig();
      setConfig(current);
      runQuickTest();
    }
  }, [isOpen]);

  const runQuickTest = async () => {
    setIsTesting(true);
    try {
      const res = await checkAppwriteConnection();
      setStatus(res);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsTesting(true);
    setFeedback({ type: 'info', message: 'Salvando configurações e testando conexão...' });

    try {
      saveAppwriteConfig({
        endpoint: config.endpoint.trim(),
        projectId: config.projectId.trim(),
        databaseId: config.databaseId.trim(),
        apiKey: config.apiKey?.trim(),
        supportEmail: config.supportEmail?.trim() || 'suporte.dinheirosemfiltro@gmail.com',
      });

      const res = await checkAppwriteConnection();
      setStatus(res);

      if (res.connected) {
        setFeedback({
          type: 'success',
          message: 'Conectado ao Cloud Appwrite com sucesso! Sincronizando dados...',
        });
        await handleSyncNow();
      } else {
        setFeedback({
          type: 'error',
          message: `Falha na conexão: ${res.message}. Verifique se o Project ID está correto.`,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Erro ao conectar: ${err?.message || 'Erro desconhecido'}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setFeedback({ type: 'info', message: 'Sincronizando dados entre o aparelho e o Appwrite...' });

    try {
      const canonicalId = getCanonicalUserId(userId || 'default');

      // 1. Sincroniza Orçamento Familiar
      await StorageService.syncUserDataWithRemote(canonicalId);

      // 2. Sincroniza Carteira de Investimentos
      await PortfolioStorageService.loadPortfolioFromRemote(canonicalId);
      await PortfolioStorageService.syncPortfolioWithRemote(canonicalId);

      if (onSyncComplete) onSyncComplete();

      setFeedback({
        type: 'success',
        message: 'Sincronização com Appwrite concluída! Todos os lançamentos e contas estão atualizados na nuvem.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Erro durante sincronização: ${err?.message || 'Verifique as coleções do Appwrite.'}`,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleForceUpload = async () => {
    window.dispatchEvent(new CustomEvent('app-confirm', {
      detail: {
        message: 'Deseja enviar todos os lançamentos, contas e categorias deste aparelho para a nuvem Appwrite?',
        onConfirm: async () => {
          setIsSyncing(true);
          setFeedback({ type: 'info', message: 'Enviando dados locais para o Cloud Appwrite...' });

          try {
            const canonicalId = getCanonicalUserId(userId || 'default');
            const accounts = StorageService.getAccounts(canonicalId);
            const categories = StorageService.getCategories(canonicalId);
            const familyMembers = StorageService.getFamilyMembers(canonicalId);
            const transactions = StorageService.getTransactions(canonicalId);
            const goals = StorageService.getGoals(canonicalId);

            const ok = await syncUserDataWithAppwrite(canonicalId, {
              accounts,
              categories,
              familyMembers,
              transactions,
              goals,
              deletedIds: Array.from(StorageService.getDeletedIds(canonicalId)),
            });

            // Também envia carteira de investimentos
            const assets = PortfolioStorageService.getAssets(canonicalId);
            const portTxs = PortfolioStorageService.getTransactions(canonicalId);
            const divs = PortfolioStorageService.getDividends(canonicalId);
            const portGoals = PortfolioStorageService.getGoals(canonicalId);
            await syncPortfolioWithAppwrite(canonicalId, {
              assets,
              transactions: portTxs,
              dividends: divs,
              goals: portGoals,
            });

            if (ok) {
              setFeedback({
                type: 'success',
                message: 'Dados enviados com sucesso para o Appwrite! Abra o outro aparelho para carregar.',
              });
            } else {
              setFeedback({
                type: 'error',
                message: 'Não foi possível enviar ao Appwrite. Verifique o Project ID e permissões da coleção.',
              });
            }
          } catch (err: any) {
            setFeedback({ type: 'error', message: `Erro ao enviar: ${err?.message}` });
          } finally {
            setIsSyncing(false);
          }
        }
      }
    }));
  };

  const handleForceDownload = async () => {
    window.dispatchEvent(new CustomEvent('app-confirm', {
      detail: {
        message: 'Deseja baixar os dados salvos na nuvem Appwrite para este aparelho?',
        onConfirm: async () => {
          setIsSyncing(true);
          setFeedback({ type: 'info', message: 'Baixando dados do Cloud Appwrite...' });

          try {
            const canonicalId = getCanonicalUserId(userId || 'default');
            const remoteData = await fetchUserDataFromAppwrite(canonicalId);

            if (remoteData) {
              if (Array.isArray(remoteData.accounts)) {
                const all = JSON.parse(localStorage.getItem('darla_accounts') || '[]').filter((a: any) => a.userId !== canonicalId);
                localStorage.setItem('darla_accounts', JSON.stringify([...all, ...remoteData.accounts]));
              }
              if (Array.isArray(remoteData.categories)) {
                const all = JSON.parse(localStorage.getItem('darla_categories') || '[]').filter((c: any) => c.userId !== canonicalId);
                localStorage.setItem('darla_categories', JSON.stringify([...all, ...remoteData.categories]));
              }
              if (Array.isArray(remoteData.familyMembers)) {
                const all = JSON.parse(localStorage.getItem('darla_family_members') || '[]').filter((f: any) => f.userId !== canonicalId);
                localStorage.setItem('darla_family_members', JSON.stringify([...all, ...remoteData.familyMembers]));
              }
              if (Array.isArray(remoteData.transactions)) {
                const all = JSON.parse(localStorage.getItem('darla_transactions') || '[]').filter((t: any) => t.userId !== canonicalId);
                localStorage.setItem('darla_transactions', JSON.stringify([...all, ...remoteData.transactions]));
              }
              if (Array.isArray(remoteData.goals)) {
                const all = JSON.parse(localStorage.getItem('darla_goals') || '[]').filter((g: any) => g.userId !== canonicalId);
                localStorage.setItem('darla_goals', JSON.stringify([...all, ...remoteData.goals]));
              }

              const remotePort = await fetchPortfolioFromAppwrite(canonicalId);
              if (remotePort) {
                if (remotePort.assets) {
                  localStorage.setItem(`darla_portfolio_assets_${canonicalId}`, JSON.stringify(remotePort.assets));
                }
                if (remotePort.transactions) {
                  localStorage.setItem(`darla_portfolio_transactions_${canonicalId}`, JSON.stringify(remotePort.transactions));
                }
                if (remotePort.dividends) {
                  localStorage.setItem(`darla_portfolio_dividends_${canonicalId}`, JSON.stringify(remotePort.dividends));
                }
                if (remotePort.goals) {
                  localStorage.setItem(`darla_portfolio_goals_${canonicalId}`, JSON.stringify(remotePort.goals));
                }
              }

              window.dispatchEvent(new CustomEvent('financial_data_mutated'));

              if (onSyncComplete) onSyncComplete();

              setFeedback({
                type: 'success',
                message: 'Dados baixados com sucesso do Appwrite e aplicados neste aparelho!',
              });
              setTimeout(() => window.location.reload(), 1500);
            } else {
              setFeedback({
                type: 'error',
                message: 'Nenhum dado encontrado no Appwrite para este usuário. Envie os dados primeiro a partir do aparelho principal.',
              });
            }
          } catch (err: any) {
            setFeedback({ type: 'error', message: `Erro ao baixar: ${err?.message}` });
          } finally {
            setIsSyncing(false);
          }
        }
      }
    }));
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
      id="appwrite-settings-modal-overlay"
    >
      <div
        className="relative w-full max-w-xl bg-[#18181B] text-white border-2 border-[#D4AF37] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        id="appwrite-settings-modal-container"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-gradient-to-r from-black via-zinc-900 to-black flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#D4AF37]/20 border border-[#D4AF37] rounded-xl text-[#D4AF37]">
              <Cloud className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>Sincronização Cloud Appwrite</span>
                <span className="text-[10px] px-2 py-0.5 bg-[#00C853] text-[#121212] font-black rounded-md uppercase">
                  Tempo Real
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Sincronize celular, tablet e computador sem perda de lançamentos
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white transition cursor-pointer"
            id="close-appwrite-settings-modal-btn"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Connection Status Card */}
          <div
            className={`p-4 rounded-2xl border flex items-start gap-3.5 transition ${
              status?.connected
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-100'
                : 'bg-amber-950/40 border-amber-500/50 text-amber-100'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {status?.connected ? (
                <CheckCircle className="w-5 h-5 text-emerald-400 stroke-[2.5]" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse stroke-[2.5]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-extrabold text-xs sm:text-sm text-white">
                  {status?.connected ? 'Conectado ao Cloud Appwrite' : 'Configuração do Appwrite'}
                </span>
                <button
                  onClick={runQuickTest}
                  disabled={isTesting}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-black transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Testar Conexão"
                >
                  <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Testando...' : 'Testar Conexão'}</span>
                </button>
              </div>
              <p className="text-xs text-gray-300 mt-1">
                {status?.message || 'Verifique as credenciais do Appwrite abaixo para sincronizar entre aparelhos.'}
              </p>
            </div>
          </div>

          {/* Feedback message */}
          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs font-bold border animate-in fade-in ${
                feedback.type === 'success'
                  ? 'bg-emerald-900/60 text-emerald-200 border-emerald-600'
                  : feedback.type === 'error'
                  ? 'bg-red-900/60 text-red-200 border-red-600'
                  : 'bg-blue-900/60 text-blue-200 border-blue-600'
              }`}
            >
              {feedback.message}
            </div>
          )}

          {/* Form Settings */}
          <form onSubmit={handleSave} className="space-y-3.5 bg-black/40 p-4 rounded-2xl border border-white/10">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-black text-[#D4AF37] flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" />
                  <span>Project ID do Appwrite Cloud</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowHelp(!showHelp)}
                  className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>Onde encontrar?</span>
                </button>
              </div>
              <input
                type="text"
                value={config.projectId}
                onChange={(e) => setConfig({ ...config, projectId: e.target.value })}
                placeholder="Ex: 66ab1234cde56789..."
                className="w-full px-3.5 py-2.5 bg-zinc-900 border border-white/20 rounded-xl text-xs sm:text-sm text-white focus:outline-hidden focus:border-[#D4AF37] transition font-mono"
              />
              {showHelp && (
                <div className="mt-2 p-3 bg-zinc-900 border border-amber-500/30 rounded-xl text-[11px] text-gray-300 space-y-2">
                  <p className="font-bold text-amber-300">Checklist no Appwrite Cloud (cloud.appwrite.io):</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-gray-300">
                    <li>
                      <strong className="text-white">Project ID</strong>: Copie em <em>Settings</em> do seu projeto e cole acima.
                    </li>
                    <li>
                      <strong className="text-white">Platform Web</strong>: Em <em>Settings &gt; Platforms &gt; Add Platform &gt; Web App</em>, cadastre o domínio do app (ex: <code className="text-amber-200">*.pages.dev</code> ou <code className="text-amber-200">localhost</code>).
                    </li>
                    <li>
                      <strong className="text-white">Database</strong>: Em <em>Databases</em>, crie o banco com ID <code className="text-amber-200 font-bold">dinheiro.semfiltro</code>.
                    </li>
                    <li>
                      <strong className="text-white">Coleção 'user_financials'</strong>: Crie a coleção com ID <code className="text-amber-200 font-bold">user_financials</code>:
                      <ul className="list-disc list-inside ml-4 text-[10px] text-gray-400">
                        <li>Atributos: <code>userId</code> (String 255), <code>data</code> (String 1000000+), <code>updatedAt</code> (String 255).</li>
                        <li>Permissões: Em <em>Settings &gt; Permissions</em>, adicione a Role <strong>Any</strong> e marque Create, Read, Update, Delete.</li>
                      </ul>
                    </li>
                    <li>
                      <strong className="text-white">Coleção 'user_portfolios'</strong>: Crie a coleção com ID <code className="text-amber-200 font-bold">user_portfolios</code> (mesmos atributos e permissão Role <strong>Any</strong>).
                    </li>
                  </ol>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-black text-gray-300 mb-1 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Database ID</span>
                </label>
                <input
                  type="text"
                  value={config.databaseId}
                  onChange={(e) => setConfig({ ...config, databaseId: e.target.value })}
                  placeholder="dinheiro.semfiltro"
                  className="w-full px-3.5 py-2 bg-zinc-900 border border-white/20 rounded-xl text-xs text-white focus:outline-hidden focus:border-[#D4AF37] transition font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-black text-gray-300 mb-1 flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>API Endpoint</span>
                </label>
                <input
                  type="text"
                  value={config.endpoint}
                  onChange={(e) => setConfig({ ...config, endpoint: e.target.value })}
                  placeholder="https://cloud.appwrite.io/v1"
                  className="w-full px-3.5 py-2 bg-zinc-900 border border-white/20 rounded-xl text-xs text-white focus:outline-hidden focus:border-[#D4AF37] transition font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-black text-gray-300 mb-1 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Appwrite API Key</span>
                </label>
                <input
                  type="password"
                  value={config.apiKey}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  placeholder="standard_99d92ec8..."
                  className="w-full px-3.5 py-2 bg-zinc-900 border border-white/20 rounded-xl text-xs text-white focus:outline-hidden focus:border-[#D4AF37] transition font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-black text-gray-300 mb-1 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>E-mail de Recuperação / Suporte</span>
                </label>
                <input
                  type="email"
                  value={config.supportEmail}
                  onChange={(e) => setConfig({ ...config, supportEmail: e.target.value })}
                  placeholder="suporte.dinheirosemfiltro@gmail.com"
                  className="w-full px-3.5 py-2 bg-zinc-900 border border-emerald-500/50 rounded-xl text-xs text-emerald-300 font-bold focus:outline-hidden focus:border-[#D4AF37] transition"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="submit"
                disabled={isTesting || isSyncing}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#D4AF37] hover:bg-[#b5952f] text-[#121212] font-black rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                {isTesting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                <span>Salvar e Conectar Appwrite</span>
              </button>
            </div>
          </form>

          {/* Manual Sync Actions */}
          <div className="p-4 bg-black/40 rounded-2xl border border-white/10 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#D4AF37] flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span>Ações Rápidas de Sincronização</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                onClick={handleSyncNow}
                disabled={isSyncing || isTesting}
                className="p-3 bg-white/5 hover:bg-[#D4AF37]/20 border border-white/15 hover:border-[#D4AF37] rounded-xl text-left transition flex flex-col justify-between gap-2 cursor-pointer group disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <RefreshCw className={`w-4 h-4 text-[#D4AF37] group-hover:rotate-180 transition duration-300 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span className="text-[10px] font-black text-amber-300 uppercase">Recomendado</span>
                </div>
                <div>
                  <div className="text-xs font-black text-white">Sincronizar Tudo</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Une celular e computador</div>
                </div>
              </button>

              <button
                onClick={handleForceUpload}
                disabled={isSyncing || isTesting}
                className="p-3 bg-white/5 hover:bg-emerald-500/20 border border-white/15 hover:border-emerald-500 rounded-xl text-left transition flex flex-col justify-between gap-2 cursor-pointer group disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <UploadCloud className="w-4 h-4 text-emerald-400 group-hover:-translate-y-0.5 transition" />
                  <span className="text-[10px] font-black text-emerald-400 uppercase">Upload</span>
                </div>
                <div>
                  <div className="text-xs font-black text-white">Enviar pra Nuvem</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Envia dados deste aparelho</div>
                </div>
              </button>

              <button
                onClick={handleForceDownload}
                disabled={isSyncing || isTesting}
                className="p-3 bg-white/5 hover:bg-blue-500/20 border border-white/15 hover:border-blue-500 rounded-xl text-left transition flex flex-col justify-between gap-2 cursor-pointer group disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <DownloadCloud className="w-4 h-4 text-blue-400 group-hover:translate-y-0.5 transition" />
                  <span className="text-[10px] font-black text-blue-400 uppercase">Download</span>
                </div>
                <div>
                  <div className="text-xs font-black text-white">Baixar da Nuvem</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Puxa do Appwrite pra cá</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-white/10 bg-black/60 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2 truncate">
            <Shield className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span className="truncate">Conta: <strong>{userId}</strong></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
