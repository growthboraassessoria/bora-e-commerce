"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { LockIcon } from "@/components/ui/Icons";
import { unlockStore, type UnlockState } from "./actions";

const START: UnlockState = { ok: false, error: null };

export default function PasswordForm() {
  const [state, action, pending] = useActionState(unlockStore, START);
  const [show, setShow] = useState(false);
  const sent = useRef(false);

  // Só registra quando a resposta do servidor chega (antes registrava "erro" no clique).
  useEffect(() => {
    if (!sent.current || state === START) return;
    track("store_password_submit", { result: state.ok ? "ok" : "erro", reason: state.reason ?? null });
    // Entrou: abre de novo o mesmo endereço, agora com o cookie de acesso.
    if (state.ok) window.location.replace(window.location.href);
  }, [state]);

  return (
    <form
      action={(fd) => {
        sent.current = true;
        // Página aberta antes de uma publicação nova: a conferência falha. Recarrega e a pessoa digita de novo.
        try { return action(fd); } catch { window.location.reload(); }
      }}
      className="w-full"
    >
      <label className="field">
        <span>Senha da loja</span>
        <span className="relative block">
          <input
            name="senha"
            // Campo de texto com bolinhas (não é type=password): o gerenciador de senhas do navegador
            // não guarda nem preenche sozinho uma tentativa antiga errada.
            type="text"
            style={show ? undefined : ({ WebkitTextSecurity: "disc" } as React.CSSProperties)}
            autoComplete="one-time-code"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            data-1p-ignore
            data-form-type="other"
            data-lpignore="true"
            autoFocus
            required
            className="input h-14 pr-24 text-lg"
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? "senha-erro" : undefined}
            placeholder="••••••••"
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold underline underline-offset-4">
            {show ? "Esconder" : "Mostrar"}
          </button>
        </span>
      </label>
      {state.error ? <p id="senha-erro" role="alert" className="mt-2 text-sm font-bold text-danger">{state.error}</p> : null}
      <button className="btn btn-primary btn-lg btn-block mt-4" disabled={pending || state.ok}>
        <LockIcon size={18} /> {pending ? "Conferindo…" : state.ok ? "Entrando…" : "Entrar na loja"}
      </button>
    </form>
  );
}
