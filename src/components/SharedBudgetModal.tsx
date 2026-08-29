import React, { useState, useEffect } from 'react';
import { User, SharedBudget } from '../types';
import { StorageService, getCanonicalUserId } from '../services/storage';
import { GamificationService, LEAGUE_DIVISIONS } from '../services/gamification';
import { appwriteDatabases as databases, getAppwriteConfig } from '../lib/appwrite';
import { getCanonicalAppwriteDocId } from '../lib/appwriteSync';
import { Permission, Role } from 'appwrite';
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
  RefreshCw,
  Send,
} from 'lucide-react';

interface SharedBudgetModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: (user: User) => Promise<void> | void;
  pendingInvites?: any[];
  onAcceptInvite?: (invite: any) => void;
  onRejectInvite?: (invite: any) => void;
  loadingInviteId?: string | null;
}

export const SharedBudgetModal: React.FC<SharedBudgetModalProps> = ({
  user,
  isOpen,
  onClose,
  onUserUpdated,
  pendingInvites = [],
  onAcceptInvite,
  onRejectInvite,
  loadingInviteId = null,
}) => {
  const currentUser = user;
  const effectiveBudgetId = StorageService.getEffectiveBudgetId(currentUser);
  const [sharedBudget, setSharedBudget] = useState<SharedBudget>(() =>
    StorageService.getSharedBudget(effectiveBudgetId, user)
  );

  const [notifications, setNotifications] = useState(() => StorageService.getPendingNotifications(user.email));
  const [sentNotifications, setSentNotifications] = useState(() => StorageService.getSentPendingNotifications(user.email));
  const [availableBudgets, setAvailableBudgets] = useState(() => StorageService.getAvailableBudgetsForUser(user));
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteAccessMode, setInviteAccessMode] = useState<'edit' | 'read'>('edit');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Estados exatos solicitados
  const [membrosLocais, setMembrosLocais] = useState<string[]>([]);
  const [permissoesLocais, setPermissoesLocais] = useState<Record<string, string>>({});
  const [compartilhadosComigo, setCompartilhadosComigo] = useState<string[]>([]);
  const [draftPermissoes, setDraftPermissoes] = useState<Record<string, string>>({});
  const [loadingPermEmail, setLoadingPermEmail] = useState<string | null>(null);

  // Busca à prova de falhas via listDocuments / getDocument
  useEffect(() => {
    const buscarDados = async () => {
      if (!currentUser?.email || !isOpen) return;
      try {
        const config = getAppwriteConfig();
        const docId = getCanonicalAppwriteDocId(currentUser.email);
        let json: any = {};
        
        try {
          const doc = await databases.getDocument(config.databaseId, 'user_financials', docId);
          if (doc && doc.data) {
            json = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
          }
        } catch (e1) {
          try {
            const lista = await databases.listDocuments(config.databaseId, 'user_financials');
            const meuDoc = lista.documents.find((d: any) => 
              d.userId === currentUser.email || 
              d.email === currentUser.email || 
              d.$id === docId ||
              (d.userId && d.userId.toLowerCase() === currentUser.email.toLowerCase())
            );
            if (meuDoc && meuDoc.data) {
              json = typeof meuDoc.data === 'string' ? JSON.parse(meuDoc.data) : meuDoc.data;
            }
          } catch (e2) {
            console.error("Erro listDocuments:", e2);
          }
        }

        setMembrosLocais(Array.isArray(json.allowed_users) ? json.allowed_users : (Array.isArray(json.shared_members) ? json.shared_members : []));
        setPermissoesLocais(json.member_permissions || {});
        
        let sharedWithMeList = Array.isArray(json.shared_with_me) ? json.shared_with_me : [];
        try {
          const listaAll = await databases.listDocuments(config.databaseId, 'user_financials');
          listaAll.documents.forEach((d: any) => {
            if (d.$id !== docId && d.userId !== currentUser.email) {
              try {
                const dJson = typeof d.data === 'string' ? JSON.parse(d.data || '{}') : (d.data || {});
                const allowed = Array.isArray(dJson.allowed_users) ? dJson.allowed_users : (Array.isArray(dJson.shared_members) ? dJson.shared_members : []);
                const ownerEmail = d.userId || d.email || d.$id;
                if (allowed.some((m: string) => m && m.toLowerCase().trim() === currentUser.email.toLowerCase().trim())) {
                  if (ownerEmail && !sharedWithMeList.includes(ownerEmail)) {
                    sharedWithMeList.push(ownerEmail);
                  }
                }
              } catch (err) {}
            }
          });
        } catch (e3) {}

        setCompartilhadosComigo(sharedWithMeList);
      } catch (e) {
        console.error("Erro na leitura:", e);
      }
    };
    buscarDados();
  }, [currentUser, isOpen]);

  const concederAcesso = async (emailConvidado: string) => {
    if (!emailConvidado) return alert("Insira um e-mail.");
    setIsLoading(true);
    try {
      const config = getAppwriteConfig();
      const meuEmail = currentUser.email.toLowerCase().trim();
      const emailAlvo = emailConvidado.toLowerCase().trim();
      
      const meuDocId = getCanonicalAppwriteDocId(meuEmail);
      const alvoDocId = getCanonicalAppwriteDocId(emailAlvo);

      const lista = await databases.listDocuments(config.databaseId, 'user_financials');
      
      const meuDoc = lista.documents.find((d: any) => d.userId === meuEmail || d.email === meuEmail || d.$id === meuDocId);
      const docAlvo = lista.documents.find((d: any) => d.userId === emailAlvo || d.email === emailAlvo || d.$id === alvoDocId);

      // Grava na Titular
      const meuJson = meuDoc && meuDoc.data ? (typeof meuDoc.data === 'string' ? JSON.parse(meuDoc.data || '{}') : meuDoc.data) : {};
      let allowed = Array.isArray(meuJson.allowed_users) ? meuJson.allowed_users : [];
      if (!allowed.includes(emailAlvo)) allowed.push(emailAlvo);
      meuJson.allowed_users = allowed;

      let sharedM = Array.isArray(meuJson.shared_members) ? meuJson.shared_members : [];
      if (!sharedM.includes(emailAlvo)) sharedM.push(emailAlvo);
      meuJson.shared_members = sharedM;

      meuJson.member_permissions = meuJson.member_permissions || {};
      if (!meuJson.member_permissions[emailAlvo]) {
        meuJson.member_permissions[emailAlvo] = inviteAccessMode === 'read' ? 'leitura' : 'edicao';
      }

      const meuPayload = { userId: meuEmail, data: JSON.stringify(meuJson) };
      if (meuDoc) {
        await databases.updateDocument(config.databaseId, 'user_financials', meuDoc.$id, meuPayload);
      } else {
        await databases.createDocument(config.databaseId, 'user_financials', meuDocId, meuPayload, [
          Permission.read(Role.users()),
          Permission.update(Role.users()),
          Permission.delete(Role.users())
        ]);
      }

      // Grava no Convidado
      const jsonAlvo = docAlvo && docAlvo.data ? (typeof docAlvo.data === 'string' ? JSON.parse(docAlvo.data || '{}') : docAlvo.data) : {};
      let shared = Array.isArray(jsonAlvo.shared_with_me) ? jsonAlvo.shared_with_me : [];
      if (!shared.includes(meuEmail)) shared.push(meuEmail);
      jsonAlvo.shared_with_me = shared;
      jsonAlvo.active_budget_owner = meuDocId;

      const alvoPayload = { userId: emailAlvo, data: JSON.stringify(jsonAlvo) };
      if (docAlvo) {
        await databases.updateDocument(config.databaseId, 'user_financials', docAlvo.$id, alvoPayload);
      } else {
        await databases.createDocument(config.databaseId, 'user_financials', alvoDocId, alvoPayload, [
          Permission.read(Role.users()),
          Permission.update(Role.users()),
          Permission.delete(Role.users())
        ]);
      }

      StorageService.addCollaboratorByEmail(currentUser, emailAlvo, inviteAccessMode);

      alert(`Acesso concedido para ${emailAlvo}!`);
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar no banco.");
    } finally {
      setIsLoading(false);
    }
  };

  const atualizarPermissao = async (emailMembro: string, nivel: string) => {
    console.log("🕵️ [DEDO-DURO] atualizarPermissao called:", { emailMembro, nivel, sharedBudgetId: sharedBudget?.budgetId, ownerEmail: sharedBudget?.ownerEmail });
    setLoadingPermEmail(emailMembro);
    try {
      const config = getAppwriteConfig();
      const meuEmail = currentUser.email.toLowerCase().trim();
      const meuDocId = getCanonicalAppwriteDocId(meuEmail);
      const lista = await databases.listDocuments(config.databaseId, 'user_financials');
      const meuDoc = lista.documents.find((d: any) => d.userId === meuEmail || d.email === meuEmail || d.$id === meuDocId);
      if (meuDoc) {
        const json = typeof meuDoc.data === 'string' ? JSON.parse(meuDoc.data || '{}') : (meuDoc.data || {});
        json.member_permissions = json.member_permissions || {};
        json.member_permissions[emailMembro] = nivel;
        await databases.updateDocument(config.databaseId, 'user_financials', meuDoc.$id, { userId: meuEmail, data: JSON.stringify(json) });
        console.log("🕵️ [DEDO-DURO] Appwrite user_financials updated successfully with member_permissions:", json.member_permissions);
      }

      if (sharedBudget && sharedBudget.budgetId) {
        const resBudget = StorageService.updateCollaboratorAccessMode(sharedBudget.budgetId, emailMembro, nivel === 'leitura' ? 'read' : 'edit');
        console.log("🕵️ [DEDO-DURO] StorageService.updateCollaboratorAccessMode returned:", resBudget);
      } else {
        console.warn("🕵️ [DEDO-DURO] sharedBudget or sharedBudget.budgetId is missing!", sharedBudget);
      }

      setPermissoesLocais(prev => ({ ...prev, [emailMembro]: nivel }));
      setDraftPermissoes(prev => {
        const copy = { ...prev };
        delete copy[emailMembro];
        return copy;
      });

      alert(`[DEDO-DURO SUCESSO] Permissão de ${emailMembro} alterada para ${nivel} confirmada com sucesso!`);

      setFeedback({
        type: 'success',
        msg: `Permissão de ${emailMembro} atualizada para ${nivel === 'leitura' ? 'Leitura (Apenas Visualizar)' : 'Edição (Completo)'} e sincronizada na conta do convidado com sucesso!`
      });
    } catch (e) {
      console.error("🕵️ [DEDO-DURO] Erro em atualizarPermissao:", e);
      alert(`[DEDO-DURO ERRO] Falha ao atualizar permissão: ${e instanceof Error ? e.message : e}`);
      setFeedback({ type: 'error', msg: 'Erro ao atualizar permissão.' });
    } finally {
      setLoadingPermEmail(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const currentBudgetId = StorageService.getEffectiveBudgetId(user);
      const curBudget = StorageService.getSharedBudget(currentBudgetId, user);
      setSharedBudget(curBudget);
      setAvailableBudgets(StorageService.getAvailableBudgetsForUser(user));
      setNotifications(StorageService.getPendingNotifications(user.email, curBudget.code));
      setSentNotifications(StorageService.getSentPendingNotifications(user.email));

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

  const [isSwitchingBudget, setIsSwitchingBudget] = useState(false);
  const [switchLoadingMessage, setSwitchLoadingMessage] = useState('');

  const handleSwitchToBudget = async (budgetIdToAccess: string) => {
    console.log('[DEDO-DURO] handleSwitchToBudget', { budgetIdToAccess, currentUser: user });
    setIsSwitchingBudget(true);
    setSwitchLoadingMessage('Sincronizando contas, transações e carregando orçamento...');
    try {
      const updated = StorageService.switchBudget(user, budgetIdToAccess);
      await onUserUpdated(updated);
      const newBudgetId = StorageService.getEffectiveBudgetId(updated);
      const targetObj = StorageService.getSharedBudget(newBudgetId);
      setSharedBudget(targetObj);
      setAvailableBudgets(StorageService.getAvailableBudgetsForUser(updated));
      setFeedback({
        type: 'success',
        msg: `Orçamento alterado com sucesso! Você agora está visualizando o orçamento de: ${targetObj.ownerName}`,
      });
      // Keep popup open for a brief moment to ensure all state updates and renders are fully settled without flashing
      await new Promise(resolve => setTimeout(resolve, 800));
      setIsSwitchingBudget(false);
      onClose();
    } catch (e) {
      console.error(e);
      setIsSwitchingBudget(false);
      setFeedback({ type: 'error', msg: 'Erro ao alternar orçamento.' });
    }
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
    try {
      const emailLimpo = String(inviteEmail).toLowerCase().trim();
      await concederAcesso(emailLimpo);
      setInviteEmail('');
    } catch (err: any) {
      setFeedback({ type: 'error', msg: String(err?.message || err) });
    }
  };

  const handleJoinBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsSubmitting(true);
    try {
      const emailLimpo = String(joinCodeOrEmail).toLowerCase().trim();
      const res = await StorageService.joinBudgetByCodeOrEmail(user, emailLimpo);
      if (res.success) {
        setJoinCodeOrEmail('');
        if (res.updatedUser) {
          await onUserUpdated(res.updatedUser);
          const newBudgetId = StorageService.getEffectiveBudgetId(res.updatedUser);
          setSharedBudget(StorageService.getSharedBudget(newBudgetId, res.updatedUser));
          setAvailableBudgets(StorageService.getAvailableBudgetsForUser(res.updatedUser));
        }
        setSentNotifications(StorageService.getSentPendingNotifications(user.email));
        setFeedback({ type: 'success', msg: res.message });
      } else {
        setFeedback({ type: 'error', msg: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', msg: String(err?.message || err) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitchToPersonal = async () => {
    setIsSwitchingBudget(true);
    setSwitchLoadingMessage('Sincronizando e carregando orçamento pessoal...');
    try {
      const updated = StorageService.switchBudget(user, user.id);
      await onUserUpdated(updated);
      setSharedBudget(StorageService.getSharedBudget(user.id, updated));
      setAvailableBudgets(StorageService.getAvailableBudgetsForUser(updated));
      setFeedback({ type: 'success', msg: 'Você retornou ao seu orçamento pessoal.' });
      await new Promise(resolve => setTimeout(resolve, 800));
      setIsSwitchingBudget(false);
      onClose();
    } catch (e) {
      console.error(e);
      setIsSwitchingBudget(false);
    }
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

  const getMemberGamification = (memberEmail: string) => {
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
      {isSwitchingBudget && (
        <div className="absolute inset-0 z-[60] bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center space-y-4 border border-emerald-100">
            <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            <h3 className="text-lg font-bold text-gray-900 font-serif">Carregando Orçamento</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{switchLoadingMessage}</p>
          </div>
        </div>
      )}
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
          {/* Pending Notifications Section */}
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black text-[#121212] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                <span>SOLICITAÇÕES E CONVITES PENDENTES ({pendingInvites.length}):</span>
              </span>
              <span className="text-[10px] bg-[#D4AF37] text-[#121212] font-black px-2 py-0.5 rounded-full uppercase">
                Tempo Real
              </span>
            </div>

            {pendingInvites && pendingInvites.length > 0 ? (
              pendingInvites.map((invite, idx) => {
                const senderName = invite.from_name || invite.from_email || 'Usuário';
                const inviteKey = invite.id || invite.budget_owner_id || idx;
                const isItemLoading = loadingInviteId === invite.id || loadingInviteId === invite.budget_owner_id;
                const isInvite = invite.type === 'INVITE' || !invite.type;

                const bannerTitle = isInvite ? '📩 Convite para Acessar Orçamento' : '🔑 Solicitação de Acesso ao Seu Orçamento';
                const messageText = isInvite
                  ? `${senderName} convidou você para sincronizar e participar do orçamento familiar dele.`
                  : `${senderName} está solicitando permissão para visualizar/editar seu orçamento.`;
                const cardStyle = isInvite
                  ? 'w-full bg-[#fffbeb] border-2 border-[#D4AF37] rounded-2xl p-4 shadow-xl'
                  : 'w-full bg-[#f0f9ff] border-2 border-sky-400 rounded-2xl p-4 shadow-xl';
                const titleColor = isInvite ? 'text-amber-900' : 'text-sky-900';
                const acceptLabel = isInvite ? 'Aceitar e Acessar Orçamento' : 'Autorizar Acesso';
                const rejectLabel = isInvite ? 'Recusar' : 'Negar Acesso';

                return (
                  <div key={inviteKey} className={cardStyle}>
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-2xl">{isInvite ? '📩' : '🔑'}</span>
                      <div className="flex-1">
                        <h4 className={`text-sm font-black ${titleColor}`}>{bannerTitle}</h4>
                        <p className="text-xs text-stone-800 font-semibold mt-1 leading-relaxed">
                          {messageText}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full">
                      <button
                        type="button"
                        onClick={() => onAcceptInvite && onAcceptInvite(invite)}
                        disabled={isItemLoading}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition disabled:opacity-50 cursor-pointer shadow-sm text-center"
                      >
                        {isItemLoading ? 'Processando...' : acceptLabel}
                      </button>
                      <button
                        type="button"
                        onClick={() => onRejectInvite && onRejectInvite(invite)}
                        disabled={isItemLoading}
                        className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold py-2.5 px-3 rounded-xl text-xs transition disabled:opacity-50 cursor-pointer text-center"
                      >
                        {rejectLabel}
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl text-center text-xs text-gray-500 font-medium">
                Nenhuma solicitação pendente no momento.
              </div>
            )}
          </div>

          {/* Status Indicator Banner */}
          <div className="p-3 sm:p-3.5 bg-gray-50 rounded-2xl border border-gray-200 flex flex-col items-stretch gap-2.5">
            <div className="space-y-0.5 min-w-0">
              <span className="text-[10px] uppercase font-black text-[#D4AF37] tracking-wider block">
                Orçamento Ativo Atual:
              </span>
              <p className="text-xs sm:text-sm font-black text-[#121212] font-serif flex items-center gap-1.5 whitespace-normal break-words">
                <Shield className="w-4 h-4 text-[#00C853] shrink-0" />
                <span className="whitespace-normal break-words">
                  {isOwner ? `Seu Orçamento Próprio (${user.name} - ${user.email})` : `Orçamento Compartilhado: ${sharedBudget.ownerName} (${sharedBudget.ownerEmail})`}
                </span>
              </p>
            </div>

            {!isOwner && (
              <button
                onClick={handleSwitchToPersonal}
                className="w-full py-2 px-3 bg-white border border-gray-300 text-[#121212] hover:bg-gray-100 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <LogOut className="w-4 h-4 text-[#FF3D00]" />
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

          {/* ORÇAMENTOS CONECTADOS */}
          <div style={{ backgroundColor: '#e8f5e9', border: '1px solid #4CAF50', borderRadius: '12px', padding: '15px', marginBottom: '25px' }}>
            <h4 style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '13px', marginBottom: '15px', marginTop: 0 }}>
              ✨ ORÇAMENTOS CONECTADOS (CLIQUE PARA ACESSAR):
            </h4>

            <button
              type="button"
              onClick={handleSwitchToPersonal}
              style={{
                width: '100%',
                padding: '15px',
                backgroundColor: isOwner ? '#1b5e20' : '#fff',
                border: isOwner ? '2px solid #0d3b10' : '1px solid #4CAF50',
                borderRadius: '10px',
                marginBottom: '10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: isOwner ? '#fff' : '#1b5e20',
                cursor: 'pointer'
              }}
            >
              <div style={{ textAlign: 'left' }}>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '15px', color: isOwner ? '#fff' : '#1b5e20' }}>Seu Orçamento Próprio</p>
                <p style={{ margin: 0, fontSize: '12px', opacity: 0.9, color: isOwner ? '#e0e0e0' : '#555' }}>Titular: {currentUser?.email}</p>
              </div>
              <span style={{ backgroundColor: isOwner ? '#fff' : '#4CAF50', color: isOwner ? '#1b5e20' : '#fff', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                {isOwner ? '✓ ATIVO' : 'ACESSAR'}
              </span>
            </button>

            {compartilhadosComigo.length > 0 ? (
              compartilhadosComigo.map((emailTitular: string, idx: number) => {
                const isSelected = !isOwner && sharedBudget.ownerEmail?.toLowerCase() === emailTitular.toLowerCase();
                const targetBudget = availableBudgets.find(item => item.budget.ownerEmail.toLowerCase() === emailTitular.toLowerCase());
                const collabRecord = targetBudget?.budget.collaborators.find(c => c.email.toLowerCase() === user.email.toLowerCase());
                const accessModeLabel = collabRecord?.accessMode === 'read' ? '📖 Modo Leitura' : '✏️ Modo Edição';
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const budgetIdToSwitch = targetBudget ? targetBudget.budget.budgetId : getCanonicalUserId(emailTitular);
                      handleSwitchToBudget(budgetIdToSwitch);
                    }}
                    style={{
                      width: '100%',
                      padding: '15px',
                      backgroundColor: isSelected ? '#1b5e20' : '#fff',
                      border: isSelected ? '2px solid #0d3b10' : '1px solid #4CAF50',
                      borderRadius: '10px',
                      marginBottom: '10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      color: isSelected ? '#fff' : '#121212',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ margin: 0, fontWeight: 'bold', color: isSelected ? '#fff' : '#2e7d32', fontSize: '15px' }}>
                        Orçamento Compartilhado ({emailTitular.split('@')[0]})
                      </p>
                      <p style={{ margin: 0, fontSize: '12px', color: isSelected ? '#e0e0e0' : '#555' }}>Titular: {emailTitular}</p>
                      <p style={{ margin: '3px 0 0 0', fontSize: '11px', fontWeight: 'bold', color: isSelected ? '#a5d6a7' : '#2e7d32' }}>
                        Permissão: {accessModeLabel}
                      </p>
                    </div>
                    <span style={{
                      backgroundColor: isSelected ? '#fff' : 'transparent',
                      color: isSelected ? '#1b5e20' : '#2e7d32',
                      padding: isSelected ? '5px 10px' : '0',
                      borderRadius: '6px',
                      fontSize: isSelected ? '11px' : '18px',
                      fontWeight: 'bold'
                    }}>
                      {isSelected ? '✓ ATIVO' : '➡️'}
                    </span>
                  </button>
                );
              })
            ) : null}
          </div>

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
                    placeholder="E-mail do Convidado"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="py-2.5 px-4 bg-[#121212] text-[#D4AF37] font-bold text-xs rounded-xl hover:bg-black transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 min-h-[38px] border border-[#D4AF37] disabled:opacity-50 w-full sm:w-auto"
                >
                  <UserPlus className="w-4 h-4 shrink-0" />
                  <span>{isLoading ? 'Processando...' : 'Conceder Acesso'}</span>
                </button>
              </div>

              {/* Mode Selection */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                <span className="text-[11px] font-bold text-gray-700 w-full sm:w-auto">Modo de Acesso:</span>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="inviteMode"
                    value="edit"
                    checked={inviteAccessMode === 'edit'}
                    onChange={() => setInviteAccessMode('edit')}
                    className="accent-[#D4AF37]"
                  />
                  <Edit3 className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span className="font-bold text-[#121212]">Edição (Completo)</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="inviteMode"
                    value="read"
                    checked={inviteAccessMode === 'read'}
                    onChange={() => setInviteAccessMode('read')}
                    className="accent-[#D4AF37]"
                  />
                  <Eye className="w-3.5 h-3.5 text-blue-600 shrink-0" />
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

          {/* SEÇÃO 2: MEMBROS QUE ACESSAM ESTE ORÇAMENTO */}
          <div className="mb-5">
            <h4 className="text-[#333] text-xs sm:text-sm font-bold mb-3 uppercase tracking-wider">
              MEMBROS QUE ACESSAM ESTE ORÇAMENTO:
            </h4>
            
            {membrosLocais.length > 0 ? (
              membrosLocais.map((email, idx) => {
                const gState = getMemberGamification(email);
                const currentDraft = draftPermissoes[email];
                const perm = currentDraft !== undefined ? currentDraft : (permissoesLocais[email] || 'leitura');
                return (
                  <div key={idx} className="p-3.5 sm:p-4 border border-gray-200 rounded-xl mb-3 bg-gray-50 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <p className="font-bold text-[#333] text-xs sm:text-sm truncate select-all">{email}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] sm:text-xs font-bold border border-emerald-200">✓ Concedido</span>
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Deseja remover o acesso de ${email}?`)) {
                                const newMembros = membrosLocais.filter(m => m !== email);
                                setMembrosLocais(newMembros);
                                handleRemoveCollaborator(email);
                              }
                            }}
                            className="py-1 px-2.5 bg-red-600 text-white rounded-lg text-[10px] sm:text-xs font-bold hover:bg-red-700 transition cursor-pointer"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 pt-1 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-gray-600">Permissão:</span>
                        <button
                          type="button"
                          disabled={loadingPermEmail === email}
                          onClick={() => atualizarPermissao(email, perm)}
                          className="py-1 px-3 bg-[#121212] text-[#D4AF37] hover:bg-black rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-xs cursor-pointer border border-[#D4AF37] disabled:opacity-50"
                        >
                          {loadingPermEmail === email ? 'Salvando...' : 'Confirmar Permissão'}
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer bg-white px-2.5 py-1.5 rounded-lg border border-gray-200 shadow-2xs hover:border-amber-400 transition flex-1 sm:flex-initial">
                          <input
                            type="radio"
                            name={`perm-${idx}-${email}`}
                            value="leitura"
                            checked={perm === 'leitura'}
                            onChange={() => setDraftPermissoes(prev => ({ ...prev, [email]: 'leitura' }))}
                            className="accent-[#D4AF37]"
                          />
                          <Eye className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="font-bold text-[#121212] text-[11px]">Leitura</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer bg-white px-2.5 py-1.5 rounded-lg border border-gray-200 shadow-2xs hover:border-amber-400 transition flex-1 sm:flex-initial">
                          <input
                            type="radio"
                            name={`perm-${idx}-${email}`}
                            value="edicao"
                            checked={perm === 'edicao'}
                            onChange={() => setDraftPermissoes(prev => ({ ...prev, [email]: 'edicao' }))}
                            className="accent-[#D4AF37]"
                          />
                          <Edit3 className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span className="font-bold text-[#121212] text-[11px]">Edição</span>
                        </label>
                      </div>
                    </div>

                    {/* Gamification Bar */}
                    <div className="flex items-center flex-wrap gap-1.5 pt-2 border-t border-gray-200 text-[11px]">
                      <span className="font-bold text-gray-500 text-[10px] uppercase tracking-wider">Gamificação:</span>
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
            ) : (
              <p style={{ textAlign: 'center', color: '#888', padding: '15px', border: '1px dashed #ccc', borderRadius: '8px' }}>Nenhum membro listado.</p>
            )}
          </div>
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
