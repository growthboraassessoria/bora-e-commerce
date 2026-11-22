import { STORE } from "./config";
import { PICKUP, pickupWhen } from "./presale";
import OptOut from "@/components/analytics/OptOut";
import PaymentText from "@/components/store/PaymentText";

// MINUTAS: revisar com o jurídico da BORA antes de publicar (dados da empresa entre colchetes em lib/config.ts).
export const POLICY_UPDATED = "20/11/2026";

export const POLICIES: { slug: string; title: string; summary: string; body: React.ReactNode }[] = [
  {
    slug: "trocas-e-devolucoes",
    title: "Trocas e devoluções",
    summary: "Troca de tamanho na retirada, 7 dias para desistir e garantia contra defeito.",
    body: (
      <>
        <p>Queremos que você treine feliz com a peça. Se algo não serviu, a gente resolve.</p>
        <h2>Desistência da compra (7 dias)</h2>
        <p>Você pode desistir da compra online em até <strong>7 dias corridos</strong> a partir da retirada, sem precisar dizer o motivo, como garante o artigo 49 do Código de Defesa do Consumidor. Devolvemos o valor integral pelo mesmo meio de pagamento.</p>
        <h2>Troca de tamanho</h2>
        <ul>
          <li>Na hora da retirada, experimente: se não servir, trocamos pelo tamanho que você precisar, se ainda houver na grade.</li>
          <li>Depois do evento, a troca é combinada pelo e-mail ou WhatsApp e feita em BH, com a peça sem uso e com etiqueta.</li>
          <li>Se o tamanho que você quer tiver acabado, você recebe o valor de volta.</li>
        </ul>
        <h2>Produto com defeito</h2>
        <p>Se a peça chegar com defeito ou apresentar defeito de fabricação, você tem <strong>90 dias</strong> para nos avisar (artigo 26 do CDC). Analisamos em até 30 dias e trocamos a peça, devolvemos o valor ou abatemos o preço, como você preferir.</p>
        <h2>Como pedir</h2>
        <p>Envie o número do pedido, o motivo e uma foto da peça para <strong>{STORE.email}</strong> ou pelo WhatsApp {STORE.whatsapp}. Respondemos em até 2 dias úteis ({STORE.hours}).</p>
        <h2>Reembolso</h2>
        <ul>
          <li><strong>Pix:</strong> transferência para uma conta no seu CPF em até 5 dias úteis após recebermos a peça.</li>
          <li><strong>Cartão:</strong> estorno solicitado à Pagar.me em até 5 dias úteis; o crédito aparece em até duas faturas, conforme o seu banco.</li>
        </ul>
        <h2>Não trocamos</h2>
        <p>Peças com sinais de uso, lavadas, sem etiqueta ou danificadas por mau uso. A regata cropped só é trocada sem uso, por higiene, salvo defeito.</p>
      </>
    ),
  },
  {
    slug: "entrega",
    title: "Retirada no evento",
    summary: "Não fazemos envio pelo correio: a peça é entregue no evento, na Pampulha.",
    body: (
      <>
        <h2>Onde</h2>
        <p><strong>{PICKUP.address}</strong> · {PICKUP.city}. <a href={PICKUP.mapsUrl} target="_blank" rel="noopener noreferrer">Ver no mapa</a>.</p>
        <h2>Quando</h2>
        <p>{pickupWhen()}. A casa abre às {PICKUP.opens} e o evento encerra às {PICKUP.closes}.</p>
        <h2>O que levar</h2>
        <p>{PICKUP.bring}</p>
        <h2>Outra pessoa vai retirar?</h2>
        <p>No checkout, escolha “Outra pessoa” e informe o nome, o CPF e o celular de quem vai buscar. Essa pessoa leva um documento com foto e o ID do pedido. Para trocar quem retira depois da compra, fale com a gente antes do evento.</p>
        <h2>Não pôde ir?</h2>
        <p>Fale com a gente pelo {STORE.email} ou WhatsApp {STORE.whatsapp} até o dia anterior. Combinamos outra forma de retirada em BH ou devolvemos o valor.</p>
        <h2>Venda no local</h2>
        <p>Também vendemos no evento, enquanto houver peças. Quem comprou na pré-venda já tem a sua separada.</p>
      </>
    ),
  },
  {
    slug: "pagamento",
    title: "Pagamento",
    summary: "Pix e cartão de crédito pela Pagar.me: descontos, parcelas, bandeiras e cupons.",
    body: (
      <>
        <p>Os pagamentos da BORA Store são processados pela <strong>Pagar.me</strong>. Os dados do cartão vão direto para a Pagar.me, criptografados: a BORA não vê nem guarda o número do cartão.</p>
        <h2>Pix</h2>
        <p><PaymentText kind="pix" /></p>
        <h2>Cartão de crédito</h2>
        <p><PaymentText kind="card" /></p>
        <h2>Cupons</h2>
        <p>Um cupom por pedido. O cupom não é trocado por dinheiro.</p>
        <h2>Nota fiscal</h2>
        <p>Emitimos a nota fiscal eletrônica no CPF informado no checkout e enviamos para o seu e-mail.</p>
      </>
    ),
  },
  {
    slug: "privacidade",
    title: "Aviso de privacidade",
    summary: "Que dados usamos para entregar seu pedido, por quê e como você controla isso (LGPD).",
    body: (
      <>
        <p>Este aviso explica como a {STORE.legalName} (CNPJ {STORE.cnpj}), controladora dos dados, trata as informações de quem compra na BORA Store, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>
        <h2>Que dados coletamos</h2>
        <ul>
          <li><strong>Compra:</strong> nome, e-mail, celular e CPF (para a nota fiscal e para conferir a retirada).</li>
          <li><strong>Retirada por outra pessoa:</strong> nome, CPF e celular de quem você indicar, usados só para conferir a entrega no evento.</li>
          <li><strong>Pagamento:</strong> forma de pagamento e status. Os dados do cartão vão direto para a Pagar.me e não passam pela BORA; no pedido ficam só a bandeira e os últimos dígitos.</li>
          <li><strong>Navegação:</strong> os itens da sacola ficam guardados no seu próprio navegador. Também medimos o uso da loja de forma anônima (veja “Medição de navegação” abaixo).</li>
          <li><strong>Novidades:</strong> o e-mail, se você se cadastrar para receber os próximos drops.</li>
        </ul>
        <h2>Para que usamos</h2>
        <ul>
          <li>Processar o pagamento, emitir a nota fiscal e entregar a peça na retirada (execução do contrato e obrigação legal).</li>
          <li>Atender trocas, devoluções e dúvidas (execução do contrato).</li>
          <li>Prevenir fraudes (legítimo interesse).</li>
          <li>Entender como a loja é usada e melhorar páginas, velocidade e erros (legítimo interesse).</li>
          <li>Enviar novidades da loja, só se você pediu (consentimento). Você pode sair a qualquer momento pelo link no e-mail.</li>
        </ul>
        <h2>Medição de navegação (analytics)</h2>
        <p>A loja tem uma medição própria, parecida com o Google Analytics, que roda no nosso servidor. Ela registra o que acontece nas páginas: páginas vistas, de onde a visita veio (por exemplo, um link do Instagram ou uma campanha), cliques em botões, rolagem, tempo na página, velocidade de carregamento e erros. Junto vai o tipo de aparelho, o navegador, o idioma e a cidade aproximada, que vem da rede e não do seu GPS.</p>
        <p>Os eventos <strong>não levam dados pessoais</strong>: não guardamos o que você digita nos formulários, e o servidor apaga qualquer coisa que pareça e-mail, CPF ou telefone. Para contar visitas e sessões, o navegador guarda um <strong>identificador anônimo</strong> e aleatório (no armazenamento local do navegador, com o nome “bora-vid”), que não tem seu nome nem é ligado ao seu cadastro. Usamos com base no legítimo interesse e guardamos os eventos por até 14 meses.</p>
        <p>Se você preferir, desligue a medição neste navegador pelo botão abaixo (ou abra a loja com <strong>?bora-no-track=1</strong> no fim do endereço). Se a loja passar a usar Google Analytics ou Meta Pixel, eles também deixam de carregar quando a medição está desligada.</p>
        <OptOut />
        <h2>Com quem compartilhamos</h2>
        <p>Só com quem precisa para a compra acontecer: Pagar.me (pagamento), o emissor da nota fiscal e o provedor que hospeda o banco de dados da loja (Supabase). Quando ligados, o Google Analytics e o Meta Pixel recebem os eventos de navegação, sem dados pessoais. Não vendemos dados.</p>
        <h2>Por quanto tempo</h2>
        <p>Dados de pedidos ficam guardados pelo prazo exigido pela lei fiscal e de consumo (em geral, 5 anos). O e-mail de novidades fica até você pedir para sair.</p>
        <h2>Seus direitos</h2>
        <p>Você pode pedir acesso, correção, portabilidade ou exclusão dos seus dados, e saber com quem eles foram compartilhados. Escreva para <strong>{STORE.email}</strong>. Respondemos em até 15 dias.</p>
        <h2>Segurança</h2>
        <p>Os dados ficam num banco acessível só pelo servidor da loja, com conexão criptografada. O link da página do pedido é exclusivo e assinado.</p>
      </>
    ),
  },
  {
    slug: "termos",
    title: "Termos de uso",
    summary: "As regras de uso da loja e das compras.",
    body: (
      <>
        <p>Ao comprar na BORA Store, operada por {STORE.legalName} (CNPJ {STORE.cnpj}, {STORE.address}), você concorda com estes termos.</p>
        <h2>Produtos e preços</h2>
        <p>Fazemos o possível para que fotos e descrições correspondam às peças. Cores podem variar um pouco conforme a tela. Preços e estoque podem mudar sem aviso, mas o preço que vale é o confirmado no checkout.</p>
        <h2>Pedido</h2>
        <p>O pedido é confirmado quando o pagamento é aprovado. Se houver erro evidente de preço ou falta de estoque depois da compra, avisamos e devolvemos o valor integral.</p>
        <h2>Reserva de estoque</h2>
        <p>Ao finalizar o checkout, as peças ficam reservadas por 60 minutos para o pagamento. Sem pagamento, o pedido é cancelado e as peças voltam para a grade.</p>
        <h2>Trocas, entregas e privacidade</h2>
        <p>Valem as políticas de <a href="/politicas/trocas-e-devolucoes">trocas e devoluções</a>, <a href="/politicas/entrega">retirada no evento</a>, <a href="/politicas/pagamento">pagamento</a> e o <a href="/politicas/privacidade">aviso de privacidade</a>.</p>
        <h2>Propriedade da marca</h2>
        <p>A marca BORA, o escudo com raio, os padrões e as fotos da loja pertencem à BORA. Não podem ser usados sem autorização.</p>
        <h2>Atendimento</h2>
        <p>{STORE.email} · WhatsApp {STORE.whatsapp} · {STORE.hours}.</p>
        <h2>Foro</h2>
        <p>Fica eleito o foro do domicílio do consumidor, como prevê o Código de Defesa do Consumidor.</p>
      </>
    ),
  },
];
