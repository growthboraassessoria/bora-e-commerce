-- BORA Store · schema "loja", isolado de public (LP e BORA OS).
-- Depois de aplicar: em Project Settings > API > Exposed schemas, incluir "loja".
create schema if not exists loja;

create table loja.categories (
  id text primary key,
  slug text unique not null,
  name text not null,
  description text not null default '',
  image text not null default '',
  position int not null default 0
);

create table loja.products (
  id text primary key,
  slug text unique not null,
  name text not null,
  subtitle text not null default '',
  description text not null default '',
  category_slug text not null references loja.categories(slug) on update cascade,
  price_cents int not null check (price_cents >= 0),
  compare_at_cents int check (compare_at_cents is null or compare_at_cents > price_cents),
  status text not null default 'active' check (status in ('active', 'draft', 'archived')),
  badges text[] not null default '{}',
  tags text[] not null default '{}',
  featured boolean not null default false,
  highlights text[] not null default '{}',
  details jsonb not null default '[]',
  care text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table loja.product_images (
  id bigserial primary key,
  product_id text not null references loja.products(id) on delete cascade,
  url text not null,
  alt text not null default '',
  color text,
  position int not null default 0
);
create index on loja.product_images (product_id, position);

create table loja.product_variants (
  id text primary key,
  product_id text not null references loja.products(id) on delete cascade,
  sku text unique not null,
  color text not null default '',
  color_hex text not null default '#000000',
  size text not null default '',
  price_cents int check (price_cents is null or price_cents >= 0),
  stock int not null default 0 check (stock >= 0),
  position int not null default 0
);
create index on loja.product_variants (product_id, position);

create table loja.coupons (
  code text primary key check (code = upper(code)),
  kind text not null check (kind in ('percent', 'fixed', 'free_shipping')),
  value int not null default 0,
  min_subtotal_cents int not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  uses int not null default 0,
  max_uses int
);

create sequence loja.order_number_seq start 1001;

create table loja.orders (
  id uuid primary key default gen_random_uuid(),
  number int unique not null default nextval('loja.order_number_seq'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'canceled', 'shipped', 'delivered', 'refunded')),
  email text not null,
  name text not null,
  phone text not null,
  cpf text not null,
  address jsonb,
  shipping_method text not null,
  shipping_cents int not null,
  subtotal_cents int not null,
  discount_cents int not null default 0,
  total_cents int not null check (total_cents >= 0),
  coupon_code text,
  payment_method text not null check (payment_method in ('pix', 'card', 'boleto')),
  payment_provider text not null,
  payment_id text,
  needs_attention boolean not null default false,
  tracking_code text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index on loja.orders (status, expires_at);
create index on loja.orders (email);

create table loja.order_items (
  id bigserial primary key,
  order_id uuid not null references loja.orders(id) on delete cascade,
  variant_id text not null references loja.product_variants(id),
  product_id text not null,
  name text not null,
  variant_label text not null,
  image text not null default '',
  unit_cents int not null,
  quantity int not null check (quantity between 1 and 10)
);
create index on loja.order_items (order_id);

create table loja.newsletter (
  email text primary key,
  created_at timestamptz not null default now()
);

-- Segurança: só o servidor da loja (service_role) acessa. Nada exposto para anon/authenticated.
alter table loja.categories enable row level security;
alter table loja.products enable row level security;
alter table loja.product_images enable row level security;
alter table loja.product_variants enable row level security;
alter table loja.coupons enable row level security;
alter table loja.orders enable row level security;
alter table loja.order_items enable row level security;
alter table loja.newsletter enable row level security;

revoke all on schema loja from anon, authenticated;
grant usage on schema loja to service_role;
grant all on all tables in schema loja to service_role;
grant all on all sequences in schema loja to service_role;

-- Cria o pedido reservando o estoque de forma atômica. Falta de estoque: exceção 'sem_estoque:<variant_id>'.
create or replace function loja.create_order(p_order jsonb, p_items jsonb)
returns table (id uuid, number int, created_at timestamptz)
language plpgsql security definer set search_path = loja, pg_temp as $$
declare
  it jsonb;
  new_id uuid;
begin
  for it in select * from jsonb_array_elements(p_items) order by value->>'variant_id' loop
    update loja.product_variants v set stock = v.stock - (it->>'quantity')::int
      where v.id = it->>'variant_id' and v.stock >= (it->>'quantity')::int;
    if not found then
      raise exception 'sem_estoque:%', it->>'variant_id';
    end if;
  end loop;

  insert into loja.orders (email, name, phone, cpf, address, shipping_method, shipping_cents, subtotal_cents, discount_cents,
    total_cents, coupon_code, payment_method, payment_provider, expires_at)
  values (p_order->>'email', p_order->>'name', p_order->>'phone', p_order->>'cpf', p_order->'address', p_order->>'shipping_method',
    (p_order->>'shipping_cents')::int, (p_order->>'subtotal_cents')::int, (p_order->>'discount_cents')::int, (p_order->>'total_cents')::int,
    nullif(p_order->>'coupon_code', ''), p_order->>'payment_method', p_order->>'payment_provider', (p_order->>'expires_at')::timestamptz)
  returning orders.id into new_id;

  insert into loja.order_items (order_id, variant_id, product_id, name, variant_label, image, unit_cents, quantity)
  select new_id, i->>'variant_id', i->>'product_id', i->>'name', i->>'variant_label', coalesce(i->>'image', ''), (i->>'unit_cents')::int, (i->>'quantity')::int
  from jsonb_array_elements(p_items) i;

  if p_order->>'coupon_code' is not null and p_order->>'coupon_code' <> '' then
    update loja.coupons set uses = uses + 1 where code = p_order->>'coupon_code';
  end if;

  return query select o.id, o.number, o.created_at from loja.orders o where o.id = new_id;
end $$;

-- Cancela pedidos pendentes vencidos e devolve o estoque.
create or replace function loja.release_expired_orders()
returns int language plpgsql security definer set search_path = loja, pg_temp as $$
declare n int;
begin
  with expired as (
    update loja.orders set status = 'canceled'
    where status = 'pending' and expires_at < now()
    returning id
  ), back as (
    select oi.variant_id, sum(oi.quantity) q from loja.order_items oi join expired e on e.id = oi.order_id group by oi.variant_id
  ), upd as (
    update loja.product_variants v set stock = v.stock + back.q from back where v.id = back.variant_id returning 1
  )
  select count(*) into n from expired;
  return n;
end $$;

-- Marca como pago (idempotente). Pedido já cancelado: tenta reservar de novo; sem estoque, marca needs_attention.
create or replace function loja.mark_order_paid(p_order_id uuid, p_payment_id text)
returns void language plpgsql security definer set search_path = loja, pg_temp as $$
declare o loja.orders; it record; ok boolean := true;
begin
  select * into o from loja.orders where id = p_order_id for update;
  if not found or o.status = 'paid' then return; end if;
  if o.status = 'canceled' then
    for it in select variant_id, quantity from loja.order_items where order_id = o.id loop
      update loja.product_variants set stock = stock - it.quantity where id = it.variant_id and stock >= it.quantity;
      if not found then ok := false; end if;
    end loop;
  end if;
  update loja.orders set status = 'paid', payment_id = p_payment_id, paid_at = now(), needs_attention = not ok where id = o.id;
end $$;

revoke all on function loja.create_order(jsonb, jsonb) from public, anon, authenticated;
revoke all on function loja.release_expired_orders() from public, anon, authenticated;
revoke all on function loja.mark_order_paid(uuid, text) from public, anon, authenticated;
grant execute on function loja.create_order(jsonb, jsonb) to service_role;
grant execute on function loja.release_expired_orders() to service_role;
grant execute on function loja.mark_order_paid(uuid, text) to service_role;
