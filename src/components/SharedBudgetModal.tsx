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
        await StorageService.syncSharedBudgetsWithServer(currentUser.email);
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
        const rawPerms = json.member_permissions || {};
        const normalizedPerms: Record<string, string> = {};
        Object.keys(rawPerms).forEach(k => {
          const val = rawPerms[k];
          normalizedPerms[k.toLowerCase()] = (val === 'edicao' || val === 'edit' || val === 'edição') ? 'edicao' : 'leitura';
        });
        if (sharedBudget && sharedBudget.collaborators) {
          sharedBudget.collaborators.forEach(c => {
            if (c.email) {
              const mode = c.accessMode === 'edit' ? 'edicao' : (c.accessMode === 'read' ? 'leitura' : null);
              if (mode) {
                normalizedPerms[c.email.toLowerCase()] = mode;
              }
            }
          });
        }
        setPermissoesLocais(normalizedPerms);
        
        let sharedWithMeList = Array.isArray(json.shared_with_me) ? json.shared_with_me : [];
        try {
          const listaAll = await databases.listDocuments(config.databaseId, 'user_financials');
          listaAll.documents.forEach((d: any) => {
            if (d.$id !== docId && d.userId !== currentUser.email) {
              try {
                const dJson = typeof d.data === 'string' ? JSON.parse(d.data || '{}') : (d.data || {});
                const ownerEmail = d.userId || d.email || d.$id;
                
                // Check server-side member_permissions for current user
                const memberPerms = dJson.member_permissions || {};
                const serverPerm = memberPerms[currentUser.email.toLowerCase().trim()];
                if (serverPerm) {
                  const accessMode = (serverPerm === 'edicao' || serverPerm === 'edit' || serverPerm === 'edição') ? 'edit' : 'read';
                  
                  // Update localStorage SHARED_BUDGETS if different
                  try {
                    const allSharedStr = localStorage.getItem('darla_shared_budgets') || '[]';
                    const allShared = JSON.parse(allSharedStr);
                    let foundB = allShared.find((b: any) => b.ownerEmail?.toLowerCase() === ownerEmail.toLowerCase() || b.budgetId === ownerEmail);
                    if (foundB) {
                      let col = foundB.collaborators?.find((c: any) => c.email.toLowerCase() === currentUser.email.toLowerCase());
                      if (col && col.accessMode !== accessMode) {
                        col.accessMode = accessMode;
                        localStorage.setItem('darla_shared_budgets', JSON.stringify(allShared));
                        window.dispatchEvent(new CustomEvent('shared_budgets_updated'));
                      }
                    }
                  } catch (err) {}

                  // Update localStorage DINHEIRO_SEM_FILTRO_USER_FINANCIALS if different
                  try {
                    const allFinStr = localStorage.getItem('DINHEIRO_SEM_FILTRO_USER_FINANCIALS') || '{}';
                    const allFin = JSON.parse(allFinStr);
                    if (allFin[ownerEmail] && allFin[ownerEmail].data) {
                      const fData = typeof allFin[ownerEmail].data === 'string' ? JSON.parse(allFin[ownerEmail].data) : allFin[ownerEmail].data;
                      fData.member_permissions = fData.member_permissions || {};
                      if (fData.member_permissions[currentUser.email.toLowerCase().trim()] !== serverPerm) {
                        fData.member_permissions[currentUser.email.toLowerCase().trim()] = serverPerm;
                        allFin[ownerEmail].data = JSON.stringify(fData);
                        localStorage.setItem('DINHEIRO_SEM_FILTRO_USER_FINANCIALS', JSON.stringify(allFin));
                        window.dispatchEvent(new Event('remote_data_updated'));
                      }
                    }
                  } catch (err) {}
                }

                const allowed = Array.isArray(dJson.allowed_users) ? dJson.allowed_users : (Array.isArray(dJson.shared_members) ? dJson.shared_members : []);
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
        setAvailableBudgets(StorageService.getAvailableBudgetsForUser(user));
      } catch (e) {
        console.error("Erro na leitura:", e);
      }
    };
    buscarDados();

    const handleUpdate = () => {
      buscarDados();
    };
    window.addEventListener('shared_budget_updated', handleUpdate);
    window.addEventListener('shared_budgets_updated', handleUpdate);
    return () => {
      window.removeEventListener('shared_budget_updated', handleUpdate);
      window.removeEventListener('shared_budgets_updated', handleUpdate);
    };
  }, [currentUser?.id, isOpen]);

  const getAccessModeLabelForTitular = (emailTitular: string, targetBudget: any) => {
    if (emailTitular.toLowerCase() === user.email?.toLowerCase()) return '✏️ Seu Orçamento';
    const mode = StorageService.getUserAccessModeForBudget(user, emailTitular);
    return mode === 'read' ? '📖 Modo Leitura' : '✏️ Modo Edição';
  };

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

  const atualizarPermissao = async (emailMembro: string, nivelInput: string) => {
    const nivel = (nivelInput === 'edicao' || nivelInput === 'edit' || nivelInput === 'edição') ? 'edicao' : 'leitura';
    const accessMode = nivel === 'edicao' ? 'edit' : 'read';
    console.log("🕵️ [DEDO-DURO] atualizarPermissao called:", { emailMembro, nivel, accessMode, sharedBudgetId: sharedBudget?.budgetId, ownerEmail: sharedBudget?.ownerEmail });
    setLoadingPermEmail(emailMembro);
    setIsLoading(true);
    try {
      const config = getAppwriteConfig();
      const meuEmail = currentUser.email.toLowerCase().trim();
      const meuDocId = getCanonicalAppwriteDocId(meuEmail);
      const emailAlvo = emailMembro.toLowerCase().trim();
      const alvoDocId = getCanonicalAppwriteDocId(emailAlvo);

      const lista = await databases.listDocuments(config.databaseId, 'user_financials');
      const meuDoc = lista.documents.find((d: any) => d.userId === meuEmail || d.email === meuEmail || d.$id === meuDocId);
      const docAlvo = lista.documents.find((d: any) => d.userId === emailAlvo || d.email === emailAlvo || d.$id === alvoDocId);

      if (meuDoc) {
        const json = typeof meuDoc.data === 'string' ? JSON.parse(meuDoc.data || '{}') : (meuDoc.data || {});
        json.member_permissions = json.member_permissions || {};
        json.member_permissions[emailAlvo] = nivel;
        await databases.updateDocument(config.databaseId, 'user_financials', meuDoc.$id, { userId: meuEmail, data: JSON.stringify(json) });
        
        try {
          await fetch('/api/data/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: meuEmail,
              member_permissions: json.member_permissions
            })
          });
        } catch (e) {
          console.warn('[Sync member_permissions to server error]', e);
        }
      }

      if (docAlvo) {
        const jsonAlvo = typeof docAlvo.data === 'string' ? JSON.parse(docAlvo.data || '{}') : (docAlvo.data || {});
        jsonAlvo.member_permissions = jsonAlvo.member_permissions || {};
        jsonAlvo.member_permissions[meuEmail] = nivel;
        await databases.updateDocument(config.databaseId, 'user_financials', docAlvo.$id, { userId: emailAlvo, data: JSON.stringify(jsonAlvo) });
      }

      if (sharedBudget && sharedBudget.budgetId) {
        const resBudget = await StorageService.updateCollaboratorAccessMode(sharedBudget.budgetId, emailAlvo, accessMode);
        if (resBudget) setSharedBudget(resBudget);
      }

      setPermissoesLocais(prev => ({ ...prev, [emailAlvo]: nivel }));
      setDraftPermissoes(prev => {
        const copy = { ...prev };
        delete copy[emailAlvo];
        return copy;
      });

      window.dispatchEvent(new CustomEvent('shared_budgets_updated'));
      window.dispatchEvent(new Event('remote_data_updated'));
      window.dispatchEvent(new Event('financial_data_mutated'));

      setFeedback({
        type: 'success',
        msg: `Permissão de ${emailMembro} atualizada para ${nivel === 'leitura' ? 'Leitura' : 'Edição'} e sincronizada com sucesso!`
      });
    } catch (e) {
      console.error("🕵️ [DEDO-DURO] Erro em atualizarPermissao:", e);
      alert(`[DEDO-DURO ERRO] Falha ao atualizar permissão: ${e instanceof Error ? e.message : e}`);
      setFeedback({ type: 'error', msg: 'Erro ao atualizar permissão.' });
    } finally {
      setLoadingPermEmail(null);
      setIsLoading(false);
    }
  };

  const removerMembro = async (emailMembro: string) => {
    if(!window.confirm(`Tem certeza que deseja excluir ${emailMembro} do seu orçamento?`)) return;
    try {
      const config = getAppwriteConfig();
      const meuId = getCanonicalAppwriteDocId(currentUser.email);
      const docMe = await databases.getDocument(config.databaseId, 'user_financials', meuId);
      const jsonMe = docMe.data ? (typeof docMe.data === 'string' ? JSON.parse(docMe.data) : docMe.data) : {};

      // Remove das listas
      jsonMe.allowed_users = (jsonMe.allowed_users || []).filter((e: string) => e.toLowerCase() !== emailMembro.toLowerCase());
      if (jsonMe.shared_members) {
        jsonMe.shared_members = jsonMe.shared_members.filter((e: string) => e.toLowerCase() !== emailMembro.toLowerCase());
      }
      if (jsonMe.member_permissions) delete jsonMe.member_permissions[emailMembro];
      await databases.updateDocument(config.databaseId, 'user_financials', meuId, { userId: currentUser.email.toLowerCase().trim(), data: JSON.stringify(jsonMe) });

      // Remove o vínculo no convidado
      const emailAlvo = emailMembro.toLowerCase().trim();
      const idConvidado = getCanonicalAppwriteDocId(emailAlvo);
      try {
        const docConv = await databases.getDocument(config.databaseId, 'user_financials', idConvidado);
        const jsonConv = docConv.data ? (typeof docConv.data === 'string' ? JSON.parse(docConv.data) : docConv.data) : {};
        if (Array.isArray(jsonConv.shared_with_me)) {
          jsonConv.shared_with_me = jsonConv.shared_with_me.filter((e: string) => e.toLowerCase() !== currentUser.email.toLowerCase());
        }
        if (jsonConv.active_budget_owner === meuId || jsonConv.active_budget_owner === currentUser.email) {
          jsonConv.active_budget_owner = null;
        }
        await databases.updateDocument(config.databaseId, 'user_financials', idConvidado, { userId: emailAlvo, data: JSON.stringify(jsonConv) });
      } catch(e) { console.warn("Convidado não sincronizado na exclusão."); }

      const targetBudgetId = sharedBudget?.budgetId || effectiveBudgetId;
      StorageService.removeCollaborator(targetBudgetId, emailMembro);

      alert("Membro removido com sucesso!");
      window.location.reload();
    } catch (error) { 
      console.error("Erro ao excluir membro:", error);
      alert("Erro ao excluir membro."); 
    }
  };

  const confirmarPermissao = async (emailMembro: string) => {
    try {
        const emailNormalizado = String(emailMembro).toLowerCase().trim();
        const permissaoEscolhida = draftPermissoes[emailMembro] || draftPermissoes[emailNormalizado] || permissoesLocais[emailNormalizado] || permissoesLocais[emailMembro] || 'leitura';
        const meuEmail = String(currentUser.email).toLowerCase().trim();
        
        const config = getAppwriteConfig();

        // 1. Busca os dados reais diretamente do servidor
        const listaDocs = await databases.listDocuments(config.databaseId, 'user_financials');
        const meuDoc = listaDocs.documents.find((d: any) => 
            String(d.email || '').toLowerCase().trim() === meuEmail || 
            String(d.userId || '').toLowerCase().trim() === meuEmail || 
            d.$id === getCanonicalAppwriteDocId(currentUser.email)
        );

        if (!meuDoc) return alert("Erro: Documento não encontrado no banco.");

        // 2. Prepara o JSON com a nova permissão
        const jsonAtual = meuDoc.data ? (typeof meuDoc.data === 'string' ? JSON.parse(meuDoc.data) : meuDoc.data) : {};
        jsonAtual.member_permissions = jsonAtual.member_permissions || {};
        jsonAtual.member_permissions[emailNormalizado] = permissaoEscolhida;
        const novaStringData = JSON.stringify(jsonAtual);

        // 3. Atualiza o banco de dados oficial da Titular (Appwrite)
        await databases.updateDocument(
            config.databaseId,
            'user_financials',
            meuDoc.$id,
            { userId: currentUser.email.toLowerCase().trim(), data: novaStringData }
        );

        // 3.1 Atualiza também o documento do membro/convidado no Appwrite se existir
        const docAlvo = listaDocs.documents.find((d: any) => 
            String(d.email || '').toLowerCase().trim() === emailNormalizado || 
            String(d.userId || '').toLowerCase().trim() === emailNormalizado || 
            d.$id === getCanonicalAppwriteDocId(emailNormalizado)
        );
        if (docAlvo) {
          try {
            const jsonAlvo = docAlvo.data ? (typeof docAlvo.data === 'string' ? JSON.parse(docAlvo.data) : docAlvo.data) : {};
            jsonAlvo.member_permissions = jsonAlvo.member_permissions || {};
            jsonAlvo.member_permissions[emailNormalizado] = permissaoEscolhida;
            await databases.updateDocument(
              config.databaseId,
              'user_financials',
              docAlvo.$id,
              { userId: emailNormalizado, data: JSON.stringify(jsonAlvo) }
            );
          } catch(e) {}
        }

        // Also update local storage and shared budget collaborator access mode
        try {
          const allFinStr = localStorage.getItem('DINHEIRO_SEM_FILTRO_USER_FINANCIALS') || '{}';
          const allFin = JSON.parse(allFinStr);
          const meuIdKey = meuDoc.$id;
          const keyToUse = allFin[meuIdKey] ? meuIdKey : Object.keys(allFin)[0];
          if (keyToUse && allFin[keyToUse]) {
            const item = allFin[keyToUse];
            const parsedData = item.data ? (typeof item.data === 'string' ? JSON.parse(item.data) : item.data) : {};
            parsedData.member_permissions = jsonAtual.member_permissions;
            item.data = JSON.stringify(parsedData);
            localStorage.setItem('DINHEIRO_SEM_FILTRO_USER_FINANCIALS', JSON.stringify(allFin));
          }
        } catch(e) {}

        const accessMode = (permissaoEscolhida === 'edicao' || permissaoEscolhida === 'edit' || permissaoEscolhida === 'edição') ? 'edit' : 'read';
        if (currentUser && currentUser.email) {
          await StorageService.updateCollaboratorAccessMode(currentUser.email, emailNormalizado, accessMode);
        }
        if (sharedBudget && sharedBudget.budgetId) {
          await StorageService.updateCollaboratorAccessMode(sharedBudget.budgetId, emailNormalizado, accessMode);
        }

        // Sync member_permissions to central server backend
        try {
          await fetch('/api/data/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: currentUser.email,
              member_permissions: jsonAtual.member_permissions
            })
          });
          await fetch('/api/data/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: emailNormalizado,
              member_permissions: jsonAtual.member_permissions
            })
          });
        } catch(e) {}

        window.dispatchEvent(new CustomEvent('shared_budgets_updated'));
        window.dispatchEvent(new Event('remote_data_updated'));
        window.dispatchEvent(new Event('financial_data_mutated'));

        // 4. O TRUQUE DE BLINDAGEM: Muta a referência do objeto em memória
        let financialData: any = meuDoc;
        if (financialData) {
            financialData.data = novaStringData; 
        }

        window.dispatchEvent(new Event('shared_budget_updated'));
        window.dispatchEvent(new Event('financial_data_mutated'));
        if ('BroadcastChannel' in window) {
          try {
            const bc = new BroadcastChannel('darla_data_sync_channel');
            bc.postMessage({ type: 'SHARED_BUDGET_UPDATED', ownerEmail: meuEmail, memberEmail: emailNormalizado, accessMode });
            bc.close();
          } catch(e) {}
        }

        alert(`SUCESSO ABSOLUTO! Permissão de ${emailNormalizado} travada no banco como: ${permissaoEscolhida.toUpperCase()}`);
        
        // 5. Hard Reload para forçar a renderização do novo estado
        window.location.href = window.location.pathname;

    } catch (error) {
        console.error("Falha na mutação:", error);
        alert("Erro ao gravar no servidor.");
    }
  };

  const togglePermissao = async (emailMembro: string, tipo: string) => {
    const emailNormalizado = String(emailMembro).toLowerCase().trim();
    setPermissoesLocais(prev => ({ ...prev, [emailNormalizado]: tipo }));
    setDraftPermissoes(prev => ({ ...prev, [emailNormalizado]: tipo, [emailMembro]: tipo }));
    
    // Dispara a atualização em tempo real silenciosamente sem bloquear
    await autoSalvarPermissao(emailNormalizado, tipo);
  };

  const autoSalvarPermissao = async (emailMembro: string, permissaoEscolhida: string) => {
    try {
        setLoadingPermEmail(emailMembro); // Feedback visual (Salvando...)
        const meuEmail = String(currentUser.email).toLowerCase().trim();
        const config = getAppwriteConfig();
        const accessMode = (permissaoEscolhida === 'edicao' || permissaoEscolhida === 'edit' || permissaoEscolhida === 'edição') ? 'edit' : 'read';
        
        // 1. Otimização Opcional: Tentar chamar a Appwrite Function de Servidor
        // (Se a VITE_APPWRITE_FUNCTION_UPDATE_PERMISSIONS estiver definida)
        try {
          const fnId = import.meta.env.VITE_APPWRITE_FUNCTION_UPDATE_PERMISSIONS;
          if (fnId) {
             const { Functions, ExecutionMethod } = await import('appwrite');
             const { appwriteClient } = await import('../lib/appwrite');
             const funcs = new Functions(appwriteClient);
             await funcs.createExecution(fnId, JSON.stringify({
               emailDoConvidado: emailMembro,
               idDoDocumentoDoOrcamento: StorageService.getEffectiveBudgetId(currentUser),
               permissaoEscolhida
             }), false, '/', ExecutionMethod.POST);
          }
        } catch(e) { console.warn("Appwrite Function call failed, falling back to client-side SDK.", e); }

        // 2. Client-Side Fallback (Padrão) - Atualiza os dados via SDK Cliente
        const listaDocs = await databases.listDocuments(config.databaseId, 'user_financials');
        const meuDoc = listaDocs.documents.find((d: any) => 
            String(d.email || '').toLowerCase().trim() === meuEmail || 
            String(d.userId || '').toLowerCase().trim() === meuEmail || 
            d.$id === getCanonicalAppwriteDocId(currentUser.email)
        );

        if (meuDoc) {
            const jsonAtual = meuDoc.data ? (typeof meuDoc.data === 'string' ? JSON.parse(meuDoc.data) : meuDoc.data) : {};
            jsonAtual.member_permissions = jsonAtual.member_permissions || {};
            jsonAtual.member_permissions[emailMembro] = permissaoEscolhida;
            const novaStringData = JSON.stringify(jsonAtual);

            // Atualiza o banco do Titular
            await databases.updateDocument(config.databaseId, 'user_financials', meuDoc.$id, { userId: meuEmail, data: novaStringData });

            // Muta no próprio browser para instant feedback
            let financialData: any = meuDoc;
            if (financialData) financialData.data = novaStringData; 
        }

        // 3. Atualiza Convidado (Se existir) para disparar o webhook do Realtime dele
        const docAlvo = listaDocs.documents.find((d: any) => 
            String(d.email || '').toLowerCase().trim() === emailMembro || 
            String(d.userId || '').toLowerCase().trim() === emailMembro || 
            d.$id === getCanonicalAppwriteDocId(emailMembro)
        );
        if (docAlvo) {
          try {
            const jsonAlvo = docAlvo.data ? (typeof docAlvo.data === 'string' ? JSON.parse(docAlvo.data) : docAlvo.data) : {};
            jsonAlvo.member_permissions = jsonAlvo.member_permissions || {};
            jsonAlvo.member_permissions[emailMembro] = permissaoEscolhida;
            await databases.updateDocument(config.databaseId, 'user_financials', docAlvo.$id, { userId: emailMembro, data: JSON.stringify(jsonAlvo) });
          } catch(e) {}
        }

        // 4. Salvar estado de shared_budget
        if (currentUser && currentUser.email) {
          await StorageService.updateCollaboratorAccessMode(currentUser.email, emailMembro, accessMode);
        }
        if (sharedBudget && sharedBudget.budgetId) {
          await StorageService.updateCollaboratorAccessMode(sharedBudget.budgetId, emailMembro, accessMode);
        }

        // 4.5. Criar registro na coleção notificacoes para sincronização em tempo real do membro
        try {
          const notifPayload = {
            userId: emailMembro.toLowerCase().trim(),
            budgetId: StorageService.getEffectiveBudgetId(currentUser),
            mensagem: `Seu nível de acesso foi alterado para: ${permissaoEscolhida}`,
            tipo: 'permissao_alterada',
            createdAt: new Date().toISOString()
          };
          await databases.createDocument(config.databaseId, 'notificacoes', 'unique()', notifPayload, [
            Permission.read(Role.users()),
            Permission.update(Role.users()),
            Permission.delete(Role.users())
          ]);
        } catch (err) {
          console.warn("Could not create document in 'notificacoes':", err);
        }

        // 5. Broadcast final (Para recarregar o Realtime entre abas)
        window.dispatchEvent(new CustomEvent('shared_budgets_updated'));
        window.dispatchEvent(new Event('remote_data_updated'));
        window.dispatchEvent(new Event('financial_data_mutated'));
        if ('BroadcastChannel' in window) {
          try {
            const bc = new BroadcastChannel('darla_data_sync_channel');
            bc.postMessage({ type: 'SHARED_BUDGET_UPDATED', ownerEmail: meuEmail, memberEmail: emailMembro, accessMode });
            bc.close();
          } catch(e) {}
        }

        setFeedback({ type: 'success', msg: `Permissão de ${emailMembro} atualizada para ${permissaoEscolhida} com sucesso!` });
    } catch (error) {
        console.error("Falha na atualização automática:", error);
        setFeedback({ type: 'error', msg: `Erro ao atualizar permissão: ${(error as any).message}` });
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

      // Consulta a coleção notificacoes para verificar alterações recentes de permissão
      (async () => {
        try {
          const config = getAppwriteConfig();
          const listaNotifs = await databases.listDocuments(config.databaseId, 'notificacoes');
          const userEmailLower = user.email.toLowerCase().trim();
          const minhasAlteracoes = listaNotifs.documents.filter((d: any) => 
            String(d.userId || '').toLowerCase().trim() === userEmailLower &&
            d.tipo === 'permissao_alterada'
          );
          if (minhasAlteracoes.length > 0) {
            minhasAlteracoes.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
            const maisRecente = minhasAlteracoes[0];
            const msg = String(maisRecente.mensagem || '').toLowerCase();
            let novaPerm = 'edicao';
            if (msg.includes('leitura') || msg.includes('read')) {
              novaPerm = 'leitura';
            } else if (msg.includes('edicao') || msg.includes('edição') || msg.includes('edit')) {
              novaPerm = 'edicao';
            }
            setPermissoesLocais(prev => ({ ...prev, [userEmailLower]: novaPerm }));
          }
        } catch (err) {
          console.warn("Could not fetch notifications collection for permissions sync:", err);
        }
      })();

      StorageService.syncNotificationsWithServer(user.email, curBudget.code).then((notifs) => {
        setNotifications(notifs);
        setSentNotifications(StorageService.getSentPendingNotifications(user.email));
        const updatedBudgetId = StorageService.getEffectiveBudgetId(user);
        const updatedB = StorageService.getSharedBudget(updatedBudgetId, user);
        setSharedBudget(updatedB);
        setAvailableBudgets(StorageService.getAvailableBudgetsForUser(user));
      });
    }
  }, [isOpen, user?.id]);

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

  const handleRemoveCollaborator = async (email: string) => {
    if (window.confirm(`Tem certeza que deseja EXCLUIR o acesso do membro ${email}?`)) {
      setIsLoading(true);
      try {
        const config = getAppwriteConfig();
        const meuEmail = currentUser.email.toLowerCase().trim();
        const meuDocId = getCanonicalAppwriteDocId(meuEmail);
        const emailAlvo = email.toLowerCase().trim();
        const alvoDocId = getCanonicalAppwriteDocId(emailAlvo);

        const lista = await databases.listDocuments(config.databaseId, 'user_financials');
        const meuDoc = lista.documents.find((d: any) => d.userId === meuEmail || d.email === meuEmail || d.$id === meuDocId);
        const docAlvo = lista.documents.find((d: any) => d.userId === emailAlvo || d.email === emailAlvo || d.$id === alvoDocId);

        if (meuDoc) {
          const json = typeof meuDoc.data === 'string' ? JSON.parse(meuDoc.data || '{}') : (meuDoc.data || {});
          if (Array.isArray(json.allowed_users)) {
            json.allowed_users = json.allowed_users.filter((m: string) => m.toLowerCase() !== emailAlvo);
          }
          if (Array.isArray(json.shared_members)) {
            json.shared_members = json.shared_members.filter((m: string) => m.toLowerCase() !== emailAlvo);
          }
          if (json.member_permissions) {
            delete json.member_permissions[emailAlvo];
          }
          await databases.updateDocument(config.databaseId, 'user_financials', meuDoc.$id, { userId: meuEmail, data: JSON.stringify(json) });
        }

        if (docAlvo) {
          const jsonAlvo = typeof docAlvo.data === 'string' ? JSON.parse(docAlvo.data || '{}') : (docAlvo.data || {});
          if (Array.isArray(jsonAlvo.shared_with_me)) {
            jsonAlvo.shared_with_me = jsonAlvo.shared_with_me.filter((owner: string) => owner.toLowerCase() !== meuEmail);
          }
          if (jsonAlvo.active_budget_owner === meuDocId || jsonAlvo.active_budget_owner === meuEmail || jsonAlvo.active_budget_owner === currentUser.email) {
            jsonAlvo.active_budget_owner = null;
          }
          await databases.updateDocument(config.databaseId, 'user_financials', docAlvo.$id, { userId: emailAlvo, data: JSON.stringify(jsonAlvo) });
        }

        const targetBudgetId = sharedBudget.budgetId || effectiveBudgetId;
        const updated = StorageService.removeCollaborator(targetBudgetId, email);
        if (updated) {
          setSharedBudget(updated);
          setFeedback({ type: 'success', msg: `Acesso do membro ${email} excluído e sincronizado com sucesso no Appwrite.` });
        }
        alert(`Membro ${email} excluído com sucesso!`);
        window.location.reload();
      } catch (err) {
        console.error("Erro ao remover colaborador no Appwrite:", err);
        alert("Erro ao excluir membro no Appwrite.");
      } finally {
        setIsLoading(false);
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
                const accessModeLabel = getAccessModeLabelForTitular(emailTitular, targetBudget);
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
                  <div key={idx} style={{ padding: '15px', border: '1px solid #e0e0e0', borderRadius: '12px', marginBottom: '15px', backgroundColor: '#f9f9f9' }}>
                      <p style={{ margin: 0, fontWeight: 'bold', color: '#333', fontSize: '15px', marginBottom: '10px' }}>{email}</p>
                      
                      {/* BOTÕES DE STATUS E EXCLUSÃO */}
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                          <span style={{ padding: '6px 12px', backgroundColor: '#e8f5e9', color: '#2e7d32', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #4CAF50' }}>✓ Concedido</span>
                          {isOwner && (
                            <button type="button" onClick={() => removerMembro(email)} style={{ padding: '6px 12px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #f44336', cursor: 'pointer' }}>Excluir</button>
                          )}
                      </div>

                      {/* CAIXA DE PERMISSÃO (RADIO BUTTONS E CONFIRMAÇÃO) */}
                      <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '10px', border: '1px solid #eee' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#555' }}>Permissão de Acesso:</span>
                              {loadingPermEmail === email && (
                                <span style={{ fontSize: '11px', color: '#ffb300', fontWeight: 'bold' }}>Salvando automaticamente...</span>
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

                      {/* Gamification Bar */}
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
