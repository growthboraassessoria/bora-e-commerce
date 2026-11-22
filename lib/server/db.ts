import "server-only";
import { createClient } from "@supabase/supabase-js";

// Supabase só no servidor, com a chave de serviço. O navegador nunca fala direto com o banco.
function make() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "loja" },
  });
}
let client: ReturnType<typeof make> | null = null;

export function storeMode(): "supabase" | "local" {
  if (process.env.DATA_STORE === "local") return "local";
  return process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "local";
}

export function db() {
  client ??= make();
  return client;
}
