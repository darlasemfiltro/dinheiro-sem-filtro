import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DarlaLogo } from './DarlaLogo';
import { User } from '../types';
import { StorageService } from '../services/storage';
import { realtimeSync, SyncConnectionStatus } from '../services/websocket';
import { Plus, LogOut, Calendar, ChevronDown, ExternalLink, Users, Trash2, Edit3, X, User as UserIcon, Check, Crown, Key, UserPlus, Bell, Shield, ShieldAlert, Flame, Lock, Mail, Calculator, Eye, EyeOff, AlertCircle, ZoomIn, ZoomOut, RotateCcw, RefreshCw, Cloud, Wifi, WifiOff } from 'lucide-react';
import { getMonthYearLabel, usePrivacyMode } from '../utils/finance';
import { GamificationService } from '../services/gamification';
import { appwriteDatabases } from '../lib/appwrite';
import { persistCurrentStateToAppwrite } from '../lib/appwriteSync';
import darlaLogoImg from '../assets/images/darla_logo_1785015447784.jpg';


interface HeaderProps {
  user: User;
  syncProgress: number | null;
  currentYear: number;
  currentMonth: number;
  onYearMonthChange: (year: number, month: number) => void;
  onOpenNewTransaction: () => void;
  onOpenSharedBudgetModal: () => void;
  onOpenEditProfile?: (tab?: 'profile' | 'request_access' | 'give_access' | 'notifications') => void;
  onOpenCriticalActionsModal?: () => void;
  onUpdateUserName?: (newName: string) => void;
  onResetBudgetToZero?: () => void;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  zoomLevel?: number;
  onZoomChange?: (newZoom: number) => void;
  onForceSync?: () => Promise<void> | void;
  onOpenAppwriteSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  syncProgress,
  currentYear,
  currentMonth,
  onYearMonthChange,
  onOpenNewTransaction,
  onOpenSharedBudgetModal,
  onOpenEditProfile,
  onOpenCriticalActionsModal,
  onUpdateUserName,
  onResetBudgetToZero,
  onLogout,
  activeTab,
  setActiveTab,
  zoomLevel = 100,
  onZoomChange,
  onForceSync,
  onOpenAppwriteSettings,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isEditNameModalOpen, setIsEditNameModalOpen] = useState(false);
  const [newName, setNewName] = useState(user.name);
  const [isJitDismissed, setIsJitDismissed] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [connStatus, setConnStatus] = useState<SyncConnectionStatus>(() => realtimeSync.getStatus());
  const [pendingNotifications, setPendingNotifications] = useState(() =>
    StorageService.getPendingNotifications(user.email)
  );
  
  // Show sync completion pop-up
  useEffect(() => {
    if (syncProgress === 100) {
      setSyncToast('Todas as atualizações foram concluídas!');
      setTimeout(() => setSyncToast(null), 3000);
    }
  }, [syncProgress]);

  useEffect(() => {
    const unsub = realtimeSync.onStatusChange((status) => {
      setConnStatus(status);
    });
    return () => {
      unsub();
    };
  }, []);


  const isPrivacyActive = usePrivacyMode();

  const togglePrivacyMode = () => {
    StorageService.setPrivacyMode(!isPrivacyActive);
  };

  const jitNotice = React.useMemo(() => {
    try {
      const txs = StorageService.getTransactions(user.id);
      if (!txs || txs.length === 0) {
        return {
          title: 'Inicie sua Ofensiva!',
          message: 'Cadastre sua primeira receita ou despesa para ganhar seus primeiros pontos de XP.',
        };
      }
      const sorted = [...txs].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const lastTxDate = new Date(sorted[0].date);
      const diffDays = Math.floor((new Date().getTime() - lastTxDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 3) {
        return {
          title: 'Mantenha sua Ofensiva Semanal Ativa! ⏰',
          message: `Faz ${diffDays} dias que você não registra gastos. Registre seus lançamentos para garantir sua sequência!`,
        };
      }
    } catch (e) {
      // fallback
    }
    return null;
  }, [user.id]);

  React.useEffect(() => {
    let isMounted = true;

    const syncNotifs = async () => {
      if (!user.email) return;
      const effectiveBudgetId = StorageService.getEffectiveBudgetId(user);
      const budget = StorageService.getSharedBudget(effectiveBudgetId, user);
      const notifs = await StorageService.syncNotificationsWithServer(user.email, budget.code);
      if (isMounted) {
        setPendingNotifications(notifs);
      }
    };

    // Initial sync
    syncNotifs();

    const handleNotifsEvent = () => {
      if (user.email) {
        const effectiveBudgetId = StorageService.getEffectiveBudgetId(user);
        const budget = StorageService.getSharedBudget(effectiveBudgetId, user);
        const currentPending = StorageService.getPendingNotifications(user.email, budget?.code);
        if (isMounted) {
          setPendingNotifications(currentPending);
        }
      }
    };

    window.addEventListener('notifications_updated', handleNotifsEvent);

    // Poll every 3 seconds for new invitations/requests from other phones/devices
    const interval = setInterval(syncNotifs, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('notifications_updated', handleNotifsEvent);
    };
  }, [user.email]);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim() && onUpdateUserName) {
      onUpdateUserName(newName.trim());
    }
    setIsEditNameModalOpen(false);
  };

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      onYearMonthChange(currentYear - 1, 12);
    } else {
      onYearMonthChange(currentYear, currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      onYearMonthChange(currentYear + 1, 1);
    } else {
      onYearMonthChange(currentYear, currentMonth + 1);
    }
  };

  const handleToday = () => {
    const now = new Date();
    onYearMonthChange(now.getFullYear(), now.getMonth() + 1);
  };

  const isReadOnly = StorageService.isCurrentUserReadOnly(user);

  return (
    <header
      className="bg-white border-b border-gray-200 shadow-xs py-1 sm:py-2.5"
      id="main-header"
    >
      {/* Pending Invitations / Access Requests In-App Notification Banner */}
      {pendingNotifications.length > 0 && (
        <div className="bg-[#D4AF37] text-[#121212] px-3 py-1.5 text-[11px] sm:text-xs font-black flex items-center justify-between gap-2 shadow-xs mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <Bell className="w-3.5 h-3.5 text-[#121212] animate-pulse shrink-0" />
            <span className="truncate">
              🔔 Convite/solicitação ({pendingNotifications.length}) pendente!
            </span>
          </div>
          <button
            onClick={onOpenSharedBudgetModal}
            className="py-0.5 px-2 bg-[#121212] hover:bg-black text-[#D4AF37] text-[10px] font-black rounded-md transition cursor-pointer shrink-0 shadow-xs whitespace-nowrap"
          >
            Ver e Aceitar
          </button>
        </div>
      )}

      {/* Read-Only Banner */}
      {isReadOnly && (
        <div className="bg-blue-600 text-white px-3 py-1 text-[11px] sm:text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-inner mb-1">
          <Lock className="w-3 h-3 shrink-0" />
          <span>Modo Leitura (Apenas Visualizar)</span>
        </div>
      )}

      {/* Just-in-Time Behavioral Alert Banner (Dismissible) */}
      {jitNotice && !isJitDismissed && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-300 px-3 py-1 sm:py-1.5 shadow-inner">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 text-[11px] sm:text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="p-0.5 bg-amber-500 text-white rounded shrink-0">
                <AlertCircle className="w-3.5 h-3.5" />
              </span>
              <div className="truncate">
                <span className="font-extrabold text-amber-950 mr-1">{jitNotice.title}:</span>
                <span className="text-amber-900 font-medium hidden sm:inline">{jitNotice.message}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setActiveTab('gamification')}
                className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded shrink-0 transition text-[10px] sm:text-[11px] cursor-pointer whitespace-nowrap"
              >
                Ofensiva
              </button>
              <button
                onClick={() => setIsJitDismissed(true)}
                className="p-0.5 text-amber-700 hover:text-amber-950 transition cursor-pointer rounded"
                title="Fechar aviso"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 space-y-1">
        {/* Row 1: Logo on Left, User Profile Avatar Dropdown PINNED ON TOP RIGHT */}
        <div className="flex items-start justify-between gap-2 w-full" id="header-top-row">
          {/* Left Column: Logo and Saiba Mais below logo */}
          <div className="flex flex-col items-start gap-1 min-w-0" id="header-left-column">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="hover:opacity-95 transition text-left cursor-pointer shrink-0"
              id="header-logo-btn"
            >
              <DarlaLogo size="sm" showSubtext={false} />
            </button>
            <a
              href="https://beacons.ai/darla.semfiltro"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 hover:bg-[#D4AF37]/15 text-[#121212] hover:text-[#D4AF37] font-extrabold text-[11px] sm:text-xs rounded-lg transition border border-gray-300 shadow-2xs shrink-0 cursor-pointer"
              id="header-saiba-mais-btn"
              title="Conheça o canal DARLA SEM FILTRO"
            >
              <ExternalLink className="w-3 h-3 text-[#D4AF37] shrink-0 stroke-[2.5]" />
              <span>Saiba Mais</span>
            </a>
          </div>

          {/* Right Column: Sync status & User Profile Avatar Dropdown (ALWAYS PINNED TOP RIGHT ABOVE MENU BUTTON) */}
          <div className="relative shrink-0 ml-auto flex items-center gap-1.5 sm:gap-2.5" id="header-profile-dropdown">
            <button
              onClick={async () => {
                try {
                  const effectiveBudgetId = StorageService.getEffectiveBudgetId(user);
                  const currentState = {
                    transactions: StorageService.getTransactions(effectiveBudgetId),
                    accounts: StorageService.getAccounts(effectiveBudgetId),
                    categories: StorageService.getCategories(effectiveBudgetId),
                    goals: StorageService.getGoals(effectiveBudgetId),
                    familyMembers: StorageService.getFamilyMembers(effectiveBudgetId),
                    updatedAt: new Date().toISOString()
                  };
                  const ok = await persistCurrentStateToAppwrite(currentState);
                  if (ok) {
                    alert('SUCESSO! Estado real sincronizado no Appwrite (documento 6a849358002db9e638ce)!');
                  } else {
                    alert('Falha ao sincronizar estado real com o Appwrite.');
                  }
                } catch (err: any) {
                  alert('ERRO APPWRITE: ' + (err.message || JSON.stringify(err)));
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#121212] hover:bg-[#D4AF37] text-[#D4AF37] hover:text-[#121212] font-black text-xs rounded-xl transition shadow-md cursor-pointer shrink-0 border border-[#D4AF37]"
              id="test-appwrite-sync-btn"
              title="Testar Conexão Nuvem Appwrite"
            >
              <Cloud className="w-4 h-4 shrink-0 stroke-[2.5]" />
              <span className="hidden sm:inline">Testar Conexão Nuvem</span>
            </button>

            <button
              onClick={() => {
                setShowUserMenu(!showUserMenu);
              }}
              className="flex items-center gap-1.5 p-1 rounded-2xl hover:bg-[#D4AF37]/15 transition cursor-pointer min-h-[38px] sm:min-h-[44px]"
              id="header-user-menu-trigger"
              title="Clique para abrir Menu do Titular, Alterar Informações, Pedir/Dar Acesso e Sair do App"
            >
              {/* Amarelo Escuro Mostarda (#D4AF37) Clean Circle Accent with User Avatar Photo / Initial */}
              <div className="flex flex-col items-center gap-1">
                <div className="relative rounded-full p-0.5 bg-[#D4AF37] ring-1 ring-[#D4AF37] shadow-xs">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#121212] text-[#D4AF37] font-black text-xs sm:text-base flex items-center justify-center uppercase shadow-xs overflow-hidden border border-[#D4AF37]">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      user.name ? user.name.trim().charAt(0).toUpperCase() : 'U'
                    )}
                  </div>
                  {pendingNotifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#FF3D00] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white animate-pulse">
                      {pendingNotifications.length}
                    </span>
                  )}
                </div>

              </div>
              <span className="hidden md:inline text-xs sm:text-sm font-black text-[#121212] max-w-[120px] truncate">
                {user.name}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#D4AF37] stroke-[3]" />
            </button>

            {/* Fixed Right Side Drawer Menu for Titular User Options */}
            {showUserMenu && createPortal(
              <div className="fixed inset-0 z-[999999] flex justify-end" id="header-user-drawer-overlay">
                {/* Backdrop Click-to-Close */}
                <div
                  className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity animate-in fade-in"
                  onClick={() => setShowUserMenu(false)}
                  id="header-user-drawer-backdrop"
                />

                {/* Right Slide-Over Menu Panel */}
                <div
                  className="relative w-85 max-w-[88vw] bg-white text-[#121212] border-l-2 border-[#D4AF37] h-full shadow-2xl flex flex-col z-[999999] animate-in slide-in-from-right duration-200 overflow-y-auto"
                  id="header-user-drawer-panel"
                >
                  {/* Drawer Header */}
                  <div className="p-4 sm:p-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-amber-50 to-white">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#121212] text-[#D4AF37] font-black text-xl sm:text-2xl flex items-center justify-center uppercase shrink-0 shadow-lg ring-2 ring-[#D4AF37] overflow-hidden border-2 border-[#D4AF37]">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          user.name ? user.name.trim().charAt(0).toUpperCase() : 'U'
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-black text-[#121212] flex items-center gap-1.5 truncate">
                          <span>{user.name}</span>
                          <Shield className="w-4 h-4 text-[#D4AF37] shrink-0" />
                        </h2>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        <span className="inline-block mt-1 px-2.5 py-0.5 bg-[#00C853] text-[#121212] text-[10px] font-black rounded-md uppercase tracking-wider">
                          TITULAR DO ORÇAMENTO
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowUserMenu(false)}
                      className="p-1.5 rounded-xl bg-gray-100 hover:bg-[#D4AF37] text-gray-700 hover:text-[#121212] transition cursor-pointer shrink-0 ml-2"
                      id="close-header-user-drawer-btn"
                    >
                      <X className="w-5 h-5 stroke-[2.5]" />
                    </button>
                  </div>

                  {/* Menu Options List */}
                  <div className="p-4 space-y-2 flex-1">
                    {/* Pending Notifications in Drawer */}
                    {pendingNotifications.length > 0 && (
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onOpenSharedBudgetModal();
                        }}
                        className="w-full text-left p-3 bg-amber-100 hover:bg-[#D4AF37] text-[#121212] border-2 border-[#D4AF37] rounded-2xl text-xs font-black transition flex items-center justify-between gap-2 cursor-pointer shadow-xs animate-pulse"
                      >
                        <div className="flex items-center gap-2.5">
                          <Bell className="w-4 h-4 text-[#121212] shrink-0" />
                          <span>Convites/Solicitações Pendentes</span>
                        </div>
                        <span className="px-2 py-0.5 bg-[#121212] text-[#D4AF37] text-[10px] font-black rounded-full">
                          {pendingNotifications.length}
                        </span>
                      </button>
                    )}

                    <p className="text-[10px] uppercase font-black tracking-widest text-[#D4AF37] px-1 py-1">
                      OPÇÕES DO TITULAR:
                    </p>


                    {/* 1. SAIR DA CONTA */}
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onLogout();
                      }}
                      className="w-full text-left p-3 bg-red-50 hover:bg-red-100 text-[#FF3D00] border border-red-200 rounded-2xl text-xs font-black transition flex items-center gap-3 cursor-pointer shadow-xs"
                      id="user-drawer-logout-btn"
                    >
                      <LogOut className="w-4 h-4 text-[#FF3D00] shrink-0 stroke-[2.5]" />
                      <span>SAIR DA CONTA</span>
                    </button>

                    {/* 2. Alterar Informações do Usuário */}
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        if (onOpenEditProfile) onOpenEditProfile('profile');
                      }}
                      className="w-full text-left p-3 bg-gray-50 hover:bg-amber-50 text-[#121212] hover:border-[#D4AF37] border border-gray-200 rounded-2xl text-xs font-bold transition flex items-center gap-3 cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4 text-[#D4AF37] shrink-0" />
                      <span>Alterar Informações do Usuário</span>
                    </button>

                    {/* 3. Acesso ao seu Orçamento (Conectar) */}
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        if (onOpenEditProfile) onOpenEditProfile('give_access');
                      }}
                      className="w-full text-left p-3 bg-gray-50 hover:bg-amber-50 text-[#121212] hover:border-[#D4AF37] border border-gray-200 rounded-2xl text-xs font-bold transition flex items-center gap-3 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4 text-[#D4AF37] shrink-0" />
                      <span>Acesso ao seu Orçamento (Conectar)</span>
                    </button>

                    {/* 4. Pedir Acesso a Outro Orçamento (Conectar) */}
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        if (onOpenEditProfile) onOpenEditProfile('request_access');
                      }}
                      className="w-full text-left p-3 bg-gray-50 hover:bg-emerald-50 text-[#121212] hover:border-[#00C853] border border-gray-200 rounded-2xl text-xs font-bold transition flex items-center gap-3 cursor-pointer"
                    >
                      <Key className="w-4 h-4 text-[#00C853] shrink-0" />
                      <span>Pedir Acesso a Outro Orçamento (Conectar)</span>
                    </button>

                    {/* 5. Gerenciar Orçamentos Conectados */}
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenSharedBudgetModal();
                      }}
                      className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 text-[#121212] hover:border-gray-400 border border-gray-200 rounded-2xl text-xs font-bold transition flex items-center gap-3 cursor-pointer"
                    >
                      <Users className="w-4 h-4 text-[#D4AF37] shrink-0" />
                      <span>Gerenciar Orçamentos Conectados</span>
                    </button>

                    {/* 6. Sincronização Nuvem Appwrite (Celular & Computador) */}
                    {onOpenAppwriteSettings && (
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onOpenAppwriteSettings();
                        }}
                        className="w-full text-left p-3 bg-amber-50 hover:bg-amber-100 text-[#121212] border border-[#D4AF37] rounded-2xl text-xs font-black transition flex items-center justify-between gap-3 cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-center gap-3">
                          <Cloud className="w-4 h-4 text-[#D4AF37] shrink-0 stroke-[2.5]" />
                          <span>Sincronização Nuvem (Appwrite)</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 bg-[#D4AF37] text-[#121212] font-black rounded-md uppercase">
                          CONFIGURAR
                        </span>
                      </button>
                    )}

                    {/* 6. Ajuste de Zoom do Aplicativo */}
                    <div className="p-3.5 bg-gradient-to-br from-amber-50/80 to-gray-50 border border-amber-200 rounded-2xl space-y-2.5 shadow-2xs">
                      <div className="flex items-center justify-between text-xs font-black text-[#121212]">
                        <span className="flex items-center gap-2">
                          <ZoomIn className="w-4 h-4 text-[#D4AF37]" />
                          Zoom do Aplicativo ({zoomLevel}%)
                        </span>
                        {zoomLevel !== 100 && (
                          <button
                            onClick={() => onZoomChange && onZoomChange(100)}
                            className="text-[10px] font-black text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer"
                            title="Redefinir para 100%"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Reset (100%)
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-1.5">
                        <button
                          onClick={() => onZoomChange && onZoomChange(zoomLevel - 10)}
                          disabled={zoomLevel <= 50}
                          className="flex-1 py-1.5 bg-white hover:bg-amber-100 text-gray-800 border border-gray-300 rounded-xl text-xs font-black flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 shadow-2xs"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                          Diminuir
                        </button>
                        <span className="px-3 py-1.5 bg-gray-200/80 rounded-xl text-xs font-black text-[#121212] min-w-[55px] text-center">
                          {zoomLevel}%
                        </span>
                        <button
                          onClick={() => onZoomChange && onZoomChange(zoomLevel + 10)}
                          disabled={zoomLevel >= 200}
                          className="flex-1 py-1.5 bg-white hover:bg-amber-100 text-gray-800 border border-gray-300 rounded-xl text-xs font-black flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 shadow-2xs"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                          Aumentar
                        </button>
                      </div>
                      <div className="grid grid-cols-6 gap-1 pt-0.5">
                        {[50, 75, 100, 125, 150, 200].map((preset) => (
                          <button
                            key={preset}
                            onClick={() => onZoomChange && onZoomChange(preset)}
                            className={`px-1 py-1 rounded-lg text-[10px] font-black cursor-pointer transition text-center ${
                              zoomLevel === preset
                                ? 'bg-[#D4AF37] text-white shadow-xs ring-1 ring-[#D4AF37]'
                                : 'bg-white text-gray-700 border border-gray-200 hover:bg-amber-50'
                            }`}
                          >
                            {preset}%
                          </button>
                        ))}
                      </div>
                    </div>


                    {/* 7. Planos & Assinatura VIP */}
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        setActiveTab('plans');
                      }}
                      className="w-full text-left p-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-950 border border-amber-300 rounded-2xl text-xs font-black transition flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Crown className="w-4 h-4 text-amber-600 fill-amber-300 shrink-0" />
                        <span>Planos & Assinatura VIP</span>
                      </div>
                      <span className="text-[9px] bg-[#00C853] text-[#121212] px-2 py-0.5 rounded-md font-black uppercase">
                        90D GRÁTIS
                      </span>
                    </button>

                    {/* 8. Menu de Ações Críticas (Exclusivo para Zerar Orçamento e Excluir Conta) */}
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        if (onOpenCriticalActionsModal) {
                          onOpenCriticalActionsModal();
                        }
                      }}
                      className="w-full text-left p-3.5 bg-red-50 hover:bg-red-100 text-[#FF3D00] border-2 border-red-200 rounded-2xl text-xs font-black transition flex items-center justify-between gap-3 cursor-pointer shadow-xs group"
                      id="user-drawer-critical-actions-btn"
                    >
                      <div className="flex items-center gap-3">
                        <ShieldAlert className="w-4 h-4 text-[#FF3D00] shrink-0 stroke-[2.5] group-hover:scale-110 transition" />
                        <span>Menu de Ações Críticas</span>
                      </div>
                      <span className="text-[9px] bg-[#FF3D00] text-white px-2 py-0.5 rounded-md font-black uppercase tracking-wider whitespace-nowrap shrink-0">
                        SENSÍVEL
                      </span>
                    </button>

                    {/* 9. Fale Conosco (Atendimento & Suporte por E-mail) */}
                    <a
                      href="mailto:suporte.dinheirosemfiltro@gmail.com?subject=Atendimento%20ao%20Cliente%20-%20Dinheiro%20Sem%20Filtro"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setShowUserMenu(false)}
                      className="w-full text-left p-3.5 bg-blue-50 hover:bg-blue-100 text-blue-950 border border-blue-200 rounded-2xl text-xs font-black transition flex items-center justify-between gap-3 cursor-pointer shadow-xs group block"
                      id="user-drawer-fale-conosco-btn"
                    >
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-blue-600 shrink-0 stroke-[2.5] group-hover:scale-110 transition" />
                        <span>Fale Conosco</span>
                      </div>
                      <span className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded-md font-black uppercase tracking-wider whitespace-nowrap shrink-0">
                        SUPORTE
                      </span>
                    </a>
                  </div>

                  {/* Drawer Footer */}
                  <div className="p-4 border-t border-gray-200 bg-gray-50 text-[11px] text-gray-500 text-center">
                    <p className="font-bold text-[#121212]">Dinheiro Sem Filtro</p>
                    <p className="text-[10px]">Gestão Financeira Descomplicada</p>
                  </div>
                </div>
              </div>,
              document.body
            )}
          </div>
        </div>

        {/* Row 2: Header Action Buttons Container */}
        <div className="flex items-center justify-start sm:justify-end gap-1.5 pt-0.5 pb-0.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex-nowrap w-full" id="header-action-buttons">
          {/* Ofensiva Semanal Button */}
          {(() => {
            const gameState = GamificationService.getGamificationState(user.id);
            return (
              <button
                onClick={() => setActiveTab('gamification')}
                className="min-h-[36px] sm:min-h-[42px] py-1.5 px-2.5 sm:py-2 sm:px-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:to-red-600 text-white font-black text-[11px] sm:text-xs rounded-xl shadow-xs hover:scale-105 transition flex items-center gap-1.5 cursor-pointer shrink-0 border border-amber-300 whitespace-nowrap"
                id="header-ofensiva-btn"
                title="Ver Ofensiva Semanal & Meta XP Mensal"
              >
                <Flame className="w-3.5 h-3.5 text-white fill-amber-200 animate-pulse shrink-0" />
                <span>{gameState.weeklyStreakCount} Semanas</span>
              </button>
            );
          })()}

          {/* Modo Snapshot de Segurança / Privacidade Rápida */}
          <button
            onClick={togglePrivacyMode}
            className={`min-h-[36px] sm:min-h-[42px] py-1.5 px-2.5 sm:py-2 sm:px-3.5 font-black text-[11px] sm:text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0 border whitespace-nowrap ${
              isPrivacyActive
                ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-300'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-300'
            }`}
            id="header-privacy-mode-btn"
            title={isPrivacyActive ? 'Ocultando valores (Modo Privacidade Ativo)' : 'Ocultar Valores Sensíveis (Modo Snapshot)'}
          >
            {isPrivacyActive ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-white shrink-0" />
                <span>Valores Ocultos</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-gray-700 shrink-0" />
                <span>Modo Privacidade</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal para Editar Nome do Usuário */}
      {isEditNameModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-2 border-[#D4AF37] relative">
            <button
              onClick={() => setIsEditNameModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-[#121212] hover:bg-gray-100 rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-[#D4AF37]/20 rounded-2xl text-[#D4AF37]">
                <Edit3 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#121212]">Editar Nome do Usuário</h3>
                <p className="text-xs text-gray-600">Altere como seu nome é exibido no aplicativo</p>
              </div>
            </div>

            <form onSubmit={handleSaveName} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#121212] mb-1">
                  Nome Completo
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#D4AF37] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Digite seu nome"
                    className="w-full pl-10 pr-4 py-2.5 text-xs bg-gray-50 border border-gray-300 rounded-xl text-[#121212] font-bold focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditNameModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-extrabold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition cursor-pointer border border-[#00A843]"
                >
                  <Check className="w-4 h-4" />
                  Salvar Nome
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Floating Sync Toast Notification */}
      {syncToast && (
        <div className="fixed bottom-5 right-5 z-[999999] bg-[#121212] text-white border-2 border-[#D4AF37] px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Cloud className="w-5 h-5 text-[#D4AF37] shrink-0 animate-bounce" />
          <span className="text-xs font-black">{syncToast}</span>
          <button
            onClick={() => setSyncToast(null)}
            className="p-1 hover:bg-white/10 rounded-lg transition ml-2 cursor-pointer"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      )}
    </header>
  );
};
