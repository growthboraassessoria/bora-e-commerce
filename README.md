# BORA Store

Loja online da BORA: hero 3D, experiência 3D com rolagem, categorias, produto, página de vendas, sacola, checkout, pagamento, obrigado e políticas. Next.js 16 + React 19 + three.js (react-three-fiber) + Supabase + Mercado Pago.

## Rodar

```bash
npm install
npm run dev            # http://localhost:3500
```

Sem variáveis de ambiente, a loja roda no **modo local**: catálogo de `lib/catalog-seed.ts`, pedidos e estoque em `.data/loja.json`, pagamento **simulado** (botão "Simular pagamento aprovado"). Serve para desenvolver e testar; não usar em produção.

## Páginas

| Rota | O que é |
| --- | --- |
| `/` | Home com hero 3D (escudo BORA extrudado + pista) |
| `/volta-18k` | Pré-venda VOLTA 18K · Edição Pampulha: hero 3D, grade por tamanho, compra direta (config em `lib/presale.ts`) |
| `/experiencia` | Pista 3D: cada peça numa estação, rolagem nativa |
| `/colecao/[slug]` | Categoria (`todos`, `camisetas`, `agasalhos`, `triathlon`, `acessorios`, `kits`) com filtros por cor, tamanho, estoque e ordem |
| `/produto/[slug]` | Produto: galeria com zoom, cor, tamanho, guia de medidas, frete por CEP |
| `/lancamento/kit-letz-bora` | Página de vendas do Kit letz BORA |
| `/carrinho` | Sacola completa (também há a gaveta lateral) |
| `/checkout` | Checkout em uma página: contato, entrega (CEP preenche o endereço), frete, Pix/cartão/boleto, cupom |
| `/pagamento/[id]` | Pix simulado (só no modo sem Mercado Pago) |
| `/obrigado/[id]?t=` | Confirmação do pedido (link assinado) |
| `/meus-pedidos` | Pedidos do cliente por CPF + celular, com status e "Ver passe" |
| `/senha` | Tela de senha (o proxy mostra no lugar do site quando a loja está fechada) |
| `/politicas/[slug]` | Trocas, entrega, pagamento, privacidade e termos |
| `/busca` | Busca |

## Supabase

Tudo fica no schema **`loja`**, isolado do `public` (LP e BORA OS). O painel da loja fica no **BORA OS** (módulo `/loja`: pedidos, pagamentos, retirada, estoque e cupons), então a loja usa o mesmo banco do OS.

