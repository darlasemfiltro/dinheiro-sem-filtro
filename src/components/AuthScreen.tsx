import React, { useState, useEffect } from 'react';
import { DarlaLogo } from './DarlaLogo';
import { StorageService } from '../services/storage';
import { appwriteSignUp, appwriteSignIn, appwriteGoogleOAuthLogin, appwritePasswordReset, appwriteCompleteRecovery } from '../lib/appwrite';
import { User } from '../types';
import {
  Lock,
  Mail,
  User as UserIcon,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  ArrowLeft,
  X,
  Sparkles,
  Loader2,
  Check,
  AlertCircle,
  UserPlus,
} from 'lucide-react';


const GOOGLE_CLIENT_ID = '516240046749-c9tu4lu53n4o3vuh0mdf389mp1kd2ur5.apps.googleusercontent.com';

interface AuthScreenProps {
  onLoginSuccess: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'auth' | 'forgot'>('auth');
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [warningNotice, setWarningNotice] = useState('');
  const [isCheckingUser, setIsCheckingUser] = useState(false);

  // Google Login Loading State
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);

  // Password Reset State
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [resetEmail, setResetEmail] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(null);
  const [recoverySecret, setRecoverySecret] = useState<string | null>(null);

  // Intercept Appwrite Native Recovery URL params on load: ?userId=...&secret=...
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const uId = urlParams.get('userId');
    const sec = urlParams.get('secret');
    if (uId && sec) {
      setRecoveryUserId(uId);
      setRecoverySecret(sec);
      setMode('forgot');
      setResetStep(2);
      setSuccessMsg('Link de recuperação do Appwrite verificado! Defina sua nova senha abaixo.');
    }
  }, []);

  // Submit standard auth
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Por favor, informe seu e-mail.');
      return;
    }
    if (!password) {
      setError('Por favor, informe sua senha.');
      return;
    }
    if (isRegister && !name) {
      setError('Por favor, informe seu nome completo.');
      return;
    }

    setError('');
    setWarningNotice('');
    const cleanEmail = email.trim().toLowerCase();
    setIsCheckingUser(true);

    try {
      try {
        if (!isRegister) {
          await appwriteSignIn(cleanEmail, password).catch(async () => {
            await appwriteSignUp(cleanEmail, password, name || cleanEmail.split('@')[0]).catch(() => {});
          });
        } else {
          await appwriteSignUp(cleanEmail, password, name).catch(() => {});
        }
      } catch (e) {}

      const user = await StorageService.ensureUserAndDataSyncedAsync(
        cleanEmail,
        password,
        isRegister ? name : undefined,
        undefined,
        'email'
      );
      localStorage.removeItem('darla_explicit_logout');
      onLoginSuccess(user);
    } catch (err: any) {
      console.error('[AuthSubmit Error]', err);
      setError('Erro ao acessar a conta. Verifique suas credenciais e tente novamente.');
    } finally {
      setIsCheckingUser(false);
    }
  };

  // Google Login Handler: Appwrite Google OAuth2
  const handleGoogleLogin = async () => {
    setError('');
    setIsLoadingGoogle(true);
    try {
      localStorage.setItem('darla_oauth_pending', 'true');
      await appwriteGoogleOAuthLogin();
    } catch (err: any) {
      console.error('[Google Login Error]', err);
      setIsLoadingGoogle(false);
      setError('Não foi possível realizar o login com o Google. Tente entrar com e-mail e senha.');
    }
  };

  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Step 1: Send Password Reset Code by Email (Appwrite Cloud + Fallback)
  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!resetEmail || !resetEmail.includes('@')) {
      setError('Por favor, digite um e-mail cadastrado válido (ex: seu.nome@gmail.com, hotmail.com, etc).');
      return;
    }

    setIsSendingEmail(true);
    try {
      // 1. Call Appwrite Cloud native createRecovery
      try {
        await appwritePasswordReset(resetEmail);
        console.log('[Appwrite Cloud] createRecovery disparado com sucesso para:', resetEmail);
      } catch (appwriteErr: any) {
        console.warn('[Appwrite createRecovery Warning - Verifique se o e-mail existe no Appwrite e se a plataforma Web está cadastrada]:', appwriteErr?.message || appwriteErr);
      }

      // 2. Call local storage / backend fallback
      const res = await StorageService.sendPasswordResetCodeAsync(resetEmail);
      if (res.success) {
        setGeneratedCode(res.code || '');
        setInputCode('');
        setSuccessMsg(res.message || 'E-mail de recuperação enviado! Verifique sua Caixa de Entrada e a pasta de Spam/Lixo Eletrônico.');
        setResetStep(2);
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError('Não foi possível enviar o e-mail no momento. Verifique sua conexão.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Step 2: Set New Password
  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!newPassword || newPassword.length < 6) {
      setError('A nova senha deve possuir pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem. Tente novamente.');
      return;
    }

    // If Appwrite recovery query params exist, complete recovery via Appwrite SDK
    if (recoveryUserId && recoverySecret) {
      try {
        await appwriteCompleteRecovery(recoveryUserId, recoverySecret, newPassword);
        setSuccessMsg('Senha redefinida com sucesso pelo Appwrite! Faça login com suas novas credenciais.');
        setMode('auth');
        setResetStep(1);
        setRecoveryUserId(null);
        setRecoverySecret(null);
        return;
      } catch (err: any) {
        setError(`Erro ao redefinir senha no Appwrite: ${err.message || 'Token expirado ou inválido.'}`);
        return;
      }
    }

    // Otherwise standard code-based verification
    if (!inputCode.trim()) {
      setError('Digite o código de 6 dígitos enviado ao seu e-mail.');
      return;
    }

    if (inputCode.trim() !== generatedCode.trim()) {
      setError('Código incorreto. Verifique o e-mail ou reenvie o código.');
      return;
    }

    const res = StorageService.updateUserPassword(resetEmail, newPassword);
    if (res.success) {
      setEmail(resetEmail);
      setPassword(newPassword);
      setSuccessMsg(res.message);
      setMode('auth');
      setIsRegister(false);
      setResetStep(1);
      setResetEmail('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setError(res.message);
    }
  };

  return (
    <div
      className="min-h-screen min-h-[100dvh] w-full bg-[#FAFAFA] flex flex-col items-center justify-center p-3 xs:p-4 sm:p-6 md:p-8 relative overflow-y-auto py-6 sm:py-12"
      id="auth-screen-container"
    >
      {/* Background Effects */}
      <div className="absolute top-0 -left-16 w-64 h-64 sm:w-96 sm:h-96 rounded-full bg-[#D4AF37]/15 blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-10 -right-16 w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-[#00C853]/15 blur-3xl pointer-events-none"></div>

      {/* Main Card */}
      <div
        className="w-full max-w-[340px] xs:max-w-sm sm:max-w-md bg-white border-2 border-[#D4AF37]/40 rounded-2xl sm:rounded-3xl shadow-xl p-4 xs:p-6 sm:p-8 relative z-10 space-y-4 sm:space-y-6 my-auto"
        id="auth-card"
      >
        {/* Logo Header */}
        <div className="text-center py-1 sm:py-2 flex flex-col items-center max-w-full overflow-hidden" id="auth-logo-header">
          <DarlaLogo size="xl" centered showSubtext className="max-w-full" />
        </div>

        {/* Global Feedback Banners */}
        {warningNotice && (
          <div className="p-3.5 bg-amber-50 border-2 border-[#D4AF37] text-amber-950 text-xs rounded-2xl shadow-sm space-y-1 animate-in fade-in">
            <div className="flex items-center gap-1.5 font-black text-xs sm:text-sm text-[#121212]">
              <AlertCircle className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <span>Aviso: Usuário Não Cadastrado</span>
            </div>
            <p className="text-[11px] sm:text-xs text-amber-900 leading-relaxed font-semibold">
              {warningNotice}
            </p>
            <div className="pt-1 flex items-center gap-1 text-[10px] sm:text-[11px] text-[#008736] font-extrabold">
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span>Preencha seus dados abaixo para se cadastrar gratuitamente.</span>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-[#FF3D00]/10 border border-[#FF3D00]/40 text-[#FF3D00] text-xs rounded-xl text-center font-bold animate-in fade-in">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-[#00C853]/10 border border-[#00C853]/40 text-[#00A843] text-xs rounded-xl text-center font-extrabold flex items-center justify-center gap-1.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-[#00C853] shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* MODE 1: STANDARD LOGIN / REGISTER */}
        {mode === 'auth' && (
          <div className="space-y-4">
            {/* Google Login Button */}
            <div className="flex justify-center w-full bg-white rounded-xl overflow-hidden min-h-[44px]">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoadingGoogle}
                className="w-full py-3 px-4 border-2 border-gray-200 hover:border-gray-300 rounded-xl flex items-center justify-center gap-3 bg-white transition-all shadow-sm cursor-pointer disabled:opacity-60"
              >
                {isLoadingGoogle ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-[#4285F4]" />
                    <span className="text-sm font-bold text-gray-700">Conectando ao Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span className="text-sm font-bold text-gray-700">Continuar com o Google</span>
                  </>
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-1">
              <div className="border-t border-gray-200 w-full"></div>
              <span className="bg-white px-3 text-[10px] sm:text-xs text-gray-500 font-black uppercase tracking-wider shrink-0">
                ou com e-mail
              </span>
              <div className="border-t border-gray-200 w-full"></div>
            </div>

            {/* Tab Toggle */}
            <div className="grid grid-cols-2 bg-gray-100 p-1.5 rounded-2xl gap-1.5 border border-gray-200" id="auth-tabs">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setError('');
                  setWarningNotice('');
                }}
                className={`flex-1 py-2.5 px-2 text-[11px] sm:text-xs font-black rounded-xl transition-all cursor-pointer min-h-[44px] flex items-center justify-center text-center leading-tight ${
                  !isRegister ? 'bg-[#121212] text-[#D4AF37] shadow-sm' : 'text-gray-600 hover:text-[#121212]'
                }`}
                id="auth-tab-login"
              >
                Entrar na Conta
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setError('');
                  setWarningNotice('');
                }}
                className={`flex-1 py-2.5 px-2 text-[11px] sm:text-xs font-black rounded-xl transition-all cursor-pointer min-h-[44px] flex items-center justify-center text-center leading-tight ${
                  isRegister ? 'bg-[#121212] text-[#D4AF37] shadow-sm' : 'text-gray-600 hover:text-[#121212]'
                }`}
                id="auth-tab-register"
              >
                Criar Nova Conta
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4" id="auth-form">
              {isRegister && (
                <div className="space-y-1">
                  <label className="text-xs sm:text-sm font-bold text-[#121212]">Nome Completo</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-[#D4AF37] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome completo"
                      className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-[#121212] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:bg-white transition"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs sm:text-sm font-bold text-[#121212]">E-mail de Acesso</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#D4AF37] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-[#121212] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:bg-white transition"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-bold text-[#121212]">Senha</label>
                  {!isRegister && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setResetStep(1);
                        setResetEmail(email);
                        setError('');
                        setSuccessMsg('');
                        setWarningNotice('');
                      }}
                      className="text-[11px] font-extrabold text-[#D4AF37] hover:underline cursor-pointer flex items-center gap-1"
                      id="forgot-password-link"
                    >
                      <KeyRound className="w-3 h-3 text-[#D4AF37]" />
                      <span>Esqueceu a senha?</span>
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#D4AF37] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-[#121212] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:bg-white transition"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isCheckingUser}
                className="w-full py-3 sm:py-3.5 px-4 bg-[#00C853] hover:bg-[#00E676] disabled:opacity-60 text-[#121212] font-black text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 group cursor-pointer min-h-[44px] border border-[#00A843]"
                id="auth-submit-btn"
              >
                {isCheckingUser ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#121212]" />
                    <span>Verificando cadastro...</span>
                  </>
                ) : (
                  <>
                    <span>{isRegister ? 'Criar minha conta' : 'Acessar meu Financeiro'}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition stroke-[3]" />
                  </>
                )}
              </button>


            </form>
          </div>
        )}

        {/* MODE 2: FORGOT / RESET PASSWORD */}
        {mode === 'forgot' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-3 bg-[#D4AF37]/10 border border-[#D4AF37]/40 rounded-2xl space-y-1">
              <div className="flex items-center gap-2 text-xs font-black text-[#121212]">
                <KeyRound className="w-4 h-4 text-[#D4AF37]" />
                <span>Redefinição de Senha</span>
              </div>
              <p className="text-[11px] text-gray-700 leading-snug">
                {resetStep === 1
                  ? 'Digite o seu e-mail cadastrado. Enviaremos um código de verificação para o seu e-mail.'
                  : 'Digite o código de 6 dígitos enviado para o seu e-mail e escolha sua nova senha.'}
              </p>
            </div>

            {/* Step 1: Send Email Code */}
            {resetStep === 1 && (
              <form onSubmit={handleSendResetCode} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-[#121212]">E-mail Cadastrado</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#D4AF37] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="seu.email@exemplo.com"
                      className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSendingEmail}
                  className="w-full py-3 px-4 bg-[#121212] hover:bg-gray-800 disabled:opacity-50 text-[#D4AF37] font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer border border-[#D4AF37]"
                >
                  <Mail className="w-4 h-4 text-[#D4AF37]" />
                  <span>{isSendingEmail ? 'Enviando e-mail...' : 'Enviar Código para o E-mail'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('auth');
                    setError('');
                    setSuccessMsg('');
                  }}
                  className="w-full py-2 px-4 text-xs font-bold text-gray-600 hover:text-[#121212] transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar para Entrar</span>
                </button>
              </form>
            )}

            {/* Step 2: Input Code & New Password */}
            {resetStep === 2 && (
              <form onSubmit={handleConfirmReset} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-[#121212]">Código de Verificação (6 Dígitos)</label>
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    placeholder="Ex: 839201"
                    maxLength={6}
                    className="w-full text-center tracking-widest font-mono font-black text-sm py-2.5 bg-amber-50 border border-[#D4AF37]/50 rounded-xl text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    required
                  />
                  <p className="text-[10px] text-gray-500 text-center">Digite os 6 dígitos recebidos no seu e-mail</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-[#121212]">Nova Senha</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#D4AF37] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-[#121212]">Confirmar Nova Senha</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#D4AF37] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer border border-[#00A843]"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#121212]" />
                  <span>Redefinir Senha e Entrar</span>
                </button>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setResetStep(1)}
                    className="text-gray-500 hover:text-black font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Alterar E-mail</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('auth');
                      setError('');
                      setSuccessMsg('');
                    }}
                    className="text-[#D4AF37] font-extrabold hover:underline cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Footer Security Badge */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-xs text-gray-600 pt-1 text-center">
          <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#00C853] shrink-0" />
          <span>Dados seguros e isolados por usuário.</span>
        </div>
      </div>

    </div>
  );
};
