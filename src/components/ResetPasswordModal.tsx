import React, { useState } from 'react';
import { Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { account } from '../lib/appwrite';
import { DarlaLogo } from './DarlaLogo';

interface ResetPasswordModalProps {
  userId: string;
  secret: string;
  onSuccess: () => void;
  onClose: () => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  userId,
  secret,
  onSuccess,
  onClose,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setIsLoading(true);
    try {
      await account.updateRecovery(userId, secret, newPassword);
      alert('Senha alterada com sucesso! Você já pode entrar com suas novas credenciais.');

      // Limpa os parâmetros da URL sem recarregar a página
      window.history.replaceState({}, document.title, window.location.pathname);
      onSuccess();
    } catch (err: any) {
      console.error('Erro no updateRecovery:', err);
      setError(`Falha ao redefinir senha: ${err.message || 'Link expirado ou inválido.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 overflow-hidden p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-2xl bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/30 shadow-inner">
              <ShieldCheck className="w-7 h-7 text-[#D4AF37]" />
            </div>
          </div>
          <h2 className="text-2xl font-serif font-black text-[#121212]">Cadastrar Nova Senha</h2>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            Defina sua nova credencial de acesso ao Dinheiro Sem Filtro.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSaveNewPassword} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-[#121212]">Nova Senha</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                required
                minLength={8}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-[#121212]">Confirmar Nova Senha</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                required
                minLength={8}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 bg-[#121212] hover:bg-gray-800 disabled:opacity-50 text-[#D4AF37] font-extrabold text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer border border-[#D4AF37]"
          >
            <span>{isLoading ? 'Salvando...' : 'Confirmar e Salvar Nova Senha'}</span>
            <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
          </button>
        </form>
      </div>
    </div>
  );
};