1. As migrations da loja (`0001_loja.sql` e `0002_painel.sql`, aqui só como fonte) entram no banco pela migration **`0024_loja.sql` do BORA OS**, que é o dono das migrations do banco. Não rodar `supabase db push` desta pasta.
2. Conferir a conta da CLI com `supabase projects list` antes de aplicar.
3. Rodar `supabase/seed.sql` (gerado por `node scripts/gen-seed-sql.mjs`).
4. No painel: **Project Settings → API → Exposed schemas**: incluir `loja`.
5. Variáveis: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ORDER_LINK_SECRET`, `NEXT_PUBLIC_SITE_URL`.

Cada pedido tem um ID legível (`BR-XXXXXX`) e um histórico (`loja.order_events`). Retirada no evento = status `delivered`, gravado pelo balcão do OS.

Segurança: RLS ligada em todas as tabelas e nenhum acesso para `anon`/`authenticated`; só o servidor (service_role) lê e grava. O estoque é reservado de forma atômica em `loja.create_order` e devolvido por `loja.release_expired_orders` quando o prazo de pagamento vence (Pix e cartão 60 min). `loja.mark_order_paid` é idempotente.

## Descontos, senha, carrinho abandonado e meus pedidos

Tabelas novas na migration `supabase/migrations/0003_loja_v2.sql` (no OS: `0029_loja_v2.sql`). Os cupons e a senha são criados no BORA OS.

**Descontos (padrão Shopify)** · `lib/pricing.ts` (regras e conta) + `lib/server/quote.ts` (escolha) + `lib/server/catalog.ts` (`getDiscountByCode`, `getAutomaticDiscounts`).
- Tipos: percentual ou valor fixo (centavos) sobre os itens elegíveis; elegíveis = sacola toda, produtos (`product_ids`, aceita id ou slug) ou categorias (`category_slugs`, vale a categoria do produto ou uma etiqueta).
- Requisito mínimo (subtotal e/ou quantidade dos itens elegíveis), período (`starts_at`/`expires_at`), limite total (`max_uses`, conferido de novo e de forma atômica no `create_order`) e uma vez por CPF (`once_per_customer`, conferido no `placeOrder` contra pedidos pendentes/pagos).
- **Um desconto por pedido.** Automáticos válidos entram sozinhos; havendo vários, fica o que deixa o total menor. Um cupom digitado só substitui o automático se deixar o total **menor** (empate fica o automático, e o cliente vê o aviso). A comparação já conta o Pix.
- Pix: 5% sobre o valor já descontado, a não ser que o desconto tenha `combines_with_pix = false`.
- O resumo mostra "Desconto automático: <título>" ou "Cupom <código>". O link `?cupom=CODE` continua valendo. Se o total do servidor for diferente do que a pessoa viu, o pedido não é criado e ela confere de novo.

**Loja com senha** · `proxy.ts` + `components/store/StoreGate.tsx` + `lib/server/settings.ts` (cache de 15 s, tag `loja-settings`).
- Com `status = password`, quem não tem o cookie `bora_store_access` (HMAC de `access:<password_version>`, 30 dias) vê a tela de senha; `/api/*` responde 403; o `placeOrder` recusa. Trocar a senha no OS sobe a versão e derruba os acessos antigos.
- Ficam sempre abertos: `/api/webhooks/*`, `/api/revalidate`, `/api/t` (analytics), `/obrigado`, `/pagamento`, `/meus-pedidos`, `/senha`, imagens de compartilhamento (`/opengraph-image`, `/produto/*/opengraph-image*`), `/sitemap.xml`, `/robots.txt` e `/manifest.webmanifest` (lista em `lib/server/settings-core.ts`). O `SALES_OPEN` continua valendo por cima.
- Testar no modo local: `node scripts/loja-senha.mjs <senha>` fecha, `node scripts/loja-senha.mjs --abrir` abre (espere 15 s). `--hash <senha>` mostra o hash no formato do OS.

**Carrinho abandonado** · `lib/checkout-session.ts` (navegador) → `POST /api/checkout-session` → `loja.checkouts`.
- Token aleatório em `localStorage["bora-checkout-token"]`. Grava quando a sacola muda (sem dados pessoais) e a cada etapa (contato, retirada, pagamento), com debounce. Preço e nome vêm do servidor. Guarda UTM (`bora-utm`) e visitante (`bora-vid`).
- Pedido criado → `completed_at` e `order_id`. Link de recuperação: `/checkout?recuperar=<token>` remonta a sacola e o contato (sem CPF) e marca `recovered_at`.

**Meus pedidos** · `/meus-pedidos`: CPF + celular (os dois precisam bater), limite de 10 buscas por IP a cada 10 min e resposta com tempo mínimo. Mostra ID, data, itens com tamanho, total, status, quem retira e "Ver passe".

**Eventos** · a loja chama `track()` (`lib/analytics.ts`) com nomes do GA4: `view_item`, `select_item`, `select_size`, `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout`, `add_contact_info`, `add_pickup_info`, `add_payment_info`, `apply_coupon`, `remove_coupon`, `purchase` (uma vez por pedido), `payment_failed`, `checkout_error`, `meus_pedidos_search`, `store_password_submit`, `whatsapp_click`. Nunca com CPF, e-mail ou telefone.

## Google Maps

O mapa do local de retirada (`components/presale/PickupMap.tsx`) usa a API JavaScript do Google Maps com a chave `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, a mesma do BORA OS. Em produção, liberar o domínio da loja nas restrições da chave. Sem chave, a página mostra o mapa incorporado do Google.

