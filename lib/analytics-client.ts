// Motor do analytics próprio da BORA Store (só roda no navegador).
// Parecido com o GA4: visitante anônimo, sessão de 30 min, origem do tráfego, page_view, rolagem,
// cliques, formulários, web vitals, erros. Os eventos saem em lote para /api/t (sendBeacon).
// Nada de dados pessoais: não lemos campos de formulário e o servidor ainda limpa e-mail, CPF e telefone.
import type { TrackProps } from "./analytics";
import { gaForwarder, metaForwarder, type Forwarder } from "./analytics-vendors";

const ENDPOINT = "/api/t";
const VID_KEY = "bora-vid"; // visitante (localStorage, permanente)
const SID_KEY = "bora-sid"; // sessão (sessionStorage)
const SC_KEY = "bora-sc"; // número de sessões do visitante
const UTM_KEY = "bora-utm"; // origem da primeira visita e da sessão
const OFF_KEY = "bora-no-track"; // "1" desliga a medição neste navegador
const SESSION_MS = 30 * 60 * 1000;
const MAX_BATCH = 25;

type Attr = { source: string; medium: string; campaign?: string; content?: string; term?: string; gclid?: string; fbclid?: string; landing?: string; at?: number };
type UtmStore = { first?: Attr; session?: Attr & { sid: string } };
type Session = { id: string; last: number; n: number };
type Ev = { n: string; t: number; p: string; ti: string; r?: string; pr: TrackProps };
type At = { t: number; path: string; title: string };

// ---------- armazenamento que nunca quebra (aba anônima, cookies bloqueados) ----------
const store = (kind: "local" | "session") => ({
  get(k: string): string | null {
    try { return (kind === "local" ? localStorage : sessionStorage).getItem(k); } catch { return null; }
  },
  set(k: string, v: string) {
    try { (kind === "local" ? localStorage : sessionStorage).setItem(k, v); } catch { /* sem armazenamento */ }
  },
  del(k: string) {
    try { (kind === "local" ? localStorage : sessionStorage).removeItem(k); } catch { /* sem armazenamento */ }
  },
});
const ls = store("local");
const ss = store("session");
const json = <T,>(s: string | null): T | null => { try { return s ? (JSON.parse(s) as T) : null; } catch { return null; } };

