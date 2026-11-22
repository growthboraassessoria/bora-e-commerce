import "server-only";

// Limpeza dos eventos de analytics antes de gravar: nada que pareça e-mail, CPF, CNPJ, telefone ou cartão.
// Campos com nome sensível somem; textos com algo parecido no meio têm o trecho trocado por "[removido]".

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const CNPJ = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
const CARD = /\b(?:\d[ -]?){13,19}\b/g;
// Telefone do Brasil: (31) 98413-3066, 31984133066, +55 31 98413 3066...
const PHONE = /(?:\+?55[\s.-]?)?\(?\b\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g;

const SENSITIVE_KEY = /(e-?mail|cpf|cnpj|phone|telefone|celular|whats|senha|password|passwd|cvv|cvc|card_?number|cartao|card_?holder|address|endereco|logradouro|street|cep|zip|token|secret|^nome$|full_?name|first_?name|last_?name|customer_?name|buyer|document|documento|rg$|birth|nascimento|^ip$)/i;

export function scrubText(s: string, max = 300): string {
  return s.slice(0, max * 2).replace(EMAIL, "[removido]").replace(CNPJ, "[removido]").replace(CPF, "[removido]").replace(CARD, "[removido]").replace(PHONE, "[removido]").slice(0, max);
}

const isSensitiveKey = (k: string) => SENSITIVE_KEY.test(k);

/** Limpa as props de um evento: no máximo 3 níveis, 40 chaves, listas de 30 itens e textos de 300 caracteres. */
export function scrubProps(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return scrubText(value);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    // Inteiros de 10 ou 11 dígitos podem ser CPF ou telefone sem formatação.
    if (Number.isInteger(value) && Math.abs(value) >= 1e9 && Math.abs(value) < 1e11) return null;
    return value;
  }
  if (depth >= 3) return null;
  if (Array.isArray(value)) return value.slice(0, 30).map((v) => scrubProps(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    let n = 0;
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (n >= 40) break;
      const key = k.slice(0, 40);
      if (!key || isSensitiveKey(key)) continue;
      const clean = scrubProps(v, depth + 1);
      if (clean === null && v !== null) continue;
      out[key] = clean;
      n++;
    }
    return out;
  }
  return null;
}

// Robôs e ferramentas (o navegador de verdade sempre manda um user agent de navegador).
const BOT = /bot\b|bot\/|crawl|spider|slurp|bingpreview|mediapartners|facebookexternalhit|facebot|whatsapp\/|telegrambot|embedly|quora link|outbrain|pinterest\/|vkshare|w3c_validator|headless|phantomjs|puppeteer|playwright|selenium|lighthouse|chrome-lighthouse|pagespeed|gtmetrix|pingdom|uptime|statuscake|datadog|newrelic|monitor|curl\/|wget\/|python-|python\/|axios\/|node-fetch|undici|go-http|java\/|okhttp|postman|insomnia|httpclient|libwww|scrapy|preview/i;

export function isBotUA(ua: string | null): boolean {
  if (!ua || ua.length < 20) return true;
  return BOT.test(ua);
}
