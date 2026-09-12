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
  Calendar,
  MapPin,
  DollarSign,
  FileText,
  MapPinOff,
} from 'lucide-react';
import {
  BRAZIL_STATES,
  POPULAR_CITIES_BY_UF,
  calculateAge,
  getMaxDateFor18YearsOld,
  formatBirthDateInput,
  brDateToIso,
  isoToBrDate,
  formatCurrencyFromDigits,
  parseCurrencyToNumber,
  sanitizeString,
  INCOME_BRACKETS,
  getValueFromIncomeBracket,
  getIncomeBracketFromValue,
} from '../utils/brazilLocations';
import { SearchableSelect, SearchableSelectOption } from './SearchableSelect';
import { LgpdTermsModal } from './LgpdTermsModal';


const GOOGLE_CLIENT_ID = '516240046749-c9tu4lu53n4o3vuh0mdf389mp1kd2ur5.apps.googleusercontent.com';

interface AuthScreenProps {
  onLoginSuccess: (user: User) => void;
  initialMode?: 'auth' | 'register';
  initialEmail?: string;
  initialName?: string;
  initialNotice?: string;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onLoginSuccess,
  initialMode = 'auth',
  initialEmail = '',
  initialName = '',
  initialNotice = '',
}) => {
  const [mode, setMode] = useState<'auth' | 'forgot'>('auth');
  const [isRegister, setIsRegister] = useState(initialMode === 'register');
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [name, setName] = useState(initialName);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [warningNotice, setWarningNotice] = useState(initialNotice);
  const [isCheckingUser, setIsCheckingUser] = useState(false);

  // Sync props if initial configuration changes (e.g. after Google OAuth return with unregistered email)
  useEffect(() => {
    if (initialMode === 'register') {
      setIsRegister(true);
    }
    if (initialEmail) {
      setEmail(initialEmail);
    }
    if (initialName) {
      setName(initialName);
    }
    if (initialNotice) {
      setWarningNotice(initialNotice);
    }
  }, [initialMode, initialEmail, initialName, initialNotice]);

  // New Demographic & LGPD Compliance States
  const [birthDate, setBirthDate] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [incomeBracket, setIncomeBracket] = useState('');
  const [consentLgpd, setConsentLgpd] = useState(false); // Strictly unchecked by default (active opt-in)
  const [isLgpdModalOpen, setIsLgpdModalOpen] = useState(false);
  const [lgpdModalTab, setLgpdModalTab] = useState<'terms' | 'privacy'>('privacy');

  // Google Login Loading State
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);

  // Password Reset State
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(null);
  const [recoverySecret, setRecoverySecret] = useState<string | null>(null);

  // Real-time Age calculation
  const calculatedAge = birthDate ? calculateAge(birthDate) : 0;
  const isAgeCalculable = birthDate.length === 10 && calculatedAge > 0;
  const isAgeValid = Boolean(birthDate) && birthDate.length === 10 && calculatedAge >= 18;
  const isLocationValid = Boolean(state) && sanitizeString(city).length >= 2;
  const numericMonthlyIncome = getValueFromIncomeBracket(incomeBracket);
  const isIncomeValid = Boolean(incomeBracket.trim());
  const isNameValid = name.trim().length >= 2;
  const isEmailValid = email.trim().includes('@') && email.trim().length >= 5;
  const isPasswordValid = password.length >= 6;

  // State Options for SearchableSelect
  const stateOptions: SearchableSelectOption[] = BRAZIL_STATES.map((s) => ({
    value: s.uf,
    label: `${s.uf} - ${s.name}`,
    sublabel: s.name,
  }));

  // City Options for SearchableSelect filtered by selected State
  const cityOptions: SearchableSelectOption[] = (
    state && POPULAR_CITIES_BY_UF[state] ? POPULAR_CITIES_BY_UF[state] : []
  ).map((c) => ({
    value: c,
    label: c,
    sublabel: state,
  }));

  // Income Bracket Options for SearchableSelect
  const incomeOptions: SearchableSelectOption[] = INCOME_BRACKETS.map((b) => ({
    value: b.label,
    label: b.label,
    sublabel: b.sublabel,
  }));

  // Form validity strictly enforcing LGPD consent and demographic fields
  const isFormValid = isRegister
    ? (consentLgpd && isAgeValid && isLocationValid && isIncomeValid && isNameValid && isEmailValid && isPasswordValid)
    : (email.trim().length > 0 && password.length > 0);

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

    if (isRegister) {
      if (!name || name.trim().length < 2) {
        setError('Por favor, informe seu nome completo.');
        return;
      }
      if (password.length < 6) {
        setError('A senha deve conter no mínimo 6 caracteres.');
        return;
      }
      if (!birthDate) {
        setError('Por favor, informe sua data de nascimento.');
        return;
      }
      if (calculatedAge < 18) {
        setError('É obrigatório ter pelo menos 18 anos completos para criar uma conta.');
        return;
      }
      if (!state) {
        setError('Por favor, selecione seu Estado (UF).');
        return;
      }
      const cleanCity = sanitizeString(city);
      if (!cleanCity || cleanCity.length < 2) {
        setError('Por favor, informe uma cidade válida.');
        return;
      }
      if (!incomeBracket || !incomeBracket.trim()) {
        setError('Por favor, selecione sua faixa de renda mensal.');
        return;
      }
      if (consentLgpd !== true) {
        setError('Você deve ler e aceitar os Termos de Uso e a Política de Privacidade (LGPD) para prosseguir.');
        return;
      }
    }

    setError('');
    setWarningNotice('');
    const cleanEmail = email.trim().toLowerCase();
    setIsCheckingUser(true);

    try {
      const consentDate = new Date().toISOString();
      const resolvedIncome = numericMonthlyIncome > 0 ? numericMonthlyIncome : (incomeBracket ? getValueFromIncomeBracket(incomeBracket) || 4000 : 4000);
      const extraProfile: Partial<User> = isRegister
        ? {
            birthDate,
            city: sanitizeString(city),
            state: state.toUpperCase(),
            monthlyIncome: resolvedIncome,
            incomeBracket: incomeBracket.trim(),
            consent_lgpd: true,
            consent_date: consentDate,
            consent_version: 'v1.1',
            user_agent: navigator.userAgent,
          }
        : {};

      if (isRegister) {
        // 1. Chamar endpoint de registro do backend com validações e persistência central
        try {
          const regRes = await fetch('/api/users/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: cleanEmail,
              password,
              name: name.trim(),
              birthDate,
              city: sanitizeString(city),
              state: state.toUpperCase(),
              monthlyIncome: resolvedIncome,
              incomeBracket: incomeBracket.trim(),
              consent_lgpd: true,
              consent_date: consentDate,
              consent_version: 'v1.1',
            }),
          });

          // Bloqueia APENAS se o servidor retornou explicitamente erro de validação de dados (400 ou 422) com mensagem
          if (regRes.status === 400 || regRes.status === 422) {
            const regData = await regRes.json().catch(() => null);
            if (regData && regData.message && regData.success === false) {
              setError(regData.message);
              setIsCheckingUser(false);
              return;
            }
          }
        } catch (backendErr) {
          console.warn('[Register] Servidor indisponível ou ambiente estático, prosseguindo com cadastro local/nuvem:', backendErr);
        }

        // 2. Registrar também no Appwrite se disponível
        await appwriteSignUp(cleanEmail, password, name).catch(() => {});
      } else {
        // Login flow: Verificar previamente se o e-mail informado já possui cadastro
        const regCheck = await StorageService.isUserRegisteredAsync(cleanEmail);
        if (!regCheck.exists || !regCheck.user) {
          // Usuário não cadastrado! Direcionar imediatamente para a aba de Criar Conta
          setIsCheckingUser(false);
          setIsRegister(true);
          setWarningNotice(`O e-mail "${cleanEmail}" ainda não possui cadastro no sistema. Preencha seus dados abaixo para criar sua conta gratuita e começar!`);
          setError('');
          return;
        }

        // Se cadastrado, verificar se a senha confere (caso possua senha registrada)
        if (regCheck.user.password && regCheck.user.password !== password) {
          setIsCheckingUser(false);
          setError('Senha incorreta. Verifique sua senha ou clique em "Esqueceu a senha?".');
          return;
        }

        try {
          await appwriteSignIn(cleanEmail, password).catch(() => {});
        } catch (e) {}
      }

      // 3. Ensure Local & Cloud User Sync
      const user = await StorageService.ensureUserAndDataSyncedAsync(
        cleanEmail,
        password,
        isRegister ? name : undefined,
        undefined,
        'email',
        isRegister ? extraProfile : undefined
      );

      localStorage.removeItem('darla_explicit_logout');
      onLoginSuccess(user);
    } catch (err: any) {
      console.error('[AuthSubmit Error]', err);
      setError('Erro ao processar conta. Verifique suas credenciais e tente novamente.');
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

  // Step 1: Send Password Reset Link via Appwrite account.createRecovery
  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!resetEmail || !resetEmail.includes('@')) {
      setError('Por favor, informe um e-mail válido.');
      return;
    }

    const cleanReset = resetEmail.trim().toLowerCase();
    setIsSendingEmail(true);

    try {
      // Verificar se o e-mail está cadastrado
      const regCheck = await StorageService.isUserRegisteredAsync(cleanReset);
      if (!regCheck.exists || !regCheck.user) {
        setIsSendingEmail(false);
        setMode('auth');
        setIsRegister(true);
        setEmail(cleanReset);
        setWarningNotice(`O e-mail "${cleanReset}" não foi encontrado em nosso sistema. Preencha seus dados abaixo para criar sua conta gratuita!`);
        return;
      }

      const redirectUrl = window.location.origin;
      await appwritePasswordReset(cleanReset);
      setSuccessMsg('Link de recuperação enviado com sucesso! Verifique a Caixa de Entrada e o Spam.');
      setTimeout(() => {
        setMode('auth');
        setResetStep(1);
        setResetEmail('');
        setSuccessMsg('');
      }, 3000);
    } catch (err: any) {
      console.error('Erro detalhado createRecovery:', err);
      const errorMsg = `Falha no envio do e-mail: [${err.code || 'ERRO'}] ${err.message || err.type || 'Falha de comunicação com o Appwrite'}`;
      setError(errorMsg);
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Step 2: Set New Password via Appwrite account.updateRecovery
  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!newPassword || newPassword.length < 8) {
      setError('A nova senha deve possuir pelo menos 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem. Tente novamente.');
      return;
    }

    if (!recoveryUserId || !recoverySecret) {
      setError('Parâmetros de recuperação inválidos ou expirados.');
      return;
    }

    try {
      await appwriteCompleteRecovery(recoveryUserId, recoverySecret, newPassword, confirmPassword);
      setSuccessMsg('Senha alterada com sucesso! Você já pode entrar com sua nova senha.');
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => {
        setRecoveryUserId(null);
        setRecoverySecret(null);
        setMode('auth');
        setResetStep(1);
        setNewPassword('');
        setConfirmPassword('');
        setSuccessMsg('');
      }, 3000);
    } catch (err: any) {
      console.error('Erro ao redefinir senha:', err);
      setError('Erro ao redefinir senha: ' + (err.message || 'Token expirado ou inválido.'));
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
                    className="w-full pl-10 pr-4 min-h-[48px] py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-[#121212] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:bg-white transition"
                    required
                  />
                </div>
                {isRegister && (
                  <p className="text-[10px] text-gray-500 font-medium">Mínimo de 6 caracteres.</p>
                )}
              </div>

              {/* EXPANDED SIGN UP FIELDS (LGPD & DEMOGRAPHICS) */}
              {isRegister && (
                <>
                  {/* 1. Data de Nascimento (Digitada com máscara DD/MM/AAAA e validação de 18+) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs sm:text-sm font-bold text-[#121212]">
                        Data de Nascimento <span className="text-[#D4AF37]">*</span>
                      </label>
                      {birthDate && isAgeCalculable && (
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                            isAgeValid
                              ? 'bg-emerald-100 text-[#008736] border border-emerald-300'
                              : 'bg-red-100 text-red-700 border border-red-300'
                          }`}
                        >
                          {isAgeValid ? `${calculatedAge} anos (18+)` : `${calculatedAge} anos (Menor de 18)`}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-[#D4AF37] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="DD/MM/AAAA"
                        value={birthDate}
                        onChange={(e) => setBirthDate(formatBirthDateInput(e.target.value))}
                        maxLength={10}
                        className={`w-full min-h-[48px] pl-10 pr-4 py-3 bg-gray-50 border rounded-xl text-xs sm:text-sm text-[#121212] focus:outline-none focus:ring-2 focus:bg-white transition tracking-wider ${
                          birthDate.length === 10 && !isAgeValid
                            ? 'border-red-400 focus:ring-red-400 bg-red-50/40'
                            : 'border-gray-200 focus:ring-[#D4AF37]'
                        }`}
                        required
                        id="signup-birthdate"
                      />
                    </div>
                    {birthDate.length === 10 && !isAgeValid ? (
                      <p className="text-[11px] font-bold text-red-600 flex items-center gap-1.5 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {calculatedAge < 18
                            ? 'É obrigatório ter no mínimo 18 anos completos para criar uma conta.'
                            : 'Por favor, informe uma data válida no formato DD/MM/AAAA.'}
                        </span>
                      </p>
                    ) : (
                      <p className="text-[10px] text-gray-500 font-medium">
                        Digite sua data de nascimento (ex: 15/05/1990). Mínimo de 18 anos (LGPD).
                      </p>
                    )}
                  </div>

                  {/* 2. Cidade e Estado (UF) com Seleção e Pesquisa Integrada no Padrão do App */}
                  <div className="space-y-1">
                    <label className="text-xs sm:text-sm font-bold text-[#121212]">
                      Localização (Estado e Cidade) <span className="text-[#D4AF37]">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Estado (UF) - Dropdown com Pesquisa no Padrão do App */}
                      <div>
                        <SearchableSelect
                          options={stateOptions}
                          value={state}
                          onChange={(newUf) => {
                            setState(newUf);
                            setCity('');
                          }}
                          placeholder="Selecione o Estado (UF)"
                          searchPlaceholder="Pesquisar estado..."
                          emptyText="Nenhum estado encontrado"
                          id="signup-state"
                        />
                      </div>

                      {/* Cidade - Dropdown com Pesquisa filtrada por Estado no Padrão do App */}
                      <div>
                        <SearchableSelect
                          options={cityOptions}
                          value={city}
                          onChange={(newCity) => setCity(newCity)}
                          placeholder={state ? 'Selecione a Cidade' : 'Primeiro selecione o Estado'}
                          searchPlaceholder="Pesquisar cidade..."
                          emptyText={state ? 'Nenhuma cidade encontrada' : 'Escolha um estado primeiro'}
                          disabled={!state}
                          allowCustomInput={Boolean(state)}
                          icon={<MapPin className="w-4 h-4 text-[#D4AF37]" />}
                          id="signup-city"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium">
                      Pesquise ou selecione seu estado e cidade para calibração de dados regionais anônimos.
                    </p>
                  </div>

                  {/* 3. Faixa de Renda Mensal (Seleção no Padrão do App com Pesquisa) */}
                  <div className="space-y-1">
                    <label className="text-xs sm:text-sm font-bold text-[#121212]">
                      Faixa de Renda Mensal <span className="text-[#D4AF37]">*</span>
                    </label>
                    <div>
                      <SearchableSelect
                        options={incomeOptions}
                        value={incomeBracket}
                        onChange={(val) => setIncomeBracket(val)}
                        placeholder="Selecione sua Faixa de Renda"
                        searchPlaceholder="Pesquisar faixa de renda..."
                        emptyText="Nenhuma faixa de renda encontrada"
                        icon={<DollarSign className="w-4 h-4 text-[#D4AF37]" />}
                        id="signup-income-bracket"
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium">
                      Informação confidencial protegida pela LGPD para calibração personalizada de metas orçamentárias.
                    </p>
                  </div>

                  {/* 4. COMPONENTE DE CONSENTIMENTO LGPD (OBRIGATÓRIO) */}
                  <div
                    className={`p-3.5 rounded-2xl border transition-all ${
                      consentLgpd
                        ? 'bg-emerald-50/80 border-emerald-300'
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}
                    id="lgpd-consent-container"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="lgpd-consent-checkbox"
                        checked={consentLgpd}
                        onChange={(e) => setConsentLgpd(e.target.checked)}
                        className="w-5 h-5 min-w-[20px] min-h-[20px] mt-0.5 rounded border-gray-300 text-[#00C853] focus:ring-[#00C853] cursor-pointer accent-[#00C853]"
                      />
                      <label
                        htmlFor="lgpd-consent-checkbox"
                        className="text-[11px] sm:text-xs text-gray-700 leading-relaxed cursor-pointer select-none"
                      >
                        Li e aceito os{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setLgpdModalTab('terms');
                            setIsLgpdModalOpen(true);
                          }}
                          className="font-black text-[#008736] hover:text-[#005c24] underline underline-offset-2 cursor-pointer inline"
                          id="lgpd-terms-link"
                        >
                          Termos de Uso
                        </button>{' '}
                        e a{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setLgpdModalTab('privacy');
                            setIsLgpdModalOpen(true);
                          }}
                          className="font-black text-[#008736] hover:text-[#005c24] underline underline-offset-2 cursor-pointer inline"
                          id="lgpd-privacy-link"
                        >
                          Política de Privacidade
                        </button>
                        . Autorizo o tratamento de meus dados demográficos e financeiros para personalização do app e geração de estatísticas orçamentárias anônimas, nos termos da LGPD.
                      </label>
                    </div>
                  </div>
                </>
              )}

              {/* Botão de Submissão */}
              <div className="space-y-2 pt-1">
                <button
                  type="submit"
                  disabled={!isFormValid || isCheckingUser}
                  className={`w-full py-3.5 sm:py-4 px-4 min-h-[48px] rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 group ${
                    !isFormValid || isCheckingUser
                      ? 'bg-gray-200 text-gray-400 border border-gray-300 opacity-50 cursor-not-allowed shadow-none'
                      : 'bg-[#00C853] hover:bg-[#00E676] text-[#121212] shadow-md hover:shadow-lg border border-[#00A843] cursor-pointer'
                  }`}
                  id="auth-submit-btn"
                >
                  {isCheckingUser ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-current" />
                      <span>Processando cadastro...</span>
                    </>
                  ) : (
                    <>
                      <span>{isRegister ? 'Criar Conta' : 'Acessar meu Financeiro'}</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition stroke-[3]" />
                    </>
                  )}
                </button>

                {isRegister && !isFormValid && (
                  <p className="text-[11px] text-center text-gray-500 font-medium">
                    {!consentLgpd
                      ? 'Marque o aceite da LGPD acima para habilitar o botão Criar Conta.'
                      : !isAgeValid
                      ? 'A idade mínima obrigatória é de 18 anos.'
                      : !isLocationValid
                      ? 'Preencha Estado e Cidade para continuar.'
                      : !isIncomeValid
                      ? 'Informe a renda mensal para calibração de metas.'
                      : 'Preencha todos os campos obrigatórios para ativar o cadastro.'}
                  </p>
                )}
              </div>


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
                  ? 'Digite o seu e-mail cadastrado. Enviaremos um link de recuperação oficial do Appwrite para o seu e-mail.'
                  : 'Digite sua nova senha (mínimo de 8 caracteres).'}
              </p>
            </div>

            {/* Step 1: Send Email Link */}
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
                  <span>{isSendingEmail ? 'Enviando link...' : 'Enviar Link de Recuperação'}</span>
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

            {/* Step 2: New Password */}
            {resetStep === 2 && (
              <form onSubmit={handleConfirmReset} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-[#121212]">Nova Senha</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#D4AF37] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
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

      {/* LGPD Terms & Privacy Policy Modal */}
      <LgpdTermsModal
        isOpen={isLgpdModalOpen}
        initialTab={lgpdModalTab}
        onClose={() => setIsLgpdModalOpen(false)}
        onAcceptAndClose={() => {
          setConsentLgpd(true);
          setIsLgpdModalOpen(false);
        }}
      />
    </div>
  );
};