## Pagar.me (gateway da BORA)

Checkout transparente pela API v5 (`lib/server/pagarme.ts`, `lib/pagarme-client.ts`, `components/checkout/CardFields.tsx`). Conta `acc_4PVW8nmFpbHKPL7v`.

- **Cartão:** o navegador gera o token direto na Pagar.me com a chave pública (`POST /tokens?appId=`); o servidor cadastra o cliente, salva o cartão a partir do token (`card_id`, funciona em conta Gateway e PSP) e cria o pedido com parcelas (até 3x, parcela mínima R$ 30) e endereço de cobrança. Aprovado → obrigado; recusado → a reserva é cancelada e as peças voltam para a grade.
- **Pix:** pedido com QR (copia e cola + imagem) que vence com a reserva (60 min). A página de pagamento consulta a Pagar.me a cada 5 s e segue sozinha quando o pagamento cai.
- **Webhook:** `/api/webhooks/pagarme` com usuário e senha (`PAGARME_WEBHOOK_USER`, `PAGARME_WEBHOOK_PASSWORD`); não confia no corpo do aviso e consulta o pedido na Pagar.me antes de dar baixa.
- **Variáveis:** `PAGARME_SECRET_KEY` (só servidor; sem ela a loja usa o pagamento simulado) e `NEXT_PUBLIC_PAGARME_PUBLIC_KEY`. O domínio da loja precisa estar em Pagar.me → Configurações → Conta → Domínios (sem isso o token do cartão não é gerado).
- **Teste sem chave e sem cobrança:** `node scripts/pagarme-mock.mjs 3590`, build com `NEXT_PUBLIC_SALES_OPEN=1 NEXT_PUBLIC_PAGARME_API_URL=http://localhost:3590`, servidor com `PAGARME_SECRET_KEY=sk_mock PAGARME_API_URL=http://localhost:3590`, e `node scripts/qa-pagarme.mjs http://localhost:3530 http://localhost:3590 [largura]`.
- O código do Mercado Pago ficou só como referência (`lib/server/payments.ts`, `app/api/webhooks/mercadopago`); não é mais escolhido.

## Analytics (próprio, tipo GA4)

Coleta própria, sem terceiros: `components/analytics/Analytics.tsx` liga o motor (`lib/analytics-client.ts`), que manda os eventos em lote com `sendBeacon` para `/api/t` (`app/api/t/route.ts`). O servidor valida (zod, até 64 KB e 50 eventos por lote), descarta robôs pelo user agent, apaga o que parece e-mail/CPF/CNPJ/telefone/cartão (`lib/server/analytics-privacy.ts`), completa país/região/cidade pelos cabeçalhos da Vercel e grava em `loja.events` (Supabase) ou em `.data/events.jsonl` (modo local). Responde 204 na hora; a gravação roda depois (`after`).

- **Visitante e sessão:** `visitor_id` anônimo em `localStorage["bora-vid"]`; `session_id` em `sessionStorage`, renovado após 30 min sem atividade. Os dois vão em todo evento.
- **Origem:** UTMs, `gclid` e `fbclid` da primeira visita e da sessão em `localStorage["bora-utm"]`. As colunas `utm_*` de cada evento têm a origem da sessão; sem UTM vale o referrer (`google` / `organic`, `instagram.com` / `social`, outro site / `referral`) ou `(direct)` / `(none)`.
- **Colunas:** `path`, `title`, `referrer` (site de fora ou a página anterior), `device`/`browser`/`os`, `country`/`region`/`city`. Tela, janela, idioma e fuso vão em `props` do `page_view` e do `session_start`.
- **Desligar:** `localStorage["bora-no-track"]="1"`, o botão no aviso de privacidade ou `?bora-no-track=1` no endereço (`?bora-no-track=0` religa). Navegador automatizado (`navigator.webdriver`) não conta.
- **Eventos da loja:** `track(nome, props)` de `lib/analytics.ts` (nunca quebra a tela; antes do coletor ligar, os eventos esperam numa fila). E-commerce no formato GA4: `currency: "BRL"`, `value` em reais, `items: [{ item_id, item_name, item_variant, price, quantity }]`, `transaction_id` no `purchase`.