function uid() {
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch { /* segue */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// ---------- estado ----------
let booted = false;
let off = false;
let visitorId = "";
let newVisitor = false;
let session: Session | null = null;
let attr: Attr = { source: "(direct)", medium: "(none)" };
let queue: Ev[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let forwarders: Forwarder[] = [];
let pageViews = 0; // page_views nesta aba (o primeiro é o carregamento "de verdade")
let lastUrl = ""; // página anterior (referrer das navegações internas)

const page = {
  path: "",
  title: "",
  referrer: "",
  start: 0,
  engaged: 0,
  resumedAt: 0 as number, // 0 = pausado
  scroll: new Set<number>(),
  interacted: false,
  forms: new WeakSet<Element>(),
};

// ---------- utilidades ----------
const short = (s: string | null | undefined, n = 40) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const eventName = (s: string) => s.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
const KEEP_QUERY = /^(q|cor|tamanho|disponivel|ordem|utm_[a-z]+|gclid|fbclid|ref|src)$/;

/** Só os parâmetros que não identificam ninguém (o ?t= do link do pedido, por exemplo, nunca sai). */
function cleanQuery(search: string) {
  const sp = new URLSearchParams(search);
  const out = new URLSearchParams();
  sp.forEach((v, k) => { if (KEEP_QUERY.test(k)) out.set(k, v.slice(0, 80)); });
  const s = out.toString();
  return s ? `?${s}` : "";
}

function cleanReferrer(ref: string) {
  if (!ref) return "";
  try {
    const u = new URL(ref);
    return u.host === location.host ? u.pathname : `${u.origin}${u.pathname}`.slice(0, 200);
  } catch { return ""; }
}

export function parseUA(ua: string) {
  const device = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua) ? "tablet" : /Mobi|iPhone|iPod|Android|BlackBerry|Opera Mini|IEMobile/i.test(ua) ? "mobile" : "desktop";
  const browser =
    /Instagram/i.test(ua) ? "Instagram" : /FBAN|FBAV|FB_IAB/i.test(ua) ? "Facebook" : /Edg(A|iOS)?\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" :
    /SamsungBrowser/.test(ua) ? "Samsung Internet" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Outro";
  const os = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /CrOS/.test(ua) ? "ChromeOS" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Outro";
  return { device, browser, os };
}

function context() {
  const ua = parseUA(navigator.userAgent);
  let tz = "";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ""; } catch { /* sem fuso */ }
  return {
    ...ua,
    screen: `${screen.width}x${screen.height}`,
    vp: `${innerWidth}x${innerHeight}`,
    dpr: Math.round((devicePixelRatio || 1) * 10) / 10,
    lang: (navigator.language || "").slice(0, 20),
    tz: tz.slice(0, 40),
  };
}

// ---------- origem do tráfego (como o GA4) ----------
const SEARCH = /(^|\.)(google|bing|yahoo|duckduckgo|ecosia|yandex|baidu|search\.brave)\./i;
const SOCIAL = /(^|\.)(instagram|facebook|fb|t|twitter|x|linkedin|whatsapp|wa|tiktok|youtube|pinterest|threads|strava|telegram)\.(com|me|co|net|org)$/i;

function attrFromHere(withReferrer: boolean): Attr {
  const sp = new URLSearchParams(location.search);
  const g = (k: string) => sp.get(k)?.slice(0, 100) || undefined;
  const utm = { source: g("utm_source"), medium: g("utm_medium"), campaign: g("utm_campaign"), content: g("utm_content"), term: g("utm_term") };
  const gclid = g("gclid");
  const fbclid = g("fbclid");
  const landing = location.pathname;
  let refHost = "";
  if (withReferrer && document.referrer) {
    try { const h = new URL(document.referrer).hostname; if (h !== location.hostname) refHost = h.replace(/^www\./, ""); } catch { /* sem referrer */ }
  }
  if (utm.source || utm.medium || utm.campaign) return { ...utm, source: utm.source ?? refHost ?? "(not set)", medium: utm.medium ?? "(not set)", gclid, fbclid, landing, at: Date.now() };
  if (gclid) return { source: "google", medium: "cpc", gclid, landing, at: Date.now() };
  if (refHost) {
    const medium = SEARCH.test(refHost) ? "organic" : SOCIAL.test(refHost) || /^l\.|^lm\./.test(refHost) ? "social" : "referral";
    return { source: refHost, medium, fbclid, landing, at: Date.now() };
  }
  if (fbclid) return { source: "facebook", medium: "social", fbclid, landing, at: Date.now() };
  return { source: "(direct)", medium: "(none)", landing, at: Date.now() };
}

const hasCampaign = () => /[?&](utm_[a-z]+|gclid|fbclid)=/.test(location.search);

// ---------- sessão ----------
/** Devolve true quando começou uma sessão nova (primeira vez ou 30 min sem atividade). */
function touchSession(now: number): boolean {
  const s = session ?? json<Session>(ss.get(SID_KEY));
  if (s && now - s.last < SESSION_MS) {
    s.last = Math.max(s.last, now);
    session = s;
    ss.set(SID_KEY, JSON.stringify(s));
    return false;
  }
  const n = (Number(ls.get(SC_KEY)) || 0) + 1;
  ls.set(SC_KEY, String(n));
  session = { id: uid(), last: now, n };
  ss.set(SID_KEY, JSON.stringify(session));
  return true;
}

function startSession(now: number) {
  const utm = json<UtmStore>(ls.get(UTM_KEY)) ?? {};
  // Na primeira página da aba vale o referrer do navegador; depois de 30 min parada, a sessão nova é direta.
  attr = attrFromHere(pageViews === 0);
  if (!utm.first) utm.first = attr;
  utm.session = { ...attr, sid: session!.id };
  ls.set(UTM_KEY, JSON.stringify(utm));
  const f = utm.first;
  if (newVisitor && session!.n === 1) push("first_visit", { landing_page: attr.landing ?? location.pathname }, now);
  push("session_start", {
    session_number: session!.n,
    landing_page: attr.landing ?? location.pathname,
    gclid: attr.gclid ?? null,
    fbclid: attr.fbclid ? attr.fbclid.slice(0, 100) : null,
    first_source: f.source, first_medium: f.medium, first_campaign: f.campaign ?? null,
    ...context(),
  }, now);
}

// ---------- fila e envio ----------
function push(name: string, props: TrackProps, now: number, at?: At) {
  queue.push({
    n: name,
    t: now,
    p: (at?.path ?? location.pathname).slice(0, 300),
    ti: short(at?.title ?? document.title, 200),
    r: page.referrer || undefined,
    pr: props,
  });
  if (queue.length >= 20) flush();
  else if (!timer) timer = setTimeout(flush, 4000);
}

function emit(name: string, props: TrackProps = {}, at?: At) {
  if (off || !booted) return;
  try {
    const n = eventName(name);
    if (!n) return;
    const now = at?.t ?? Date.now();
    if (touchSession(now)) {
      flush(); // o que ficou na fila é da sessão anterior
      startSession(now);
    }
    push(n, props, now, at);
    for (const f of forwarders) {
      try { f(n, props); } catch { /* GA/Pixel nunca quebram a loja */ }
    }
  } catch { /* analytics nunca quebra a loja */ }
}

function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  while (queue.length && session) {
    const batch = queue.splice(0, MAX_BATCH);
    const body = JSON.stringify({
      v: visitorId,
      s: session.id,
      sn: session.n,
      u: { source: attr.source, medium: attr.medium, campaign: attr.campaign, content: attr.content, term: attr.term },
      c: context(),
      e: batch,
    });
    let sent = false;
    try { sent = !!navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "text/plain;charset=UTF-8" })); } catch { sent = false; }
    if (!sent) {
      try { fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "content-type": "text/plain;charset=UTF-8" } }).catch(() => {}); } catch { /* sem rede */ }
    }
  }
}

