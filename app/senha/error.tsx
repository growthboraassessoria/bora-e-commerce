"use client";
// Falha ao conferir a senha (ex.: página aberta antes de uma publicação nova). Recarrega e tenta de novo.
import { useEffect } from "react";

export default function SenhaError({ error }: { error: Error }) {
  useEffect(() => { console.error("senha", error.message); }, [error]);
  return (
    <div className="wrap py-24 text-center max-w-xl">
      <h1 className="display text-[clamp(32px,6vw,56px)]">Não deu para conferir agora.</h1>
      <p className="mt-4 text-ink-2">A loja foi atualizada enquanto a página estava aberta. Recarregue e digite a senha de novo.</p>
      <button type="button" onClick={() => window.location.reload()} className="btn btn-primary btn-lg mt-8">Recarregar</button>
    </div>
  );
}
