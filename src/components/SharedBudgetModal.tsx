import React, { useState, useEffect } from 'react';
import { User, SharedBudget } from '../types';
import { StorageService, getCanonicalUserId } from '../services/storage';
import { GamificationService, LEAGUE_DIVISIONS } from '../services/gamification';
import { appwriteDatabases as databases, getAppwriteConfig, parsePayloadFromAppwrite, serializePayloadForAppwrite } from '../lib/appwrite';
import { getCanonicalAppwriteDocId } from '../lib/appwriteSync';
import { Permission, Role, ID, Query } from 'appwrite';
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
  const isReadOnly = StorageService.isCurrentUserReadOnly(currentUser);
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

  // Estados locais sincronizados
  const [membrosLocais, setMembrosLocais] = useState<string[]>([]);
  const [deletedMembers, setDeletedMembers] = useState<Set<string>>(new Set());
  const [permissoesLocais, setPermissoesLocais] = useState<Record<string, string>>({});
  const [compartilhadosComigo, setCompartilhadosComigo] = useState<string[]>([]);
  const [permissoesTitulares, setPermissoesTitulares] = useState<Record<string, string>>({});
  const [draftPermissoes, setDraftPermissoes] = useState<Record<string, string>>({});
  const [loadingPermEmail, setLoadingPermEmail] = useState<string | null>(null);

  // Busca do servidor sem cache intermediário
  useEffect(() => {
    const buscarDados = async () => {
      if (!currentUser?.email || !isOpen) return;
      try {
        const config = getAppwriteConfig();
        const meuEmailLimpo = currentUser.email.toLowerCase().trim();
        
        // Robustly find current user document
        let docMe: any = null;
        try {
          const meuId = getCanonicalAppwriteDocId(meuEmailLimpo);
          docMe = await databases.getDocument(config.databaseId, 'user_financials', meuId);
        } catch (e) {
          try {
            const listMe = await databases.listDocuments(config.databaseId, 'user_financials', [
              Query.equal('userId', meuEmailLimpo),
              Query.limit(1)
            ]);
            if (listMe.documents.length > 0) docMe = listMe.documents[0];
          } catch (e2) {}
        }

        let json: any = {};
        if (docMe && docMe.data) {
          json = await parsePayloadFromAppwrite(docMe.data);
        } else {
          // Fallback to server data
          try {
            const servRes = await fetch(`/api/data/load?userId=${encodeURIComponent(meuEmailLimpo)}`);
            if (servRes.ok) {
              const servData = await servRes.json();
              if (servData.success && servData.data) {
                json = servData.data;
              }
            }
          } catch {}
        }

        // Carrega lista de membros vinculados ao titular
        const membrosSet = new Set<string>();
        (Array.isArray(json.allowed_users) ? json.allowed_users : []).forEach((m: string) => m && membrosSet.add(m.toLowerCase().trim()));
        (Array.isArray(json.shared_members) ? json.shared_members : []).forEach((m: string) => m && membrosSet.add(m.toLowerCase().trim()));
        if (json.member_permissions && typeof json.member_permissions === 'object') {
          Object.keys(json.member_permissions).forEach(k => k && membrosSet.add(k.toLowerCase().trim()));
        }

        const rawPerms = json.member_permissions || {};
        const normalizedPerms: Record<string, string> = {};
        Object.keys(rawPerms).forEach(k => {
          const val = rawPerms[k];
          normalizedPerms[k.toLowerCase()] = (val === 'edicao' || val === 'edit' || val === 'edição') ? 'edicao' : 'leitura';
        });

        // Identifica orçamentos compartilhados com este usuário
        let sharedWithMeList: string[] = Array.isArray(json.shared_with_me) ? [...json.shared_with_me] : [];
        const permsDosTitulares: Record<string, string> = {};

        // Também consultar a API central de orçamentos compartilhados
        try {
          const sBudgets = await StorageService.syncSharedBudgetsWithServer(meuEmailLimpo);
          sBudgets.forEach(b => {
            if (b && b.ownerEmail && b.ownerEmail.toLowerCase().trim() === meuEmailLimpo) {
              (b.collaborators || []).forEach(c => {
                if (c && c.email) {
                  const cClean = c.email.toLowerCase().trim();
                  membrosSet.add(cClean);
                  if (c.accessMode && !normalizedPerms[cClean]) {
                    const modeStr = String(c.accessMode || '');
                    normalizedPerms[cClean] = (modeStr === 'edicao' || modeStr === 'edit' || modeStr === 'edição') ? 'edicao' : 'leitura';
                  }
                }
              });
            }
            if (b && b.ownerEmail && b.ownerEmail.toLowerCase().trim() !== meuEmailLimpo) {
              const bOwnerClean = b.ownerEmail.toLowerCase().trim();
              const isCollab = (b.collaborators || []).some(c => (c.email || '').toLowerCase().trim() === meuEmailLimpo);
              if (isCollab) {
                if (!sharedWithMeList.includes(bOwnerClean)) {
                  sharedWithMeList.push(bOwnerClean);
                }
                const myCollab = b.collaborators.find(c => (c.email || '').toLowerCase().trim() === meuEmailLimpo);
                if (myCollab?.accessMode) {
                  permsDosTitulares[bOwnerClean] = myCollab.accessMode;
                }
              }
            }
          });
        } catch (e) {}

        membrosSet.delete(meuEmailLimpo);
        deletedMembers.forEach(d => membrosSet.delete(d));
        setMembrosLocais(Array.from(membrosSet));
        setPermissoesLocais(normalizedPerms);

        // Para cada titular em shared_with_me, verificar se o usuário ainda tem acesso
        for (const ownerEmail of [...sharedWithMeList]) {
          try {
            const ownerEmailClean = ownerEmail.toLowerCase().trim();
            let docOwner: any = null;
            try {
              const ownerId = getCanonicalAppwriteDocId(ownerEmailClean);
              docOwner = await databases.getDocument(config.databaseId, 'user_financials', ownerId);
            } catch (e) {
              try {
                const listOwner = await databases.listDocuments(config.databaseId, 'user_financials', [
                  Query.equal('userId', ownerEmailClean),
                  Query.limit(1)
                ]);
                if (listOwner.documents.length > 0) docOwner = listOwner.documents[0];
              } catch (e2) {}
            }

            let dJson: any = {};
            if (docOwner && docOwner.data) {
              dJson = await parsePayloadFromAppwrite(docOwner.data);
            } else {
              try {
                const sRes = await fetch(`/api/data/load?userId=${encodeURIComponent(ownerEmailClean)}`);
                if (sRes.ok) {
                  const sData = await sRes.json();
                  if (sData.success && sData.data) dJson = sData.data;
                }
              } catch {}
            }

            const allowed = Array.isArray(dJson.allowed_users) ? dJson.allowed_users : (Array.isArray(dJson.shared_members) ? dJson.shared_members : []);
            const permsDoTitular = dJson.member_permissions || {};
            const collabs = Array.isArray(dJson.collaborators) ? dJson.collaborators : [];
            
            const isStillAllowed = allowed.some((m: string) => m && m.toLowerCase().trim() === meuEmailLimpo)
              || Boolean(permsDoTitular[meuEmailLimpo])
              || collabs.some((c: any) => (c.email || '').toLowerCase().trim() === meuEmailLimpo)
              || Boolean(permsDosTitulares[ownerEmailClean]);
            
            if (isStillAllowed) {
              const permDefinida = permsDoTitular[meuEmailLimpo];
              const modoFinal: 'read' | 'edit' = (permDefinida === 'edicao' || permDefinida === 'edit' || permDefinida === 'edição') ? 'edit' : (permDefinida === 'leitura' || permDefinida === 'read' ? 'read' : (permsDosTitulares[ownerEmailClean] === 'read' ? 'read' : 'edit'));
              permsDosTitulares[ownerEmailClean] = modoFinal;
              
              // Sincroniza localmente
              await StorageService.updateCollaboratorAccessMode(ownerEmailClean, meuEmailLimpo, modoFinal);
            }
          } catch (err) {}
        }

        setCompartilhadosComigo(sharedWithMeList);
        setPermissoesTitulares(permsDosTitulares);
        setAvailableBudgets(StorageService.getAvailableBudgetsForUser(user));
      } catch (e) {
        console.error("Erro na sincronização de permissões:", e);
      }
    };

    buscarDados();

    const handleUpdate = () => buscarDados();
    window.addEventListener('shared_budget_updated', handleUpdate);
    window.addEventListener('shared_budgets_updated', handleUpdate);
    return () => {
      window.removeEventListener('shared_budget_updated', handleUpdate);
      window.removeEventListener('shared_budgets_updated', handleUpdate);
    };
  }, [currentUser?.id, isOpen]);

  // Exibe a permissão lida diretamente do documento do Titular
  const getAccessModeLabelForTitular = (emailTitular: string) => {
    const limpo = emailTitular.toLowerCase().trim();
    if (limpo === user.email?.toLowerCase().trim()) return '✏️ Seu Orçamento';

    const modoServidor = permissoesTitulares[limpo];
    if (modoServidor) {
      return modoServidor === 'read' ? '📖 Modo Leitura' : '✏️ Modo Edição';
    }

    const mode = StorageService.getUserAccessModeForBudget(user, emailTitular);
    return mode === 'read' ? '📖 Modo Leitura' : '✏️ Modo Edição';
  };

  const autoSalvarPermissao = async (emailMembro: string, permissaoEscolhida: string) => {
    try {
      setLoadingPermEmail(emailMembro);
      const meuEmail = String(currentUser.email).toLowerCase().trim();
      const config = getAppwriteConfig();
      const accessMode = (permissaoEscolhida === 'edicao' || permissaoEscolhida === 'edit' || permissaoEscolhida === 'edição') ? 'edit' : 'read';

      // 1. Sincronizar com o servidor backend central
      try {
        await fetch('/api/shared-budgets/update-permission', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ownerEmail: meuEmail,
            memberEmail: emailMembro,
            permission: permissaoEscolhida,
          }),
        });
      } catch (errServ) {
        console.warn('[Server update-permission warning]', errServ);
      }

      // 2. Grava no documento do Titular (user_financials) preservando atributos obrigatórios (estado, etc.)
      try {
        const listaDocs = await databases.listDocuments(config.databaseId, 'user_financials');
        const meuDoc = listaDocs.documents.find((d: any) =>
          String(d.email || '').toLowerCase().trim() === meuEmail ||
          String(d.userId || '').toLowerCase().trim() === meuEmail ||
          d.$id === getCanonicalAppwriteDocId(currentUser.email)
        );

        if (meuDoc) {
          const jsonAtual = meuDoc.data ? await parsePayloadFromAppwrite(meuDoc.data) : {};
          jsonAtual.member_permissions = jsonAtual.member_permissions || {};
          jsonAtual.member_permissions[emailMembro.toLowerCase().trim()] = permissaoEscolhida;
          const novaStringData = await serializePayloadForAppwrite(jsonAtual);

          const updatePayload: Record<string, any> = {
            userId: meuEmail,
            data: novaStringData
          };

          await databases.updateDocument(config.databaseId, 'user_financials', meuDoc.$id, updatePayload);
        }
      } catch (errDoc) {
        console.warn('[Appwrite updateDoc permission warning]', errDoc);
      }

      // 3. Dispara registro na tabela 'notificacoes' para o membro
      try {
        await databases.createDocument(config.databaseId, 'notificacoes', ID.unique(), {
          userId: emailMembro.toLowerCase().trim(),
          budgetId: currentUser?.email || 'orcamento',
          mensagem: `${meuEmail} alterou sua permissão para ${permissaoEscolhida === 'leitura' ? 'leitura' : 'edicao'}.`,
          tipo: 'permissao_alterada',
        });
      } catch (errNotif) {}

      // 4. Atualiza cache do navegador
      if (currentUser?.email) {
        await StorageService.updateCollaboratorAccessMode(currentUser.email, emailMembro, accessMode);
      }
      if (sharedBudget?.budgetId) {
        await StorageService.updateCollaboratorAccessMode(sharedBudget.budgetId, emailMembro, accessMode);
      }

      window.dispatchEvent(new CustomEvent('shared_budget_updated', { detail: { budgetId: meuEmail } }));
      window.dispatchEvent(new CustomEvent('shared_budgets_updated'));
      window.dispatchEvent(new Event('remote_data_updated'));
      window.dispatchEvent(new Event('financial_data_mutated'));

      setFeedback({
        type: 'success',
        msg: `Permissão de ${emailMembro} atualizada para ${permissaoEscolhida} com sucesso!`,
      });
    } catch (error) {
      console.error("Falha ao salvar permissão:", error);
      setFeedback({ type: 'error', msg: `Erro ao salvar permissão: ${(error as any).message}` });
    } finally {
      setLoadingPermEmail(null);
    }
  };

  const togglePermissao = async (emailMembro: string, tipo: string) => {
    const emailNormalizado = String(emailMembro).toLowerCase().trim();
    setPermissoesLocais(prev => ({ ...prev, [emailNormalizado]: tipo }));
    setDraftPermissoes(prev => ({ ...prev, [emailNormalizado]: tipo, [emailMembro]: tipo }));
    await autoSalvarPermissao(emailNormalizado, tipo);
  };

  const concederAcesso = async (emailConvidado: string) => {
    if (!emailConvidado) {
      window.dispatchEvent(new CustomEvent('app-alert', { detail: { message: "Insira um e-mail." } }));
      return;
    }
    setIsLoading(true);
    try {
      const meuEmail = currentUser.email.toLowerCase().trim();
      const emailAlvo = emailConvidado.toLowerCase().trim();

      if (meuEmail === emailAlvo) {
        throw new Error("Você não pode conceder acesso ao seu próprio e-mail.");
      }

      // 1. Chamada robusta ao backend central para conceder o acesso com fallback cliente-first
      let useClientFallback = false;
      try {
        const servRes = await fetch('/api/shared-budgets/add-collaborator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ownerEmail: meuEmail,
            guestEmail: emailAlvo,
            accessMode: inviteAccessMode || 'edit',
          }),
        });

        if (servRes.status === 404) {
          console.warn('[Server 404] add-collaborator backend not available on this domain. Using direct client-side Appwrite/Local-first sharing.');
          useClientFallback = true;
        } else {
          const responseText = await servRes.text();
          let servData: any = {};
          try {
            servData = responseText ? JSON.parse(responseText) : {};
          } catch (parseErr) {
            throw new Error(responseText || 'Erro de comunicação com o servidor.');
          }
          if (!servRes.ok || !servData.success) {
            throw new Error(servData.message || responseText || `Erro ao conceder acesso (${servRes.status}).`);
          }
        }
      } catch (fetchErr: any) {
        console.warn('[Backend fetch error] Falling back to direct client-side Appwrite/Local-first sharing.', fetchErr);
        useClientFallback = true;
      }

      // 2. Sincronizar com o Appwrite diretamente pelo cliente (com descompressão e serialização seguras)
      try {
        const config = getAppwriteConfig();
        let meuDoc: any = null;
        try {
          const meuDocId = getCanonicalAppwriteDocId(meuEmail);
          meuDoc = await databases.getDocument(config.databaseId, 'user_financials', meuDocId);
        } catch (e) {
          try {
            const listMe = await databases.listDocuments(config.databaseId, 'user_financials', [
              Query.equal('userId', meuEmail),
              Query.limit(1)
            ]);
            if (listMe.documents.length > 0) meuDoc = listMe.documents[0];
          } catch {}
        }

        if (meuDoc) {
          const meuJson = await parsePayloadFromAppwrite(meuDoc.data);
          let allowed = Array.isArray(meuJson.allowed_users) ? meuJson.allowed_users : [];
          if (!allowed.includes(emailAlvo)) allowed.push(emailAlvo);
          meuJson.allowed_users = allowed;

          let sharedM = Array.isArray(meuJson.shared_members) ? meuJson.shared_members : [];
          if (!sharedM.includes(emailAlvo)) sharedM.push(emailAlvo);
          meuJson.shared_members = sharedM;

          meuJson.member_permissions = meuJson.member_permissions || {};
          meuJson.member_permissions[emailAlvo] = inviteAccessMode === 'read' ? 'leitura' : 'edicao';

          const novaData = await serializePayloadForAppwrite(meuJson);
          await databases.updateDocument(config.databaseId, 'user_financials', meuDoc.$id, {
            userId: meuEmail,
            data: novaData
          }, [
            Permission.read(Role.any()),
            Permission.write(Role.any()),
            Permission.update(Role.any()),
            Permission.delete(Role.any())
          ]);
        }
      } catch (appwriteClientErr) {
        console.warn('[Direct Appwrite client update notice]', appwriteClientErr);
        // If we are forced to use client fallback and Appwrite client-side update also fails, then raise the error
        if (useClientFallback) {
          throw new Error(`Não foi possível salvar no Appwrite do cliente: ${(appwriteClientErr as any).message || appwriteClientErr}`);
        }
      }

      // 3. Atualizar armazenamento local
      await StorageService.addCollaboratorByEmail(currentUser, emailAlvo, inviteAccessMode);

      // 4. Atualizar estados locais da modal
      setMembrosLocais(prev => prev.includes(emailAlvo) ? prev : [...prev, emailAlvo]);
      setPermissoesLocais(prev => ({
        ...prev,
        [emailAlvo]: inviteAccessMode === 'read' ? 'leitura' : 'edicao'
      }));

      setFeedback({
        type: 'success',
        msg: `🎉 Acesso concedido com sucesso para ${emailAlvo}!`,
      });

      window.dispatchEvent(new CustomEvent('shared_budget_updated', { detail: { budgetId: meuEmail } }));
      window.dispatchEvent(new CustomEvent('shared_budgets_updated'));
      window.dispatchEvent(new Event('financial_data_mutated'));

      window.dispatchEvent(new CustomEvent('app-alert', {
        detail: {
          message: `Acesso concedido para ${emailAlvo}!`,
          onOk: () => {}
        }
      }));
    } catch (e: any) {
      console.error("ERRO DETALHADO NO CONCEDER ACESSO:", e);
      const errorMsg = e?.message || JSON.stringify(e);
      setFeedback({ type: 'error', msg: `Erro ao conceder acesso: ${errorMsg}` });
      window.dispatchEvent(new CustomEvent('app-alert', { 
        detail: { 
          message: `Erro ao conceder acesso: ${errorMsg}` 
        } 
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const removerMembro = async (emailMembro: string) => {
    window.dispatchEvent(new CustomEvent('app-confirm', {
      detail: {
        message: `Tem certeza que deseja excluir ${emailMembro} do seu orçamento?`,
        onConfirm: async () => {
          try {
            const meuEmail = (sharedBudget?.ownerEmail || currentUser.email).toLowerCase().trim();
            const emailAlvo = emailMembro.toLowerCase().trim();

            // 1. Remover via API do servidor
            try {
              await fetch('/api/shared-budgets/remove-collaborator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  budgetId: sharedBudget?.budgetId || meuEmail,
                  email: emailAlvo,
                  ownerEmail: meuEmail
                })
              });
            } catch (errServ) {
              console.warn('[Server remove-collaborator warning]', errServ);
            }

            // 2. Atualizar Appwrite pelo cliente
            try {
              const config = getAppwriteConfig();
              let docMe: any = null;
              try {
                const meuId = getCanonicalAppwriteDocId(meuEmail);
                docMe = await databases.getDocument(config.databaseId, 'user_financials', meuId);
              } catch (e) {
                const listMe = await databases.listDocuments(config.databaseId, 'user_financials', [
                  Query.equal('userId', meuEmail),
                  Query.limit(1)
                ]);
                if (listMe.documents.length > 0) docMe = listMe.documents[0];
              }

              if (docMe) {
                const jsonMe = await parsePayloadFromAppwrite(docMe.data);
                jsonMe.allowed_users = (jsonMe.allowed_users || []).filter((e: string) => e.toLowerCase() !== emailAlvo);
                if (jsonMe.shared_members) {
                  jsonMe.shared_members = jsonMe.shared_members.filter((e: string) => e.toLowerCase() !== emailAlvo);
                }
                if (jsonMe.member_permissions) delete jsonMe.member_permissions[emailAlvo];

                const novaDataMe = await serializePayloadForAppwrite(jsonMe);
                await databases.updateDocument(config.databaseId, 'user_financials', docMe.$id, {
                  userId: meuEmail,
                  data: novaDataMe
                });
              }
            } catch (errAppwrite) {
              console.warn('[Client Appwrite remove error]', errAppwrite);
            }

            // 3. Atualizar armazenamento local
            if (sharedBudget?.budgetId) {
              await StorageService.removeCollaborator(sharedBudget.budgetId, emailMembro);
            }
            await StorageService.removeCollaborator(meuEmail, emailMembro);

            // 4. Atualizar estados locais
            setDeletedMembers(prev => {
              const next = new Set(prev);
              next.add(emailAlvo);
              return next;
            });
            setMembrosLocais(prev => prev.filter(e => e.toLowerCase().trim() !== emailAlvo));
            setPermissoesLocais(prev => {
              const next = { ...prev };
              delete next[emailAlvo];
              return next;
            });

            window.dispatchEvent(new CustomEvent('shared_budget_updated', { detail: { budgetId: meuEmail } }));
            window.dispatchEvent(new CustomEvent('shared_budgets_updated'));
            window.dispatchEvent(new Event('financial_data_mutated'));

            setFeedback({
              type: 'success',
              msg: `${emailMembro} foi removido(a) do seu orçamento.`
            });
          } catch (e: any) {
            console.error("Erro ao remover membro:", e);
            window.dispatchEvent(new CustomEvent('app-alert', { detail: { message: `Erro ao excluir membro: ${e.message}` } }));
          }
        }
      }
    }));
  };

  const [isSwitchingBudget, setIsSwitchingBudget] = useState(false);
  const [switchLoadingMessage, setSwitchLoadingMessage] = useState('');

  const handleSwitchToBudget = async (budgetIdToAccess: string) => {
    setIsSwitchingBudget(true);
    setSwitchLoadingMessage('Sincronizando contas, transações e permissões...');
    try {
      const updated = StorageService.switchBudget(user, budgetIdToAccess);
      await StorageService.syncUserDataWithRemote(budgetIdToAccess);
      await onUserUpdated(updated);
      const newBudgetId = StorageService.getEffectiveBudgetId(updated);
      const targetObj = StorageService.getSharedBudget(newBudgetId, updated);
      setSharedBudget(targetObj);
      setAvailableBudgets(StorageService.getAvailableBudgetsForUser(updated));

      window.dispatchEvent(new CustomEvent('shared_budget_updated', { detail: { budgetId: newBudgetId } }));
      window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId: newBudgetId } }));

      setFeedback({
        type: 'success',
        msg: `Orçamento alterado com sucesso! Você agora está visualizando o orçamento de: ${targetObj.ownerName}`,
      });
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
      await StorageService.syncUserDataWithRemote(user.id);
      await onUserUpdated(updated);
      setSharedBudget(StorageService.getSharedBudget(user.id, updated));
      setAvailableBudgets(StorageService.getAvailableBudgetsForUser(updated));

      window.dispatchEvent(new CustomEvent('shared_budget_updated', { detail: { budgetId: user.id } }));
      window.dispatchEvent(new CustomEvent('financial_data_mutated', { detail: { userId: user.id } }));

      setFeedback({ type: 'success', msg: 'Você retornou ao seu orçamento pessoal.' });
      await new Promise(resolve => setTimeout(resolve, 800));
      setIsSwitchingBudget(false);
      onClose();
    } catch (e) {
      console.error(e);
      setIsSwitchingBudget(false);
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

                const bannerTitle = isInvite ? 'Convite para Acessar Orçamento' : 'Solicitação de Acesso ao Seu Orçamento';
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

            {(() => {
              const myEmailClean = (currentUser?.email || user?.email || '').toLowerCase().trim();
              const connectedTitulares = Array.from(new Set([
                ...compartilhadosComigo.map(e => e.toLowerCase().trim()),
                ...availableBudgets.filter(b => !b.isOwner && b.budget?.ownerEmail).map(b => b.budget.ownerEmail.toLowerCase().trim())
              ])).filter(e => e && e !== myEmailClean);

              if (connectedTitulares.length === 0) return null;

              return connectedTitulares.map((emailTitular: string, idx: number) => {
                const isSelected = !isOwner && (
                  sharedBudget.ownerEmail?.toLowerCase().trim() === emailTitular ||
                  effectiveBudgetId?.toLowerCase().trim() === emailTitular
                );
                const targetBudget = availableBudgets.find(item => item.budget.ownerEmail.toLowerCase().trim() === emailTitular);
                const accessModeLabel = getAccessModeLabelForTitular(emailTitular);
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
              });
            })()}
          </div>

          {Boolean(!isReadOnly) && (
            <div className="space-y-3 bg-[#D4AF37]/10 p-3.5 sm:p-4 rounded-2xl border border-[#D4AF37]/40">
              <label className="text-xs font-extrabold text-[#121212] block uppercase tracking-wider flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-[#D4AF37]" />
                <span>1. Acesso ao seu Orçamento (Conectar):</span>
              </label>
              <p className="text-[11px] text-gray-700 leading-snug">
                Informe o <strong>e-mail do convidado</strong> cadastrado no sistema para conceder acesso ao seu orçamento:
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

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                  <span className="text-[11px] font-bold text-gray-700 w-full sm:w-auto">Modo de Acesso Inicial:</span>
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
          )}

          {/* Section 2: Pedir Acesso */}
          <div className="space-y-2 pt-2 border-t border-gray-200">
            <label className="text-xs font-extrabold text-[#121212] block uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-4 h-4 text-[#00C853]" />
              <span>2. Pedir Acesso a Outro Orçamento (Conectar):</span>
            </label>
            <p className="text-[11px] text-gray-700 leading-snug">
              Informe o <strong>e-mail do titular</strong> do orçamento cadastrado no sistema para solicitar autorização:
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

          {/* SEÇÃO DE MEMBROS E PERMISSÕES */}
          <div className="mb-5">
            <h4 className="text-[#333] text-xs sm:text-sm font-bold mb-3 uppercase tracking-wider">
              MEMBROS QUE ACESSAM ESTE ORÇAMENTO:
            </h4>

            {membrosLocais.length > 0 ? (
              membrosLocais.map((email, idx) => {
                const gState = getMemberGamification(email);
                const currentDraft = draftPermissoes[email];
                const perm = currentDraft !== undefined ? currentDraft : (permissoesLocais[email.toLowerCase().trim()] || 'leitura');
                return (
                  <div key={idx} style={{ padding: '15px', border: '1px solid #e0e0e0', borderRadius: '12px', marginBottom: '15px', backgroundColor: '#f9f9f9' }}>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#333', fontSize: '15px', marginBottom: '10px' }}>{email}</p>

                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                      <span style={{ padding: '6px 12px', backgroundColor: '#e8f5e9', color: '#2e7d32', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #4CAF50' }}>✓ Concedido</span>
                      {Boolean(!isReadOnly) && isOwner && (
                        <button type="button" onClick={() => removerMembro(email)} style={{ padding: '6px 12px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #f44336', cursor: 'pointer' }}>Excluir</button>
                      )}
                    </div>

                    {Boolean(!isReadOnly) ? (
                      <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '10px', border: '1px solid #eee' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#555' }}>Permissão de Acesso:</span>
                          {loadingPermEmail === email && (
                            <span style={{ fontSize: '11px', color: '#ffb300', fontWeight: 'bold' }}>Salvando no servidor...</span>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                          <div onClick={() => togglePermissao(email, 'leitura')} style={{ flex: 1, padding: '10px', border: perm !== 'edicao' ? '2px solid #ffb300' : '1px solid #ddd', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', backgroundColor: perm !== 'edicao' ? '#fffaf0' : '#fff' }}>
                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: perm !== 'edicao' ? '4px solid #ffb300' : '2px solid #ccc', backgroundColor: '#fff' }}></div>
                            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#333' }}>👁️ Leitura</span>
                          </div>

                          <div onClick={() => togglePermissao(email, 'edicao')} style={{ flex: 1, padding: '10px', border: perm === 'edicao' ? '2px solid #ffb300' : '1px solid #ddd', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', backgroundColor: perm === 'edicao' ? '#fffaf0' : '#fff' }}>
                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: perm === 'edicao' ? '4px solid #ffb300' : '2px solid #ccc', backgroundColor: '#fff' }}></div>
                            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#333' }}>✏️ Edição</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ backgroundColor: '#fff', padding: '10px 15px', borderRadius: '10px', border: '1px solid #eee', fontSize: '13px', color: '#555' }}>
                        Permissão de Acesso: <strong className="text-gray-900">{perm === 'edicao' ? '✏️ Edição' : '👁️ Leitura'}</strong>
                      </div>
                    )}

                    <div className="flex items-center flex-wrap gap-1.5 pt-3 mt-3 border-t border-gray-200 text-[11px]">
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
              <p style={{ textAlign: 'center', color: '#888', padding: '15px', border: '1px dashed #ccc', borderRadius: '8px' }}>Nenhum membro listado no momento.</p>
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
