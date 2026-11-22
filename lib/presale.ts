// Pré-venda VOLTA 18K. Valores padrão: o BORA OS (Builder) pode sobrescrever os textos (ver lib/cms-schema.ts).
// ATENÇÃO: não é produto oficial da prova; a página deixa isso claro.
export const PRESALE = {
  slug: "volta-18k",
  path: "/volta-18k",
  name: "VOLTA 18K",
  edition: "Edição Pampulha",
  tag: "volta-18k",
  productSlugs: ["camiseta-letz-bora-algodao", "regata-cropped-bora"],
  // Datas a definir com a BORA. Enquanto forem null, a página não promete data.
  closesAt: null as string | null, // fim da pré-venda online, ex.: "2026-11-30T23:59:00-03:00"
  eventDate: null as string | null, // dia da retirada, ex.: "07/12/2026"
};

// Sem envio pelo Brasil: a entrega (e a venda no local) acontece no evento.
export const PICKUP = {
  address: "Av. Otacílio Negrão de Lima, 2827",
  city: "Pampulha · Belo Horizonte, MG",
  opens: "4h",
  closes: "11h",
  query: "Av. Otacílio Negrão de Lima, 2827, Pampulha, Belo Horizonte, MG",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("Av. Otacílio Negrão de Lima, 2827, Belo Horizonte, MG"),
  bring: "Leve um documento com foto e o número do pedido (está no e-mail de confirmação).",
};

export const pickupWhen = () => (PRESALE.eventDate ? `Dia ${PRESALE.eventDate}, das ${PICKUP.opens} às ${PICKUP.closes}` : `No dia da prova, das ${PICKUP.opens} às ${PICKUP.closes}`);
export const pickupLine = () => `${PICKUP.address} · ${PICKUP.city}`;
