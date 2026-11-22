// Campos da pré-venda editáveis no BORA OS (Builder › Conteúdo), no mesmo formato de BORA OS/lib/contentSchema.ts.
// Ao registrar o site "bora-store" no OS, copiar este bloco para lá. O padrão (def) é o texto que a página usa hoje.
export type FieldDef = { key: string; label: string; kind: "text" | "textarea" | "lines" | "url" | "bool"; max?: number; def?: string; hint?: string };

export const PRESALE_ROUTE = "/volta-18k";

export const PRESALE_FIELDS: FieldDef[] = [
  { key: "hero.chip", label: "Hero · selo verde", kind: "text", max: 30, def: "Pré-venda aberta" },
  { key: "hero.edition", label: "Hero · edição", kind: "text", max: 30, def: "Edição Pampulha" },
  { key: "hero.eyebrow", label: "Hero · linha de cima", kind: "text", max: 40, def: "BORA apresenta" },
  { key: "hero.title_a", label: "Hero · título (linha 1)", kind: "text", max: 12, def: "Volta" },
  { key: "hero.title_b", label: "Hero · título (linha 2, contorno neon)", kind: "text", max: 8, def: "18K" },
  { key: "hero.sub", label: "Hero · texto", kind: "textarea", max: 220, def: "Duas peças para a volta mais famosa de BH. Camiseta de algodão e regata cropped, as duas pretas com verde neon, em edição limitada. Garanta online e retire no evento." },
  { key: "hero.cta", label: "Hero · botão principal", kind: "text", max: 28, def: "Garantir a minha" },
  { key: "steps.title", label: "Como funciona · título", kind: "text", max: 60, def: "Três passos até a largada." },
  { key: "steps.items", label: "Como funciona · passos (título | texto, um por linha)", kind: "lines", def: "Escolha e pague | Tamanho na grade, pagamento por Pix ou cartão, pela Pagar.me. Seu cadastro vai junto com o pedido.\nSua peça fica reservada | A confirmação chega por e-mail na hora do pagamento, com o número do pedido.\nRetire no evento | No dia da prova, das 4h às 11h, na Av. Otacílio Negrão de Lima, 2827. É só levar documento e o número do pedido." },
  { key: "shirt.story", label: "Camiseta · texto", kind: "textarea", max: 260, def: "Preta, de algodão, com o BORA pequeno no peito e o selo LETZ BORA nas costas. Para a largada, para a chegada e para o café depois." },
  { key: "cropped.story", label: "Cropped · texto", kind: "textarea", max: 260, def: "Preta com estampa verde neon, tecido performance que seca rápido e as curvas de nível da BORA em volta do raio nas costas. Se vê de longe no pelotão." },
  { key: "pickup.title", label: "Retirada · título", kind: "text", max: 40, def: "Retire no evento" },
  { key: "pickup.note", label: "Retirada · observação", kind: "textarea", max: 220, def: "Não fazemos envio pelo correio. A peça é entregue no local, no dia da prova. Também vamos vender lá, enquanto houver peças: garantindo agora, a sua já está separada." },
  { key: "faq", label: "Perguntas (pergunta | resposta, uma por linha)", kind: "lines", def: "" , hint: "Vazio = perguntas padrão da página." },
  { key: "final.title", label: "Chamada final · título", kind: "text", max: 30, def: "Vista a volta." },
  { key: "disclaimer", label: "Aviso de rodapé", kind: "textarea", max: 220, def: "Coleção BORA inspirada na Volta da Pampulha. Não é produto oficial da prova nem tem ligação com a organização do evento." },
];

export const PRESALE_SETTINGS: FieldDef[] = [
  { key: "presale.event_date", label: "Data da retirada (dia da prova)", kind: "text", hint: "Ex.: 07/12/2026. Vazio = \"no dia da prova\"." },
  { key: "presale.open", label: "Pré-venda aberta", kind: "bool", hint: "Desligado = botões viram \"Pré-venda encerrada\"." },
];
