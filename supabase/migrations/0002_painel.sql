-- BORA Store · 0002 · painel de pedidos no BORA OS.
-- ID legível do pedido (BR-XXXXXX), retirada no evento, histórico do pedido e as funções que o OS chama.
-- Tudo continua só para o service_role: o OS confere a permissão do membro antes de chamar.

-- ---------- ID do pedido ----------
-- 6 caracteres sem 0/O/1/I (fácil de ditar no balcão). Não é segredo: o segredo do link é o token assinado.
create or replace function loja.new_order_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  s text;
begin
  loop
    s := 'BR-';
    for i in 1..6 loop
      s := s || substr(alphabet, 1 + floor(random() * 32)::int, 1);
    end loop;
    exit when not exists (select 1 from loja.orders o where o.code = s);
  end loop;
  return s;
end $$;

alter table loja.orders add column if not exists code text;
update loja.orders set code = loja.new_order_code() where code is null;
alter table loja.orders alter column code set default loja.new_order_code();
alter table loja.orders alter column code set not null;
create unique index if not exists orders_code_key on loja.orders (code);

-- ---------- Retirada, cancelamento e reembolso ----------
-- status 'delivered' = peça retirada no evento.
alter table loja.orders
  add column if not exists picked_up_at timestamptz,
  add column if not exists picked_up_by text,
  add column if not exists canceled_at timestamptz,
  add column if not exists refunded_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  -- Quem retira, quando não é o comprador (nulo = o próprio comprador).
  add column if not exists pickup_name text,
  add column if not exists pickup_cpf text,
  add column if not exists pickup_phone text;

create index if not exists orders_cpf_idx on loja.orders (cpf);
create index if not exists orders_pickup_cpf_idx on loja.orders (pickup_cpf) where pickup_cpf is not null;
create index if not exists orders_created_idx on loja.orders (created_at desc);

-- ---------- Histórico do pedido ----------
create table if not exists loja.order_events (
  id bigserial primary key,
  order_id uuid not null references loja.orders(id) on delete cascade,
  kind text not null check (kind in ('created', 'paid', 'expired', 'canceled', 'refunded', 'picked_up', 'pickup_undone', 'note', 'attention')),
  actor text not null default 'Sistema',
  actor_id uuid,
  note text,
  at timestamptz not null default now()
);
create index if not exists order_events_order_idx on loja.order_events (order_id, at);
alter table loja.order_events enable row level security;
grant all on loja.order_events to service_role;
grant all on all sequences in schema loja to service_role;

-- Pedidos que já existiam ganham o evento de criação (e de pagamento).
insert into loja.order_events (order_id, kind, at)
select o.id, 'created', o.created_at from loja.orders o
where not exists (select 1 from loja.order_events e where e.order_id = o.id and e.kind = 'created');
insert into loja.order_events (order_id, kind, actor, at)
select o.id, 'paid', 'Mercado Pago', o.paid_at from loja.orders o
where o.paid_at is not null and not exists (select 1 from loja.order_events e where e.order_id = o.id and e.kind = 'paid');

-- ---------- Funções da loja, agora com ID e histórico ----------
drop function if exists loja.create_order(jsonb, jsonb);
create function loja.create_order(p_order jsonb, p_items jsonb)
returns table (id uuid, number int, code text, created_at timestamptz)
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
    total_cents, coupon_code, payment_method, payment_provider, expires_at, pickup_name, pickup_cpf, pickup_phone)
  values (p_order->>'email', p_order->>'name', p_order->>'phone', p_order->>'cpf', p_order->'address', p_order->>'shipping_method',
    (p_order->>'shipping_cents')::int, (p_order->>'subtotal_cents')::int, (p_order->>'discount_cents')::int, (p_order->>'total_cents')::int,
    nullif(p_order->>'coupon_code', ''), p_order->>'payment_method', p_order->>'payment_provider', (p_order->>'expires_at')::timestamptz,
    nullif(p_order->>'pickup_name', ''), nullif(p_order->>'pickup_cpf', ''), nullif(p_order->>'pickup_phone', ''))
  returning orders.id into new_id;

  insert into loja.order_items (order_id, variant_id, product_id, name, variant_label, image, unit_cents, quantity)
  select new_id, i->>'variant_id', i->>'product_id', i->>'name', i->>'variant_label', coalesce(i->>'image', ''), (i->>'unit_cents')::int, (i->>'quantity')::int
  from jsonb_array_elements(p_items) i;

  if p_order->>'coupon_code' is not null and p_order->>'coupon_code' <> '' then
    update loja.coupons set uses = uses + 1 where coupons.code = p_order->>'coupon_code';
  end if;

  insert into loja.order_events (order_id, kind, actor) values (new_id, 'created', 'Loja');
  return query select o.id, o.number, o.code, o.created_at from loja.orders o where o.id = new_id;
