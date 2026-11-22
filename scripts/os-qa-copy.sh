#!/bin/bash
# Cópia de teste do BORA OS com login falso (dona com todas as permissões), para ver as telas da Loja sem banco.
# Nunca toca no BORA OS de verdade: copia para um diretório à parte e só altera a cópia.
# Uso: bash scripts/os-qa-copy.sh <destino>   (depois: cd <destino> && BOS_QA_FAKE=1 ... npx next dev -p 3101)
set -euo pipefail
OS="/Users/alexrodrigues/Projetos/BORA-ASSESSORIA/BORA OS"
DEST="${1:?destino}"
mkdir -p "$DEST"
rsync -a --delete --exclude node_modules --exclude .next --exclude .git --exclude .vercel --exclude '.env*' "$OS/" "$DEST/"
[ -d "$DEST/node_modules" ] && [ ! -L "$DEST/node_modules" ] || { rm -f "$DEST/node_modules"; cp -Rc "$OS/node_modules" "$DEST/node_modules"; }  # cópia APFS (clone): o Turbopack não segue node_modules por link

# 1) getAuth: com BOS_QA_FAKE=1 devolve uma sessão completa, sem Supabase.
python3 - "$DEST/lib/auth.ts" <<'EOF'
import sys
p = sys.argv[1]; s = open(p).read()
marker = "export const getAuth = cache(async (): Promise<AuthState> => {\n"
assert marker in s
fake = marker + '''  if (process.env.BOS_QA_FAKE === "1") {
    // Banco falso: qualquer encadeamento (schema("os").rpc(), from().select().eq() etc.) é "awaitable" e resolve com { data: null, error: null }.
    const fakeDone = Promise.resolve({ data: null, error: null });
    const fakeDb: any = new Proxy(function () {}, {
      get: (_t, k) => (k === "then" ? (ok: any, ko: any) => fakeDone.then(ok, ko) : fakeDb),
      apply: () => fakeDb,
    });
    const { PERMS } = await import("./perms");
    return { stage: "ok", db: fakeDb, member: { user_id: "qa", email: "qa@bora.local", full_name: "Ana QA", status: "active", must_change_password: false }, perms: new Set<string>(PERMS), roles: ["owner"], ufs: null, totpAt: Math.floor(Date.now() / 1000) };
  }
'''
s = s.replace(marker, fake, 1)
open(p, "w").write(s)
EOF

# 2) proxy: com BOS_QA_FAKE=1 só aplica a CSP (não manda para o login).
python3 - "$DEST/proxy.ts" <<'EOF'
import sys
p = sys.argv[1]; s = open(p).read()
marker = "  let res = NextResponse.next({ request: { headers } });\n"
assert marker in s
s = s.replace(marker, marker + '''  if (process.env.BOS_QA_FAKE === "1") { res.headers.set("Content-Security-Policy", policy); return res; }
''', 1)
open(p, "w").write(s)
EOF
echo "cópia de teste pronta em $DEST"
