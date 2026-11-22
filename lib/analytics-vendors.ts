// Repasse opcional para GA4 e Meta Pixel. Só é usado quando NEXT_PUBLIC_GA_ID / NEXT_PUBLIC_META_PIXEL_ID existem.
// Os scripts oficiais são carregados pelo components/analytics/Analytics.tsx (next/script afterInteractive);
// aqui ficam a fila de cada um (igual ao snippet oficial) e o mapeamento dos eventos.
import type { TrackProps } from "./analytics";

export type Forwarder = (name: string, props: TrackProps) => void;

type Fn = ((...args: unknown[]) => void) & Record<string, unknown>;
type W = { dataLayer?: unknown[]; gtag?: Fn; fbq?: Fn; _fbq?: Fn };
const w = () => window as unknown as W;

/** Página atual sem parâmetros que identificam alguém (ex.: o ?t= do link do pedido). */
function safeLocation() {
  const sp = new URLSearchParams(location.search);
  const out = new URLSearchParams();
  sp.forEach((v, k) => { if (/^(q|cor|tamanho|disponivel|ordem|utm_[a-z]+|gclid|fbclid)$/.test(k)) out.set(k, v); });
  const q = out.toString();
  return `${location.origin}${location.pathname}${q ? `?${q}` : ""}`;
}

// O GA4 já mede sozinho (medição otimizada) ou reserva estes nomes: não repassamos para não duplicar.
const GA_SKIP = new Set(["first_visit", "session_start", "user_engagement", "scroll", "click", "file_download", "form_start", "form_submit", "view_search_results", "ui_click", "visibility", "first_interaction"]);

export function gaForwarder(id: string): Forwarder {
  const g = w();
  g.dataLayer = g.dataLayer || [];
  if (!g.gtag) {
    // gtag precisa receber o objeto `arguments`, não um array.
    g.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      g.dataLayer!.push(arguments);
    } as unknown as Fn;
    g.gtag("js", new Date());
    g.gtag("config", id, { send_page_view: false, page_location: safeLocation() });
  }
  return (name, props) => {
    if (GA_SKIP.has(name)) return;
    if (name === "page_view") {
      g.gtag!("set", { page_location: safeLocation(), page_title: document.title });
      g.gtag!("event", "page_view", { page_location: safeLocation(), page_title: document.title, page_referrer: document.referrer || undefined });
      return;
    }
    g.gtag!("event", name, props);
  };
}

type Item = { item_id?: string; item_name?: string; price?: number; quantity?: number };
const META: Record<string, string> = {
  page_view: "PageView",
  view_item: "ViewContent",
  add_to_cart: "AddToCart",
  begin_checkout: "InitiateCheckout",
  add_payment_info: "AddPaymentInfo",
  purchase: "Purchase",
  view_search_results: "Search",
  generate_lead: "Lead",
  sign_up: "CompleteRegistration",
  add_to_wishlist: "AddToWishlist",
  contact_click: "Contact",
};

export function metaForwarder(id: string): Forwarder {
  const g = w();
  if (!g.fbq) {
    // Fila igual ao snippet oficial do Pixel; o fbevents.js consome quando carregar.
    const n = function fbq(...args: unknown[]) {
      const self = n as unknown as { callMethod?: (...a: unknown[]) => void; queue: unknown[] };
      if (self.callMethod) self.callMethod.apply(n, args);
      else self.queue.push(args);
    } as unknown as Fn;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    g.fbq = n;
    if (!g._fbq) g._fbq = n;
    g.fbq("init", id);
  }
  return (name, props) => {
    const ev = META[name];
    if (!ev) return;
    if (ev === "PageView") return g.fbq!("track", "PageView");
    const items = Array.isArray(props.items) ? (props.items as Item[]) : [];
    const valueCents = typeof props.value_cents === "number" ? props.value_cents / 100 : undefined;
    const params: Record<string, unknown> = {
      value: typeof props.value === "number" ? props.value : valueCents,
      currency: typeof props.currency === "string" ? props.currency : "BRL",
    };
    if (items.length) {
      params.content_type = "product";
      params.content_ids = items.map((i) => i.item_id).filter(Boolean);
      params.contents = items.map((i) => ({ id: i.item_id, quantity: i.quantity ?? 1, item_price: i.price }));
      params.num_items = items.reduce((s, i) => s + (i.quantity ?? 1), 0);
      if (items[0].item_name) params.content_name = items[0].item_name;
    }
    if (ev === "Search") params.search_string = props.search_term;
    if (ev === "Contact") params.method = props.method;
    if (params.value === undefined) delete params.value;
    const eventID = typeof props.transaction_id === "string" ? props.transaction_id : undefined;
    g.fbq!("track", ev, params, eventID ? { eventID: `${name}-${eventID}` } : undefined);
  };
}
