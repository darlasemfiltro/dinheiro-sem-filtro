export interface BrazilState {
  uf: string;
  name: string;
}

export const BRAZIL_STATES: BrazilState[] = [
  { uf: 'AC', name: 'Acre' },
  { uf: 'AL', name: 'Alagoas' },
  { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' },
  { uf: 'BA', name: 'Bahia' },
  { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' },
  { uf: 'ES', name: 'Espírito Santo' },
  { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' },
  { uf: 'MT', name: 'Mato Grosso' },
  { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'PA', name: 'Pará' },
  { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' },
  { uf: 'PE', name: 'Pernambuco' },
  { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' },
  { uf: 'RN', name: 'Rio Grande do Norte' },
  { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' },
  { uf: 'RR', name: 'Roraima' },
  { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' },
  { uf: 'SE', name: 'Sergipe' },
  { uf: 'TO', name: 'Tocantins' },
];

export const POPULAR_CITIES_BY_UF: Record<string, string[]> = {
  AC: ['Rio Branco', 'Cruzeiro do Sul', 'Sena Madureira', 'Tarauacá', 'Feijó', 'Brasiléia', 'Senador Guiomard', 'Plácido de Castro', 'Xapuri', 'Mâncio Lima'],
  AL: ['Maceió', 'Arapiraca', 'Rio Largo', 'Palmeira dos Índios', 'União dos Palmares', 'Penedo', 'São Miguel dos Campos', 'Campo Alegre', 'Coruripe', 'Delmiro Gouveia', 'Marechal Deodoro'],
  AP: ['Macapá', 'Santana', 'Laranjal do Jari', 'Oiapoque', 'Porto Grande', 'Mazagão', 'Tartarugalzinho', 'Vitória do Jari'],
  AM: ['Manaus', 'Parintins', 'Itacoatiara', 'Manacapuru', 'Coari', 'Tabatinga', 'Maués', 'Tefé', 'Manicoré', 'Humaitá', 'Iranduba'],
  BA: ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Camaçari', 'Juazeiro', 'Itabuna', 'Lauro de Freitas', 'Ilhéus', 'Jequié', 'Teixeira de Freitas', 'Barreiras', 'Alagoinhas', 'Porto Seguro', 'Simões Filho', 'Paulo Afonso', 'Eunápolis', 'Santo Antônio de Jesus'],
  CE: ['Fortaleza', 'Caucaia', 'Juazeiro do Norte', 'Maracanaú', 'Sobral', 'Crato', 'Itapipoca', 'Maranguape', 'Iguatu', 'Quixadá', 'Pacatuba', 'Aquiraz', 'Canindé', 'Russas', 'Tianguá', 'Crateús'],
  DF: ['Brasília', 'Taguatinga', 'Ceilândia', 'Águas Claras', 'Guará', 'Samambaia', 'Planaltina', 'Sobradinho', 'Gama', 'Santa Maria', 'Recanto das Emas', 'Vicente Pires', 'Sudoeste/Octogonal', 'Lago Sul', 'Lago Norte'],
  ES: ['Vitória', 'Vila Velha', 'Serra', 'Cariacica', 'Cachoeiro de Itapemirim', 'Linhares', 'São Mateus', 'Colatina', 'Guarapari', 'Aracruz', 'Viana', 'Nova Venécia', 'Marataízes'],
  GO: ['Goiânia', 'Aparecida de Goiânia', 'Anápolis', 'Rio Verde', 'Luziânia', 'Águas Lindas de Goiás', 'Valparaíso de Goiás', 'Trindade', 'Formosa', 'Novo Gama', 'Senador Canedo', 'Itumbiara', 'Catalão', 'Jataí', 'Planaltina', 'Caldas Novas'],
  MA: ['São Luís', 'Imperatriz', 'São José de Ribamar', 'Timon', 'Caxias', 'Codó', 'Paço do Lumiar', 'Açailândia', 'Bacabal', 'Balsas', 'Santa Inês', 'Barra do Corda', 'Pinheiro', 'Chapadinha'],
  MT: ['Cuiabá', 'Várzea Grande', 'Rondonópolis', 'Sinop', 'Tangará da Serra', 'Sorriso', 'Lucas do Rio Verde', 'Primavera do Leste', 'Barra do Garças', 'Alta Floresta', 'Cáceres', 'Nova Mutum'],
  MS: ['Campo Grande', 'Dourados', 'Três Lagoas', 'Corumbá', 'Ponta Porã', 'Sidrolândia', 'Naviraí', 'Nova Andradina', 'Aquidauana', 'Maracaju', 'Paranaíba'],
  MG: ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora', 'Betim', 'Montes Claros', 'Ribeirão das Neves', 'Uberaba', 'Governador Valadares', 'Ipatinga', 'Sete Lagoas', 'Divinópolis', 'Santa Luzia', 'Ibirité', 'Poços de Caldas', 'Patos de Minas', 'Pouso Alegre', 'Teófilo Otoni', 'Barbacena', 'Sabará', 'Varginha', 'Conselheiro Lafaiete', 'Araguari', 'Itabira', 'Passos', 'Coronel Fabriciano', 'Muriaé', 'Ubá', 'Nova Lima'],
  PA: ['Belém', 'Ananindeua', 'Santarém', 'Marabá', 'Parauapebas', 'Castanhal', 'Abaetetuba', 'Cametá', 'Marituba', 'Bragança', 'São Félix do Xingu', 'Barcarena', 'Altamira', 'Tucuruí', 'Paragominas', 'Tailândia'],
  PB: ['João Pessoa', 'Campina Grande', 'Santa Rita', 'Patos', 'Bayeux', 'Sousa', 'Cajazeiras', 'Cabedelo', 'Guarabira', 'Mamanguape', 'Queimadas'],
  PR: ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel', 'São José dos Pinhais', 'Foz do Iguaçu', 'Colombo', 'Guarapuava', 'Paranaguá', 'Araucária', 'Toledo', 'Apucarana', 'Pinhais', 'Campo Largo', 'Arapongas', 'Almirante Tamandaré', 'Umuarama', 'Piraquara', 'Cambé', 'Fazenda Rio Grande', 'Sarandi'],
  PE: ['Recife', 'Jaboatão dos Guararapes', 'Olinda', 'Caruaru', 'Petrolina', 'Paulista', 'Cabo de Santo Agostinho', 'Camaragibe', 'Garanhuns', 'Vitória de Santo Antão', 'Igarassu', 'São Lourenço da Mata', 'Santa Cruz do Capibaribe', 'Abreu e Lima', 'Ipojuca', 'Serra Talhada', 'Araripina', 'Gravatá'],
  PI: ['Teresina', 'Parnaíba', 'Picos', 'Piripiri', 'Floriano', 'Barras', 'Campo Maior', 'União', 'Altos', 'Esperantina', 'Pedro II'],
  RJ: ['Rio de Janeiro', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Niterói', 'Belford Roxo', 'Campos dos Goytacazes', 'São João de Meriti', 'Petrópolis', 'Volta Redonda', 'Macaé', 'Magé', 'Itaboraí', 'Cabo Frio', 'Angra dos Reis', 'Nova Friburgo', 'Barra Mansa', 'Teresópolis', 'Mesquita', 'Nilópolis', 'Maricá', 'Rio das Ostras', 'Resende', 'Araruama', 'Itaguaí'],
  RN: ['Natal', 'Mossoró', 'Parnamirim', 'São Gonçalo do Amarante', 'Ceará-Mirim', 'Macaíba', 'Caicó', 'Açu', 'Currais Novos', 'São José de Mipibu', 'Santa Cruz'],
  RS: ['Porto Alegre', 'Caxias do Sul', 'Canoas', 'Pelotas', 'Santa Maria', 'Gravataí', 'Viamão', 'Novo Hamburgo', 'São Leopoldo', 'Rio Grande', 'Alvorada', 'Passo Fundo', 'Sapucaia do Sul', 'Uruguaiana', 'Santa Cruz do Sul', 'Cachoeirinha', 'Bento Gonçalves', 'Bagé', 'Erechim', 'Guaíba', 'Lajeado', 'Ijuí'],
  RO: ['Porto Velho', 'Ji-Paraná', 'Ariquemes', 'Vilhena', 'Cacoal', 'Rolim de Moura', 'Jaru', 'Guajará-Mirim', 'Ouro Preto do Oeste', 'Pimenta Bueno'],
  RR: ['Boa Vista', 'Rorainópolis', 'Caracaraí', 'Cantá', 'Mucajaí', 'Pacaraima'],
  SC: ['Florianópolis', 'Joinville', 'Blumenau', 'São José', 'Chapecó', 'Itajaí', 'Criciúma', 'Balneário Camboriú', 'Palhoça', 'Brusque', 'Tubarão', 'Lages', 'Jaraguá do Sul', 'São Bento do Sul', 'Camboriú', 'Navegantes', 'Caçador', 'Concórdia', 'Rio do Sul'],
  SP: ['São Paulo', 'Guarulhos', 'Campinas', 'São Bernardo do Campo', 'Santo André', 'Osasco', 'São José dos Campos', 'Ribeirão Preto', 'Sorocaba', 'Santos', 'Mauá', 'São José do Rio Preto', 'Mogi das Cruzes', 'Diadema', 'Jundiaí', 'Piracicaba', 'Carapicuíba', 'Bauru', 'Itaquaquecetuba', 'São Vicente', 'Franca', 'Praia Grande', 'Guarujá', 'Taubaté', 'Limeira', 'Suzano', 'Taboão da Serra', 'Sumaré', 'Barueri', 'Embu das Artes', 'Indaiatuba', 'Cotia', 'Americana', 'Marília', 'Araraquara', 'Jacareí', 'Presidente Prudente', 'Hortolândia', 'Rio Claro', 'Araçatuba', 'Santa Bárbara d\'Oeste', 'Itupeva', 'Bragança Paulista', 'São Caetano do Sul', 'Itapetininga'],
  SE: ['Aracaju', 'Nossa Senhora do Socorro', 'Lagarto', 'Itabaiana', 'São Cristóvão', 'Estância', 'Tobias Barreto', 'Simão Dias', 'Propriá'],
  TO: ['Palmas', 'Araguaína', 'Gurupi', 'Porto Nacional', 'Paraíso do Tocantins', 'Colinas do Tocantins', 'Guaraí'],
};

/**
 * Strips HTML tags, control characters, and excess whitespace from user input.
 */
export function sanitizeString(input: string): string {
  if (!input) return '';
  return input
    .replace(/<[^>]*>?/gm, '') // remove HTML tags
    .replace(/[^\w\s\u00C0-\u017F.,'-]/gi, '') // allow letters, accented characters, spaces and standard punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formats raw user typing into Brazilian date mask "DD/MM/AAAA".
 */
export function formatBirthDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length === 0) return '';

  let day = digits.slice(0, 2);
  let month = digits.slice(2, 4);
  let year = digits.slice(4, 8);

  // Validate day if 2 digits entered
  if (day.length === 2) {
    const d = parseInt(day, 10);
    if (d > 31) day = '31';
    else if (d === 0) day = '01';
  }

  // Validate month if 2 digits entered
  if (month.length === 2) {
    const m = parseInt(month, 10);
    if (m > 12) month = '12';
    else if (m === 0) month = '01';
  }

  if (digits.length <= 2) {
    return day;
  }
  if (digits.length <= 4) {
    return `${day}/${month}`;
  }
  return `${day}/${month}/${year}`;
}

/**
 * Converts DD/MM/AAAA to ISO YYYY-MM-DD for backend and database storage.
 * Returns empty string if invalid.
 */
export function brDateToIso(brDate: string): string {
  if (!brDate) return '';
  const parts = brDate.split('/');
  if (parts.length !== 3) return '';
  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  const year = parts[2];
  if (year.length !== 4) return '';

  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return '';
  if (m < 1 || m > 12) return '';
  if (d < 1 || d > 31) return '';
  if (y < 1900 || y > new Date().getFullYear()) return '';

  return `${year}-${month}-${day}`;
}

/**
 * Converts ISO YYYY-MM-DD to DD/MM/AAAA.
 */
export function isoToBrDate(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
}

/**
 * Calculates accurate age based on birth date (accepts YYYY-MM-DD or DD/MM/AAAA).
 */
export function calculateAge(birthDateString: string): number {
  if (!birthDateString) return 0;
  let year = 0;
  let month = 0;
  let day = 0;

  if (birthDateString.includes('/')) {
    const parts = birthDateString.split('/');
    if (parts.length !== 3) return 0;
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    year = parseInt(parts[2], 10);
  } else if (birthDateString.includes('-')) {
    const parts = birthDateString.split('-');
    if (parts.length !== 3) return 0;
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    day = parseInt(parts[2], 10);
  } else {
    return 0;
  }

  if (isNaN(year) || isNaN(month) || isNaN(day)) return 0;
  if (year < 1900 || year > new Date().getFullYear()) return 0;

  const birthDate = new Date(year, month, day);
  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return Math.max(0, age);
}

/**
 * Returns date string YYYY-MM-DD corresponding to exactly 18 years ago from today.
 */
export function getMaxDateFor18YearsOld(): string {
  const today = new Date();
  const maxYear = today.getFullYear() - 18;
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${maxYear}-${m}-${d}`;
}

/**
 * Live mask for currency typing (BRL - R$).
 * Formats user typing from raw digits into "R$ 3.500,00".
 */
export function formatCurrencyFromDigits(digitsOrStr: string | number): string {
  if (typeof digitsOrStr === 'number') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(digitsOrStr);
  }

  const cleanDigits = String(digitsOrStr || '').replace(/\D/g, '');
  if (!cleanDigits) return '';

  const num = parseInt(cleanDigits, 10) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

/**
 * Parses masked currency string like "R$ 3.500,00" into a positive float number.
 */
export function parseCurrencyToNumber(currencyStr: string): number {
  if (!currencyStr) return 0;
  const cleanDigits = String(currencyStr).replace(/\D/g, '');
  if (!cleanDigits) return 0;
  return parseInt(cleanDigits, 10) / 100;
}

/**
 * Returns user demographic age bracket string (e.g. "25-34 anos").
 */
export function getAgeGroup(age?: number): string {
  if (!age || age <= 0) return '25-34 anos';
  if (age < 25) return '18-24 anos';
  if (age < 35) return '25-34 anos';
  if (age < 45) return '35-44 anos';
  if (age < 60) return '45-59 anos';
  return '60+ anos';
}

/**
 * Returns anonymized aggregate benchmark of household income commitment
 * by Brazilian Macro-Region according to national consumer and debt studies.
 */
export function getRegionalBenchmark(state?: string): number {
  const uf = (state || '').toUpperCase().trim();
  // Sudeste (SP, RJ, MG, ES): ~67%
  if (['SP', 'RJ', 'MG', 'ES'].includes(uf)) return 67;
  // Sul (PR, SC, RS): ~64%
  if (['PR', 'SC', 'RS'].includes(uf)) return 64;
  // Centro-Oeste (DF, GO, MT, MS): ~66%
  if (['DF', 'GO', 'MT', 'MS'].includes(uf)) return 66;
  // Nordeste (BA, PE, CE, MA, PB, RN, AL, SE, PI): ~70%
  if (['BA', 'PE', 'CE', 'MA', 'PB', 'RN', 'AL', 'SE', 'PI'].includes(uf)) return 70;
  // Norte (AM, PA, RO, AC, AP, RR, TO): ~68%
  if (['AM', 'PA', 'RO', 'AC', 'AP', 'RR', 'TO'].includes(uf)) return 68;
  return 67; // Média Nacional do Brasil
}

export const MINIMUM_WAGE = 1621;

export interface IncomeBracket {
  id: string;
  label: string;
  sublabel: string;
  representativeValue: number;
}

export const INCOME_BRACKETS: IncomeBracket[] = [
  {
    id: 'ate-1621',
    label: 'Até R$ 1.621',
    sublabel: 'Até 1 salário mínimo',
    representativeValue: 1621,
  },
  {
    id: '1622-3242',
    label: 'R$ 1.622 a R$ 3.242',
    sublabel: '1 a 2 salários mínimos',
    representativeValue: 2432,
  },
  {
    id: '3243-5000',
    label: 'R$ 3.243 a R$ 5.000',
    sublabel: '2 a 3 salários mínimos',
    representativeValue: 4000,
  },
  {
    id: '5001-10000',
    label: 'R$ 5.001 a R$ 10.000',
    sublabel: '3 a 6 salários mínimos',
    representativeValue: 7500,
  },
  {
    id: '10001-20000',
    label: 'R$ 10.001 a R$ 20.000',
    sublabel: '6 a 12 salários mínimos',
    representativeValue: 15000,
  },
  {
    id: 'acima-20000',
    label: 'Acima de R$ 20.000',
    sublabel: 'Mais de 12 salários mínimos',
    representativeValue: 25000,
  },
];

export function getIncomeBracketFromValue(val?: number): string {
  if (!val || val <= 0) return '';
  if (val <= 1621) return 'Até R$ 1.621';
  if (val <= 3242) return 'R$ 1.622 a R$ 3.242';
  if (val <= 5000) return 'R$ 3.243 a R$ 5.000';
  if (val <= 10000) return 'R$ 5.001 a R$ 10.000';
  if (val <= 20000) return 'R$ 10.001 a R$ 20.000';
  return 'Acima de R$ 20.000';
}

export function getValueFromIncomeBracket(bracket?: string): number {
  if (!bracket) return 0;
  const found = INCOME_BRACKETS.find(
    (b) => b.label === bracket || b.id === bracket
  );
  if (found) return found.representativeValue;

  const b = bracket.trim();
  if ((b.includes('1.621') || b.includes('1.500')) && b.toLowerCase().includes('até')) return 1621;
  if (b.includes('3.242') || b.includes('3.000')) return 2432;
  if (b.includes('5.000')) return 4000;
  if (b.includes('10.000')) return 7500;
  if (b.includes('20.000') && !b.toLowerCase().includes('acima')) return 15000;
  if (b.includes('20.000') || b.toLowerCase().includes('acima')) return 25000;
  return 4000;
}


