// Analytics da BORA Store: contrato único para a loja inteira.
// track(nome, props) no navegador. Nunca lança erro e nunca bloqueia a tela.
// O coletor (components/analytics/Analytics.tsx) instala window.__boraTrack; antes disso,
// os eventos ficam numa fila curta (window.__boraQ) e saem assim que o coletor liga.
//
// E-commerce: use os nomes e o formato do GA4 (props.currency "BRL", props.value em reais,
// props.items [{ item_id, item_name, item_variant, price, quantity }]). Eles são repassados
// ao GA4 e ao Meta Pixel quando as variáveis existem (ver README, seção Analytics).
export type TrackProps = Record<string, string | number | boolean | null | undefined | Record<string, unknown> | unknown[]>;

type Queued = { n: string; p: TrackProps; t: number; path: string; title: string };
type W = { __boraTrack?: (n: string, p: TrackProps, at?: { t: number; path: string; title: string }) => void; __boraQ?: Queued[] };

export function track(name: string, props: TrackProps = {}): void {
  if (typeof window === "undefined") return;
  try {
    const w = window as unknown as W;
    if (w.__boraTrack) return w.__boraTrack(name, props);
    // Coletor ainda não ligou (efeitos dos filhos rodam antes do dele): guarda com a hora e a página de agora.
    const q = (w.__boraQ ??= []);
    if (q.length < 50) q.push({ n: name, p: props, t: Date.now(), path: location.pathname, title: document.title });
  } catch {
    /* analytics nunca quebra a loja */
  }
}