// ---------- página: tempo ativo, rolagem, primeira interação ----------
const active = () => document.visibilityState === "visible" && document.hasFocus();
function resume() { if (!page.resumedAt && active()) page.resumedAt = Date.now(); }
function pause() {
  if (page.resumedAt) { page.engaged += Date.now() - page.resumedAt; page.resumedAt = 0; }
}
function sendEngagement() {
  pause();
  const ms = Math.round(page.engaged);
  if (page.path && ms >= 100) emit("user_engagement", { engagement_time_msec: ms }, { t: Date.now(), path: page.path, title: page.title });
  page.engaged = 0;
  resume();
}

/** Página que recebeu o último page_view (o componente usa para saber se o título já mudou). */
export function currentPage() {
  return { path: page.path, title: page.title, count: pageViews };
}

/** Troca de página detectada: fecha o tempo da página anterior. */
export function leavePage() {
  if (!booted || !page.path) return;
  sendEngagement();
  pause();
}

/** page_view (o componente chama em toda navegação do App Router). */
export function pageView(pathname: string, search: string) {
  boot();
  if (off) return;
  const query = cleanQuery(search);
  const url = pathname + query;
  if (url === lastUrl && Date.now() - page.start < 800) return; // StrictMode / repetição
  page.referrer = pageViews === 0 ? cleanReferrer(document.referrer) : lastUrl;
  page.path = pathname;
  page.title = short(document.title, 200);
  page.start = Date.now();
  page.engaged = 0;
  page.resumedAt = 0;
  page.scroll = new Set();
  page.interacted = false;
  resume();
  // Campanha nova numa sessão que já existe (clicou num anúncio de novo): atualiza a origem da sessão.
  if (pageViews === 0 && session && hasCampaign()) {
    attr = attrFromHere(true);
    const utm = json<UtmStore>(ls.get(UTM_KEY)) ?? {};
    utm.session = { ...attr, sid: session.id };
    ls.set(UTM_KEY, JSON.stringify(utm));
  }
  emit("page_view", { query: query || null, nav: pageViews === 0 ? "load" : "route", page_number: pageViews + 1, ...(pageViews === 0 ? { screen: `${screen.width}x${screen.height}`, lang: navigator.language?.slice(0, 20) } : {}) });
  pageViews++;
  lastUrl = url;
  if (pathname === "/busca") {
    const q = new URLSearchParams(search).get("q");
    if (q) {
      const count = Number(document.querySelector<HTMLElement>("[data-search-count]")?.dataset.searchCount);
      emit("view_search_results", { search_term: q.slice(0, 80), results: Number.isFinite(count) ? count : null });
    }
  }
}

function onScroll() {
  const h = document.documentElement.scrollHeight;
  if (h <= innerHeight + 20 || !page.path) return;
  const pct = ((scrollY + innerHeight) / h) * 100;
  for (const mark of [25, 50, 75, 90, 100]) {
    if (pct >= (mark === 100 ? 99 : mark) && !page.scroll.has(mark)) {
      page.scroll.add(mark);
      emit("scroll", { percent_scrolled: mark });
    }
  }
}

