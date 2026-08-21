import React, { useState } from 'react';
import { User, SharedBudget, BudgetCollaborator } from '../types';
import { StorageService } from '../services/storage';
import { GamificationService, LEAGUE_DIVISIONS } from '../services/gamification';
import {
  Users,
  Copy,
  Check,
  UserPlus,
  LogOut,
  Shield,
  Key,
  Sparkles,
  X,
  Mail,
  CheckCircle2,
  Edit3,
  Eye,
  Trash2,
  Flame,
  Zap,
  Gem,
  Lock,
  RefreshCw,
  Send,
} from 'lucide-react';

interface SharedBudgetModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: (user: User) => void;
}

export const SharedBudgetModal: React.FC<SharedBudgetModalProps> = ({
  user,
  isOpen,
  onClose,
  onUserUpdated,
}) => {
  const effectiveBudgetId = StorageService.getEffectiveBudgetId(user);
  const [sharedBudget, setSharedBudget] = useState<SharedBudget>(() =>
    StorageService.getSharedBudget(effectiveBudgetId, user)
  );

  const [notifications, setNotifications] = useState(() => StorageService.getPendingNotifications(user.email));
  const [sentNotifications, setSentNotifications] = useState(() => StorageService.getSentPendingNotifications(user.email));
  const [availableBudgets, setAvailableBudgets] = useState(() => StorageService.getAvailableBudgetsForUser(user));
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteAccessMode, setInviteAccessMode] = useState<'edit' | 'read'>('edit');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      const currentBudgetId = StorageService.getEffectiveBudgetId(user);
      const curBudget = StorageService.getSharedBudget(currentBudgetId, user);
      setSharedBudget(curBudget);
      setAvailableBudgets(StorageService.getAvailableBudgetsForUser(user));
      setNotifications(StorageService.getPendingNotifications(user.email, curBudget.code));
      setSentNotifications(StorageService.getSentPendingNotifications(user.email));

      // Sync with server in real time when modal opens
      StorageService.syncNotificationsWithServer(user.email, curBudget.code).then((notifs) => {
        setNotifications(notifs);
        setSentNotifications(StorageService.getSentPendingNotifications(user.email));
        const updatedBudgetId = StorageService.getEffectiveBudgetId(user);
        const updatedB = StorageService.getSharedBudget(updatedBudgetId, user);
        setSharedBudget(updatedB);
        setAvailableBudgets(StorageService.getAvailableBudgetsForUser(user));
      });
    }
  }, [isOpen, user]);

  React.useEffect(() => {
    const handleNotifsUpdate = () => {
      const currentBudgetId = StorageService.getEffectiveBudgetId(user);
      const curBudget = StorageService.getSharedBudget(currentBudgetId, user);
      setNotifications(StorageService.getPendingNotifications(user.email, curBudget.code));
      setSentNotifications(StorageService.getSentPendingNotifications(user.email));
    };
    window.addEventListener('notifications_updated', handleNotifsUpdate);
    return () => window.removeEventListener('notifications_updated', handleNotifsUpdate);
  }, [user]);

  const handleRespondNotification = (notifId: string, action: 'accept' | 'reject') => {
    const res = StorageService.respondToNotification(notifId, action, user);
    if (res.success) {
      if (res.updatedUser) {
        onUserUpdated(res.updatedUser);
        const newBudgetId = StorageService.getEffectiveBudgetId(res.updatedUser);
        setSharedBudget(StorageService.getSharedBudget(newBudgetId, res.updatedUser));
        setAvailableBudgets(StorageService.getAvailableBudgetsForUser(res.updatedUser));
      } else {
        const currentBudgetId = StorageService.getEffectiveBudgetId(user);
        setSharedBudget(StorageService.getSharedBudget(currentBudgetId, user));
        setAvailableBudgets(StorageService.getAvailableBudgetsForUser(user));
      }
      setNotifications(StorageService.getPendingNotifications(user.email));
      setFeedback({ type: 'success', msg: res.message });
    } else {
      setFeedback({ type: 'error', msg: res.message });
    }
  };

  const handleSwitchToBudget = (budgetIdToAccess: string) => {
    const updated = StorageService.switchBudget(user, budgetIdToAccess);
    onUserUpdated(updated);
    const newBudgetId = StorageService.getEffectiveBudgetId(updated);
    setSharedBudget(StorageService.getSharedBudget(newBudgetId, updated));
    setAvailableBudgets(StorageService.getAvailableBudgetsForUser(updated));
    const targetObj = StorageService.getSharedBudget(newBudgetId, updated);
    setFeedback({
      type: 'success',
      msg: `Orçamento alterado com sucesso! Você agora está visualizando o orçamento de: ${targetObj.ownerName}`,
    });
  };
  const [joinCodeOrEmail, setJoinCodeOrEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  if (!isOpen) return null;

  const isOwner =
    sharedBudget.ownerEmail.toLowerCase() === user.email.toLowerCase() ||
    sharedBudget.ownerId === user.id ||
    effectiveBudgetId === user.id;

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(user.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyInviteText = () => {
    const text = `Olá! Te convido a compartilhar o orçamento financeiro com o DINHEIRO SEM FILTRO.\nInforme meu e-mail (${user.email}) em 'Pedir Acesso a Outro Orçamento' para sincronizarmos nossos lançamentos e contas!`;
    navigator.clipboard.writeText(text);
    setFeedback({ type: 'success', msg: 'Mensagem de convite copiada para a área de transferência!' });
  };

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsSubmitting(true);
    try {
      const res = await StorageService.addCollaboratorByEmail(user, inviteEmail, inviteAccessMode);
      if (res.success) {
        setInviteEmail('');
        if (res.sharedBudget) {
          if (inviteAccessMode === 'read') {
            StorageService.updateCollaboratorAccessMode(res.sharedBudget.budgetId, inviteEmail, 'read');
          }
          setSharedBudget(StorageService.getSharedBudget(res.sharedBudget.budgetId, user));
        }
        setSentNotifications(StorageService.getSentPendingNotifications(user.email));
        setFeedback({ type: 'success', msg: res.message });
      } else {
        setFeedback({ type: 'error', msg: res.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsSubmitting(true);
    try {
      const res = await StorageService.joinBudgetByCodeOrEmail(user, joinCodeOrEmail);
      if (res.success) {
        setJoinCodeOrEmail('');
        if (res.updatedUser) {
          onUserUpdated(res.updatedUser);
          const newBudgetId = StorageService.getEffectiveBudgetId(res.updatedUser);
          setSharedBudget(StorageService.getSharedBudget(newBudgetId, res.updatedUser));
          setAvailableBudgets(StorageService.getAvailableBudgetsForUser(res.updatedUser));
        }
        setSentNotifications(StorageService.getSentPendingNotifications(user.email));
        setFeedback({ type: 'success', msg: res.message });
      } else {
        setFeedback({ type: 'error', msg: res.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendNotification = async (notifId: string) => {
    setFeedback(null);
    setIsSubmitting(true);
    try {
      const res = await StorageService.resendNotification(notifId, user);
      setSentNotifications(StorageService.getSentPendingNotifications(user.email));
      setFeedback({ type: res.success ? 'success' : 'error', msg: res.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelNotification = (notifId: string) => {
    const res = StorageService.cancelNotification(notifId);
    setSentNotifications(StorageService.getSentPendingNotifications(user.email));
    setFeedback({ type: 'success', msg: res.message });
  };

  const handleSwitchToPersonal = () => {
    const updated = StorageService.switchBudget(user, user.id);
    onUserUpdated(updated);
    setSharedBudget(StorageService.getSharedBudget(user.id, updated));
    setAvailableBudgets(StorageService.getAvailableBudgetsForUser(updated));
    setFeedback({ type: 'success', msg: 'Você retornou ao seu orçamento pessoal.' });
  };

  const handleRemoveCollaborator = (email: string) => {
    if (window.confirm(`Tem certeza que deseja EXCLUIR o acesso do membro ${email}?`)) {
      const targetBudgetId = sharedBudget.budgetId || effectiveBudgetId;
      const updated = StorageService.removeCollaborator(targetBudgetId, email);
      if (updated) {
        setSharedBudget(updated);
        setFeedback({ type: 'success', msg: `Acesso do membro ${email} excluído com sucesso.` });
      }
    }
  };

  const handleSetAccessMode = (email: string, targetMode: 'edit' | 'read') => {
    const targetBudgetId = sharedBudget.budgetId || effectiveBudgetId;
    const updated = StorageService.updateCollaboratorAccessMode(targetBudgetId, email, targetMode);
    if (updated) {
      setSharedBudget(updated);
      setFeedback({
        type: 'success',
        msg: `Permissão de ${email} alterada para ${targetMode === 'read' ? 'Modo Leitura (Apenas Visualizar)' : 'Modo Edição (Completo)'}.`,
      });
    }
  };

  // Helper function to build member gamification stats
  const getMemberGamification = (memberEmail: string, isOwnerMember: boolean) => {
    // Lookup user by email if possible, or use memberEmail as key
    const gState = GamificationService.getGamificationState(memberEmail);
    const divInfo = LEAGUE_DIVISIONS.find((d) => d.id === gState.currentDivision) || LEAGUE_DIVISIONS[0];
    return {
      division: divInfo,
      streak: gState.weeklyStreakCount,
      xp: gState.xpTotal,
      gems: gState.gems,
    };
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-gray-200 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] sm:max-h-[88vh] flex flex-col my-auto overflow-hidden animate-in fade-in">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4 sm:p-5 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#D4AF37]/10 text-[#121212] rounded-xl shrink-0">
              <Users className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-[#121212] font-serif">
                Compartilhar Orçamento & Gestão de Membros
              </h2>
              <p className="text-[10px] sm:text-[11px] text-gray-500 leading-tight">
                Permissões (Leitura/Edição), exclusão, compartilhamento e Gamificação dos membros
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-[#121212] rounded-lg transition cursor-pointer shrink-0 ml-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 min-h-0">
          {/* In-App Notification Notice Banner */}
          <div className="p-3.5 bg-amber-50 border border-amber-300/80 rounded-2xl flex items-start gap-2.5 text-xs shadow-2xs">
            <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-extrabold text-[#121212] flex items-center gap-1.5">
                <span>🔔 Notificações Diretas no Aplicativo</span>
                <span className="bg-[#00C853] text-[#121212] text-[9px] font-black px-1.5 py-0.5 rounded uppercase">Tempo Real</span>
              </p>
              <p className="text-[11px] text-gray-700 leading-snug">
                Todas as solicitações para acessar orçamentos e convites de novos membros são notificados e gerenciados diretamente dentro do aplicativo em tempo real.
              </p>
            </div>
          </div>

          {/* Pending Notifications Section (Shown 1 single time per request) */}
          {notifications.length > 0 && (
            <div className="space-y-3 p-3.5 bg-amber-100/60 border-2 border-[#D4AF37] rounded-2xl animate-in fade-in shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#121212] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                  <span>Notificações e Convites Pendentes ({notifications.length}):</span>
                </span>
                <span className="text-[10px] bg-[#D4AF37] text-[#121212] font-black px-2 py-0.5 rounded-full uppercase">
                  Ação Necessária
                </span>
              </div>

              {/* 1. Quem pediu para acessar o seu orçamento */}
              {notifications.filter((n) => n.type === 'request').length > 0 && (
                <div className="space-y-2 pt-1 border-t border-amber-200">
                  <p className="text-[11px] font-black text-amber-950 uppercase tracking-wider">
                    📩 QUEM PEDIU PARA ACESSAR SEU ORÇAMENTO:
                  </p>
                  {notifications
                    .filter((n) => n.type === 'request')
                    .map((notif) => (
                      <div
                        key={notif.id}
                        className="p-3 bg-white border border-amber-300 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs text-xs"
                      >
                        <div>
                          <p className="font-extrabold text-[#121212]">
                            {notif.fromName} ({notif.fromEmail})
                          </p>
                          <p className="text-[11px] text-gray-600">
                            Solicitou permissão para acessar o seu orçamento financeiro compartilhado.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto pt-1 sm:pt-0">
                          <button
                            type="button"
                            onClick={() => handleRespondNotification(notif.id, 'accept')}
                            className="flex-1 sm:flex-initial py-2.5 px-4 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm min-h-[42px] border border-[#00A843]"
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>Aceitar e Dar Acesso</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRespondNotification(notif.id, 'reject')}
                            className="flex-1 sm:flex-initial py-2.5 px-3 bg-red-100 hover:bg-red-200 text-[#FF3D00] font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 border border-red-200 min-h-[42px]"
                          >
                            <X className="w-4 h-4 stroke-[2.5]" />
                            <span>Recusar</span>
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* 2. Quem te convidou para acessar o orçamento dele */}
              {notifications.filter((n) => n.type === 'invite').length > 0 && (
                <div className="space-y-2 pt-1 border-t border-amber-200">
                  <p className="text-[11px] font-black text-amber-950 uppercase tracking-wider">
                    ✉️ QUEM TE CONVIDOU PARA ACESSAR O ORÇAMENTO DELE:
                  </p>
                  {notifications
                    .filter((n) => n.type === 'invite')
                    .map((notif) => (
                      <div
                        key={notif.id}
                        className="p-3 bg-white border border-amber-300 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs text-xs"
                      >
                        <div>
                          <p className="font-extrabold text-[#121212]">
                            {notif.fromName} ({notif.fromEmail})
                          </p>
                          <p className="text-[11px] text-gray-600">
                            Convidou você para se conectar e compartilhar o orçamento financeiro dele(a).
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto pt-1 sm:pt-0">
                          <button
                            type="button"
                            onClick={() => handleRespondNotification(notif.id, 'accept')}
                            className="flex-1 sm:flex-initial py-1.5 px-3 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-[11px] rounded-lg transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Aceitar Convite</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRespondNotification(notif.id, 'reject')}
                            className="flex-1 sm:flex-initial py-1.5 px-2.5 bg-red-100 hover:bg-red-200 text-[#FF3D00] font-bold text-[11px] rounded-lg transition cursor-pointer flex items-center justify-center gap-1 border border-red-200"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Recusar</span>
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Status Indicator Banner */}
          <div className="p-3 sm:p-3.5 bg-gray-50 rounded-2xl border border-gray-200 flex flex-wrap items-center justify-between gap-2.5">
            <div className="space-y-0.5 min-w-0">
              <span className="text-[10px] uppercase font-black text-[#D4AF37] tracking-wider block">
                Orçamento Ativo Atual:
              </span>
              <p className="text-xs font-black text-[#121212] font-serif flex items-center gap-1.5 truncate">
                <Shield className="w-4 h-4 text-[#00C853] shrink-0" />
                <span className="truncate">
                  {isOwner ? `Seu Orçamento Próprio (${user.name})` : `Orçamento Compartilhado por ${sharedBudget.ownerName}`}
                </span>
              </p>
            </div>

            {!isOwner && (
              <button
                onClick={handleSwitchToPersonal}
                className="py-1.5 px-3 bg-white border border-gray-300 text-[#121212] hover:bg-gray-100 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5 text-[#FF3D00]" />
                Voltar ao Meu Próprio
              </button>
            )}
          </div>

          {/* Feedback Alert */}
          {feedback && (
            <div
              className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-[#00C853]/10 border-[#00C853]/30 text-[#121212]'
                  : 'bg-[#FF3D00]/10 border-[#FF3D00]/30 text-[#121212]'
              }`}
            >
              <CheckCircle2 className={`w-4 h-4 shrink-0 ${feedback.type === 'success' ? 'text-[#00C853]' : 'text-[#FF3D00]'}`} />
              <span>{feedback.msg}</span>
            </div>
          )}

          {/* List of Available Budgets to Access */}
          {availableBudgets.length > 0 && (
            <div className="space-y-2 bg-[#00C853]/10 p-3.5 rounded-2xl border border-[#00C853]/30">
              <label className="text-xs font-black text-[#121212] block uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#00C853]" />
                <span>Orçamentos Conectados (Clique para Acessar):</span>
              </label>
              <div className="space-y-2 pt-0.5">
                {availableBudgets.map((item) => (
                  <div
                    key={item.budget.budgetId}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs transition ${
                      item.isActive
                        ? 'bg-[#00C853]/20 border-[#00C853] font-extrabold text-[#121212] shadow-2xs'
                        : 'bg-white border-gray-200 hover:border-[#D4AF37] text-[#121212]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-[#121212] truncate">
                        {item.isOwner ? `Seu Orçamento Próprio` : `Orçamento de ${item.budget.ownerName}`}
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">
                        Titular: {item.budget.ownerEmail}
                      </p>
                    </div>

                    {item.isActive ? (
                      <span className="px-2.5 py-1 bg-[#00C853] text-[#121212] font-black text-[10px] rounded-lg uppercase tracking-wider shrink-0 flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[3]" /> Ativo
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSwitchToBudget(item.budget.budgetId)}
                        className="py-1.5 px-3 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs rounded-xl transition cursor-pointer shrink-0 shadow-xs flex items-center gap-1"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        <span>Acessar Orçamento</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 1: Acesso ao seu Orçamento (Conectar) */}
          <div className="space-y-3 bg-[#D4AF37]/10 p-3.5 sm:p-4 rounded-2xl border border-[#D4AF37]/40">
            <label className="text-xs font-extrabold text-[#121212] block uppercase tracking-wider flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-[#D4AF37]" />
              <span>1. Acesso ao seu Orçamento (Conectar):</span>
            </label>
            <p className="text-[11px] text-gray-700 leading-snug">
              Informe somente o <strong>e-mail do convidado</strong> cadastrado no sistema para conceder acesso ao seu orçamento e defina a permissão:
            </p>

            <form onSubmit={handleAddCollaborator} className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Mail className="w-4 h-4 text-[#D4AF37] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="E-mail do Convidado (Ex: convidado@exemplo.com)"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-2.5 px-4 bg-[#121212] text-[#D4AF37] font-bold text-xs rounded-xl hover:bg-black transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 min-h-[38px] border border-[#D4AF37] disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4 shrink-0" />
                  <span>Conceder Acesso</span>
                </button>
              </div>

              {/* Mode Selection */}
              <div className="flex items-center gap-3 pt-1">
                <span className="text-[11px] font-bold text-gray-700">Modo de Acesso:</span>
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="inviteMode"
                    value="edit"
                    checked={inviteAccessMode === 'edit'}
                    onChange={() => setInviteAccessMode('edit')}
                    className="accent-[#D4AF37]"
                  />
                  <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                  <span className="font-bold text-[#121212]">Edição (Completo)</span>
                </label>
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="inviteMode"
                    value="read"
                    checked={inviteAccessMode === 'read'}
                    onChange={() => setInviteAccessMode('read')}
                    className="accent-[#D4AF37]"
                  />
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-bold text-[#121212]">Leitura (Apenas Visualizar)</span>
                </label>
              </div>
            </form>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-white/90 p-2.5 rounded-xl border border-amber-300 text-xs w-full">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <span className="text-[11px] font-bold text-gray-700">Seu E-mail de Titular:</span>
                <span className="font-semibold text-xs text-[#121212] bg-amber-50 px-2 py-0.5 rounded border border-amber-200 truncate select-all">{user.email}</span>
              </div>
              <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="flex-1 sm:flex-initial py-1.5 px-3 bg-[#D4AF37] hover:bg-[#B89628] text-[#121212] font-black text-[10px] rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado!' : 'Copiar E-mail'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyInviteText}
                  className="flex-1 sm:flex-initial py-1.5 px-3 bg-[#121212] text-[#D4AF37] font-bold text-[10px] rounded-lg hover:bg-black transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Copiar Convite</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Pedir Acesso a Outro Orçamento (Conectar) */}
          <div className="space-y-2 pt-2 border-t border-gray-200">
            <label className="text-xs font-extrabold text-[#121212] block uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-4 h-4 text-[#00C853]" />
              <span>2. Pedir Acesso a Outro Orçamento (Conectar):</span>
            </label>
            <p className="text-[11px] text-gray-700 leading-snug">
              Informe somente o <strong>e-mail do titular</strong> do orçamento cadastrado no sistema para solicitar autorização:
            </p>
            <form onSubmit={handleJoinBudget} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-[#00C853] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  value={joinCodeOrEmail}
                  onChange={(e) => setJoinCodeOrEmail(e.target.value)}
                  placeholder="E-mail do Titular do Orçamento (Ex: titular@exemplo.com)"
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#00C853]"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="py-2.5 px-4 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs rounded-xl transition cursor-pointer shrink-0 flex items-center justify-center gap-1.5 min-h-[38px] disabled:opacity-50"
              >
                <Key className="w-4 h-4" />
                <span>Pedir Acesso</span>
              </button>
            </form>
          </div>

          {/* Section 3: Convites e Solicitações Enviadas (Aguardando Aprovacão / Reenviar) */}
          {sentNotifications.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-[#121212] uppercase tracking-wider flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-[#D4AF37]" />
                  <span>3. Convites Enviados Aguardando Resposta ({sentNotifications.length}):</span>
                </label>
                <span className="text-[10px] bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded-full">
                  Pendente(s)
                </span>
              </div>
              <p className="text-[11px] text-gray-500 leading-tight">
                Se a outra pessoa não viu a solicitação, clique em <strong>Reenviar Convite</strong> para disparar novamente por e-mail e aplicativo:
              </p>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {sentNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="p-3 bg-amber-50/60 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 bg-[#D4AF37] text-[#121212] font-black text-[9px] rounded uppercase tracking-wider">
                          {notif.type === 'invite' ? '✉️ Convite Enviado' : '📩 Solicitação Enviada'}
                        </span>
                      </div>
                      <p className="font-extrabold text-[#121212] truncate text-xs">
                        Para: <span className="text-amber-900">{notif.toEmail}</span>
                      </p>
                      <p className="text-[10px] text-gray-400">
                        Enviado em {new Date(notif.createdAt).toLocaleDateString('pt-BR')} às {new Date(notif.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => handleResendNotification(notif.id)}
                        disabled={isSubmitting}
                        className="flex-1 sm:flex-initial py-1.5 px-3 bg-[#D4AF37] hover:bg-[#B89628] text-[#121212] font-black text-[10px] rounded-lg transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                        title="Reenviar convite por e-mail e aplicativo"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                        <span>Reenviar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCancelNotification(notif.id)}
                        className="py-1.5 px-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-[10px] rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                        title="Cancelar solicitação"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Membros que Acessam este Orçamento & Gamificação */}
          {(() => {
            const actualCollaborators = sharedBudget.collaborators.filter(
              (c) => c.email.toLowerCase() !== sharedBudget.ownerEmail.toLowerCase()
            );

            return (
              <div className="space-y-3 pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-[#121212] uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#D4AF37]" />
                    <span>Membros que Acessam este Orçamento:</span>
                  </label>
                  <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                    {1 + actualCollaborators.length} Membro(s)
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 leading-tight">
                  Gerencie privilégios (Modo Leitura / Edição), exclua acessos e veja a Gamificação (Divisão, Ofensiva, XP e Gemas) de cada participante:
                </p>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {/* Member 1: Titular Principal */}
                  {(() => {
                    const ownerGamification = getMemberGamification(sharedBudget.ownerEmail, true);
                    return (
                      <div className="p-3 bg-gradient-to-r from-amber-50/90 to-white rounded-2xl border border-amber-300/60 shadow-2xs space-y-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-[#D4AF37] text-[#121212] font-black text-sm flex items-center justify-center uppercase shrink-0 shadow-xs ring-2 ring-[#D4AF37]/30">
                              {sharedBudget.ownerName ? sharedBudget.ownerName[0] : 'T'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-extrabold text-[#121212] truncate flex items-center gap-1">
                                <span>{sharedBudget.ownerName || 'Titular Principal'}</span>
                                <Shield className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                              </p>
                              <p className="text-[10px] text-gray-500 truncate">{sharedBudget.ownerEmail}</p>
                              <span className="inline-block mt-0.5 px-2 py-0.5 bg-[#D4AF37] text-[#121212] font-black text-[9px] rounded uppercase tracking-wider">
                                👑 Titular Principal
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="px-2 py-1 bg-[#00C853]/15 text-[#00A843] border border-[#00C853]/40 font-black text-[10px] rounded-lg uppercase tracking-wider flex items-center gap-1">
                              <Check className="w-3 h-3 stroke-[3]" /> Acesso Total (Dono)
                            </span>
                          </div>
                        </div>

                        {/* Gamification Bar for Titular */}
                        <div className="flex items-center flex-wrap gap-2 pt-1 border-t border-amber-200/60 text-[11px]">
                          <span className="font-bold text-gray-700 text-[10px] uppercase tracking-wider">
                            Gamificação:
                          </span>
                          <span className="px-2 py-0.5 bg-pink-50 border border-pink-200 text-pink-900 font-extrabold rounded-md flex items-center gap-1">
                            <span>{ownerGamification.division.icon}</span>
                            <span>{ownerGamification.division.name}</span>
                          </span>
                          <span className="px-2 py-0.5 bg-orange-50 border border-orange-200 text-orange-900 font-extrabold rounded-md flex items-center gap-1">
                            <Flame className="w-3 h-3 text-orange-600 fill-orange-500" />
                            <span>{ownerGamification.streak} sem</span>
                          </span>
                          <span className="px-2 py-0.5 bg-purple-50 border border-purple-200 text-purple-900 font-extrabold rounded-md flex items-center gap-1">
                            <Zap className="w-3 h-3 text-purple-600 fill-purple-400" />
                            <span>{ownerGamification.xp} XP</span>
                          </span>
                          <span className="px-2 py-0.5 bg-cyan-50 border border-cyan-200 text-cyan-900 font-extrabold rounded-md flex items-center gap-1">
                            <Gem className="w-3 h-3 text-cyan-600 fill-cyan-400" />
                            <span>{ownerGamification.gems} 💎</span>
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Additional Collaborators */}
                  {actualCollaborators.length === 0 ? (
                    <div className="p-3 text-center bg-gray-50 border border-dashed border-gray-300 rounded-xl">
                      <p className="text-xs text-gray-500 font-medium">Nenhum outro membro convidado no momento.</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Use o formulário acima para convidar seu cônjuge, sócio ou familiares.
                      </p>
                    </div>
                  ) : (
                    actualCollaborators.map((collab, idx) => {
                      const gState = getMemberGamification(collab.email, false);
                      const currentMode = collab.accessMode || 'edit';
                      const nameFromStore = StorageService.getUserNameByEmail(collab.email);
                      const collabName = (collab.name && collab.name.trim() !== '' && collab.name !== collab.email)
                        ? collab.name
                        : (nameFromStore || collab.email.split('@')[0]);

                      return (
                        <div
                          key={idx}
                          className="p-3 bg-white border border-gray-200 rounded-2xl shadow-2xs space-y-2.5 text-xs"
                        >
                          {/* Member Info Row (Avatar + Name + Email + Status) */}
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-[#121212] text-[#D4AF37] font-black text-sm flex items-center justify-center uppercase shrink-0 shadow-xs border border-[#D4AF37] mt-0.5">
                              {collabName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-extrabold text-[#121212] text-sm leading-tight break-words">
                                {collabName}
                              </p>
                              <p className="text-[11px] text-gray-500 break-all leading-tight font-medium">
                                {collab.email}
                              </p>
                              <span className="inline-block text-[10px] text-[#D4AF37] font-black mt-1">
                                👥 Colaborador Vinculado
                              </span>
                            </div>
                          </div>

                          {/* Owner Action Controls Row */}
                          {isOwner ? (
                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 flex-wrap sm:flex-nowrap">
                              <select
                                value={currentMode}
                                onChange={(e) => handleSetAccessMode(collab.email, e.target.value as 'edit' | 'read')}
                                className="py-1.5 px-2 bg-gray-50 border border-gray-300 rounded-lg text-[11px] font-black text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37] cursor-pointer flex-1 min-w-[140px]"
                                title="Alterar atribuição de permissão do usuário"
                              >
                                <option value="edit">📝 Modo Edição (Completo)</option>
                                <option value="read">👁️ Modo Leitura (Apenas Ver)</option>
                              </select>

                              <button
                                type="button"
                                onClick={() => handleRemoveCollaborator(collab.email)}
                                className="py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white font-black text-[11px] rounded-lg transition cursor-pointer flex items-center justify-center gap-1 shrink-0 shadow-xs"
                                title="Excluir este membro do orçamento"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Excluir</span>
                              </button>
                            </div>
                          ) : (
                            <div className="pt-2 border-t border-gray-100">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-extrabold border uppercase tracking-wider ${
                                  currentMode === 'read'
                                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                                    : 'bg-green-50 text-green-800 border-green-200'
                                }`}
                              >
                                {currentMode === 'read' ? '👁️ Leitura' : '📝 Edição'}
                              </span>
                            </div>
                          )}

                          {/* Mode Description Box */}
                          <div className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded-xl border border-gray-200 flex items-center gap-1.5 leading-normal">
                            {currentMode === 'read' ? (
                              <>
                                <Lock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span>
                                  <strong>Permissão Leitura:</strong> Este membro pode apenas visualizar dados, sem direito a cadastrar ou alterar lançamentos.
                                </span>
                              </>
                            ) : (
                              <>
                                <Edit3 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                <span>
                                  <strong>Permissão Edição:</strong> Este membro possui acesso completo para criar, editar e excluir lançamentos no orçamento.
                                </span>
                              </>
                            )}
                          </div>

                          {/* Gamification Bar for Member */}
                          <div className="flex items-center flex-wrap gap-2 pt-1 border-t border-gray-100 text-[11px]">
                            <span className="font-bold text-gray-500 text-[10px] uppercase tracking-wider">
                              Gamificação:
                            </span>
                            <span className="px-2 py-0.5 bg-pink-50 border border-pink-200 text-pink-900 font-extrabold rounded-md flex items-center gap-1">
                              <span>{gState.division.icon}</span>
                              <span>{gState.division.name}</span>
                            </span>
                            <span className="px-2 py-0.5 bg-orange-50 border border-orange-200 text-orange-900 font-extrabold rounded-md flex items-center gap-1">
                              <Flame className="w-3 h-3 text-orange-600 fill-orange-500" />
                              <span>{gState.streak} sem</span>
                            </span>
                            <span className="px-2 py-0.5 bg-purple-50 border border-purple-200 text-purple-900 font-extrabold rounded-md flex items-center gap-1">
                              <Zap className="w-3 h-3 text-purple-600 fill-purple-400" />
                              <span>{gState.xp} XP</span>
                            </span>
                            <span className="px-2 py-0.5 bg-cyan-50 border border-cyan-200 text-cyan-900 font-extrabold rounded-md flex items-center gap-1">
                              <Gem className="w-3 h-3 text-cyan-600 fill-cyan-400" />
                              <span>{gState.gems} 💎</span>
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
            </div>
          </div>
        );
      })()}
        </div>

        {/* Footer Buttons */}
        <div className="p-4 border-t border-gray-200 bg-white shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-gray-100 border border-gray-300 text-[#121212] font-bold text-xs sm:text-sm rounded-xl hover:bg-gray-200 transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