end $$;

create or replace function loja.release_expired_orders()
returns int language plpgsql security definer set search_path = loja, pg_temp as $$
declare n int;
begin
  with expired as (
    update loja.orders set status = 'canceled', canceled_at = now(), updated_at = now()
    where status = 'pending' and expires_at < now()
    returning id
  ), back as (
    select oi.variant_id, sum(oi.quantity) q from loja.order_items oi join expired e on e.id = oi.order_id group by oi.variant_id
  ), upd as (
    update loja.product_variants v set stock = v.stock + back.q from back where v.id = back.variant_id returning 1
  ), ev as (
    insert into loja.order_events (order_id, kind, note) select e.id, 'expired', 'Prazo de pagamento terminou; peças voltaram para a grade.' from expired e returning 1
  )
  select count(*) into n from expired;
  return n;
end $$;

-- Pagamento (Mercado Pago ou baixa manual no OS). Idempotente.
-- Pedido já cancelado: tenta reservar de novo; sem estoque, marca needs_attention.
create or replace function loja.pay_order(p_order_id uuid, p_payment_id text, p_actor text, p_actor_id uuid, p_note text)
returns text language plpgsql security definer set search_path = loja, pg_temp as $$
declare o loja.orders; it record; ok boolean := true;
begin
  select * into o from loja.orders where id = p_order_id for update;
  if not found then raise exception 'nao_encontrado'; end if;
  if o.status in ('paid', 'delivered') then return o.status; end if;
  if o.status = 'refunded' then raise exception 'pedido_invalido:refunded'; end if;
  if o.status = 'canceled' then
    for it in select variant_id, quantity from loja.order_items where order_id = o.id loop
      update loja.product_variants set stock = stock - it.quantity where id = it.variant_id and stock >= it.quantity;
      if not found then ok := false; end if;
    end loop;
  end if;
  update loja.orders set status = 'paid', payment_id = coalesce(p_payment_id, payment_id), paid_at = now(),
    canceled_at = null, needs_attention = not ok, updated_at = now() where id = o.id;
  insert into loja.order_events (order_id, kind, actor, actor_id, note) values (o.id, 'paid', p_actor, p_actor_id, p_note);
  if not ok then
    insert into loja.order_events (order_id, kind, note) values (o.id, 'attention', 'Pago depois de cancelado e sem estoque para todas as peças. Resolver com o comprador.');
  end if;
  return 'paid';
end $$;

create or replace function loja.mark_order_paid(p_order_id uuid, p_payment_id text)
returns void language plpgsql security definer set search_path = loja, pg_temp as $$
begin
  perform loja.pay_order(p_order_id, p_payment_id, 'Mercado Pago', null, null);
exception when others then
  if sqlerrm = 'nao_encontrado' then return; end if;
  raise;
end $$;

