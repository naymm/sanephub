-- Subscrições Web Push (PWA) por utilizador — envio via Edge Function com VAPID.
create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint web_push_subscriptions_endpoint_unique unique (endpoint)
);

create index if not exists idx_web_push_subscriptions_user_id on public.web_push_subscriptions (user_id);

alter table public.web_push_subscriptions enable row level security;

create policy "web_push_subscriptions: select own"
  on public.web_push_subscriptions for select
  using (auth.uid() = user_id);

create policy "web_push_subscriptions: insert own"
  on public.web_push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "web_push_subscriptions: update own"
  on public.web_push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "web_push_subscriptions: delete own"
  on public.web_push_subscriptions for delete
  using (auth.uid() = user_id);

comment on table public.web_push_subscriptions is 'Endpoints Web Push por dispositivo; envio apenas via service role (Edge).';
