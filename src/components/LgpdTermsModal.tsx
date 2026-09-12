import React, { useState } from 'react';
import { X, ShieldCheck, FileText, Lock, CheckCircle2, UserCheck, BarChart3, Database } from 'lucide-react';

interface LgpdTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAcceptAndClose?: () => void;
  initialTab?: 'terms' | 'privacy';
}

export const LgpdTermsModal: React.FC<LgpdTermsModalProps> = ({
  isOpen,
  onClose,
  onAcceptAndClose,
  initialTab = 'privacy',
}) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(initialTab);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      id="lgpd-modal-overlay"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white border border-gray-200 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-in slide-in-from-bottom-6 duration-200"
        id="lgpd-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#00C853]/15 flex items-center justify-center text-[#008736]">
              <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-[#121212] leading-tight">
                Privacidade & Termos de Uso
              </h2>
              <p className="text-[11px] text-gray-500 font-bold">
                Conformidade com a LGPD (Lei nº 13.709/2018) • Versão v1.1
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition cursor-pointer"
            title="Fechar"
            id="lgpd-close-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-3 bg-gray-50 border-b border-gray-200 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`pb-2.5 px-3 text-xs font-black transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'privacy'
                ? 'border-[#00C853] text-[#008736]'
                : 'border-transparent text-gray-500 hover:text-[#121212]'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Política de Privacidade & LGPD</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`pb-2.5 px-3 text-xs font-black transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'terms'
                ? 'border-[#00C853] text-[#008736]'
                : 'border-transparent text-gray-500 hover:text-[#121212]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Termos de Uso</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="px-5 py-4 overflow-y-auto space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
          {activeTab === 'privacy' ? (
            <>
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-1.5 text-emerald-950">
                <div className="flex items-center gap-2 font-black text-xs text-emerald-900">
                  <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Nosso Compromisso com a Transparência</span>
                </div>
                <p className="text-[11px] sm:text-xs text-emerald-900 leading-snug">
                  O <strong>Dinheiro Sem Filtro</strong> preza pela segurança, sigilo e soberania de suas informações financeiras. Coletamos e tratamos apenas os dados estritamente necessários para viabilizar sua gestão orçamentária pessoal.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-black text-[#121212] uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-[#D4AF37]" />
                  1. Dados Coletados e Finalidades
                </h3>
                <ul className="list-disc pl-5 space-y-1.5 text-gray-600 text-xs">
                  <li>
                    <strong>Identificação Básica:</strong> Nome completo, e-mail e senha com hash criptográfico para autenticação e isolamento de sua conta.
                  </li>
                  <li>
                    <strong>Dados Demográficos (Data de Nascimento, Cidade, Estado e Renda):</strong> Utilizados para aferir maioridade legal (18+), categorizar regionalmente referências de custo de vida e calibrar recomendações orçamentárias personalizadas.
                  </li>
                  <li>
                    <strong>Dados Financeiros:</strong> Transações, contas, investimentos e metas inseridos voluntariamente por você para seu próprio controle e visualização analítica.
                  </li>
                  <li>
                    <strong>Estatísticas Anônimas:</strong> Geração de benchmarks agregados e médias orçamentárias estritamente anonimizadas, sem qualquer possibilidade de identificação individual.
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-black text-[#121212] uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-[#00C853]" />
                  2. Tratamento e Não Compartilhamento
                </h3>
                <p className="text-xs text-gray-600">
                  Não comercializamos, alugamos ou repassamos seus dados pessoais a corretoras, bancos ou anunciantes de terceiros. Seus lançamentos financeiros permanecem confidenciais e criptografados.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-black text-[#121212] uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#008736]" />
                  3. Direitos do Titular (Artigo 18 da LGPD)
                </h3>
                <p className="text-xs text-gray-600">
                  A qualquer momento, você pode exercer seus direitos garantidos pela LGPD diretamente no aplicativo:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                    <strong className="text-[#121212] block">Acesso e Retificação:</strong>
                    Consulte ou edite seus dados no menu Perfil.
                  </div>
                  <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                    <strong className="text-[#121212] block">Exclusão Definitiva:</strong>
                    Exclua permanentemente sua conta e todos os dados a qualquer momento.
                  </div>
                  <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                    <strong className="text-[#121212] block">Portabilidade:</strong>
                    Exporte relatórios completos em PDF e planilhas.
                  </div>
                  <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                    <strong className="text-[#121212] block">Revogação do Consentimento:</strong>
                    Encerre o uso e remova seu cadastro de forma facilitada.
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-[11px] text-gray-500 font-medium">
                Dúvidas sobre o tratamento de seus dados pessoais podem ser encaminhadas diretamente ao nosso canal de privacidade em <strong>suporte.dinheirosemfiltro@gmail.com</strong>.
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <h3 className="text-xs font-black text-[#121212] uppercase tracking-wider">
                  1. Objeto e Aceitação
                </h3>
                <p className="text-xs text-gray-600">
                  Ao criar sua conta no <strong>Dinheiro Sem Filtro</strong>, você concorda expressamente com as condições estipuladas nestes Termos de Uso. O aplicativo é uma plataforma de gestão orçamentária pessoal e apoio à tomada de decisão financeira do próprio usuário.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-black text-[#121212] uppercase tracking-wider">
                  2. Idade Mínima
                </h3>
                <p className="text-xs text-gray-600">
                  O cadastro é estritamente restrito a indivíduos civilmente capazes com idade mínima de <strong>18 (dezoito) anos</strong> completos na data do registro.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-black text-[#121212] uppercase tracking-wider">
                  3. Responsabilidade das Informações
                </h3>
                <p className="text-xs text-gray-600">
                  O usuário é o único responsável pela veracidade dos dados cadastrais, sigilo de suas credenciais de acesso e pela exatidão dos lançamentos de despesas, receitas e investimentos informados na ferramenta.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-black text-[#121212] uppercase tracking-wider">
                  4. Natureza Educacional e Orçamentária
                </h3>
                <p className="text-xs text-gray-600">
                  Os comparativos orçamentários, metas e pontuações do app têm caráter informativo e analítico, não constituindo recomendação formal ou consultoria de investimentos regulamentada pela CVM.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-gray-600 hover:text-[#121212] transition cursor-pointer"
          >
            Fechar
          </button>
          {onAcceptAndClose && (
            <button
              type="button"
              onClick={onAcceptAndClose}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer border border-[#00A843]"
              id="lgpd-accept-btn"
            >
              <CheckCircle2 className="w-4 h-4 text-[#121212]" />
              <span>Li e Concordo com os Termos</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
