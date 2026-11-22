-- BORA Store · 0006 (no BORA OS: 0032_loja_catalogo.sql) · cadastro de produtos no padrão da Shopify (BORA OS → Loja → Produtos e Coleções).
-- Produto: até 3 opções com nome livre e valores (options = [{"name":"Cor","values":[{"value":"Preto","hex":"#0a0a0a"}]}, ...]),
--   tipo do produto, custo por item, título e descrição para buscadores. Status: active (Ativo), draft (Rascunho), archived (Arquivado).
-- Variante: valor de cada opção (options = {"Cor":"Preto","Tamanho":"M","Estilo":"Cropped"}), foto própria, preço "de",
--   código de barras e archived (variante removida que já foi vendida: some da loja, os pedidos continuam apontando para ela).
--   color, color_hex e size continuam preenchidos a partir das opções Cor e Tamanho (a loja e o OS antigos leem essas colunas).
-- Coleções: loja.categories vira a lista de coleções; loja.product_collections liga produto ↔ coleção (várias), com a ordem do
--   produto dentro da coleção. products.category_slug continua sendo a coleção principal (compatibilidade).
-- Fotos: bucket público loja-produtos no Storage (só imagens, até 5 MB). Só o servidor (service_role) grava.
-- Idempotente: pode rodar de novo sem estragar nada.

-- ---------- Produtos ----------
alter table loja.products
  add column if not exists options jsonb not null default '[]',
  add column if not exists product_type text not null default '',
  add column if not exists cost_cents int,
  add column if not exists seo_title text not null default '',
  add column if not exists seo_description text not null default '';

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'loja.products'::regclass and conname = 'products_cost_chk') then
    alter table loja.products add constraint products_cost_chk check (cost_cents is null or cost_cents >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'loja.products'::regclass and conname = 'products_options_chk') then
    alter table loja.products add constraint products_options_chk check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) <= 3);
  end if;
  -- O status já aceita 'archived' desde a 0024 (loja: 0001). Se algum banco tiver outro CHECK, troca por um que aceite.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'loja.products'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%status%archived%'
  ) then
    alter table loja.products drop constraint if exists products_status_check;
    alter table loja.products add constraint products_status_check check (status in ('active', 'draft', 'archived'));
  end if;
end $$;

-- ---------- Variantes ----------
alter table loja.product_variants
  add column if not exists options jsonb not null default '{}',
  add column if not exists image text,
  add column if not exists compare_at_cents int,
  add column if not exists barcode text,
  add column if not exists archived boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'loja.product_variants'::regclass and conname = 'product_variants_compare_chk') then
    alter table loja.product_variants add constraint product_variants_compare_chk check (compare_at_cents is null or compare_at_cents >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'loja.product_variants'::regclass and conname = 'product_variants_options_chk') then
    alter table loja.product_variants add constraint product_variants_options_chk check (jsonb_typeof(options) = 'object');
  end if;
end $$;

-- Variantes que já existem: opções a partir de color/size.
update loja.product_variants
set options = jsonb_strip_nulls(jsonb_build_object('Cor', nullif(color, ''), 'Tamanho', nullif(size, '')))
where options = '{}'::jsonb and (color <> '' or size <> '');

-- Produtos que já existem: opções Cor (com o código da cor) e Tamanho, na ordem das variantes.
update loja.products p
set options = coalesce((
  select jsonb_agg(x.opt order by x.ord)
  from (
    select 1 as ord, jsonb_build_object('name', 'Cor', 'values', jsonb_agg(jsonb_build_object('value', c.color, 'hex', c.hex) order by c.pos)) as opt
    from (
      select v.color, min(v.color_hex) as hex, min(v.position) as pos
      from loja.product_variants v where v.product_id = p.id and v.color <> '' group by v.color
    ) c
    having count(*) > 0
    union all
    select 2, jsonb_build_object('name', 'Tamanho', 'values', jsonb_agg(jsonb_build_object('value', s.size) order by s.pos))
    from (
      select v.size, min(v.position) as pos
      from loja.product_variants v where v.product_id = p.id and v.size <> '' group by v.size
    ) s
    having count(*) > 0
  ) x
), '[]'::jsonb)
where p.options = '[]'::jsonb;

-- ---------- Coleções (produto ↔ coleção, muitos para muitos) ----------
create table if not exists loja.product_collections (
  product_id text not null references loja.products(id) on delete cascade,
  collection_slug text not null references loja.categories(slug) on update cascade on delete cascade,
  position int not null default 0,
  created_at timestamptz not null default now(),
  primary key (product_id, collection_slug)
);
create index if not exists product_collections_slug_idx on loja.product_collections (collection_slug, position);

-- Vínculos iniciais: a categoria principal de cada produto e as etiquetas com o slug de uma coleção (ex.: volta-18k).
insert into loja.product_collections (product_id, collection_slug, position)
select l.product_id, l.slug, (row_number() over (partition by l.slug order by l.pos, l.product_id) - 1)::int
from (
  select p.id as product_id, p.category_slug as slug, p.position as pos from loja.products p
  union
  select p.id, c.slug, p.position from loja.products p join loja.categories c on c.slug = any (p.tags)
) l
on conflict (product_id, collection_slug) do nothing;

-- ---------- Segurança: só o servidor (service_role), como o resto do schema loja ----------
alter table loja.product_collections enable row level security;
revoke all on loja.product_collections from public, anon, authenticated;
grant all on loja.product_collections to service_role;

-- ---------- Fotos dos produtos (Storage) ----------
-- Público para leitura (a vitrine mostra pela URL pública). Sem políticas em storage.objects: anon e authenticated
-- não gravam nem apagam; o OS grava com a service_role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('loja-produtos', 'loja-produtos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'])
on conflict (id) do update
set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
