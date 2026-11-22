// Porta da loja no MODO LOCAL (.data/loja.json). Em produção a senha é criada no BORA OS (loja.settings).
// Uso:
//   node scripts/loja-senha.mjs <senha> ["mensagem da tela"]   → fecha a loja com senha (derruba acessos antigos)
//   node scripts/loja-senha.mjs --abrir                         → abre a loja
//   node scripts/loja-senha.mjs --hash <senha>                  → só mostra o hash no formato do OS
// O cache das configurações é de 15 s: espere esse tempo antes de conferir no navegador.
import { randomBytes, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), ".data", "loja.json");
const [arg, msg] = process.argv.slice(2);
const hash = (pw) => {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 }).toString("hex")}`;
};

if (!arg) {
  console.log("Uso: node scripts/loja-senha.mjs <senha> | --abrir | --hash <senha>");
  process.exit(1);
}
if (arg === "--hash") {
  console.log(hash(msg ?? ""));
  process.exit(0);
}

let db = { stock: {}, orders: [], newsletter: [], seq: 1000 };
try { db = JSON.parse(readFileSync(FILE, "utf8")); } catch {}
const s = db.settings ?? {};
if (arg === "--abrir") {
  db.settings = { ...s, status: "open" };
  console.log("Loja aberta (modo local).");
} else {
  db.settings = { ...s, status: "password", passwordHash: hash(arg), passwordVersion: (s.passwordVersion ?? 1) + 1, ...(msg ? { passwordMessage: msg } : {}) };
  console.log(`Loja com senha (modo local), versão ${db.settings.passwordVersion}.`);
}
mkdirSync(path.dirname(FILE), { recursive: true });
writeFileSync(FILE, JSON.stringify(db, null, 2));