Eventos automáticos:

| Evento | Quando | props principais |
| --- | --- | --- |
| `first_visit` | primeira visita do navegador | `landing_page` |
| `session_start` | sessão nova | `session_number`, `landing_page`, `gclid`, `fbclid`, `first_source/medium/campaign` |
| `page_view` | toda navegação (inclusive do App Router) | `query` (só parâmetros sem dado pessoal), `nav` (`load`/`route`) |
| `user_engagement` | ao trocar de página ou esconder a aba | `engagement_time_msec` (ms com a aba visível e em foco) |
| `scroll` | 25, 50, 75, 90 e 100% da página | `percent_scrolled` |
| `first_interaction` | primeiro clique/tecla/toque/roda na página | `ms`, `type` |
| `ui_click` | clique em botão ou link interno | `element`, `text` (até 40 letras), `href`, `section` |
| `click` | link para outro site | `outbound: true`, `link_domain`, `link_url` |
| `contact_click` | WhatsApp, e-mail ou telefone | `method` |
| `file_download` | link para pdf, zip, csv, mp4, glb... | `file_name`, `file_extension` |
| *nome do `data-track`* | clique em elemento com `data-track="nome"` | cada `data-track-xxx` vira `props.xxx` |
| `rage_click` | 3+ cliques no mesmo ponto em 1 s | `count`, `element`, `text` |
| `form_start` / `form_submit` | primeiro campo focado / envio (nunca o conteúdo) | `form_id` (`id`, `name` ou `data-track-form`), `form_destination` |
| `view_search_results` | `/busca?q=` | `search_term`, `results` |
| `page_not_found` | página 404 | `path` |
| `web_vitals` | LCP, CLS, INP, FCP e TTFB (uma vez por carregamento) | `name`, `value` (ms; CLS sem unidade), `rating` |
| `js_error` | `window.onerror` e promessa rejeitada (5 por página) | `kind`, `message` (até 150 letras), `source`, `line` |
| `visibility` | aba escondida / visível | `state`, `hidden_ms` |
| `experiencia_3d_start` | cena 3D pronta (home, volta-18k, experiência) | `scene`, `load_ms` |
| `experiencia_3d_progress` / `experiencia_3d_complete` | estação alcançada / chegada na `/experiencia` | `station`, `slug`, `total` |
| `generate_lead` | cadastro na newsletter | `method` |

Variáveis opcionais (sem elas, nada externo carrega; com a medição desligada, também não):

- `NEXT_PUBLIC_GA_ID` (ex.: `G-XXXX`): carrega o gtag e repassa os eventos (o `page_view` vai manual, sem o `?t=` do link do pedido). Os que o GA4 já mede sozinho ou reserva (`session_start`, `scroll`, cliques de saída, formulários...) não são repassados: deixe a "medição otimizada" ligada no GA4.
- `NEXT_PUBLIC_META_PIXEL_ID`: carrega o Pixel e mapeia `page_view`→PageView, `view_item`→ViewContent, `add_to_cart`→AddToCart, `begin_checkout`→InitiateCheckout, `add_payment_info`→AddPaymentInfo, `purchase`→Purchase (com `eventID` pelo `transaction_id`), além de Search, Lead e Contact.

Teste: `node scripts/qa-analytics.mjs` com o servidor de desenvolvimento no ar (modo local). Os eventos de teste ficam com `utm_source = "qa"`.

## SEO

