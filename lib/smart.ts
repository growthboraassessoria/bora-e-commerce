// Pequenas inteligências do checkout.

const DOMAINS = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com.br", "yahoo.com", "icloud.com", "live.com", "uol.com.br", "bol.com.br", "terra.com.br"];

function distance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

// "ana@gmial.com" → "ana@gmail.com"
export function emailSuggestion(email: string): string | null {
  const m = /^([^@\s]+)@([^@\s]+)$/.exec(email.trim().toLowerCase());
  if (!m) return null;
  const [, user, domain] = m;
  if (DOMAINS.includes(domain)) return null;
  let best: string | null = null;
  let bestD = 3;
  for (const d of DOMAINS) {
    const dist = distance(domain, d);
    if (dist < bestD) { bestD = dist; best = d; }
  }
  return best && bestD <= 2 ? `${user}@${best}` : null;
}

export const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v.trim());

// Soma dias úteis (sem feriados) a partir de hoje.
export function addBusinessDays(from: Date, days: number) {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

const FMT = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
const fmt = (d: Date) => FMT.format(d).replace(".", "").replace(",", "");

// "5 a 8 dias úteis" + 2 dias úteis para postar → "chega entre qua 26/11 e seg 01/12"
export function etaLabel(days: string, dispatchDays = 2) {
  const m = /(\d+)\s*a\s*(\d+)/.exec(days);
  if (!m) return days;
  const now = new Date();
  const a = addBusinessDays(now, dispatchDays + Number(m[1]));
  const b = addBusinessDays(now, dispatchDays + Number(m[2]));
  return `chega entre ${fmt(a)} e ${fmt(b)}`;
}
