-- BORA Store · 0005 (no BORA OS: 0031_loja_etapas.sql) · etapas do pedido (linha de processo).
-- Recebido → Pagamento → Em processamento → Separado → Pronto para retirada / Enviado → Retirado / Entregue.
-- Exceções (cancelado, estornado, expirado, pagamento recusado) continuam vindo do status e do histórico.
-- A etapa é derivada das datas abaixo (no OS: lib/loja/etapas.ts; na loja: lib/etapas.ts). O status continua 'paid'
-- até a entrega, para o balcão (confirm_pickup), o cancelamento e o reembolso seguirem como estão.
-- Tudo só para o service_role: o OS confere a permissão do membro (loja.orders.manage) antes de chamar.
-- Pode rodar mais de uma vez.

-- ---------- Datas e autor de cada etapa ----------
-- shipped_* = "saiu da separação": pronto para retirada (shipping_method = 'retirada') ou enviado (pac/sedex).
-- Entregue/retirado continua em picked_up_at/by (status 'delivered').
alter table loja.orders
  add column if not exists processing_at timestamptz,
  add column if not exists processing_by text,
  add column if not exists packed_at timestamptz,
  add column if not exists packed_by text,
  add column if not exists shipped_at timestamptz,
  add column if not exists shipped_by text;

-- ---------- Novos tipos no histórico ----------
-- processing, packed, ready (pronto para retirada), shipped (enviado), delivered (entregue por envio), stage_undone (voltou uma etapa).
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'loja.order_events'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table loja.order_events drop constraint %I', c.conname);
  end loop;
end $$;
alter table loja.order_events add constraint order_events_kind_check check (kind in (
  'created', 'paid', 'expired', 'canceled', 'refunded', 'picked_up', 'pickup_undone', 'note', 'attention',
  'processing', 'packed', 'ready', 'shipped', 'delivered', 'stage_undone'
));

-- ---------- Avançar ou voltar a etapa ----------
-- p_stage: 'processing' | 'packed' | 'shipped' (pronto p/ retirada ou enviado) | 'delivered' (só envio) | 'back' (volta uma etapa; nota obrigatória).
-- Só avança com pagamento aprovado. Pode pular etapas (a linha mostra "pulou"); não repete nem volta para trás avançando.
-- Retirada no evento continua no balcão (confirm_pickup). Devolve a etapa em que o pedido ficou.
create or replace function loja.set_order_stage(p_order_id uuid, p_stage text, p_actor text, p_actor_id uuid, p_note text default null)
returns text language plpgsql security definer set search_path = loja, pg_temp as $$
declare
  o loja.orders;
  ship boolean;
  cur int;
  tgt int;
  v_note text := nullif(left(trim(coalesce(p_note, '')), 500), '');
  names constant text[] := array['paid', 'processing', 'packed', 'shipped', 'delivered'];
  v_kind text;
begin
  select * into o from loja.orders where id = p_order_id for update;
  if not found then raise exception 'nao_encontrado'; end if;
  if o.status in ('canceled', 'refunded') then raise exception 'etapa_bloqueada:%', o.status; end if;
  if o.status = 'pending' or o.paid_at is null then raise exception 'etapa_sem_pagamento'; end if;
  ship := coalesce(o.shipping_method, 'retirada') <> 'retirada';
  cur := case
    when o.status = 'delivered' then 4
    when o.shipped_at is not null or o.status = 'shipped' then 3
    when o.packed_at is not null then 2
    when o.processing_at is not null then 1
    else 0 end;

  if p_stage = 'back' then
    if v_note is null or length(v_note) < 3 then raise exception 'invalido: nota'; end if;
    if cur = 0 then raise exception 'etapa_inicial'; end if;
    if cur = 4 then
      update loja.orders set status = 'paid', picked_up_at = null, picked_up_by = null, updated_at = now() where id = o.id;
      insert into loja.order_events (order_id, kind, actor, actor_id, note)
      values (o.id, case when ship then 'stage_undone' else 'pickup_undone' end, p_actor, p_actor_id, v_note);
    else
      update loja.orders set
        processing_at = case when cur = 1 then null else processing_at end, processing_by = case when cur = 1 then null else processing_by end,
        packed_at = case when cur = 2 then null else packed_at end, packed_by = case when cur = 2 then null else packed_by end,
        shipped_at = case when cur = 3 then null else shipped_at end, shipped_by = case when cur = 3 then null else shipped_by end,
        status = case when o.status = 'shipped' then 'paid' else o.status end,
        updated_at = now()
      where id = o.id;
      insert into loja.order_events (order_id, kind, actor, actor_id, note) values (o.id, 'stage_undone', p_actor, p_actor_id, v_note);
    end if;
    -- Etapa em que ficou: a maior data que sobrou.
    select case
      when x.shipped_at is not null then 'shipped' when x.packed_at is not null then 'packed'
      when x.processing_at is not null then 'processing' else 'paid' end
    into v_kind from loja.orders x where x.id = o.id;
    return v_kind;
  end if;

  tgt := array_position(names, p_stage) - 1;
  if tgt is null or tgt < 1 then raise exception 'invalido: etapa'; end if;
  if tgt <= cur then raise exception 'etapa_ja_feita:%', names[cur + 1]; end if;
  if tgt = 4 and not ship then raise exception 'etapa_use_balcao'; end if;

  update loja.orders set
    processing_at = case when tgt = 1 then now() else processing_at end, processing_by = case when tgt = 1 then p_actor else processing_by end,
    packed_at = case when tgt = 2 then now() else packed_at end, packed_by = case when tgt = 2 then p_actor else packed_by end,
    shipped_at = case when tgt = 3 then now() else shipped_at end, shipped_by = case when tgt = 3 then p_actor else shipped_by end,
    status = case when tgt = 4 then 'delivered' else status end,
    picked_up_at = case when tgt = 4 then now() else picked_up_at end, picked_up_by = case when tgt = 4 then p_actor else picked_up_by end,
    updated_at = now()
  where id = o.id;

  v_kind := case tgt when 1 then 'processing' when 2 then 'packed' when 3 then (case when ship then 'shipped' else 'ready' end) else 'delivered' end;
  insert into loja.order_events (order_id, kind, actor, actor_id, note) values (o.id, v_kind, p_actor, p_actor_id, v_note);
  return names[tgt + 1];
end $$;

revoke all on function loja.set_order_stage(uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function loja.set_order_stage(uuid, text, text, uuid, text) to service_role;

-- A retirada no balcão (loja.confirm_pickup) não muda: aceita pular etapas, e a linha mostra as que ficaram para trás como "pulou".
