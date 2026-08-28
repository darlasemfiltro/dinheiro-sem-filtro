import React, { useState, useEffect, useRef } from 'react';
import { X, User as UserIcon, Check, Users, Mail, Key, Shield, UserPlus, CheckCircle2, Send, Copy, LogOut, Camera, Trash2, Upload, Image as ImageIcon, Sliders } from 'lucide-react';
import { User } from '../types';
import { StorageService } from '../services/storage';
import { AvatarCropModal } from './AvatarCropModal';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onSaveName: (newName: string, avatarUrl?: string) => void;
  onOpenSharedBudgetModal?: () => void;
  onUserUpdated?: (updatedUser: User) => void;
  onLogout?: () => void;
  initialTab?: 'profile' | 'request_access' | 'give_access';
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onSaveName,
  onOpenSharedBudgetModal,
  onUserUpdated,
  onLogout,
  initialTab = 'profile',
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'request_access' | 'give_access'>(
    initialTab === 'profile' || initialTab === 'request_access' || initialTab === 'give_access' ? initialTab : 'profile'
  );
  const [name, setName] = useState(user.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Image Cropping / Adjustment Modal State
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [pendingImageSrc, setPendingImageSrc] = useState('');

  // Access Request State (Pedir Acesso)
  const [requestCodeOrEmail, setRequestCodeOrEmail] = useState('');
  const [requestFeedback, setRequestFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Give Access State (Dar Acesso)
  const [giveEmail, setGiveEmail] = useState('');
  const [giveFeedback, setGiveFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = () => {
    if (user?.email) {
      navigator.clipboard.writeText(user.email);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      if (initialTab && initialTab !== ('notifications' as any)) {
        setActiveTab(initialTab as any);
      } else {
        setActiveTab('profile');
      }
      if (user) {
        setName(user.name || '');
        setAvatarUrl(user.avatarUrl || '');
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, user, initialTab]);

  if (!isOpen) return null;

  const effectiveBudgetId = StorageService.getEffectiveBudgetId(user);
  const currentBudgetObj = StorageService.getSharedBudget(effectiveBudgetId, user);
  const isConnectedToOther = effectiveBudgetId !== user.id;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setPendingImageSrc(dataUrl);
        setIsCropModalOpen(true);
        setError('');
      }
    };
    reader.readAsDataURL(file);
    // Clear input so selecting the same file triggers onChange
    e.target.value = '';
  };

  const handleOpenCropExisting = () => {
    if (avatarUrl) {
      setPendingImageSrc(avatarUrl);
      setIsCropModalOpen(true);
    }
  };

  const handleSaveNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor, digite um nome válido.');
      return;
    }
    setError('');
    onSaveName(name.trim(), avatarUrl);
    setSuccessMsg('Informações do perfil atualizadas com sucesso!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Pedir Acesso (Solicitar acesso por E-mail) - FORCED DEBUG REWRITE 2026-08-25
  const handleRequestAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestFeedback(null);
    const emailDigitado = requestCodeOrEmail;
    if (!emailDigitado.trim()) {
      setRequestFeedback({ type: 'error', msg: 'Digite o E-mail do Titular do Orçamento.' });
      return;
    }

    try {
      const emailLimpo = String(emailDigitado).toLowerCase().trim();
      console.log("🔍 DEBUG: Buscando userId exato ->", emailLimpo);

      const res = await StorageService.joinBudgetByCodeOrEmail(user, emailLimpo);
      console.log("📦 DEBUG: Resposta do lookup ->", res);

      if (!res.success) {
        alert(`[DEBUG DE CÓDIGO NOVO] 0 resultados para o userId: "${emailLimpo}". Mensagem: ${res.message}`);
        setRequestFeedback({ type: 'error', msg: res.message });
        return;
      }

      alert(`[DEBUG DE SUCESSO] Conexão/Solicitação realizada com sucesso para: "${emailLimpo}"!`);
      setRequestCodeOrEmail('');
      setRequestFeedback({ type: 'success', msg: res.message });
      if (res.updatedUser && onUserUpdated) {
        onUserUpdated(res.updatedUser);
      }
    } catch (error: any) {
      console.error("❌ DEBUG Erro lookup:", error);
      alert(`[DEBUG DE ERRO] Falha no lookup: ${error.message || error}`);
      setRequestFeedback({ type: 'error', msg: `Erro: ${error.message || error}` });
    }
  };

  // Dar Acesso (Conceder acesso direto a um e-mail)
  const handleGiveAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGiveFeedback(null);
    const emailDigitado = giveEmail;
    if (!emailDigitado.trim()) {
      setGiveFeedback({ type: 'error', msg: 'Digite um e-mail válido para conceder acesso.' });
      return;
    }

    try {
      const emailLimpo = String(emailDigitado).toLowerCase().trim();
      console.log("🔍 DEBUG: Concedendo acesso ao userId exato ->", emailLimpo);

      const res = await StorageService.addCollaboratorByEmail(user, emailLimpo);
      console.log("📦 DEBUG: Resposta de conceder acesso ->", res);

      if (!res.success) {
        alert(`[DEBUG GIVE ACCESS] Falha para o email: "${emailLimpo}". Mensagem: ${res.message}`);
        setGiveFeedback({ type: 'error', msg: res.message });
        return;
      }

      alert(`[DEBUG GIVE ACCESS SUCESSO] Acesso concedido/convite enviado para: "${emailLimpo}"!`);
      setGiveEmail('');
      setGiveFeedback({ type: 'success', msg: res.message });
    } catch (error: any) {
      console.error("❌ DEBUG Erro give access:", error);
      alert(`[DEBUG DE ERRO GIVE ACCESS] ${error.message || error}`);
      setGiveFeedback({ type: 'error', msg: `Erro: ${error.message || error}` });
    }
  };

  const initialLetter = name.trim() ? name.trim().charAt(0).toUpperCase() : (user.name ? user.name.trim().charAt(0).toUpperCase() : 'U');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border-2 border-[#D4AF37] relative my-auto max-h-[90vh] flex flex-col overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-500 hover:text-[#121212] hover:bg-gray-100 rounded-full transition cursor-pointer z-10"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header Profile Banner */}
        <div className="flex items-center gap-3 sm:gap-4 pb-4 border-b border-gray-200 shrink-0">
          <div className="relative rounded-full p-0.5 bg-[#D4AF37] ring-2 ring-[#D4AF37] ring-offset-2 shadow-md shrink-0">
            <div className="w-12 h-12 rounded-full bg-[#D4AF37] text-[#121212] font-black text-xl flex items-center justify-center uppercase shadow-inner">
              {initialLetter}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-extrabold text-[#121212] font-serif truncate">
              {activeTab === 'profile' && 'Informações do Usuário'}
              {activeTab === 'request_access' && 'Pedir Acesso a Outro Orçamento'}
              {activeTab === 'give_access' && 'Acesso ao seu Orçamento (Conectar)'}
            </h2>
            <p className="text-xs text-gray-500 truncate">{user.name} ({user.email})</p>
            <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 rounded-md text-[10px] font-black uppercase tracking-wider">
              <Shield className="w-3 h-3 text-[#D4AF37]" />
              <span>Titular do Perfil</span>
            </div>
          </div>
        </div>

        {/* Scrollable Modal Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 pt-4 min-h-0">
          {/* TAB 1: EDIT PROFILE (Informações do Usuário) */}
          {activeTab === 'profile' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* User Account Info Card */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                <p className="text-xs font-black text-[#121212] uppercase tracking-wider flex items-center gap-1.5">
                  <UserIcon className="w-4 h-4 text-[#D4AF37]" />
                  <span>Informações do Cadastro do Usuário</span>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                    <span className="text-[10px] text-gray-500 font-bold uppercase block">Nome Registrado</span>
                    <span className="font-extrabold text-[#121212]">{user.name || 'Não informado'}</span>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                    <span className="text-[10px] text-gray-500 font-bold uppercase block">E-mail Cadastrado</span>
                    <span className="font-extrabold text-[#121212] truncate block">{user.email}</span>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-gray-200 sm:col-span-2">
                    <span className="text-[10px] text-gray-500 font-bold uppercase block">Status / Identidade do Orçamento</span>
                    <span className="font-extrabold text-[#00C853] flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-[#00C853] shrink-0" />
                      <span className="truncate">
                        {isConnectedToOther
                          ? `Compartilhado (${currentBudgetObj.ownerName})`
                          : currentBudgetObj.collaborators.filter(c => c.role === 'collaborator').length > 0
                          ? `Titular (Orçamento Compartilhado)`
                          : `Titular (Orçamento Pessoal)`}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {successMsg && (
                <div className="p-3 bg-[#00C853]/10 border border-[#00C853]/30 rounded-2xl text-xs font-bold text-[#121212] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#00C853] shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveNameSubmit} className="p-4 bg-amber-50/50 border border-amber-200/80 rounded-2xl space-y-4">
                <p className="text-xs font-extrabold text-[#121212] uppercase tracking-wider flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-[#D4AF37]" />
                  <span>Alterar Foto de Perfil & Nome do Usuário</span>
                </p>

                {/* Profile Photo Upload / Preview Section */}
                <div className="p-3.5 bg-white border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
                  {/* Photo / Initial Avatar Circle */}
                  <div className="relative shrink-0">
                    <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-full bg-[#121212] text-[#D4AF37] font-black text-2xl sm:text-3xl flex items-center justify-center uppercase shadow-lg ring-4 ring-[#D4AF37] overflow-hidden border-2 border-[#D4AF37]">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={name || user.name} className="w-full h-full object-cover" />
                      ) : (
                        (name || user.name || 'U').trim().charAt(0).toUpperCase()
                      )}
                    </div>
                  </div>

                  {/* Upload Controls */}
                  <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#121212]">
                      {avatarUrl ? 'Foto de Perfil Atual' : 'Sem foto de perfil (Exibindo Inicial)'}
                    </p>
                    <p className="text-[11px] text-gray-500 leading-tight">
                      Carregue uma imagem do seu celular ou computador. Se remover a foto, a letra inicial do seu nome será exibida automaticamente no app.
                    </p>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                      <label className="min-h-[48px] py-2.5 px-4 bg-[#D4AF37] hover:bg-[#B89628] text-[#121212] font-black text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer">
                        <Camera className="w-4 h-4 shrink-0" />
                        <span>{avatarUrl ? 'Alterar Foto' : 'Escolher Foto'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload}
                        />
                      </label>

                      {avatarUrl && (
                        <>
                          <button
                            type="button"
                            onClick={handleOpenCropExisting}
                            className="min-h-[48px] py-2.5 px-3.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border border-amber-300"
                            title="Ajustar zoom, enquadramento e rotação da foto"
                          >
                            <Sliders className="w-4 h-4 text-[#D4AF37] shrink-0" />
                            <span>Ajustar Foto</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setAvatarUrl('')}
                            className="min-h-[48px] py-2.5 px-3.5 bg-red-100 hover:bg-red-200 text-red-800 font-bold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                            title="Remover foto de perfil e voltar a exibir a letra inicial"
                          >
                            <Trash2 className="w-4 h-4 text-red-600 shrink-0" />
                            <span>Remover</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Name Edit Input */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    Novo Nome Completo do Titular
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-[#D4AF37] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Digite o nome completo"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37] transition"
                    />
                  </div>
                  {error && <p className="text-xs text-[#FF3D00] font-medium mt-1">{error}</p>}
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="submit"
                    className="py-2.5 px-5 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer border border-[#00A843]"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Salvar Alterações de Perfil</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: PEDIR ACESSO A OUTRO ORÇAMENTO (CONECTAR) */}
          {activeTab === 'request_access' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3.5 bg-[#00C853]/10 border border-[#00C853]/30 rounded-2xl space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#121212]">
                  <Key className="w-4 h-4 text-[#00C853]" />
                  <span>Pedir Acesso a Outro Orçamento (Conectar)</span>
                </div>
                <p className="text-[11px] text-gray-700 leading-snug">
                  Informe somente o <span className="font-bold">E-mail do Titular</span> cadastrado no sistema para solicitar autorização e se conectar ao orçamento dele.
                </p>
              </div>

              {requestFeedback && (
                <div
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
                    requestFeedback.type === 'success'
                      ? 'bg-[#00C853]/10 border-[#00C853]/30 text-[#121212]'
                      : 'bg-[#FF3D00]/10 border-[#FF3D00]/30 text-[#121212]'
                  }`}
                >
                  <CheckCircle2 className={`w-4 h-4 shrink-0 ${requestFeedback.type === 'success' ? 'text-[#00C853]' : 'text-[#FF3D00]'}`} />
                  <span>{requestFeedback.msg}</span>
                </div>
              )}

              <form onSubmit={handleRequestAccessSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-extrabold text-[#121212] mb-1">
                    E-mail do Titular do Orçamento
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#00C853] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={requestCodeOrEmail}
                      onChange={(e) => setRequestCodeOrEmail(e.target.value)}
                      placeholder="titular@exemplo.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#00C853]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="submit"
                    className="py-2.5 px-5 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer border border-[#00A843]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Pedir Acesso ao Orçamento</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: ACESSO AO SEU ORÇAMENTO (CONECTAR) */}
          {activeTab === 'give_access' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3.5 bg-[#D4AF37]/10 border border-[#D4AF37]/40 rounded-2xl space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#121212]">
                  <UserPlus className="w-4 h-4 text-[#D4AF37]" />
                  <span>Acesso ao seu Orçamento (Conectar)</span>
                </div>
                <p className="text-[11px] text-gray-700 leading-snug">
                  Informe somente o <span className="font-bold">E-mail do Convidado</span> (cônjuge, parceiro ou familiar) cadastrado no sistema para conceder e liberar acesso ao seu orçamento.
                </p>
              </div>

              {giveFeedback && (
                <div
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
                    giveFeedback.type === 'success'
                      ? 'bg-[#00C853]/10 border-[#00C853]/30 text-[#121212]'
                      : 'bg-[#FF3D00]/10 border-[#FF3D00]/30 text-[#121212]'
                  }`}
                >
                  <CheckCircle2 className={`w-4 h-4 shrink-0 ${giveFeedback.type === 'success' ? 'text-[#00C853]' : 'text-[#FF3D00]'}`} />
                  <span>{giveFeedback.msg}</span>
                </div>
              )}

              <form onSubmit={handleGiveAccessSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-extrabold text-[#121212] mb-1">
                    E-mail do Convidado
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#D4AF37] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={giveEmail}
                      onChange={(e) => setGiveEmail(e.target.value)}
                      placeholder="convidado@exemplo.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-xs w-full">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="text-[11px] font-bold text-gray-700">Seu E-mail de Titular:</span>
                    <span className="font-semibold text-xs text-[#121212] bg-white px-2 py-0.5 rounded border border-amber-300 truncate select-all">{user.email}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="w-full sm:w-auto px-3 py-1.5 bg-[#D4AF37] hover:bg-[#B89628] text-[#121212] font-black text-[10px] rounded-lg transition flex items-center justify-center gap-1 cursor-pointer shrink-0"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copiado!' : 'Copiar E-mail'}</span>
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="submit"
                    className="py-2.5 px-5 bg-[#121212] hover:bg-gray-800 text-[#D4AF37] font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer border border-[#D4AF37]"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Conceder Acesso ao Seu Orçamento</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {onOpenSharedBudgetModal && initialTab !== 'profile' && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSharedBudgetModal();
                }}
                className="min-h-[48px] py-2.5 px-3.5 bg-gray-100 hover:bg-gray-200 text-[#121212] text-xs sm:text-sm font-extrabold rounded-xl transition flex items-center gap-2 cursor-pointer"
              >
                <Users className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>Painel Completo de Orçamentos</span>
              </button>
            )}

            {onLogout && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="btn-saida min-h-[48px] text-xs sm:text-sm font-extrabold rounded-xl flex items-center gap-2"
                title="Sair da Conta do Aplicativo"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Sair da Conta</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] py-2.5 px-5 bg-[#121212] text-white text-xs sm:text-sm font-extrabold rounded-xl hover:bg-black transition cursor-pointer ml-auto"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Avatar Crop & Adjustment Modal */}
      <AvatarCropModal
        isOpen={isCropModalOpen}
        imageSrc={pendingImageSrc}
        onClose={() => setIsCropModalOpen(false)}
        onCropComplete={(croppedUrl) => {
          setAvatarUrl(croppedUrl);
          setError('');
        }}
      />
    </div>
  );
};