function firstInteraction(type: string) {
  if (page.interacted || !page.path) return;
  page.interacted = true;
  const ms = pageViews <= 1 ? performance.now() : Date.now() - page.start;
  emit("first_interaction", { ms: Math.round(ms), type });
}

// ---------- cliques ----------
const FILE = /\.(pdf|zip|rar|7z|docx?|xlsx?|pptx?|csv|txt|mp3|mp4|mov|webm|glb|gltf|usdz|dmg|exe|apk)$/i;
let clicks: { t: number; x: number; y: number }[] = [];
let lastRage = 0;

function section(el: Element) {
  const s = el.closest<HTMLElement>("[data-section]")?.dataset.section;
  if (s) return short(s, 40);
  const id = el.closest("section[id]")?.id;
  if (id) return short(id, 40);
  const lm = el.closest("header, footer, nav, aside, dialog, [role=dialog]");
  return lm ? (lm.getAttribute("role") === "dialog" ? "dialog" : lm.tagName.toLowerCase()) : "main";
}

function label(el: Element) {
  return short(el.getAttribute("aria-label") || (el as HTMLElement).innerText || el.getAttribute("title") || el.getAttribute("value") || "", 40);
}

function dataProps(el: HTMLElement) {
  const out: TrackProps = {};
  for (const [k, v] of Object.entries(el.dataset)) {
    if (k.startsWith("track") && k !== "track" && v !== undefined) {
      const key = eventName(k.slice(5).replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`));
      if (key) out[key] = v.slice(0, 100);
    }
  }
  return out;
}

function onClick(e: MouseEvent) {
  const el = e.target instanceof Element ? e.target : null;
  if (!el || el.closest("[data-no-track]")) return;
  firstInteraction("click");

  // Rage click: 3 ou mais cliques no mesmo ponto (30 px) em 1 segundo.
  const now = Date.now();
  clicks = clicks.filter((c) => now - c.t < 1000 && Math.hypot(c.x - e.clientX, c.y - e.clientY) < 30);
  clicks.push({ t: now, x: e.clientX, y: e.clientY });
  if (clicks.length >= 3 && now - lastRage > 1000) {
    lastRage = now;
    const target = el.closest("a, button, [role=button], input, label, summary") ?? el;
    emit("rage_click", { count: clicks.length, element: target.tagName.toLowerCase(), text: label(target), section: section(target) });
    clicks = [];
  }

  const tracked = el.closest<HTMLElement>("[data-track]");
  if (tracked) emit(tracked.dataset.track || "click_custom", { ...dataProps(tracked), section: section(tracked) });

  const a = el.closest<HTMLAnchorElement>("a[href]");
  if (a) {
    let url: URL;
    try { url = new URL(a.href, location.href); } catch { return; }
    const text = label(a);
    if (url.protocol === "mailto:") return emit("contact_click", { method: "email", text, section: section(a) });
    if (url.protocol === "tel:") return emit("contact_click", { method: "phone", text, section: section(a) });
    if (!/^https?:$/.test(url.protocol)) return;
    if (/(^|\.)wa\.me$|whatsapp\.com$/.test(url.hostname)) emit("contact_click", { method: "whatsapp", text, section: section(a) });
    if (a.hasAttribute("download") || FILE.test(url.pathname)) {
      const name = url.pathname.split("/").pop() ?? "";
      return emit("file_download", { file_name: name.slice(0, 80), file_extension: (name.split(".").pop() ?? "").toLowerCase(), link_url: `${url.origin}${url.pathname}`.slice(0, 200), text });
    }
    if (url.hostname !== location.hostname) return emit("click", { outbound: true, link_domain: url.hostname, link_url: `${url.origin}${url.pathname}`.slice(0, 200), text, section: section(a) });
    if (!tracked) emit("ui_click", { element: "link", text, href: (url.pathname + (url.hash || "")).slice(0, 200), section: section(a) });
    return;
  }
  const btn = el.closest<HTMLElement>("button, [role=button], input[type=submit], input[type=button], summary");
  if (btn && !tracked) emit("ui_click", { element: btn.tagName === "SUMMARY" ? "summary" : "button", text: label(btn), id: btn.id ? short(btn.id, 40) : null, section: section(btn) });
}

// ---------- formulários (nunca lemos o que foi digitado) ----------
function formInfo(f: HTMLFormElement) {
  let dest = "";
  try { const act = f.getAttribute("action"); dest = act && !act.startsWith("javascript") ? new URL(act, location.href).pathname : ""; } catch { /* sem destino */ }
  const forms = [...document.forms];
  return {
    form_id: short(f.id || f.getAttribute("name") || f.dataset.trackForm || f.getAttribute("aria-label") || `form-${forms.indexOf(f) + 1}`, 40),
    form_destination: dest || null,
    fields: f.elements.length,
    section: section(f),
  };
}
function onFocusIn(e: FocusEvent) {
  const el = e.target instanceof Element ? e.target : null;
  const f = el?.closest("form");
  if (!f || f.closest("[data-no-track]") || !/^(INPUT|SELECT|TEXTAREA)$/.test(el!.tagName) || page.forms.has(f)) return;
  page.forms.add(f);
  emit("form_start", formInfo(f));
}
function onSubmit(e: SubmitEvent) {
  const f = e.target instanceof HTMLFormElement ? e.target : null;
  if (!f || f.closest("[data-no-track]")) return;
  emit("form_submit", { ...formInfo(f), submit_text: e.submitter ? label(e.submitter) : null });
}

// ---------- erros de JavaScript (mensagem curta) ----------
const errorsSeen = new Set<string>();
function jsError(kind: string, message: string, source?: string, line?: number, col?: number) {
  const msg = short(message, 150);
  if (!msg || errorsSeen.size >= 5 || errorsSeen.has(msg) || /ResizeObserver loop|^Script error\.?$/i.test(msg)) return;
  if (source && /^(chrome|moz|safari|safari-web)-extension:/.test(source)) return;
  errorsSeen.add(msg);
  let src = "";
  try { src = source ? new URL(source).pathname.slice(0, 120) : ""; } catch { src = ""; }
  emit("js_error", { kind, message: msg, source: src || null, line: line ?? null, col: col ?? null });
}

// ---------- Web Vitals (sem biblioteca) ----------
const LIMITS: Record<string, [number, number]> = { LCP: [2500, 4000], CLS: [0.1, 0.25], INP: [200, 500], FCP: [1800, 3000], TTFB: [800, 1800] };
const vitalsSent = new Set<string>();
function vital(metric: string, value: number) {
  if (vitalsSent.has(metric) || !Number.isFinite(value) || value < 0) return;
  vitalsSent.add(metric);
  const [good, poor] = LIMITS[metric];
  const v = metric === "CLS" ? Math.round(value * 1000) / 1000 : Math.round(value);
  emit("web_vitals", { name: metric, value: v, rating: v <= good ? "good" : v <= poor ? "needs-improvement" : "poor" }, { t: Date.now(), path: vitalsPath, title: document.title });
}
let vitalsPath = "";
const vitalsState = { lcp: 0, cls: 0, clsWindow: 0, clsFirst: 0, clsLast: 0, inp: new Map<number, number>() };

function observe(type: string, cb: (list: PerformanceEntry[]) => void, extra: Record<string, unknown> = {}) {
  try {
    if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return;
    new PerformanceObserver((l) => cb(l.getEntries())).observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
  } catch { /* navegador sem suporte */ }
}

function startVitals() {
  vitalsPath = location.pathname;
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav && nav.responseStart > 0) vital("TTFB", nav.responseStart - ((nav as unknown as { activationStart?: number }).activationStart ?? 0));
  } catch { /* sem navigation timing */ }
  observe("paint", (es) => es.forEach((e) => e.name === "first-contentful-paint" && vital("FCP", e.startTime)));
  observe("largest-contentful-paint", (es) => { const last = es[es.length - 1]; if (last) vitalsState.lcp = last.startTime; });
  observe("layout-shift", (es) => {
    for (const e of es as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
      if (e.hadRecentInput) continue;
      const s = vitalsState;
      if (s.clsWindow && e.startTime - s.clsLast < 1000 && e.startTime - s.clsFirst < 5000) s.clsWindow += e.value;
      else { s.clsWindow = e.value; s.clsFirst = e.startTime; }
      s.clsLast = e.startTime;
      s.cls = Math.max(s.cls, s.clsWindow);
    }
  });
  const onEvent = (es: PerformanceEntry[]) => {
    for (const e of es as (PerformanceEntry & { interactionId?: number })[]) {
      if (!e.interactionId) continue;
      vitalsState.inp.set(e.interactionId, Math.max(vitalsState.inp.get(e.interactionId) ?? 0, e.duration));
    }
  };
  observe("event", onEvent, { durationThreshold: 40 });
  observe("first-input", onEvent);
  // O LCP para de mudar na primeira interação.
  const stopLcp = () => { if (vitalsState.lcp) vital("LCP", vitalsState.lcp); };
  addEventListener("pointerdown", stopLcp, { once: true, capture: true });
  addEventListener("keydown", stopLcp, { once: true, capture: true });
}

function finishVitals() {
  if (vitalsState.lcp) vital("LCP", vitalsState.lcp);
  vital("CLS", vitalsState.cls);
  if (vitalsState.inp.size) {
    const all = [...vitalsState.inp.values()].sort((a, b) => b - a);
    vital("INP", all[Math.min(all.length - 1, Math.floor(all.length / 50))]);
  }
}

// ---------- visibilidade ----------
let hiddenAt = 0;
let hiddenHandled = false;
function onHide() {
  if (hiddenHandled) return flush();
  hiddenHandled = true;
  hiddenAt = Date.now();
  sendEngagement();
  pause();
  finishVitals();
  emit("visibility", { state: "hidden" });
  flush();
}
function onShow() {
  if (!hiddenHandled) return;
  hiddenHandled = false;
  emit("visibility", { state: "visible", hidden_ms: hiddenAt ? Date.now() - hiddenAt : null });
  resume();
}

// ---------- liga e desliga ----------
export function isOff() {
  return off;
}

/** Desliga (true) ou religa (false) a medição neste navegador. */
export function setOptOut(v: boolean) {
  if (v) { ls.set(OFF_KEY, "1"); queue = []; }
  else ls.del(OFF_KEY);
  off = v;
}

export function boot() {
  if (booted || typeof window === "undefined") return;
  booted = true;
  try {
    // ?bora-no-track=1 desliga e ?bora-no-track=0 religa (útil para a equipe não contar as próprias visitas).
    const flag = new URLSearchParams(location.search).get(OFF_KEY);
    if (flag === "1") ls.set(OFF_KEY, "1");
    if (flag === "0") ls.del(OFF_KEY);
    // Robôs de navegador automatizado (navigator.webdriver) não contam.
    off = ls.get(OFF_KEY) === "1" || navigator.webdriver === true;
    const w = window as unknown as { __boraTrack?: unknown; __boraQ?: { n: string; p: TrackProps; t: number; path: string; title: string }[] };
    if (off) { w.__boraQ = []; return; }

    visitorId = ls.get(VID_KEY) ?? "";
    if (!/^[A-Za-z0-9-]{8,64}$/.test(visitorId)) {
      visitorId = uid();
      newVisitor = true;
      ls.set(VID_KEY, visitorId);
    }
    const prev = json<UtmStore>(ls.get(UTM_KEY));
    const saved = json<Session>(ss.get(SID_KEY));
    if (saved && prev?.session?.sid === saved.id) attr = prev.session;

    const ga = process.env.NEXT_PUBLIC_GA_ID;
    const pixel = process.env.NEXT_PUBLIC_META_PIXEL_ID;
    if (ga) forwarders.push(gaForwarder(ga));
    if (pixel) forwarders.push(metaForwarder(pixel));

    w.__boraTrack = (n: string, p: TrackProps, at?: At) => emit(n, p, at);
    const pending = w.__boraQ ?? [];
    w.__boraQ = [];

    addEventListener("click", onClick, { capture: true, passive: true });
    addEventListener("focusin", onFocusIn, { capture: true });
    addEventListener("submit", onSubmit, { capture: true });
    let ticking = false;
    addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; onScroll(); });
    }, { passive: true });
    for (const t of ["keydown", "touchstart", "wheel"] as const) addEventListener(t, () => firstInteraction(t), { capture: true, passive: true });
    addEventListener("focus", resume);
    addEventListener("blur", pause);
    document.addEventListener("visibilitychange", () => (document.visibilityState === "hidden" ? onHide() : onShow()));
    addEventListener("pagehide", onHide);
    addEventListener("error", (e) => jsError("error", e.message, e.filename, e.lineno, e.colno));
    addEventListener("unhandledrejection", (e) => {
      const r = e.reason as { message?: string } | string | undefined;
      jsError("promise", typeof r === "string" ? r : r?.message ?? "Promise rejeitada");
    });
    startVitals();

    // Eventos que chegaram antes do coletor ligar (ex.: view_item no efeito da página de produto).
    if (pending.length) setTimeout(() => pending.forEach((q) => emit(q.n, q.p, { t: q.t, path: q.path, title: q.title })), 300);
  } catch { /* analytics nunca quebra a loja */ }
}

export type { Forwarder };
