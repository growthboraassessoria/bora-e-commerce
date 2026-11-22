import { NextResponse } from "next/server";
import { onlyDigits } from "@/lib/shipping";
import { lockedResponse } from "@/lib/server/settings";

// Busca o endereço pelo CEP (ViaCEP).
export async function GET(req: Request) {
  const locked = await lockedResponse();
  if (locked) return locked;
  const cep = onlyDigits(new URL(req.url).searchParams.get("cep") || "");
  if (cep.length !== 8) return NextResponse.json({ error: "CEP inválido" }, { status: 400 });
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(5000), next: { revalidate: 86400 } });
    const d = await res.json();
    if (!res.ok || d.erro) return NextResponse.json({ error: "CEP não encontrado" }, { status: 404 });
    return NextResponse.json({ cep, street: d.logradouro || "", district: d.bairro || "", city: d.localidade || "", uf: d.uf || "" });
  } catch {
    return NextResponse.json({ error: "Não deu para consultar o CEP agora" }, { status: 502 });
  }
}
