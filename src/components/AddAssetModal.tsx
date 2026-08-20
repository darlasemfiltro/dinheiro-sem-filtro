import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Calendar, RefreshCw, Sparkles, Search, ChevronDown, ChevronUp, Check, Plus } from 'lucide-react';
import { AssetCategory, InvestmentTransaction } from '../types';
import { CATEGORY_LABELS, PortfolioStorageService } from '../services/portfolioStorage';
import { formatNumberToPtBr, parsePtBrNumber } from '../utils/finance';

interface AddAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTransaction: (tx: Omit<InvestmentTransaction, 'id' | 'createdAt'> | InvestmentTransaction) => void;
  userId?: string;
  editingTransaction?: InvestmentTransaction | null;
}

export interface TickerInfo {
  ticker: string;
  name: string;
}

export const ALL_BROKERS = [
  'BANCO CREDIT AGRICOLE BRASIL S.A.',
  'RICO INVESTIMENTOS',
  'XP INVESTIMENTOS',
  'CLEAR CORRETORA',
  'BTG PACTUAL',
  'NUBANK / NUINVEST',
  'INTER INVEST',
  'TORO INVESTIMENTOS',
  'GENIAL INVESTIMENTOS',
  'ÁGORA INVESTIMENTOS',
  'AVENUE',
  'NOMAD',
  'STAKE',
  'BINANCE',
  'MERCADO BITCOIN',
  'FOXBIT',
  'BYBIT',
  'COINBASE',
  'KUCOIN',
  'BITGET',
  'MEXC',
  'GATE.IO',
  'BANCO DO BRASIL',
  'ITAÚ CORRETORA',
  'BRADESCO S.A.',
  'SANTANDER CORRETORA',
  'C6 BANK',
  'SAFRA',
  'BANCO DAYCOVAL',
  'BANCO BMG',
  'BANCO PINE',
  'BANCO MASTER',
  'ORAMA INVESTIMENTOS',
  'MODALMAIS',
  'MIRAE ASSET',
  'GUAJA VEST',
  'OUTRA INSTITUIÇÃO',
];

