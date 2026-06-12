create table if not exists public.user_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id text not null,
  source text not null default 'mesa',
  receivable_app_id text,
  table_app_id text,
  tab_app_id text,
  tab_name text,
  delivery_app_id text,
  customer_app_id numeric,
  customer_name text,
  method text not null,
  amount numeric(12,2) not null default 0,
  gross_amount numeric(12,2) not null default 0,
  net_amount numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  service_charge numeric(12,2) not null default 0,
  received_amount numeric(12,2) not null default 0,
  change_amount numeric(12,2) not null default 0,
  time_label text,
  paid_at_label text,
  paid_at_iso date,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, app_id)
);

create table if not exists public.user_accounts_receivable (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id text not null,
  code text,
  customer_app_id numeric not null,
  customer_name text not null,
  description text not null,
  amount numeric(12,2) not null default 0,
  gross_amount numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  service_charge numeric(12,2) not null default 0,
  status text not null default 'aberto',
  created_at_label text,
  created_at_iso date,
  due_date_label text,
  time_label text,
  paid_at_label text,
  paid_at_iso date,
  paid_time_label text,
  paid_method text,
  payment_app_id text,
  table_app_id text,
  tab_app_id text,
  delivery_app_id text,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, app_id)
);

create table if not exists public.user_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id numeric not null,
  description text not null,
  category text not null,
  amount numeric(12,2) not null default 0,
  status text not null default 'pendente',
  time_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, app_id)
);

create table if not exists public.user_cash_closings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id numeric not null,
  code text,
  expected_total numeric(12,2) not null default 0,
  counted_total numeric(12,2) not null default 0,
  difference numeric(12,2) not null default 0,
  notes text,
  payments_count numeric not null default 0,
  created_at_label text,
  created_at_iso date,
  time_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, app_id)
);

create table if not exists public.user_cash_closing_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  closing_app_id numeric not null,
  method text not null,
  label text not null,
  expected numeric(12,2) not null default 0,
  counted numeric(12,2) not null default 0,
  difference numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, closing_app_id, method)
);

create index if not exists idx_user_payments_user_id on public.user_payments(user_id);
create index if not exists idx_user_payments_paid_at_iso on public.user_payments(paid_at_iso);
create index if not exists idx_user_receivables_user_id on public.user_accounts_receivable(user_id);
create index if not exists idx_user_receivables_status on public.user_accounts_receivable(status);
create index if not exists idx_user_expenses_user_id on public.user_expenses(user_id);
create index if not exists idx_user_cash_closings_user_id on public.user_cash_closings(user_id);
create index if not exists idx_user_cash_closing_methods_user_id on public.user_cash_closing_methods(user_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_user_payments_updated_at on public.user_payments;
create trigger set_user_payments_updated_at
before update on public.user_payments
for each row execute function public.set_updated_at();

drop trigger if exists set_user_accounts_receivable_updated_at on public.user_accounts_receivable;
create trigger set_user_accounts_receivable_updated_at
before update on public.user_accounts_receivable
for each row execute function public.set_updated_at();

drop trigger if exists set_user_expenses_updated_at on public.user_expenses;
create trigger set_user_expenses_updated_at
before update on public.user_expenses
for each row execute function public.set_updated_at();

drop trigger if exists set_user_cash_closings_updated_at on public.user_cash_closings;
create trigger set_user_cash_closings_updated_at
before update on public.user_cash_closings
for each row execute function public.set_updated_at();

alter table public.user_payments enable row level security;
alter table public.user_accounts_receivable enable row level security;
alter table public.user_expenses enable row level security;
alter table public.user_cash_closings enable row level security;
alter table public.user_cash_closing_methods enable row level security;

drop policy if exists "Users can select own payments" on public.user_payments;
create policy "Users can select own payments" on public.user_payments
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own payments" on public.user_payments;
create policy "Users can insert own payments" on public.user_payments
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own payments" on public.user_payments;
create policy "Users can update own payments" on public.user_payments
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own payments" on public.user_payments;
create policy "Users can delete own payments" on public.user_payments
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can select own receivables" on public.user_accounts_receivable;
create policy "Users can select own receivables" on public.user_accounts_receivable
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own receivables" on public.user_accounts_receivable;
create policy "Users can insert own receivables" on public.user_accounts_receivable
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own receivables" on public.user_accounts_receivable;
create policy "Users can update own receivables" on public.user_accounts_receivable
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own receivables" on public.user_accounts_receivable;
create policy "Users can delete own receivables" on public.user_accounts_receivable
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can select own expenses" on public.user_expenses;
create policy "Users can select own expenses" on public.user_expenses
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own expenses" on public.user_expenses;
create policy "Users can insert own expenses" on public.user_expenses
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own expenses" on public.user_expenses;
create policy "Users can update own expenses" on public.user_expenses
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own expenses" on public.user_expenses;
create policy "Users can delete own expenses" on public.user_expenses
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can select own cash closings" on public.user_cash_closings;
create policy "Users can select own cash closings" on public.user_cash_closings
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own cash closings" on public.user_cash_closings;
create policy "Users can insert own cash closings" on public.user_cash_closings
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own cash closings" on public.user_cash_closings;
create policy "Users can update own cash closings" on public.user_cash_closings
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own cash closings" on public.user_cash_closings;
create policy "Users can delete own cash closings" on public.user_cash_closings
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can select own cash closing methods" on public.user_cash_closing_methods;
create policy "Users can select own cash closing methods" on public.user_cash_closing_methods
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own cash closing methods" on public.user_cash_closing_methods;
create policy "Users can insert own cash closing methods" on public.user_cash_closing_methods
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own cash closing methods" on public.user_cash_closing_methods;
create policy "Users can update own cash closing methods" on public.user_cash_closing_methods
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own cash closing methods" on public.user_cash_closing_methods;
create policy "Users can delete own cash closing methods" on public.user_cash_closing_methods
for delete to authenticated using (auth.uid() = user_id);
