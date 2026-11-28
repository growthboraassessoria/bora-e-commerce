-- BORA Store · 0008 (no BORA OS: 0039_loja_geo.sql) · localização da compra.
-- geo: até três registros, cada um com a fonte e a data (formato em lib/geo.ts da loja e lib/loja/geo.ts do OS):
--   ip   → país, UF, cidade e lat/lng aproximados pela rede (cabeçalhos da Vercel). Nos pedidos antigos: fonte "ip-analytics".
--   cep  → CEP, bairro, cidade e UF da cobrança do cartão (nunca rua nem número) e lat/lng da BrasilAPI, se houver.
--   gps  → lat, lng e precisão do celular, só quando o cliente toca em "Compartilhar minha localização".
-- Idempotente: pode rodar mais de uma vez.

alter table loja.orders add column if not exists geo jsonb;

-- create_order: igual ao da 0003 (limite de usos do desconto atômico), agora gravando o geo que a loja manda.
create or replace function loja.create_order(p_order jsonb, p_items jsonb)
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
    total_cents, coupon_code, payment_method, payment_provider, expires_at, pickup_name, pickup_cpf, pickup_phone, geo)
  values (p_order->>'email', p_order->>'name', p_order->>'phone', p_order->>'cpf', p_order->'address', p_order->>'shipping_method',
    (p_order->>'shipping_cents')::int, (p_order->>'subtotal_cents')::int, (p_order->>'discount_cents')::int, (p_order->>'total_cents')::int,
    cc, p_order->>'payment_method', p_order->>'payment_provider', (p_order->>'expires_at')::timestamptz,
    nullif(p_order->>'pickup_name', ''), nullif(p_order->>'pickup_cpf', ''), nullif(p_order->>'pickup_phone', ''),
    case when jsonb_typeof(p_order->'geo') = 'object' and p_order->'geo' <> '{}'::jsonb then p_order->'geo' end)
  returning orders.id into new_id;

  insert into loja.order_items (order_id, variant_id, product_id, name, variant_label, image, unit_cents, quantity)
  select new_id, i->>'variant_id', i->>'product_id', i->>'name', i->>'variant_label', coalesce(i->>'image', ''), (i->>'unit_cents')::int, (i->>'quantity')::int
  from jsonb_array_elements(p_items) i;

  insert into loja.order_events (order_id, kind, actor) values (new_id, 'created', 'Loja');
  return query select o.id, o.number, o.code, o.created_at from loja.orders o where o.id = new_id;
end $$;
revoke all on function loja.create_order(jsonb, jsonb) from public, anon, authenticated;
grant execute on function loja.create_order(jsonb, jsonb) to service_role;

-- Preenchimento retroativo dos pedidos sem geo: a cidade do analytics (loja.events) do mesmo visitante,
-- achado pelo checkout ligado ao pedido (loja.checkouts.order_id), no evento mais perto da hora da compra.
with near as (
  select distinct on (o.id) o.id, e.at, e.country, e.region, e.city
  from loja.orders o
  join loja.checkouts c on c.order_id = o.id and c.visitor_id is not null
  join loja.events e on e.visitor_id = c.visitor_id
    and (nullif(e.city, '') is not null or nullif(e.region, '') is not null)
  where o.geo is null
  order by o.id, abs(extract(epoch from (e.at - o.created_at))), e.id
)
update loja.orders o
set geo = jsonb_build_object('ip', jsonb_strip_nulls(jsonb_build_object(
  'source', 'ip-analytics',
  'at', to_jsonb(n.at),
  'country', upper(nullif(n.country, '')),
  'uf', upper(nullif(n.region, '')),
  'city', nullif(n.city, '')
)))
from near n
where o.id = n.id and o.geo is null;
