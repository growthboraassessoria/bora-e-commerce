import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { LocalCatalog } from "../catalog-merge";

// Cadastro de produtos e coleções que o BORA OS grava no modo local (chave "catalog" do .data/loja.json).
// Lido a cada requisição, sem cache: o que o OS salva aparece na hora na loja local.
const FILE = path.join(process.env.VERCEL ? "/tmp/bora-store" : path.join(process.cwd(), ".data"), "loja.json");

export async function readLocalCatalog(): Promise<LocalCatalog | null> {
  try {
    const c = (JSON.parse(await readFile(FILE, "utf8")) as { catalog?: LocalCatalog }).catalog;
    return c && typeof c === "object" ? c : null;
  } catch {
    return null;
  }
}
