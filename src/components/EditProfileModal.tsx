import React, { useState, useEffect, useRef } from 'react';
import { X, User as UserIcon, Check, Shield, CheckCircle2, LogOut, Camera, Trash2, Sliders } from 'lucide-react';
import { User } from '../types';
import { StorageService } from '../services/storage';
import { AvatarCropModal } from './AvatarCropModal';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onSaveName: (newName: string, avatarUrl?: string) => void;
  onUserUpdated?: (updatedUser: User) => void;
  onLogout?: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onSaveName,
  onUserUpdated,
  onLogout,
}) => {
  const [name, setName] = useState(user.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Image Cropping / Adjustment Modal State
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [pendingImageSrc, setPendingImageSrc] = useState('');

  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      if (user) {
        setName(user.name || '');
        setAvatarUrl(user.avatarUrl || '');
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, user?.id]);

  if (!isOpen) return null;

  const initialLetter = (name || user.name || 'U').trim().charAt(0).toUpperCase();

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
    e.target.value = '';
  };

  const handleOpenCropExisting = () => {
    if (avatarUrl) {
      setPendingImageSrc(avatarUrl);
      setIsCropModalOpen(true);
    }
  };

  const handleSaveNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('O nome não pode estar vazio.');
      return;
    }

    try {
      setError('');
      onSaveName(name.trim(), avatarUrl);
      const updatedUser = StorageService.updateUserProfile(user.email, name.trim(), avatarUrl);
      if (updatedUser && onUserUpdated) {
        onUserUpdated(updatedUser);
      }
      setSuccessMsg('Informações do usuário atualizadas com sucesso!');
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar alterações.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh] p-5 sm:p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header Profile Banner */}
        <div className="flex items-center gap-3 sm:gap-4 pb-4 border-b border-gray-200 shrink-0 pr-8">
          <div className="relative rounded-full p-0.5 bg-[#D4AF37] ring-2 ring-[#D4AF37] ring-offset-2 shadow-md shrink-0">
            <div className="w-12 h-12 rounded-full bg-[#D4AF37] text-[#121212] font-black text-xl flex items-center justify-center uppercase shadow-inner overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={name || user.name} className="w-full h-full object-cover" />
              ) : (
                initialLetter
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm sm:text-lg font-extrabold text-[#121212] font-serif truncate">
              Informações do Usuário
            </h2>
            <p className="text-[11px] sm:text-xs text-gray-500 truncate max-w-[200px] sm:max-w-xs">{user.name} ({user.email})</p>
            <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 rounded-md text-[10px] font-black uppercase tracking-wider">
              <Shield className="w-3 h-3 text-[#D4AF37]" />
              <span>Acesso ao Aplicativo</span>
            </div>
          </div>
        </div>

        {/* Scrollable Modal Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 pt-4 min-h-0">
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* User Account Info Card */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
              <p className="text-xs font-black text-[#121212] uppercase tracking-wider flex items-center gap-1.5">
                <UserIcon className="w-4 h-4 text-[#D4AF37]" />
                <span>Dados da Conta</span>
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
                <div className="relative shrink-0">
                  <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-full bg-[#121212] text-[#D4AF37] font-black text-2xl sm:text-3xl flex items-center justify-center uppercase shadow-lg ring-4 ring-[#D4AF37] overflow-hidden border-2 border-[#D4AF37]">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={name || user.name} className="w-full h-full object-cover" />
                    ) : (
                      initialLetter
                    )}
                  </div>
                </div>

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
                          title="Remover foto de perfil"
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
                  Nome Completo
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
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {onLogout && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 hover:border-red-400 min-h-[48px] text-xs sm:text-sm font-extrabold rounded-xl transition flex items-center gap-2 cursor-pointer"
                title="Sair da Conta"
              >
                <LogOut className="w-4 h-4 text-red-600 shrink-0" />
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
