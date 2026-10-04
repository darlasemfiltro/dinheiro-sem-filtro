import { ID, Permission, Role } from 'appwrite';

export const cleanAndFormatRegistrationPayload = (formData: any, userEmail: string) => {
  const email = userEmail.trim().toLowerCase();

  // 1. Extração estrita de 2 letras para o Estado (UF)
  let uf = 'DF';
  const rawState = String(formData.estado || formData.state || '').trim();
  if (rawState.includes('-')) {
    uf = rawState.split('-')[0].trim().toUpperCase().slice(0, 2);
  } else if (rawState.length >= 2) {
    uf = rawState.slice(0, 2).toUpperCase();
  }

  // 2. Normalização de Cidade (máximo 60 caracteres)
  const cidade = String(formData.cidade || formData.city || 'Brasília').trim().slice(0, 60);

  // 3. Normalização de Data de Nascimento (ISO 8601 UTC - meio-dia UTC para evitar shift de fuso)
  let isoBirth = '1995-01-27T12:00:00.000Z';
  const rawBirth = String(formData.dataNascimento || formData.data_nascimento || formData.birthDate || '');
  if (rawBirth.includes('/')) {
    const parts = rawBirth.split('/');
    if (parts.length === 3) {
      const d = new Date(Date.UTC(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), 12, 0, 0, 0));
      if (!isNaN(d.getTime())) isoBirth = d.toISOString();
    }
  } else if (rawBirth.includes('-')) {
    const parts = rawBirth.split('T')[0].split('-');
    if (parts.length === 3) {
      const d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0, 0));
      if (!isNaN(d.getTime())) isoBirth = d.toISOString();
    } else {
      const d = new Date(rawBirth);
      if (!isNaN(d.getTime())) isoBirth = d.toISOString();
    }
  }

  // 4. Renda Mensal (Inteiro)
  const renda = Math.round(Number(formData.rendaMensal || formData.renda_mensal || formData.monthlyIncome) || 0);

  const faixaRenda = String(formData.incomeBracket || formData.faixa_renda || 'R$ 3.243 a R$ 5.000').trim();
  const sexoVal = String(formData.sexo || formData.gender || 'Outros').trim();
  const consentLgpd = Boolean(formData.consentLgpd ?? formData.consent_lgpd ?? true);

  const initialFinancialData = {
    saldo: 0,
    receitas: 0,
    despesas: 0,
    transactions: [],
    accounts: [
      {
        id: 'default',
        userId: email,
        name: 'Conta Corrente Principal',
        initialBalance: 0,
        color: '#4F46E5',
        icon: 'Wallet',
        type: 'checking'
      }
    ],
    categories: [],
    financialGoals: [],
    goals: [],
    familyMembers: [],
    investmentTransactions: [],
    investmentGoals: [],
    birthDate: isoBirth,
    data_nascimento: isoBirth,
    city: cidade,
    cidade: cidade,
    state: uf,
    estado: uf,
    monthlyIncome: renda,
    renda_mensal: renda,
    incomeBracket: faixaRenda,
    faixa_renda: faixaRenda,
    sexo: sexoVal,
    consent_lgpd: consentLgpd,
    updatedAt: new Date().toISOString()
  };

  return {
    userId: email,
    data: JSON.stringify(initialFinancialData),
    cidade: cidade || 'Brasília',
    estado: uf,
    data_nascimento: isoBirth,
    renda_mensal: renda,
    faixa_renda: faixaRenda,
    sexo: sexoVal,
    consent_lgpd: consentLgpd
  };
};