- **Metadata por página** com `pageMeta()` de `lib/seo.ts`: título, descrição, canonical, Open Graph e cartão do X. A `/volta-18k` continua lendo título, descrição, imagem, canonical e noindex do Builder (`getSeo`). Busca e sacola ficam sempre fora do Google; o resto segue `INDEXABLE` (layout + `robots.ts`).
- **JSON-LD** (`components/seo/JsonLd.tsx`): Organization e WebSite com busca na home; Product completo (preço, estoque, pré-venda, retirada no evento, troca em 7 dias) e BreadcrumbList no produto; BreadcrumbList e ItemList nas coleções; FAQPage, ItemList e BreadcrumbList na `/volta-18k` e no lançamento; BreadcrumbList nas políticas.
- **Arquivos:** `app/sitemap.ts` (home, pré-venda, coleções com produto, produtos ativos com data e fotos, políticas, experiência, meus pedidos), `app/robots.ts`, `app/manifest.ts`, `app/opengraph-image.tsx` (marca) e `app/(loja)/produto/[slug]/opengraph-image.tsx` (foto, nome e preço; a foto WebP vira JPEG com o sharp).

## Testes

```bash
node scripts/qa-flow.mjs   # compra de ponta a ponta no modo simulado
node scripts/loja-senha.mjs bora123   # porta com senha no modo local (--abrir para abrir)
node scripts/qa-shots.mjs ./.qa   # prints desktop e celular + rolagem horizontal
node scripts/qa-analytics.mjs    # analytics (eventos em .data/events.jsonl) + JSON-LD, sitemap e robots
```

## Antes de publicar

- Pré-venda: preencher `closesAt` e `shipsFrom` em `lib/presale.ts`. Grade real da pré-venda já está no catálogo (200 peças).
- Preços, estoques (fora da pré-venda), medidas e tabela de frete são **provisórios** (`lib/catalog-seed.ts`, `lib/shipping.ts`, `components/product/SizeGuide.tsx`).
- Dados da empresa entre colchetes em `lib/config.ts` (razão social, CNPJ, e-mail, WhatsApp).
- Políticas em `lib/policies.tsx` são minutas: revisar com o jurídico.
- Conferir com a BORA se o contrato com a adidas permite vender vestuário próprio.
- Não há painel de pedidos ainda: os pedidos ficam em `loja.orders` (Supabase) até existir um módulo no BORA OS.

## No ar (demonstração)

Desde 20/11/2026, https://borausar.vercel.app está em **modo demonstração**: `NEXT_PUBLIC_SALES_OPEN=1` e `NEXT_PUBLIC_SALES_DEMO=1` na Vercel, com pagamento simulado (sem `MP_ACCESS_TOKEN`) e `ORDER_LINK_SECRET` cadastrado. Sem banco, os pedidos vão para o `/tmp` de cada servidor e para uma cópia criptografada no cookie `bora_order` (`lib/server/order-cookie.ts`), então a jornada funciona mesmo que a Vercel troque de servidor. Esses pedidos somem e não aparecem no BORA OS. Para voltar à vitrine, apague `NEXT_PUBLIC_SALES_OPEN` e `NEXT_PUBLIC_SALES_DEMO` e publique de novo.

## Vitrine (como era antes)

- https://borausar.vercel.app · projeto Vercel `borausar` (time `bora-assessoria`). Publicar: `vercel deploy --prod --scope bora-assessoria` nesta pasta (o `.vercelignore` deixa de fora `.data`, `.qa`, `assets-src` e `.env*.local`; o `vercel.json` marca o framework Next.js, sem ele a Vercel serve 404).
- **Vendas fechadas** enquanto `NEXT_PUBLIC_SALES_OPEN` não for `1`: botões de compra viram "Pré-venda abre em breve" e abrem o WhatsApp com a peça e o tamanho; sacola, checkout e cadastro de e-mail ficam fechados. Em desenvolvimento a compra fica aberta.
- **Fora do Google** enquanto `NEXT_PUBLIC_SITE_INDEXABLE` não for `1`.
- Para abrir a venda: aplicar a `0024_loja.sql` do BORA OS, cadastrar `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ORDER_LINK_SECRET`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` e `NEXT_PUBLIC_SALES_OPEN=1` na Vercel e publicar de novo. Para o mapa personalizado: liberar `borausar.vercel.app` na chave do Google Maps e cadastrar `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (sem ela aparece o mapa padrão do Google).

