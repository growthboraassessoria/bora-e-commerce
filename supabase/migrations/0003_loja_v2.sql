-- BORA Store · 0003 (no BORA OS: 0029_loja_v2.sql) · descontos no padrão Shopify, loja aberta/fechada com senha,
-- checkouts abandonados e analytics próprio. Tudo só para o service_role (a loja e o OS conferem permissão antes).

-- ---------- Configurações da loja (uma linha só) ----------
-- status: open = qualquer um entra; password = só com a senha (criada no BORA OS).
-- password_hash: "scrypt$<salt hex>$<hash hex>" (N=16384, r=8, p=1, 32 bytes), gerado pelo OS.
-- password_version: sobe a cada troca de senha e invalida os acessos liberados antes.
create table if not exists loja.settings (
  id boolean primary key default true check (id),
  status text not null default 'open' check (status in ('open', 'password')),
  password_hash text,
  password_version int not null default 1,
  password_message text not null default 'A BORA Store abre em breve. Tem a senha? Entre abaixo.',
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into loja.settings (id) values (true) on conflict (id) do nothing;

-- ---------- Descontos (padrão Shopify) ----------
-- method: code = cupom digitado; automatic = aplicado sozinho quando as condições batem.
-- kind: percent (value 1-100) | fixed (value em centavos, sobre os itens elegíveis) | free_shipping.
-- applies_to: all | products (product_ids) | categories (category_slugs).
-- Requisito mínimo: min_subtotal_cents e/ou min_quantity. Limites: max_uses (total) e once_per_customer (por CPF).
-- Período: starts_at / expires_at. combines_with_pix: se o desconto do Pix (5%) entra por cima.
alter table loja.coupons
  add column if not exists title text not null default '',
  add column if not exists method text not null default 'code',
  add column if not exists applies_to text not null default 'all',
  add column if not exists product_ids text[] not null default '{}',
  add column if not exists category_slugs text[] not null default '{}',
  add column if not exists min_quantity int not null default 0,
  add column if not exists starts_at timestamptz,
  add column if not exists once_per_customer boolean not null default false,
  add column if not exists combines_with_pix boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();
do $$ begin
  alter table loja.coupons add constraint coupons_method_chk check (method in ('code', 'automatic'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table loja.coupons add constraint coupons_applies_chk check (applies_to in ('all', 'products', 'categories'));
exception when duplicate_object then null; end $$;
create index if not exists orders_coupon_cpf_idx on loja.orders (coupon_code, cpf) where coupon_code is not null;

-- create_order: agora respeita o limite de usos do desconto de forma atômica.
drop function if exists loja.create_order(jsonb, jsonb);
create function loja.create_order(p_order jsonb, p_items jsonb)
returns table (id uuid, number int, code text, created_at timestamptz)
language plpgsql security definer set search_path = loja, pg_temp as $$
declare
  it jsonb;
  new_id uuid;
  cc text := nullif(p_order->>'coupon_code', '');
begin
  if cc is not null then
    update loja.coupons c set uses = c.uses + 1, updated_at = now()
      where c.code = cc and c.active and (c.max_uses is null or c.uses < c.max_uses);
    if not found then raise exception 'cupom_esgotado:%', cc; end if;
  end if;

  for it in select * from jsonb_array_elements(p_items) order by value->>'variant_id' loop
    update loja.product_variants v set stock = v.stock - (it->>'quantity')::int
      where v.id = it->>'variant_id' and v.stock >= (it->>'quantity')::int;
    if not found then
      raise exception 'sem_estoque:%', it->>'variant_id';
    end if;
  end loop;

  insert into loja.orders (email, name, phone, cpf, address, shipping_method, shipping_cents, subtotal_cents, discount_cents,
    total_cents, coupon_code, payment_method, payment_provider, expires_at, pickup_name, pickup_cpf, pickup_phone)
  values (p_order->>'email', p_order->>'name', p_order->>'phone', p_order->>'cpf', p_order->'address', p_order->>'shipping_method',
    (p_order->>'shipping_cents')::int, (p_order->>'subtotal_cents')::int, (p_order->>'discount_cents')::int, (p_order->>'total_cents')::int,
    cc, p_order->>'payment_method', p_order->>'payment_provider', (p_order->>'expires_at')::timestamptz,
    nullif(p_order->>'pickup_name', ''), nullif(p_order->>'pickup_cpf', ''), nullif(p_order->>'pickup_phone', ''))
  returning orders.id into new_id;

  insert into loja.order_items (order_id, variant_id, product_id, name, variant_label, image, unit_cents, quantity)
  select new_id, i->>'variant_id', i->>'product_id', i->>'name', i->>'variant_label', coalesce(i->>'image', ''), (i->>'unit_cents')::int, (i->>'quantity')::int
  from jsonb_array_elements(p_items) i;

  insert into loja.order_events (order_id, kind, actor) values (new_id, 'created', 'Loja');
  return query select o.id, o.number, o.code, o.created_at from loja.orders o where o.id = new_id;
end $$;
revoke all on function loja.create_order(jsonb, jsonb) from public, anon, authenticated;
grant execute on function loja.create_order(jsonb, jsonb) to service_role;

-- ---------- Checkouts (carrinho abandonado) ----------
-- Um registro por sessão de compra. A loja grava quando a pessoa monta a sacola e a cada etapa do checkout.
-- token: vai no link de recuperação (/checkout?recuperar=<token>), que remonta a sacola.
create table if not exists loja.checkouts (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  visitor_id text,
  email text, phone text, name text, cpf text,
  lines jsonb not null default '[]',
  item_count int not null default 0,
  subtotal_cents int not null default 0,
  total_cents int not null default 0,
  coupon_code text,
  step text not null default 'cart' check (step in ('cart', 'contact', 'pickup', 'payment')),
  payment_method text,
  order_id uuid references loja.orders(id) on delete set null,
  completed_at timestamptz,
  recovered_at timestamptz,
  contacted_at timestamptz,
  contacted_by text,
  utm jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists checkouts_open_idx on loja.checkouts (updated_at desc) where completed_at is null;
create index if not exists checkouts_visitor_idx on loja.checkouts (visitor_id);

-- ---------- Analytics próprio (tipo GA4) ----------
create table if not exists loja.events (
  id bigserial primary key,
  at timestamptz not null default now(),
  name text not null,
  visitor_id text,
  session_id text,
  path text,
  title text,
  referrer text,
  utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  device text, browser text, os text,
  country text, region text, city text,
  props jsonb not null default '{}'
);
create index if not exists events_at_idx on loja.events (at desc);
create index if not exists events_name_at_idx on loja.events (name, at desc);
create index if not exists events_session_idx on loja.events (session_id);
create index if not exists events_visitor_idx on loja.events (visitor_id);

alter table loja.settings enable row level security;
alter table loja.checkouts enable row level security;
alter table loja.events enable row level security;
grant all on loja.settings, loja.checkouts, loja.events to service_role;
grant all on all sequences in schema loja to service_role;