-- ---------- Funções do painel (BORA OS) ----------
-- p_ref aceita o id (uuid), o ID do pedido (BR-XXXXXX) ou o número (#1001).
create or replace function loja.find_order(p_ref text) returns uuid
language plpgsql stable security definer set search_path = loja, pg_temp as $$
declare r text := upper(trim(coalesce(p_ref, ''))); found_id uuid;
begin
  if r ~ '^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$' then
    select id into found_id from loja.orders where id = r::uuid;
  elsif r ~ '^(BR-?)?[2-9A-HJ-NP-Z]{6}$' then
    select id into found_id from loja.orders where code = 'BR-' || right(r, 6);
  elsif r ~ '^#?[0-9]{1,9}$' then
    select id into found_id from loja.orders where number = ltrim(r, '#')::int;
  end if;
  return found_id;
end $$;

create or replace function loja.confirm_pickup(p_ref text, p_actor text, p_actor_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = loja, pg_temp as $$
declare oid uuid := loja.find_order(p_ref); o loja.orders;
begin
  if oid is null then raise exception 'nao_encontrado'; end if;
  select * into o from loja.orders where id = oid for update;
  if o.status = 'delivered' then raise exception 'ja_retirado'; end if;
  if o.status <> 'paid' then raise exception 'retirada_bloqueada:%', o.status; end if;
  update loja.orders set status = 'delivered', picked_up_at = now(), picked_up_by = p_actor, updated_at = now() where id = oid;
  insert into loja.order_events (order_id, kind, actor, actor_id, note) values (oid, 'picked_up', p_actor, p_actor_id, nullif(trim(coalesce(p_note, '')), ''));
  return jsonb_build_object('id', oid, 'code', o.code, 'number', o.number);
end $$;

create or replace function loja.undo_pickup(p_order_id uuid, p_actor text, p_actor_id uuid, p_note text)
returns void language plpgsql security definer set search_path = loja, pg_temp as $$
declare o loja.orders;
begin
  select * into o from loja.orders where id = p_order_id for update;
  if not found then raise exception 'nao_encontrado'; end if;
  if o.status <> 'delivered' then raise exception 'pedido_invalido:%', o.status; end if;
  update loja.orders set status = 'paid', picked_up_at = null, picked_up_by = null, updated_at = now() where id = o.id;
  insert into loja.order_events (order_id, kind, actor, actor_id, note) values (o.id, 'pickup_undone', p_actor, p_actor_id, p_note);
end $$;

-- Cancela pedido aguardando ou pago (ainda não retirado) e devolve as peças para a grade.
create or replace function loja.cancel_order(p_order_id uuid, p_actor text, p_actor_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = loja, pg_temp as $$
declare o loja.orders;
begin
  select * into o from loja.orders where id = p_order_id for update;
  if not found then raise exception 'nao_encontrado'; end if;
  if o.status not in ('pending', 'paid') then raise exception 'pedido_invalido:%', o.status; end if;
  update loja.product_variants v set stock = v.stock + x.q
  from (select variant_id, sum(quantity) q from loja.order_items where order_id = o.id group by variant_id) x where v.id = x.variant_id;
  update loja.orders set status = 'canceled', canceled_at = now(), updated_at = now() where id = o.id;
  insert into loja.order_events (order_id, kind, actor, actor_id, note) values (o.id, 'canceled', p_actor, p_actor_id, p_reason);
end $$;

-- Registra o reembolso (o estorno em si é feito no Mercado Pago). Pago e não retirado: as peças voltam para a grade.
create or replace function loja.refund_order(p_order_id uuid, p_actor text, p_actor_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = loja, pg_temp as $$
declare o loja.orders;
begin
  select * into o from loja.orders where id = p_order_id for update;
  if not found then raise exception 'nao_encontrado'; end if;
  if o.paid_at is null or o.status not in ('paid', 'delivered', 'canceled') then raise exception 'pedido_invalido:%', o.status; end if;
  if o.status = 'paid' then
    update loja.product_variants v set stock = v.stock + x.q
    from (select variant_id, sum(quantity) q from loja.order_items where order_id = o.id group by variant_id) x where v.id = x.variant_id;
  end if;
  update loja.orders set status = 'refunded', refunded_at = now(), updated_at = now() where id = o.id;
  insert into loja.order_events (order_id, kind, actor, actor_id, note) values (o.id, 'refunded', p_actor, p_actor_id, p_reason);
end $$;

create or replace function loja.add_order_note(p_order_id uuid, p_actor text, p_actor_id uuid, p_note text)
returns void language plpgsql security definer set search_path = loja, pg_temp as $$
begin
  if length(trim(coalesce(p_note, ''))) = 0 then raise exception 'invalido: nota'; end if;
  if not exists (select 1 from loja.orders where id = p_order_id) then raise exception 'nao_encontrado'; end if;
  insert into loja.order_events (order_id, kind, actor, actor_id, note) values (p_order_id, 'note', p_actor, p_actor_id, left(trim(p_note), 1000));
end $$;

revoke all on function loja.new_order_code() from public, anon, authenticated;
revoke all on function loja.create_order(jsonb, jsonb) from public, anon, authenticated;
revoke all on function loja.release_expired_orders() from public, anon, authenticated;
revoke all on function loja.pay_order(uuid, text, text, uuid, text) from public, anon, authenticated;
revoke all on function loja.mark_order_paid(uuid, text) from public, anon, authenticated;
revoke all on function loja.find_order(text) from public, anon, authenticated;
revoke all on function loja.confirm_pickup(text, text, uuid, text) from public, anon, authenticated;
revoke all on function loja.undo_pickup(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function loja.cancel_order(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function loja.refund_order(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function loja.add_order_note(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function loja.new_order_code() to service_role;
grant execute on function loja.create_order(jsonb, jsonb) to service_role;
grant execute on function loja.release_expired_orders() to service_role;
grant execute on function loja.pay_order(uuid, text, text, uuid, text) to service_role;
grant execute on function loja.mark_order_paid(uuid, text) to service_role;
grant execute on function loja.find_order(text) to service_role;
grant execute on function loja.confirm_pickup(text, text, uuid, text) to service_role;
grant execute on function loja.undo_pickup(uuid, text, uuid, text) to service_role;
grant execute on function loja.cancel_order(uuid, text, uuid, text) to service_role;
grant execute on function loja.refund_order(uuid, text, uuid, text) to service_role;
grant execute on function loja.add_order_note(uuid, text, uuid, text) to service_role;