export const TICKERS_BY_CATEGORY: Record<AssetCategory, TickerInfo[]> = {
  acoes: [
    { ticker: 'PETR4', name: 'Petróleo Brasileiro S.A. - Petrobras PN' },
    { ticker: 'PETR3', name: 'Petróleo Brasileiro S.A. - Petrobras ON' },
    { ticker: 'VALE3', name: 'Vale S.A.' },
    { ticker: 'BBAS3', name: 'Banco do Brasil S.A.' },
    { ticker: 'BBSE3', name: 'BB Seguridade Participações S.A.' },
    { ticker: 'ITUB4', name: 'Itaú Unibanco Holding S.A. PN' },
    { ticker: 'ITUB3', name: 'Itaú Unibanco Holding S.A. ON' },
    { ticker: 'BBDC4', name: 'Banco Bradesco S.A. PN' },
    { ticker: 'BBDC3', name: 'Banco Bradesco S.A. ON' },
    { ticker: 'WEGE3', name: 'WEG S.A.' },
    { ticker: 'TAEE11', name: 'Taesa Transmissora Aliança de Energia Elétrica' },
    { ticker: 'CMIG4', name: 'Cia Energética de Minas Gerais - Cemig PN' },
    { ticker: 'CMIG3', name: 'Cia Energética de Minas Gerais - Cemig ON' },
    { ticker: 'CSMG3', name: 'Cia de Saneamento de Minas Gerais - Copasa' },
    { ticker: 'GOAU4', name: 'Metalúrgica Gerdau S.A.' },
    { ticker: 'GERD4', name: 'Gerdau S.A.' },
    { ticker: 'LEVE3', name: 'Mahle Metal Leve S.A.' },
    { ticker: 'AGRO3', name: 'BrasilAgro Cia Brasileira de Propriedades Agrícolas' },
    { ticker: 'MGLU3', name: 'Magazine Luiza S.A.' },
    { ticker: 'RENT3', name: 'Localiza Rent a Car S.A.' },
    { ticker: 'PRIO3', name: 'Prio S.A.' },
    { ticker: 'ELET3', name: 'Centrais Elétricas Brasileiras S.A. - Eletrobras ON' },
    { ticker: 'ELET6', name: 'Centrais Elétricas Brasileiras S.A. - Eletrobras PNB' },
    { ticker: 'EQTL3', name: 'Equatorial Energia S.A.' },
    { ticker: 'ABEV3', name: 'Ambev S.A.' },
    { ticker: 'SANB11', name: 'Banco Santander Brasil S.A. Unit' },
    { ticker: 'SANB4', name: 'Banco Santander Brasil S.A. PN' },
    { ticker: 'SANB3', name: 'Banco Santander Brasil S.A. ON' },
    { ticker: 'SUZB3', name: 'Suzano S.A.' },
    { ticker: 'RADL3', name: 'Raia Drogasil S.A.' },
    { ticker: 'EGIE3', name: 'Engie Brasil Energia S.A.' },
    { ticker: 'CPLE6', name: 'Cia Paranaense de Energia - Copel PNB' },
    { ticker: 'CPLE3', name: 'Cia Paranaense de Energia - Copel ON' },
    { ticker: 'CXSE3', name: 'Caixa Seguridade Participações S.A.' },
    { ticker: 'KLBN11', name: 'Klabin S.A. Unit' },
    { ticker: 'KLBN4', name: 'Klabin S.A. PN' },
    { ticker: 'FLRY3', name: 'Fleury S.A.' },
    { ticker: 'VBBR3', name: 'Vibra Energia S.A.' },
    { ticker: 'ALOS3', name: 'Allos S.A.' },
    { ticker: 'AMER3', name: 'Americanas S.A.' },
    { ticker: 'ASAI3', name: 'Sendas Distribuidora (Assaí)' },
    { ticker: 'AURE3', name: 'Auren Energia S.A.' },
    { ticker: 'AZUL4', name: 'Azul S.A.' },
    { ticker: 'B3SA3', name: 'B3 S.A. - Brasil, Bolsa, Balcão' },
    { ticker: 'BEEF3', name: 'Minerva S.A.' },
    { ticker: 'BPAC11', name: 'Banco BTG Pactual S.A. Unit' },
    { ticker: 'BRAP4', name: 'Bradespar S.A.' },
    { ticker: 'BRFS3', name: 'BRF S.A.' },
    { ticker: 'BRKM5', name: 'Braskem S.A.' },
    { ticker: 'CASH3', name: 'Méliuz S.A.' },
    { ticker: 'CCRO3', name: 'CCR S.A.' },
    { ticker: 'CIEL3', name: 'Cielo S.A.' },
    { ticker: 'CMIN3', name: 'CSN Mineração S.A.' },
    { ticker: 'COGN3', name: 'Cogna Educação S.A.' },
    { ticker: 'CPFE3', name: 'CPFL Energia S.A.' },
    { ticker: 'CSNA3', name: 'Cia Siderúrgica Nacional' },
    { ticker: 'CYRE3', name: 'Cyrela Brazil Realty S.A.' },
    { ticker: 'DXCO3', name: 'Dexco S.A.' },
    { ticker: 'ECOR3', name: 'EcoRodovias Infraestrutura S.A.' },
    { ticker: 'EMBR3', name: 'Embraer S.A.' },
    { ticker: 'ENEV3', name: 'Eneva S.A.' },
    { ticker: 'ENGI11', name: 'Energisa S.A. Unit' },
    { ticker: 'HAPV3', name: 'Hapvida Participações e Investimentos' },
    { ticker: 'HYPE3', name: 'Hypera S.A.' },
    { ticker: 'IGTI11', name: 'Iguatemi S.A. Unit' },
    { ticker: 'JBSS3', name: 'JBS S.A.' },
    { ticker: 'LREN3', name: 'Lojas Renner S.A.' },
    { ticker: 'LWSA3', name: 'LWSA S.A. (Locaweb)' },
    { ticker: 'MRFG3', name: 'Marfrig Global Foods S.A.' },
    { ticker: 'MRVE3', name: 'MRV Engenharia S.A.' },
    { ticker: 'MULT3', name: 'Multiplan Empreendimentos' },
    { ticker: 'NTCO3', name: 'Natura &Co Holding S.A.' },
    { ticker: 'PCAR3', name: 'Companhia Brasileira de Distribuição (Pão de Açúcar)' },
    { ticker: 'PETZ3', name: 'Pet Center Comércio S.A.' },
    { ticker: 'POMO4', name: 'Marcopolo S.A. PN' },
    { ticker: 'POSI3', name: 'Positivo Tecnologia S.A.' },
    { ticker: 'RAIZ4', name: 'Raízen S.A. PN' },
    { ticker: 'RDOR3', name: 'Rede D\'Or São Luiz S.A.' },
    { ticker: 'RECV3', name: 'Petroreconcavo S.A.' },
    { ticker: 'RRRP3', name: '3R Petroleum Óleo e Gás' },
    { ticker: 'SBSP3', name: 'Cia de Saneamento Básico - Sabesp' },
    { ticker: 'SLCE3', name: 'SLC Agrícola S.A.' },
    { ticker: 'SMTO3', name: 'São Martinho S.A.' },
    { ticker: 'STBP3', name: 'Santos Brasil Participações S.A.' },
    { ticker: 'TOTS3', name: 'Totvs S.A.' },
    { ticker: 'UGPA3', name: 'Ultrapar Participações S.A.' },
    { ticker: 'USIM5', name: 'Usinas Siderúrgicas de Minas Gerais - Usiminas PN' },
    { ticker: 'VIVA3', name: 'Vivara Participações S.A.' },
    { ticker: 'YDUQ3', name: 'Yduqs Participações S.A.' },
    { ticker: 'TRPL4', name: 'CTEEP - Transmissão Paulista PN' },
    { ticker: 'SAPR11', name: 'Cia de Saneamento do Paraná - Sanepar Unit' },
    { ticker: 'SAPR4', name: 'Sanepar PN' },
    { ticker: 'KEPL3', name: 'Kepler Weber S.A.' },
    { ticker: 'UNIP6', name: 'Unipar Carbocloro S.A. PNB' },
    { ticker: 'RANI3', name: 'Irani Papel e Embalagem S.A.' },
    { ticker: 'TASA4', name: 'Taurus Armas S.A.' },
    { ticker: 'SHUL4', name: 'Schulz S.A.' },
    { ticker: 'MYPK3', name: 'Iochpe-Maxion S.A.' },
    { ticker: 'WIZC3', name: 'Wiz Soluções e Corretagem S.A.' },
    { ticker: 'PLPL3', name: 'Plano & Plano Desenvolvimento Urbano' },
    { ticker: 'CURY3', name: 'Cury Construtora e Incorporadora' },
    { ticker: 'DIRR3', name: 'Direcional Engenharia S.A.' },
    { ticker: 'GUAR3', name: 'Guararapes Confecções S.A.' },
    { ticker: 'TEND3', name: 'Construtora Tenda S.A.' },
    { ticker: 'ARZZ3', name: 'Arezzo Indústria e Comércio' },
    { ticker: 'SOMA3', name: 'Grupo de Moda Soma S.A.' },
    { ticker: 'INTB3', name: 'Intelbras S.A.' },
    { ticker: 'ALPA4', name: 'Alpargatas S.A.' },
    { ticker: 'EVEN3', name: 'Even Construtora e Incorporadora' },
    { ticker: 'PSSA3', name: 'Porto Seguro S.A.' },
    { ticker: 'IRBR3', name: 'IRB Brasil Resseguros S.A.' },
    { ticker: 'MOVI3', name: 'Movida Participações S.A.' },
    { ticker: 'SIMH3', name: 'Simpar S.A.' },
  ],
  fiis: [
    { ticker: 'MXRF11', name: 'Maxi Renda Fundo Imobiliário' },
    { ticker: 'HCTR11', name: 'Hectare CE Fundo Imobiliário' },
    { ticker: 'VINO11', name: 'Vinci Offices Fundo Imobiliário' },
    { ticker: 'HGBS11', name: 'Hedge Shopping Centers FII' },
    { ticker: 'ALZR11', name: 'Alianza Trust Renda Imobiliária FII' },
    { ticker: 'RZAT11', name: 'Riza Akio FII' },
    { ticker: 'KNCA11', name: 'Kinea Crédito Agrícola FII' },
    { ticker: 'BBCR11', name: 'BB Progressivo FII' },
    { ticker: 'XPIN11', name: 'XP Industrial FII' },
    { ticker: 'TGAR11', name: 'TG Ativo Real FII' },
    { ticker: 'HGLG11', name: 'CSHG Logística FII' },
    { ticker: 'KNCR11', name: 'Kinea Rendimentos Imobiliários FII' },
    { ticker: 'KNSC11', name: 'Kinea Securities FII' },
    { ticker: 'CPTS11', name: 'Capitânia Securities II FII' },
    { ticker: 'VISC11', name: 'Vinci Shopping Centers FII' },
    { ticker: 'XPML11', name: 'XP Malls FII' },
    { ticker: 'BBRC11', name: 'BB Renda Corporativa FII' },
    { ticker: 'BCFF11', name: 'BTG Pactual Fundo de Fondos FII' },
    { ticker: 'IRDM11', name: 'Iridium Recebíveis Imobiliários FII' },
    { ticker: 'VRTA11', name: 'Fator Verita FII' },
    { ticker: 'TRXF11', name: 'TRX Real Estate FII' },
    { ticker: 'XPLG11', name: 'XP Log FII' },
    { ticker: 'PVBI11', name: 'VBI Prime Properties FII' },
    { ticker: 'BTLG11', name: 'BTG Pactual Logística FII' },
    { ticker: 'ABCP11', name: 'Grand Plaza Shopping FII' },
    { ticker: 'BCIA11', name: 'Bradesco Carteira Imobiliária FII' },
    { ticker: 'BLMG11', name: 'BlueCap Logística FII' },
    { ticker: 'BRCR11', name: 'BC Fund FII' },
    { ticker: 'DEVO11', name: 'Devant Recebíveis Imobiliários FII' },
    { ticker: 'GGRC11', name: 'GGR Covepi Renda Imobiliária FII' },
    { ticker: 'HGFF11', name: 'CSHG Imobiliário FOFF FII' },
    { ticker: 'HGPO11', name: 'CSHG Prime Offices FII' },
    { ticker: 'HGRE11', name: 'CSHG Real Estate FII' },
    { ticker: 'HSLG11', name: 'HSI Logística FII' },
    { ticker: 'HTMX11', name: 'Hotel Maxinvest FII' },
    { ticker: 'JSRE11', name: 'JS Real Estate Multigestão FII' },
    { ticker: 'KNIP11', name: 'Kinea Índices de Preços FII' },
    { ticker: 'MALL11', name: 'Malls Brasil Plural FII' },
    { ticker: 'MAXR11', name: 'Max Retail FII' },
    { ticker: 'MFII11', name: 'Mérito Desenvolvimento Imobiliário FII' },
    { ticker: 'MGFF11', name: 'MOGNO Fundo de Fundos FII' },
    { ticker: 'OUJP11', name: 'Ouro Preto Desenvolvimento Imobiliário FII' },
    { ticker: 'PATL11', name: 'Pátria Logística FII' },
    { ticker: 'PLCR11', name: 'Plural Recebíveis Imobiliários FII' },
    { ticker: 'RECR11', name: 'Rec Recebíveis Imobiliários FII' },
    { ticker: 'RBRP11', name: 'RBR Properties FII' },
    { ticker: 'RBRR11', name: 'RBR Rendimento High Grade FII' },
    { ticker: 'RBRY11', name: 'RBR Crédito Imobiliário FIAGRO/FII' },
    { ticker: 'RZTR11', name: 'Riza Terra FII' },
    { ticker: 'SARE11', name: 'Santander Renda de Aluguel FII' },
    { ticker: 'SPTW11', name: 'SP Terra Fortuna FII' },
    { ticker: 'VILG11', name: 'Vinci Logística FII' },
    { ticker: 'VSLH11', name: 'Versalhes Recebíveis Imobiliários FII' },
    { ticker: 'HGRU11', name: 'CSHG Renda Urbana FII' },
    { ticker: 'RBRF11', name: 'RBR Alpha Multiestratégia Real Estate FII' },
    { ticker: 'RBVA11', name: 'Rio Bravo Renda Varejo FII' },
    { ticker: 'PORD11', name: 'Polo Recebíveis Imobiliários FII' },
    { ticker: 'KFOF11', name: 'Kinea Fundo de Fondos FII' },
    { ticker: 'GALG11', name: 'GARTNER Logística FII' },
    { ticker: 'CVBI11', name: 'VBI Crédito Imobiliário FII' },
    { ticker: 'BTAL11', name: 'BTG Pactual Agro Logística FII' },
    { ticker: 'GARE11', name: 'Guardian Real Estate FII' },
    { ticker: 'VGIR11', name: 'Valora RE FII' },
    { ticker: 'CLIN11', name: 'Claggett Infraestrutura e Imobiliário FII' },
    { ticker: 'RZAK11', name: 'Riza AKadin FII' },
    { ticker: 'CACR11', name: 'Cartell Imobiliário FII' },
    { ticker: 'HABT11', name: 'Habitat II FII' },
    { ticker: 'VGIP11', name: 'Valora IP FII' },
    { ticker: 'KNHY11', name: 'Kinea High Yield FII' },
    { ticker: 'BTCI11', name: 'BTG Pactual Crédito Imobiliário FII' },
  ],
  tesouro: [
    { ticker: 'TESOURO SELIC 2027', name: 'Tesouro Selic 2027 (LFT)' },
    { ticker: 'TESOURO SELIC 2029', name: 'Tesouro Selic 2029 (LFT)' },
    { ticker: 'TESOURO SELIC 2031', name: 'Tesouro Selic 2031 (LFT)' },
    { ticker: 'TESOURO IPCA+ 2029', name: 'Tesouro IPCA+ 2029 (NTN-B Principal)' },
    { ticker: 'TESOURO IPCA+ 2035', name: 'Tesouro IPCA+ 2035 (NTN-B Principal)' },
    { ticker: 'TESOURO IPCA+ 2045', name: 'Tesouro IPCA+ 2045 (NTN-B Principal)' },
    { ticker: 'TESOURO IPCA+ 2055', name: 'Tesouro IPCA+ 2055 (NTN-B Principal)' },
    { ticker: 'TESOURO IPCA+ JUROS 2035', name: 'Tesouro IPCA+ com Juros Semestrais 2035' },
    { ticker: 'TESOURO IPCA+ JUROS 2040', name: 'Tesouro IPCA+ com Juros Semestrais 2040' },
    { ticker: 'TESOURO IPCA+ JUROS 2055', name: 'Tesouro IPCA+ com Juros Semestrais 2055' },
    { ticker: 'TESOURO PREFIXADO 2027', name: 'Tesouro Prefixado 2027 (LTN)' },
    { ticker: 'TESOURO PREFIXADO 2031', name: 'Tesouro Prefixado 2031 (LTN)' },
    { ticker: 'TESOURO PREFIXADO JUROS 2035', name: 'Tesouro Prefixado com Juros Semestrais 2035' },
    { ticker: 'TESOURO EDUCA+ 2030', name: 'Tesouro Educa+ 2030' },
    { ticker: 'TESOURO EDUCA+ 2035', name: 'Tesouro Educa+ 2035' },
    { ticker: 'TESOURO EDUCA+ 2040', name: 'Tesouro Educa+ 2040' },
    { ticker: 'TESOURO RENDA+ 2030', name: 'Tesouro Renda+ Aposentadoria Extra 2030' },
    { ticker: 'TESOURO RENDA+ 2035', name: 'Tesouro Renda+ Aposentadoria Extra 2035' },
    { ticker: 'TESOURO RENDA+ 2040', name: 'Tesouro Renda+ Aposentadoria Extra 2040' },
    { ticker: 'TESOURO RENDA+ 2045', name: 'Tesouro Renda+ Aposentadoria Extra 2045' },
    { ticker: 'TESOURO RENDA+ 2050', name: 'Tesouro Renda+ Aposentadoria Extra 2050' },
    { ticker: 'TESOURO RENDA+ 2055', name: 'Tesouro Renda+ Aposentadoria Extra 2055' },
    { ticker: 'TESOURO RENDA+ 2060', name: 'Tesouro Renda+ Aposentadoria Extra 2060' },
  ],
  bdr: [
    { ticker: 'AAPL34', name: 'Apple Inc. BDR' },
    { ticker: 'NVDC34', name: 'NVIDIA Corporation BDR' },
    { ticker: 'MSFT34', name: 'Microsoft Corporation BDR' },
    { ticker: 'AMZO34', name: 'Amazon.com Inc. BDR' },
    { ticker: 'GOGL34', name: 'Alphabet Inc. (Google) BDR' },
    { ticker: 'TSLA34', name: 'Tesla Inc. BDR' },
    { ticker: 'M1TA34', name: 'Meta Platforms Inc. BDR' },
    { ticker: 'BERK34', name: 'Berkshire Hathaway Inc. BDR' },
    { ticker: 'DISB34', name: 'The Walt Disney Co. BDR' },
    { ticker: 'NFLX34', name: 'Netflix Inc. BDR' },
    { ticker: 'MELI34', name: 'MercadoLibre Inc. BDR' },
    { ticker: 'JNJB34', name: 'Johnson & Johnson BDR' },
    { ticker: 'PGCO34', name: 'Procter & Gamble Co. BDR' },
    { ticker: 'COCA34', name: 'The Coca-Cola Co. BDR' },
    { ticker: 'PFIZ34', name: 'Pfizer Inc. BDR' },
    { ticker: 'NIKE34', name: 'Nike Inc. BDR' },
    { ticker: 'BABA34', name: 'Alibaba Group BDR' },
    { ticker: 'SPOT34', name: 'Spotify Technology BDR' },
    { ticker: 'A1MD34', name: 'Advanced Micro Devices (AMD) BDR' },
    { ticker: 'INTC34', name: 'Intel Corp BDR' },
    { ticker: 'CSCO34', name: 'Cisco Systems BDR' },
    { ticker: 'ORCL34', name: 'Oracle Corp BDR' },
    { ticker: 'PYPL34', name: 'PayPal Holdings BDR' },
    { ticker: 'VIZA34', name: 'Visa Inc. BDR' },
    { ticker: 'MSCD34', name: 'Mastercard Inc BDR' },
    { ticker: 'JPMC34', name: 'JPMorgan Chase BDR' },
    { ticker: 'WMTB34', name: 'Walmart Inc BDR' },
    { ticker: 'COST34', name: 'Costco Wholesale BDR' },
    { ticker: 'PEPB34', name: 'PepsiCo Inc BDR' },
    { ticker: 'AVGO34', name: 'Broadcom Inc BDR' },
    { ticker: 'CRMV34', name: 'Salesforce Inc BDR' },
    { ticker: 'ADBE34', name: 'Adobe Inc BDR' },
    { ticker: 'QCOM34', name: 'Qualcomm Inc BDR' },
    { ticker: 'PLTR34', name: 'Palantir Technologies BDR' },
    { ticker: 'COIN34', name: 'Coinbase Global BDR' },
    { ticker: 'UBER34', name: 'Uber Technologies BDR' },
  ],
  etfs: [
    { ticker: 'BOVA11', name: 'BOVA11 - ETF do Índice Ibovespa' },
    { ticker: 'BOVV11', name: 'BOVV11 - ETF do Índice Ibovespa (Itnow)' },
    { ticker: 'IVVB11', name: 'IVVB11 - ETF S&P 500 em Reais' },
    { ticker: 'HASH11', name: 'HASH11 - ETF de Criptoativos Nasdaq' },
    { ticker: 'SMAL11', name: 'SMAL11 - ETF do Índice Small Cap' },
    { ticker: 'GOLD11', name: 'GOLD11 - ETF de Ouro em Reais' },
    { ticker: 'FIXA11', name: 'FIXA11 - ETF do Índice S&P/B3 Renda Fixa' },
    { ticker: 'XINA11', name: 'XINA11 - ETF de Ações Chinesas MSCI China' },
    { ticker: 'SPXI11', name: 'SPXI11 - ETF S&P 500 Itaú' },
    { ticker: 'NASD11', name: 'NASD11 - ETF Nasdaq 100 em Reais' },
    { ticker: 'BITH11', name: 'BITH11 - ETF de Bitcoin Hashdex' },
    { ticker: 'ETHE11', name: 'ETHE11 - ETF de Ethereum Hashdex' },
    { ticker: 'DIVO11', name: 'DIVO11 - ETF do Índice de Dividendos' },
    { ticker: 'BRAX11', name: 'BRAX11 - ETF de 100 Maiores Empresas B3' },
    { ticker: 'MATB11', name: 'MATB11 - ETF Materiais Básicos' },
    { ticker: 'FIND11', name: 'FIND11 - ETF Setor Financeiro' },
    { ticker: 'GOVE11', name: 'GOVE11 - ETF Governança Corporativa' },
    { ticker: 'ISUS11', name: 'ISUS11 - ETF Sustentabilidade ESG' },
    { ticker: 'PIBB11', name: 'PIBB11 - ETF IBrX 50' },
    { ticker: 'ACWI11', name: 'ACWI11 - ETF Ações Globais' },
    { ticker: 'EURP11', name: 'EURP11 - ETF Ações Europeias' },
    { ticker: 'ASIA11', name: 'ASIA11 - ETF Ações Asiáticas' },
    { ticker: 'USTK11', name: 'USTK11 - ETF Tecnologia EUA' },
    { ticker: 'TECK11', name: 'TECK11 - ETF Big Techs' },
    { ticker: 'QBTC11', name: 'QBTC11 - ETF Bitcoin QR Asset' },
    { ticker: 'QETH11', name: 'QETH11 - ETF Ethereum QR Asset' },
    { ticker: 'CRPT11', name: 'CRPT11 - ETF Cripto Empiricus' },
    { ticker: 'WRLD11', name: 'WRLD11 - ETF Global All Cap' },
  ],
  fiagro: [
    { ticker: 'VGIA11', name: 'Valora Hedge Agro Fiagro' },
    { ticker: 'KNCA11', name: 'Kinea Crédito Agrícola Fiagro' },
    { ticker: 'CPTR11', name: 'Capitânia Agro Fiagro' },
    { ticker: 'XPCA11', name: 'XP Crédito Agrícola Fiagro' },
    { ticker: 'FGAA11', name: 'FGTS Agro Fiagro' },
    { ticker: 'RZAG11', name: 'Riza Agro Fiagro' },
    { ticker: 'SNAG11', name: 'Suno Agro Fiagro' },
    { ticker: 'GCRA11', name: 'Galapagos Recebíveis do Agronegócio Fiagro' },
    { ticker: 'AAZQ11', name: 'AZ Quest Solo Agro Fiagro' },
    { ticker: 'EGAF11', name: 'Ecoagro Fiagro' },
    { ticker: 'JAGR11', name: 'JGP Crédito Agro Fiagro' },
    { ticker: 'RURA11', name: 'Itaú BBA Agro Rura Fiagro' },
    { ticker: 'AGRX11', name: 'Exes Araguaia Agro Fiagro' },
    { ticker: 'BCCA11', name: 'BTG Pactual Crédito Agrícola Fiagro' },
    { ticker: 'OIAG11', name: 'Ourinvest Agrocria Fiagro' },
    { ticker: 'MANA11', name: 'Mana FIAGRO' },
    { ticker: 'PLCA11', name: 'Plural Crédito Agro Fiagro' },
    { ticker: 'VCRA11', name: 'Vinci Crédito Agro Fiagro' },
    { ticker: 'BBGO11', name: 'BB Agro Fiagro' },
    { ticker: 'RBRS11', name: 'RBR Agro Fiagro' },
    { ticker: 'CRAA11', name: 'Sparta Fiagro' },
    { ticker: 'IAAG11', name: 'Icatu Agro Fiagro' },
  ],
  fundos: [
    { ticker: 'VERDE FIC FIM', name: 'VERDE FIC FIM - Fundo Multimercado' },
    { ticker: 'ALASKA BLACK FIC FIA', name: 'ALASKA BLACK FIC FIA - Fundo de Ações' },
    { ticker: 'ARX EQUITY FIC FIA', name: 'ARX EQUITY FIC FIA - Fundo de Ações' },
    { ticker: 'SPARTA TOP FIC FIRF', name: 'SPARTA TOP FIC FIRF - Fundo Renda Fixa' },
    { ticker: 'KINEA CHRONOS FIM', name: 'KINEA CHRONOS FIM - Fundo Multimercado' },
    { ticker: 'BOGARI VALUE FIC FIA', name: 'BOGARI VALUE FIC FIA - Fundo de Ações' },
    { ticker: 'KAPITALO KAPPA FIM', name: 'KAPITALO KAPPA FIM - Fundo Multimercado' },
    { ticker: 'WESTERN ASSET FIRF', name: 'WESTERN ASSET FIRF - Crédito Privado' },
    { ticker: 'BB RENDA FIXA LP', name: 'BB Renda Fixa Longo Prazo' },
    { ticker: 'ITAÚ REVESTIMENTO FI', name: 'Itaú Revestimento Fundo Multimercado' },
    { ticker: 'BRADESCO HI-YIELD', name: 'Bradesco Crédito Privado High Yield' },
    { ticker: 'NUCLEO FIC FIA', name: 'Núcleo Ações FIC FIA' },
    { ticker: 'REAL INVESTOR FIA', name: 'Real Investor Fundo de Investimento em Ações' },
    { ticker: 'ZURICH TRIDENTE', name: 'Zurich Tridente Fundo Multimercado' },
  ],
  renda_fixa: [
    { ticker: 'CDB 100% CDI', name: 'CDB 100% CDI (Liquidez Diária)' },
    { ticker: 'CDB 110% CDI', name: 'CDB Pós-Fixado 110% CDI' },
    { ticker: 'CDB 120% CDI', name: 'CDB Pós-Fixado 120% CDI' },
    { ticker: 'CDB IPCA+ 7,5%', name: 'CDB Atrelado à Inflação IPCA+' },
    { ticker: 'LCI 95% CDI', name: 'LCI 95% CDI (Isento de IR)' },
    { ticker: 'LCA 92% CDI', name: 'LCA 92% CDI (Isento de IR)' },
    { ticker: 'LC 115% CDI', name: 'Letra de Câmbio 115% CDI' },
    { ticker: 'CRI 100% CDI', name: 'Certificado de Recebíveis Imobiliários' },
    { ticker: 'CRA IPCA+ 7,0%', name: 'Certificado de Recebíveis do Agronegócio' },
    { ticker: 'DEBÊNTURE INCENTIVADA', name: 'Debênture Infraestrutura (Isenta IR)' },
    { ticker: 'POUPANÇA', name: 'Caderneta de Poupança Tradicional' },
    { ticker: 'DPGE 105% CDI', name: 'Depósito Prazo Garantia Especial' },
    { ticker: 'CDB PRÉ-FIXADO 13%', name: 'CDB Pré-Fixado 13% a.a.' },
  ],
  stocks: [
    { ticker: 'AAPL', name: 'Apple Inc.' },
    { ticker: 'NVDA', name: 'NVIDIA Corporation' },
    { ticker: 'MSFT', name: 'Microsoft Corporation' },
    { ticker: 'AMZN', name: 'Amazon.com Inc.' },
    { ticker: 'GOOGL', name: 'Alphabet Inc. (Google Class A)' },
    { ticker: 'GOOG', name: 'Alphabet Inc. (Google Class C)' },
    { ticker: 'TSLA', name: 'Tesla Inc.' },
    { ticker: 'META', name: 'Meta Platforms Inc.' },
    { ticker: 'BRK.B', name: 'Berkshire Hathaway Inc.' },
    { ticker: 'DIS', name: 'The Walt Disney Company' },
    { ticker: 'NFLX', name: 'Netflix Inc.' },
    { ticker: 'AMD', name: 'Advanced Micro Devices Inc.' },
    { ticker: 'INTC', name: 'Intel Corporation' },
    { ticker: 'JNJ', name: 'Johnson & Johnson' },
    { ticker: 'PG', name: 'Procter & Gamble Co.' },
    { ticker: 'KO', name: 'The Coca-Cola Company' },
    { ticker: 'PEP', name: 'PepsiCo Inc.' },
    { ticker: 'COST', name: 'Costco Wholesale Corp.' },
    { ticker: 'V', name: 'Visa Inc.' },
    { ticker: 'MA', name: 'Mastercard Inc.' },
    { ticker: 'JPM', name: 'JPMorgan Chase & Co.' },
    { ticker: 'WMT', name: 'Walmart Inc.' },
    { ticker: 'UNH', name: 'UnitedHealth Group Inc.' },
    { ticker: 'HD', name: 'The Home Depot Inc.' },
    { ticker: 'BAC', name: 'Bank of America Corp.' },
    { ticker: 'XOM', name: 'Exxon Mobil Corp.' },
    { ticker: 'CVX', name: 'Chevron Corporation' },
    { ticker: 'PFE', name: 'Pfizer Inc.' },
    { ticker: 'ABBV', name: 'AbbVie Inc.' },
    { ticker: 'MRK', name: 'Merck & Co. Inc.' },
    { ticker: 'TSM', name: 'Taiwan Semiconductor Manufacturing (TSMC)' },
    { ticker: 'AVGO', name: 'Broadcom Inc.' },
    { ticker: 'ORCL', name: 'Oracle Corporation' },
    { ticker: 'CRM', name: 'Salesforce Inc.' },
    { ticker: 'CSCO', name: 'Cisco Systems Inc.' },
    { ticker: 'ACN', name: 'Accenture Plc' },
    { ticker: 'MCD', name: 'McDonald\'s Corporation' },
    { ticker: 'NKE', name: 'Nike Inc.' },
    { ticker: 'ADBE', name: 'Adobe Inc.' },
    { ticker: 'TXN', name: 'Texas Instruments Inc.' },
    { ticker: 'PM', name: 'Philip Morris International' },
    { ticker: 'QCOM', name: 'Qualcomm Inc.' },
    { ticker: 'AMAT', name: 'Applied Materials Inc.' },
    { ticker: 'GE', name: 'General Electric Co.' },
    { ticker: 'IBM', name: 'International Business Machines' },
    { ticker: 'CAT', name: 'Caterpillar Inc.' },
    { ticker: 'HON', name: 'Honeywell International' },
    { ticker: 'LMT', name: 'Lockheed Martin Corp.' },
    { ticker: 'BKNG', name: 'Booking Holdings Inc.' },
    { ticker: 'NOW', name: 'ServiceNow Inc.' },
    { ticker: 'UBER', name: 'Uber Technologies Inc.' },
    { ticker: 'PLTR', name: 'Palantir Technologies Inc.' },
    { ticker: 'COIN', name: 'Coinbase Global Inc.' },
    { ticker: 'HOOD', name: 'Robinhood Markets Inc.' },
    { ticker: 'SNOW', name: 'Snowflake Inc.' },
    { ticker: 'SHOP', name: 'Shopify Inc.' },
    { ticker: 'BABA', name: 'Alibaba Group Holding' },
    { ticker: 'NIO', name: 'NIO Inc.' },
    { ticker: 'ARM', name: 'Arm Holdings plc' },
    { ticker: 'SMCI', name: 'Super Micro Computer Inc.' },
    { ticker: 'PANW', name: 'Palo Alto Networks' },
    { ticker: 'CRWD', name: 'CrowdStrike Holdings' },
    { ticker: 'SOFI', name: 'SoFi Technologies Inc.' },
    { ticker: 'SQ', name: 'Block Inc. (Square)' },
    { ticker: 'PYPL', name: 'PayPal Holdings Inc.' },
    { ticker: 'SPOT', name: 'Spotify Technology S.A.' },
    { ticker: 'RBLX', name: 'Roblox Corporation' },
    { ticker: 'NET', name: 'Cloudflare Inc.' },
  ],
  reits: [
    { ticker: 'O', name: 'Realty Income Corporation' },
    { ticker: 'AMT', name: 'American Tower Corporation' },
    { ticker: 'PLD', name: 'Prologis Inc.' },
    { ticker: 'EQIX', name: 'Equinix Inc.' },
    { ticker: 'CCI', name: 'Crown Castle Inc.' },
    { ticker: 'PSA', name: 'Public Storage' },
    { ticker: 'SPG', name: 'Simon Property Group Inc.' },
    { ticker: 'VICI', name: 'VICI Properties Inc.' },
    { ticker: 'DLR', name: 'Digital Realty Trust Inc.' },
    { ticker: 'WELL', name: 'Welltower Inc.' },
    { ticker: 'AVB', name: 'AvalonBay Communities Inc.' },
    { ticker: 'STAG', name: 'STAG Industrial Inc.' },
    { ticker: 'AGNC', name: 'AGNC Investment Corp.' },
    { ticker: 'NNN', name: 'NNN REIT Inc.' },
    { ticker: 'WPC', name: 'W. P. Carey Inc.' },
    { ticker: 'ADC', name: 'Agree Realty Corporation' },
    { ticker: 'EPR', name: 'EPR Properties' },
    { ticker: 'MAIN', name: 'Main Street Capital Corp' },
    { ticker: 'OHI', name: 'Omega Healthcare Investors' },
    { ticker: 'HR', name: 'Healthcare Realty Trust' },
    { ticker: 'MPW', name: 'Medical Properties Trust' },
    { ticker: 'IIPR', name: 'Innovative Industrial Properties' },
  ],
  etf_exterior: [
    { ticker: 'VOO', name: 'Vanguard S&P 500 ETF' },
    { ticker: 'QQQ', name: 'Invesco QQQ Trust (Nasdaq 100)' },
    { ticker: 'VXUS', name: 'Vanguard Total International Stock ETF' },
    { ticker: 'VT', name: 'Vanguard Total World Stock ETF' },
    { ticker: 'SCHD', name: 'Schwab U.S. Dividend Equity ETF' },
    { ticker: 'VTI', name: 'Vanguard Total Stock Market ETF' },
    { ticker: 'IVV', name: 'iShares Core S&P 500 ETF' },
    { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust' },
    { ticker: 'IWM', name: 'iShares Russell 2000 ETF' },
    { ticker: 'JEPI', name: 'JPMorgan Equity Premium Income ETF' },
    { ticker: 'JEPQ', name: 'JPMorgan Nasdaq Equity Premium Income ETF' },
    { ticker: 'VNQ', name: 'Vanguard Real Estate ETF' },
    { ticker: 'GLD', name: 'SPDR Gold Shares ETF' },
    { ticker: 'VUG', name: 'Vanguard Growth ETF' },
    { ticker: 'VTV', name: 'Vanguard Value ETF' },
    { ticker: 'BND', name: 'Vanguard Total Bond Market ETF' },
    { ticker: 'AGG', name: 'iShares Core U.S. Aggregate Bond ETF' },
    { ticker: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF' },
    { ticker: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF' },
    { ticker: 'IEMG', name: 'iShares Core MSCI Emerging Markets ETF' },
    { ticker: 'VIG', name: 'Vanguard Dividend Appreciation ETF' },
    { ticker: 'VYM', name: 'Vanguard High Dividend Yield ETF' },
    { ticker: 'XLE', name: 'Energy Select Sector SPDR Fund' },
    { ticker: 'XLF', name: 'Financial Select Sector SPDR Fund' },
    { ticker: 'XLK', name: 'Technology Select Sector SPDR Fund' },
    { ticker: 'XLV', name: 'Health Care Select Sector SPDR Fund' },
    { ticker: 'ARKK', name: 'ARK Innovation ETF' },
    { ticker: 'SMH', name: 'VanEck Semiconductor ETF' },
    { ticker: 'SOXX', name: 'iShares Semiconductor ETF' },
  ],
  cripto: [
    { ticker: 'BTC', name: 'Bitcoin (BTC)' },
    { ticker: 'ETH', name: 'Ethereum (ETH)' },
    { ticker: 'SOL', name: 'Solana (SOL)' },
    { ticker: 'BNB', name: 'BNB (Binance Coin)' },
    { ticker: 'XRP', name: 'Ripple (XRP)' },
    { ticker: 'ADA', name: 'Cardano (ADA)' },
    { ticker: 'USDT', name: 'Tether USD (USDT)' },
    { ticker: 'USDC', name: 'USD Coin (USDC)' },
    { ticker: 'AVAX', name: 'Avalanche (AVAX)' },
    { ticker: 'DOGE', name: 'Dogecoin (DOGE)' },
    { ticker: 'DOT', name: 'Polkadot (DOT)' },
    { ticker: 'LINK', name: 'Chainlink (LINK)' },
    { ticker: 'AAVE', name: 'Aave Protocol (AAVE)' },
    { ticker: 'PENDLE', name: 'Pendle Finance (PENDLE)' },
    { ticker: 'VIRTUAL', name: 'Virtuals Protocol (VIRTUAL)' },
    { ticker: 'SHIB', name: 'Shiba Inu (SHIB)' },
    { ticker: 'PEPE', name: 'Pepe Coin (PEPE)' },
    { ticker: 'NEAR', name: 'NEAR Protocol (NEAR)' },
    { ticker: 'FET', name: 'Artificial Superintelligence Alliance (FET)' },
    { ticker: 'SUI', name: 'Sui (SUI)' },
    { ticker: 'APT', name: 'Aptos (APT)' },
    { ticker: 'POL', name: 'Polygon (POL / MATIC)' },
    { ticker: 'MATIC', name: 'Polygon (MATIC)' },
    { ticker: 'LTC', name: 'Litecoin (LTC)' },
    { ticker: 'BCH', name: 'Bitcoin Cash (BCH)' },
    { ticker: 'XLM', name: 'Stellar Lumens (XLM)' },
    { ticker: 'UNI', name: 'Uniswap (UNI)' },
    { ticker: 'ATOM', name: 'Cosmos (ATOM)' },
    { ticker: 'ETC', name: 'Ethereum Classic (ETC)' },
    { ticker: 'XMR', name: 'Monero (XMR)' },
    { ticker: 'ICP', name: 'Internet Computer (ICP)' },
    { ticker: 'RENDER', name: 'Render Token (RENDER)' },
    { ticker: 'INJ', name: 'Injective (INJ)' },
    { ticker: 'STX', name: 'Stacks (STX)' },
    { ticker: 'TIA', name: 'Celestia (TIA)' },
    { ticker: 'KAS', name: 'Kaspa (KAS)' },
    { ticker: 'TRX', name: 'TRON (TRX)' },
    { ticker: 'LDO', name: 'Lido DAO (LDO)' },
    { ticker: 'HBAR', name: 'Hedera Hashgraph (HBAR)' },
    { ticker: 'ARB', name: 'Arbitrum (ARB)' },
    { ticker: 'OP', name: 'Optimism (OP)' },
    { ticker: 'FIL', name: 'Filecoin (FIL)' },
    { ticker: 'SEI', name: 'Sei Network (SEI)' },
    { ticker: 'WIF', name: 'dogwifhat (WIF)' },
    { ticker: 'FLOKI', name: 'Floki Inu (FLOKI)' },
    { ticker: 'BONK', name: 'Bonk (BONK)' },
    { ticker: 'JASMY', name: 'JasmyCoin (JASMY)' },
    { ticker: 'RUNE', name: 'THORChain (RUNE)' },
    { ticker: 'AR', name: 'Arweave (AR)' },
    { ticker: 'PYTH', name: 'Pyth Network (PYTH)' },
    { ticker: 'JUP', name: 'Jupiter (JUP)' },
    { ticker: 'TAO', name: 'Bittensor (TAO)' },
    { ticker: 'ENA', name: 'Ethena (ENA)' },
    { ticker: 'TON', name: 'Toncoin (TON)' },
    { ticker: 'ALGO', name: 'Algorand (ALGO)' },
    { ticker: 'QNT', name: 'Quant (QNT)' },
    { ticker: 'VET', name: 'VeChain (VET)' },
    { ticker: 'MANA', name: 'Decentraland (MANA)' },
    { ticker: 'SAND', name: 'The Sandbox (SAND)' },
    { ticker: 'AXS', name: 'Axie Infinity (AXS)' },
    { ticker: 'CHZ', name: 'Chiliz (CHZ)' },
    { ticker: 'GALA', name: 'Gala Games (GALA)' },
    { ticker: 'GRT', name: 'The Graph (GRT)' },
    { ticker: 'FTM', name: 'Fantom (FTM)' },
    { ticker: 'THETA', name: 'Theta Network (THETA)' },
    { ticker: 'EOS', name: 'EOS Network (EOS)' },
    { ticker: 'XTZ', name: 'Tezos (XTZ)' },
    { ticker: 'WLD', name: 'Worldcoin (WLD)' },
    { ticker: 'IMX', name: 'Immutable (IMX)' },
    { ticker: 'GMX', name: 'GMX Protocol (GMX)' },
    { ticker: 'DYDX', name: 'dYdX (DYDX)' },
    { ticker: 'SNX', name: 'Synthetix (SNX)' },
    { ticker: 'CRV', name: 'Curve DAO (CRV)' },
    { ticker: 'COMP', name: 'Compound (COMP)' },
    { ticker: 'MKR', name: 'Maker (MKR)' },
    { ticker: 'ONDO', name: 'Ondo Finance (ONDO)' },
    { ticker: 'OM', name: 'MANTRA (OM)' },
    { ticker: 'POPCAT', name: 'Popcat (POPCAT)' },
    { ticker: 'NEIRO', name: 'First Neiro on Ethereum (NEIRO)' },
  ],
  fip: [
    { ticker: 'FIP IE', name: 'Fundo de Investimento em Participações Infraestrutura' },
    { ticker: 'FIP MULTIESTRATÉGIA', name: 'Fundo de Investimento em Participações Patria' },
    { ticker: 'FIP VINCI CAPITAL', name: 'Fundo de Investimento em Participações Vinci' },
    { ticker: 'FIP KINEA INFRA', name: 'FIP Kinea Infraestrutura' },
    { ticker: 'FIP SPECTRA', name: 'FIP Spectra Private Equity' },
  ],
  fia: [
    { ticker: 'TRIGONO FLAGSHIP FIA', name: 'Trígono Flagship Small Caps FIA' },
    { ticker: 'DYNAMO COUGAR FIA', name: 'Dynamo Cougar Fundo de Investimento em Ações' },
    { ticker: 'BREADTH FIA', name: 'Breadth Fundo de Investimento em Ações' },
    { ticker: 'ATMOS FIC FIA', name: 'Atmos Fundo de Ações FIA' },
    { ticker: 'BOGARI VALUE FIA', name: 'Bogari Value FIA' },
  ],
  fi_infra: [
    { ticker: 'JUCR11', name: 'JPP Infraestrutura FI-Infra' },
    { ticker: 'BDIF11', name: 'BTG Pactual Debêntures Incentivadas FI-Infra' },
    { ticker: 'CDII11', name: 'Sparta Infraestrutura FI-Infra' },
    { ticker: 'IFRA11', name: 'Itaú Infraestrutura FI-Infra' },
    { ticker: 'KINF11', name: 'Kinea Infraestrutura FI-Infra' },
    { ticker: 'CPTI11', name: 'Capitânia Infraestrutura FI-Infra' },
  ],
  fidc: [
    { ticker: 'FIDC CREDIT SUISSE', name: 'FIDC Credit Suisse Crédito' },
    { ticker: 'FIDC VALORA MULTISETORIAL', name: 'FIDC Valora Multisetorial' },
    { ticker: 'FIDC SPARTA CRÉDITO', name: 'FIDC Sparta Direitos Creditórios' },
    { ticker: 'FIDC BTG CORPORATE', name: 'FIDC BTG Pactual Corporate' },
    { ticker: 'FIDC ITAÚ CRÉDITO', name: 'FIDC Itaú Direitos Creditórios' },
  ],
};

const ptBrToIso = (text: string): string | null => {
  const digits = text.replace(/\D/g, '');
  if (digits.length === 8) {
    const day = parseInt(digits.slice(0, 2), 10);
    const month = parseInt(digits.slice(2, 4), 10);
    const year = parseInt(digits.slice(4, 8), 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return null;
};

const isoToPtBr = (iso: string): string => {
  if (!iso || !iso.includes('-')) return iso;
  const [y, m, d] = iso.split('-');
  if (y && m && d) {
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return iso;
};

export const AddAssetModal: React.FC<AddAssetModalProps> = ({
  isOpen,
  onClose,
  onSaveTransaction,
  userId = 'default',
  editingTransaction = null,
}) => {
  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [assetCategory, setAssetCategory] = useState<AssetCategory>('acoes');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  const [assetTicker, setAssetTicker] = useState('');
  const [tickerSearch, setTickerSearch] = useState('');
  const [isTickerOpen, setIsTickerOpen] = useState(false);

  const [quantity, setQuantity] = useState<string>('0');
  const [unitPrice, setUnitPrice] = useState<string>('0,00');

  const [broker, setBroker] = useState<string>('RICO INVESTIMENTOS');
  const [brokerSearch, setBrokerSearch] = useState('RICO INVESTIMENTOS');
  const [isBrokerOpen, setIsBrokerOpen] = useState(false);

  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [dateText, setDateText] = useState<string>(() => isoToPtBr(new Date().toISOString().split('T')[0]));
  const [notes, setNotes] = useState('');
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [autoQuoteFetched, setAutoQuoteFetched] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const datePickerRef = useRef<HTMLInputElement>(null);
  const categoryContainerRef = useRef<HTMLDivElement>(null);
  const tickerContainerRef = useRef<HTMLDivElement>(null);
  const brokerContainerRef = useRef<HTMLDivElement>(null);

  // Synchronize state when modal opens or editingTransaction changes
  useEffect(() => {
    if (isOpen) {
      if (editingTransaction) {
        setType(editingTransaction.type || 'buy');
        setAssetCategory(editingTransaction.assetCategory || 'acoes');
        setAssetTicker(editingTransaction.assetTicker || '');
        setTickerSearch(editingTransaction.assetTicker || '');
        setQuantity(formatNumberToPtBr(editingTransaction.quantity));
        setUnitPrice(formatNumberToPtBr(editingTransaction.unitPrice));
        setBroker(editingTransaction.broker || 'RICO INVESTIMENTOS');
        setBrokerSearch(editingTransaction.broker || 'RICO INVESTIMENTOS');
        setDate(editingTransaction.date || new Date().toISOString().split('T')[0]);
        setDateText(isoToPtBr(editingTransaction.date || new Date().toISOString().split('T')[0]));
        setNotes(editingTransaction.notes || '');
        setAutoQuoteFetched(null);
      } else {
        setType('buy');
        setAssetCategory('acoes');
        setAssetTicker('');
        setTickerSearch('');
        setQuantity('0');
        setUnitPrice('0,00');
        setBroker('RICO INVESTIMENTOS');
        setBrokerSearch('RICO INVESTIMENTOS');
        setDate(new Date().toISOString().split('T')[0]);
        setDateText(isoToPtBr(new Date().toISOString().split('T')[0]));
        setNotes('');
        setAutoQuoteFetched(null);
      }
      setSuccessMessage(null);
    }
  }, [isOpen, editingTransaction]);

  // Computed total
  const totalAmount = useMemo(() => {
    const q = parsePtBrNumber(quantity) || 0;
    const p = parsePtBrNumber(unitPrice) || 0;
    return q * p;
  }, [quantity, unitPrice]);

  const currencySymbol = useMemo(() => {
    return assetCategory === 'stocks' || assetCategory === 'etf_exterior' || assetCategory === 'reits'
      ? 'US$'
      : 'R$';
  }, [assetCategory]);

  // Handle click outside dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryContainerRef.current && !categoryContainerRef.current.contains(event.target as Node)) {
        setIsCategoryOpen(false);
      }
      if (tickerContainerRef.current && !tickerContainerRef.current.contains(event.target as Node)) {
        setIsTickerOpen(false);
      }
      if (brokerContainerRef.current && !brokerContainerRef.current.contains(event.target as Node)) {
        setIsBrokerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered Tickers list: Searches selected category first, then cross-searches all categories
  const filteredTickers = useMemo(() => {
    const q = tickerSearch.toLowerCase().trim();
    const currentList = TICKERS_BY_CATEGORY[assetCategory] || [];

    if (!q) {
      return currentList.map((item) => ({ ...item, category: assetCategory }));
    }

    const matchCurrent = currentList
      .filter((item) => item.ticker.toLowerCase().includes(q) || item.name.toLowerCase().includes(q))
      .map((item) => ({ ...item, category: assetCategory }));

    const matchCurrentTickers = new Set(matchCurrent.map((i) => i.ticker.toUpperCase()));

    const matchOther: { ticker: string; name: string; category: AssetCategory }[] = [];
    (Object.keys(TICKERS_BY_CATEGORY) as AssetCategory[]).forEach((cat) => {
      if (cat === assetCategory) return;
      const list = TICKERS_BY_CATEGORY[cat] || [];
      list.forEach((item) => {
        if (
          !matchCurrentTickers.has(item.ticker.toUpperCase()) &&
          (item.ticker.toLowerCase().includes(q) || item.name.toLowerCase().includes(q))
        ) {
          matchOther.push({ ...item, category: cat });
        }
      });
    });

    return [...matchCurrent, ...matchOther];
  }, [assetCategory, tickerSearch]);

  // Filtered Brokers list
  const filteredBrokers = useMemo(() => {
    if (!brokerSearch.trim()) return ALL_BROKERS;
    const q = brokerSearch.toLowerCase().trim();
    return ALL_BROKERS.filter((b) => b.toLowerCase().includes(q));
  }, [brokerSearch]);

  const handleDateTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const digitsOnly = rawVal.replace(/\D/g, '').slice(0, 8);
    let formatted = digitsOnly;
    if (digitsOnly.length > 2 && digitsOnly.length <= 4) {
      formatted = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}`;
    } else if (digitsOnly.length > 4) {
      formatted = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4)}`;
    }

    setDateText(formatted);

    const parsedIso = ptBrToIso(formatted);
    if (parsedIso) {
      setDate(parsedIso);
    }
  };

  const handleNativeDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIso = e.target.value;
    if (newIso) {
      setDate(newIso);
      setDateText(isoToPtBr(newIso));
    }
  };

  const openDatePicker = () => {
    const el = datePickerRef.current;
    if (el) {
      if (typeof (el as any).showPicker === 'function') {
        try {
          (el as any).showPicker();
        } catch {
          el.focus();
          el.click();
        }
      } else {
        el.focus();
        el.click();
      }
    }
  };

  // Auto-fetch historical quote on date or ticker change
  useEffect(() => {
    const currentTicker = assetTicker || tickerSearch;
    if (!currentTicker || currentTicker.trim().length < 2 || !date) return;

    // Avoid overwriting saved price when editing if ticker and date haven't changed from saved transaction
    if (
      editingTransaction &&
      editingTransaction.assetTicker.toUpperCase() === currentTicker.trim().toUpperCase() &&
      editingTransaction.date === date
    ) {
      return;
    }

    let isMounted = true;
    setIsFetchingQuote(true);

    const timer = setTimeout(async () => {
      try {
        const quote = await PortfolioStorageService.getHistoricalQuote(currentTicker, date);
        if (isMounted && quote !== null) {
          const formattedQuote = formatNumberToPtBr(quote);
          setUnitPrice(formattedQuote);
          setAutoQuoteFetched(`${currencySymbol} ${formattedQuote} (${date.split('-').reverse().join('/')})`);
        }
      } catch {
        // Fallback
      } finally {
        if (isMounted) setIsFetchingQuote(false);
      }
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [assetTicker, tickerSearch, date, currencySymbol, editingTransaction]);

  const resetForm = () => {
    setAssetTicker('');
    setTickerSearch('');
    setQuantity('0');
    setUnitPrice('0,00');
    setNotes('');
    setAutoQuoteFetched(null);
  };

  const handleSave = (keepOpen: boolean): boolean => {
    const finalTicker = (assetTicker || tickerSearch).trim().toUpperCase();
    if (!finalTicker || !quantity || !unitPrice) {
      alert('Por favor, preencha o código do ativo, quantidade e preço unitário.');
      return false;
    }

    const parsedDate = ptBrToIso(dateText) || date;
    if (!parsedDate || !/^\d{4}-\d{2}-\d{2}$/.test(parsedDate)) {
      alert('Por favor, informe uma data válida no formato DD/MM/AAAA.');
      return false;
    }

    const qty = parsePtBrNumber(quantity);
    const price = parsePtBrNumber(unitPrice);

    if (isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
      alert('Quantidade e preço devem ser números válidos maiores que zero.');
      return false;
    }

    const finalBroker = (broker || brokerSearch || 'RICO INVESTIMENTOS').trim().toUpperCase();

    const payload = {
      ...(editingTransaction ? { id: editingTransaction.id, createdAt: editingTransaction.createdAt } : {}),
      userId,
      assetTicker: finalTicker,
      assetCategory,
      type,
      quantity: qty,
      unitPrice: price,
      totalAmount: qty * price,
      broker: finalBroker,
      date: parsedDate,
      notes: notes.trim() || undefined,
    };

    onSaveTransaction(payload as any);

    if (keepOpen) {
      resetForm();
      setSuccessMessage(`Lançamento de ${finalTicker} salvo com sucesso!`);
      setTimeout(() => setSuccessMessage(null), 3500);
    } else {
      onClose();
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave(false);
  };

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-[#18181B] text-white border-2 border-[#00C853]/60 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header matching StatusInvest modal */}
        <div className="bg-[#00A859] p-4 text-white flex items-center justify-between shadow-md">
          <h2 className="text-base sm:text-lg font-extrabold tracking-wide">
            {editingTransaction ? 'Editar Transação' : 'Adicionar Transação'}
          </h2>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="p-1 rounded-lg hover:bg-black/20 text-white transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-sm bg-[#18181B]">
          <p className="text-xs text-gray-300 font-medium">
            Preencha os dados, navegue pelas categorias e adicione ativos
          </p>

          {/* Operation Type: Compra / Venda */}
          <div className="bg-[#121212] p-1 rounded-xl grid grid-cols-2 gap-1 border border-white/10">
            <button
              type="button"
              onClick={() => setType('buy')}
              className={`py-2.5 rounded-lg font-extrabold text-xs transition cursor-pointer ${
                type === 'buy'
                  ? 'bg-[#18181B] text-white border-2 border-[#00C853] shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Compra
            </button>
            <button
              type="button"
              onClick={() => setType('sell')}
              className={`py-2.5 rounded-lg font-extrabold text-xs transition cursor-pointer ${
                type === 'sell'
                  ? 'bg-[#18181B] text-white border-2 border-[#00C853] shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Venda
            </button>
          </div>

          {/* Category Dropdown (Images 1 & 2) */}
          <div ref={categoryContainerRef} className="relative">
            <label className="block text-xs font-bold text-gray-300 mb-1">
              Categoria <span className="text-[#00E676]">*</span>
            </label>
            <button
              type="button"
              onClick={() => setIsCategoryOpen(!isCategoryOpen)}
              className="w-full bg-[#121212] border border-white/20 rounded-xl px-3.5 py-3 text-sm font-semibold text-white flex items-center justify-between hover:border-[#00C853] focus:outline-none transition cursor-pointer"
            >
              <span>{CATEGORY_LABELS[assetCategory] || 'Selecione'}</span>
              {isCategoryOpen ? (
                <ChevronUp className="w-4 h-4 text-[#00E676]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {/* Scrollable Categories Overlay (Images 1 & 2) */}
            {isCategoryOpen && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-[#121212] border-2 border-[#00C853]/80 rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-white/5 animate-in fade-in duration-150">
                {(Object.keys(CATEGORY_LABELS) as AssetCategory[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setAssetCategory(cat);
                      setAssetTicker('');
                      setTickerSearch('');
                      setIsCategoryOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 text-xs sm:text-sm font-medium transition flex items-center justify-between cursor-pointer ${
                      assetCategory === cat
                        ? 'bg-[#00C853]/20 text-[#00E676] font-bold'
                        : 'text-gray-200 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span>{CATEGORY_LABELS[cat]}</span>
                    {assetCategory === cat && <Check className="w-4 h-4 text-[#00E676]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ticker Search Autocomplete (Image 3) */}
          <div ref={tickerContainerRef} className="relative">
            <label className="block text-xs font-bold text-gray-300 mb-1">
              Nome ou código do ativo <span className="text-[#00E676]">*</span>
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              <input
                type="text"
                value={tickerSearch}
                onChange={(e) => {
                  setTickerSearch(e.target.value.toUpperCase());
                  setAssetTicker(e.target.value.toUpperCase());
                  setIsTickerOpen(true);
                }}
                onFocus={() => setIsTickerOpen(true)}
                placeholder={`Ex: Bova, PETR4, MXRF11...`}
                className="w-full bg-[#121212] border border-white/20 rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-bold text-white placeholder-gray-500 focus:outline-none focus:border-[#00C853]"
              />
            </div>

            {/* Tickers Autocomplete List */}
            {isTickerOpen && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#121212] border-2 border-[#00C853]/80 rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-white/5">
                {filteredTickers.slice(0, 40).map((item) => (
                  <div
                    key={`${item.category}-${item.ticker}`}
                    onClick={() => {
                      setAssetTicker(item.ticker);
                      setTickerSearch(item.ticker);
                      if (item.category && item.category !== assetCategory) {
                        setAssetCategory(item.category);
                      }
                      setIsTickerOpen(false);
                    }}
                    className="p-3 hover:bg-[#00C853]/20 hover:text-[#00E676] cursor-pointer transition text-xs sm:text-sm font-bold text-gray-200 flex items-center justify-between"
                  >
                    <span>{item.ticker} - {item.name}</span>
                    <span className="text-[10px] text-gray-400 uppercase bg-white/5 px-2 py-0.5 rounded ml-2 shrink-0">
                      {CATEGORY_LABELS[item.category || assetCategory]}
                    </span>
                  </div>
                ))}
                {tickerSearch.trim().length > 0 &&
                  !filteredTickers.some((i) => i.ticker.toUpperCase() === tickerSearch.trim().toUpperCase()) && (
                    <div
                      onClick={() => {
                        const clean = tickerSearch.trim().toUpperCase();
                        setAssetTicker(clean);
                        setTickerSearch(clean);
                        setIsTickerOpen(false);
                      }}
                      className="p-3 bg-[#00C853]/10 hover:bg-[#00C853]/25 cursor-pointer transition text-xs sm:text-sm font-bold text-[#00E676] flex items-center justify-between"
                    >
                      <span>Usar "{tickerSearch.trim().toUpperCase()}" (Novo ativo personalizado)</span>
                      <span className="text-[10px] bg-[#00C853]/30 text-[#00E676] px-2 py-0.5 rounded font-extrabold ml-2 shrink-0">
                        Cadastrar
                      </span>
                    </div>
                  )}
              </div>
            )}
          </div>

          {/* Date, Price, Quantity Grid */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                Data da operação <span className="text-[#00E676]">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={dateText}
                  onChange={handleDateTextChange}
                  placeholder="dd/mm/aaaa"
                  maxLength={10}
                  required
                  className="w-full bg-[#121212] border border-white/20 rounded-xl pl-3.5 pr-11 py-2.5 text-sm font-bold text-white placeholder-gray-500 focus:outline-none focus:border-[#00C853]"
                />
                <button
                  type="button"
                  onClick={openDatePicker}
                  className="absolute right-1.5 p-1.5 bg-white/10 hover:bg-[#00C853] text-gray-300 hover:text-[#121212] rounded-lg transition cursor-pointer"
                  title="Abrir calendário"
                >
                  <Calendar className="w-4 h-4" />
                </button>
                <input
                  ref={datePickerRef}
                  type="date"
                  value={date}
                  onChange={handleNativeDateChange}
                  className="sr-only absolute pointer-events-none opacity-0"
                  tabIndex={-1}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-gray-300">
                    Preço <span className="text-[#00E676]">*</span>
                  </label>
                  {isFetchingQuote && (
                    <span className="text-[10px] text-[#00E676] font-bold flex items-center gap-1 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Buscando...
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-400">
                    {currencySymbol}
                  </span>
                  <input
                    type="text"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    onBlur={() => {
                      if (unitPrice.trim()) {
                        setUnitPrice(formatNumberToPtBr(unitPrice));
                      }
                    }}
                    placeholder="0,00"
                    required
                    className="w-full bg-[#121212] border border-white/20 rounded-xl pl-9 pr-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-[#00C853]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  Quantidade <span className="text-[#00E676]">*</span>
                </label>
                <input
                  type="text"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  onBlur={() => {
                    if (quantity.trim()) {
                      setQuantity(formatNumberToPtBr(quantity));
                    }
                  }}
                  placeholder="0"
                  required
                  className="w-full bg-[#121212] border border-white/20 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-[#00C853]"
                />
              </div>
            </div>

            {/* Total Value Display (Image 4) */}
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">Valor total</label>
              <div className="w-full bg-[#121212] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-extrabold text-gray-300">
                {currencySymbol} {formatNumberToPtBr(totalAmount)}
              </div>
            </div>
          </div>

          {/* Institution / Broker Autocomplete (Image 4) */}
          <div ref={brokerContainerRef} className="relative">
            <label className="block text-xs font-bold text-gray-300 mb-1">
              Instituição <span className="text-[#00E676]">*</span>
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              <input
                type="text"
                value={brokerSearch}
                onChange={(e) => {
                  setBrokerSearch(e.target.value);
                  setBroker(e.target.value);
                  setIsBrokerOpen(true);
                }}
                onFocus={() => setIsBrokerOpen(true)}
                placeholder="Ex: Rico, XP, BTG, Credit Agricole..."
                className="w-full bg-[#121212] border border-white/20 rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-bold text-white placeholder-gray-500 focus:outline-none focus:border-[#00C853]"
              />
            </div>

            {/* Brokers Autocomplete Overlay (Image 4) */}
            {isBrokerOpen && brokerSearch.trim().length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#121212] border-2 border-[#00C853]/80 rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-white/5">
                {filteredBrokers.map((bName) => (
                  <div
                    key={bName}
                    onClick={() => {
                      setBroker(bName);
                      setBrokerSearch(bName);
                      setIsBrokerOpen(false);
                    }}
                    className="p-3 hover:bg-[#00C853]/20 hover:text-[#00E676] cursor-pointer transition text-xs sm:text-sm font-bold text-gray-200"
                  >
                    {bName}
                  </div>
                ))}
                {!filteredBrokers.some((b) => b.toUpperCase() === brokerSearch.trim().toUpperCase()) && (
                  <div
                    onClick={() => {
                      const cleanB = brokerSearch.trim().toUpperCase();
                      setBroker(cleanB);
                      setBrokerSearch(cleanB);
                      setIsBrokerOpen(false);
                    }}
                    className="p-3 bg-[#00C853]/10 hover:bg-[#00C853]/25 cursor-pointer transition text-xs sm:text-sm font-bold text-[#00E676] flex items-center justify-between"
                  >
                    <span>Usar "{brokerSearch.trim().toUpperCase()}" (Outra instituição)</span>
                    <span className="text-[10px] bg-[#00C853]/30 text-[#00E676] px-2 py-0.5 rounded font-extrabold">
                      Confirmar
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1">Observações (Opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Aporte mensal recorrente"
              className="w-full bg-[#121212] border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00C853]"
            />
          </div>

          {autoQuoteFetched && !isFetchingQuote && (
            <p className="text-[11px] text-[#00E676] font-bold flex items-center gap-1 bg-[#00C853]/10 p-2 rounded-lg border border-[#00C853]/30">
              <Sparkles className="w-3.5 h-3.5 text-[#00E676]" />
              Cotação histórica obtida: {autoQuoteFetched}
            </p>
          )}

          {successMessage && (
            <div className="p-3 bg-[#00C853]/20 border border-[#00C853] text-[#00E676] rounded-xl text-xs font-bold flex items-center justify-between animate-in fade-in">
              <span>{successMessage}</span>
            </div>
          )}

          {/* Submit Action Buttons matching Image 4 */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-white/10 flex-wrap">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="px-4 py-2.5 rounded-xl border border-white/20 text-xs font-bold text-gray-300 hover:bg-white/10 transition cursor-pointer"
            >
              Voltar
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 bg-[#00A859] hover:bg-[#00C853] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg transition cursor-pointer flex items-center gap-1.5"
            >
              <span>Salvar</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSave(true);
              }}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg transition cursor-pointer flex items-center gap-1.5 border border-emerald-400/30"
              title="Salvar esta transação e continuar adicionando outra"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Transação</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
