 9. TABELAS DE PORTFÓLIO E INVESTIMENTOS
CREATE TABLE IF NOT EXISTS portfolio_assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  average_price NUMERIC NOT NULL,
  current_price NUMERIC,
  currency TEXT,
  return_pct NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_ticker TEXT NOT NULL,
  asset_category TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  broker TEXT,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_dividends (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_ticker TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'BRL',
  payment_date DATE NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  target_amount NUMERIC NOT NULL,
  target_date DATE NOT NULL,
  start_date DATE NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================
-- DINHEIRO SEM FILTRO - SCRIPT COMPLETO DE BANCO DE DADOS
-- Cole este código no SQL Editor do seu projeto no Supabase
-- 9. TABELAS DE PORTFÓLIO E INVESTIMENTOS
CREATE TABLE IF NOT EXISTS portfolio_assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  average_price NUMERIC NOT NULL,
  current_price NUMERIC,
  currency TEXT,
  return_pct NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_ticker TEXT NOT NULL,
  asset_category TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  broker TEXT,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_dividends (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_ticker TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'BRL',
  payment_date DATE NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  target_amount NUMERIC NOT NULL,
  target_date DATE NOT NULL,
  start_date DATE NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================

-- 1. TABELA DE USUÁRIOS (users)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  budget_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA DE CONTAS FINANCEIRAS (accounts)
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'checking' | 'credit' | 'cash' | 'savings' | 'other'
  initial_balance NUMERIC DEFAULT 0,
  color TEXT,
  icon TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA DE CATEGORIAS & SUBCATEGORIAS (categories)
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'income' | 'expense'
  color TEXT,
  icon TEXT,
  subcategories JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA DE MEMBROS DA FAMÍLIA (family_members)
CREATE TABLE IF NOT EXISTS family_members (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  relationship TEXT,
  color TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABELA DE LANÇAMENTOS / TRANSAÇÕES (transactions)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  target_account_id TEXT, -- Para transferências entre contas
  type TEXT NOT NULL, -- 'income' | 'expense' | 'transfer'
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  category_id TEXT NOT NULL,
  subcategory_id TEXT,
  family_member_id TEXT,
  family_member_name TEXT,
  is_consolidated BOOLEAN DEFAULT TRUE,
  installment_index INT,
  installment_total INT,
  parent_installment_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABELA DE METAS FINANCEIRAS (goals)
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  target_amount NUMERIC NOT NULL,
  current_amount NUMERIC DEFAULT 0,
  target_date DATE,
  category TEXT,
  color TEXT,
  icon TEXT,
  notes TEXT,
  yield_rate NUMERIC DEFAULT 0, -- Rentabilidade simulada (% a.m. ou a.a.)
  yield_period TEXT DEFAULT 'monthly', -- 'monthly' | 'yearly'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABELA DE ORÇAMENTOS COMPARTILHADOS (shared_budgets)
CREATE TABLE IF NOT EXISTS shared_budgets (
  budget_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  collaborators JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABELA DE SOLICITAÇÕES / CONVITES DE COMPARTILHAMENTO (budget_shares)
CREATE TABLE IF NOT EXISTS budget_shares (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  shared_with_email TEXT NOT NULL,
  permission TEXT DEFAULT 'edit',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. TABELAS DE PORTFÓLIO E INVESTIMENTOS
CREATE TABLE IF NOT EXISTS portfolio_assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  average_price NUMERIC NOT NULL,
  current_price NUMERIC,
  currency TEXT,
  return_pct NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_ticker TEXT NOT NULL,
  asset_category TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  broker TEXT,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_dividends (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_ticker TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'BRL',
  payment_date DATE NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  target_amount NUMERIC NOT NULL,
  target_date DATE NOT NULL,
  start_date DATE NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================
-- ROW LEVEL SECURITY (RLS) - SEGURANÇA E POLÍTICAS DE ACESSO
-- 9. TABELAS DE PORTFÓLIO E INVESTIMENTOS
CREATE TABLE IF NOT EXISTS portfolio_assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  average_price NUMERIC NOT NULL,
  current_price NUMERIC,
  currency TEXT,
  return_pct NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_ticker TEXT NOT NULL,
  asset_category TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  broker TEXT,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_dividends (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_ticker TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'BRL',
  payment_date DATE NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  target_amount NUMERIC NOT NULL,
  target_date DATE NOT NULL,
  start_date DATE NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================

-- Habilitando RLS em todas as tabelas para proteção contra vulnerabilidades
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_dividends ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_goals ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS DE RLS PARA APLICAÇÃO (Permite operações com a Chave Anônima / Pública)
DROP POLICY IF EXISTS "Acesso à tabela users" ON users;
CREATE POLICY "Acesso à tabela users" ON users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso à tabela accounts" ON accounts;
CREATE POLICY "Acesso à tabela accounts" ON accounts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso à tabela categories" ON categories;
CREATE POLICY "Acesso à tabela categories" ON categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso à tabela family_members" ON family_members;
CREATE POLICY "Acesso à tabela family_members" ON family_members FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso à tabela transactions" ON transactions;
CREATE POLICY "Acesso à tabela transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso à tabela goals" ON goals;
CREATE POLICY "Acesso à tabela goals" ON goals FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso à tabela shared_budgets" ON shared_budgets;
CREATE POLICY "Acesso à tabela shared_budgets" ON shared_budgets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso à tabela budget_shares" ON budget_shares;
CREATE POLICY "Acesso à tabela budget_shares" ON budget_shares FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Acesso à tabela portfolio_assets" ON portfolio_assets;
CREATE POLICY "Acesso à tabela portfolio_assets" ON portfolio_assets FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Acesso à tabela portfolio_transactions" ON portfolio_transactions;
CREATE POLICY "Acesso à tabela portfolio_transactions" ON portfolio_transactions FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Acesso à tabela portfolio_dividends" ON portfolio_dividends;
CREATE POLICY "Acesso à tabela portfolio_dividends" ON portfolio_dividends FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Acesso à tabela portfolio_goals" ON portfolio_goals;
CREATE POLICY "Acesso à tabela portfolio_goals" ON portfolio_goals FOR ALL USING (true) WITH CHECK (true);

-- NOTA DE SEGURANÇA:
-- Se utilizar o Supabase Auth Nativo (auth.uid()), substitua "USING (true)" por:
-- "USING (auth.uid()::text = user_id)" para isolar totalmente os dados de cada usuário.

-- 9. TABELAS DE PORTFÓLIO E INVESTIMENTOS
CREATE TABLE IF NOT EXISTS portfolio_assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  average_price NUMERIC NOT NULL,
  current_price NUMERIC,
  currency TEXT,
  return_pct NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_ticker TEXT NOT NULL,
  asset_category TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  broker TEXT,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_dividends (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_ticker TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'BRL',
  payment_date DATE NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  target_amount NUMERIC NOT NULL,
  target_date DATE NOT NULL,
  start_date DATE NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================
-- ÍNDICES DE DESEMPENHO E CONSULTA
-- 9. TABELAS DE PORTFÓLIO E INVESTIMENTOS
CREATE TABLE IF NOT EXISTS portfolio_assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  average_price NUMERIC NOT NULL,
  current_price NUMERIC,
  currency TEXT,
  return_pct NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_ticker TEXT NOT NULL,
  asset_category TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  broker TEXT,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_dividends (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_ticker TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'BRL',
  payment_date DATE NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  target_amount NUMERIC NOT NULL,
  target_date DATE NOT NULL,
  start_date DATE NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_assets_user ON portfolio_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_transactions_user ON portfolio_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_dividends_user ON portfolio_dividends(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_goals_user ON portfolio_goals(user_id);
