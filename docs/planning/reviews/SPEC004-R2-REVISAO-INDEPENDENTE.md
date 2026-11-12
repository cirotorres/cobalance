# CoBalance — SPEC004 | R2 — Re-revisão independente

**Data:** 12/11/2026 (Fortaleza, UTC−3)
**Responsável:** revisão independente da execução R2
**Checkout:** `/home/ciro/dev/prog/cobalance`
**Branch:** `feat/spec004-emprestimos-correcao-ux`
**HEAD verificado:** `1dff28f` (fonte da SPEC004 majoritariamente no WIP ainda não commitado)
**Parecer:** **R2 GREEN LOCAL — VERIFIED_CODE_REVIEW / READY_FOR_INTEGRATION_PLANNING**
**Produção:** **NÃO AUTORIZADA** por este documento. Nenhum commit, push, merge, deploy nem migration persistente realizado.

## 1. Escopo

Releitura integral de `SPEC004-R1-REVISAO-INDEPENDENTE.md` e `SPEC004-R2-EXECUTOR-REPORT.md`, inspeção dos arquivos modificados na R2 e reprodução independente dos testes. Objetivo: reavaliar os achados anteriores F1 (P1), F2 (P2) e F3 (P2), sem reescrever o código do executor.

O checkout continha alterações e arquivos não rastreados de outras SPECs. Não usei `git reset`, `clean`, `stash`, `checkout` nem staging. Os testes de migração foram executados exclusivamente em banco PostgreSQL local descartável, e houve verificação do contêiner `cobalance-spec003-test-pg`: `Mounts=[]`, `tmpfs` em `/var/lib/postgresql/data` e bind somente em `127.0.0.1:55439`. Nenhuma conexão foi feita ao Neon Primary/copy.

## 2. Decisões da revisão — achados R1

### F1 / P1 — **RESOLVIDO (GREEN)**

**Causa anterior:** `backend/alembic/env.py` prioriza `COBALANCE_ALEMBIC_DATABASE_URL`, enquanto o runner antigo passava somente `COBALANCE_ALEMBIC_URL` ao subprocesso.

**Evidências no código revisado:**
- `backend/tests/test_p1_migration.py::_safe_migration_url` exige `COBALANCE_TEST_DB_DISPOSABLE=1`, PostgreSQL local, porta 55439 e alvo `cobalance_spec003_migr_test`, além de coerência com o `TEST_URL` do harness.
- `_run_alembic` força **ambas** `COBALANCE_ALEMBIC_DATABASE_URL` e `COBALANCE_ALEMBIC_URL` para o mesmo `MIGR_URL` validado, incluindo `DATABASE_URL`; portanto a prioridade do `env.py` não pode recuperar a URL herdada.
- `backend/tests/test_spec004_migration.py` reutiliza o runner inclusive para o downgrade que deve falhar com um contrato `VOIDED`, sem `subprocess.run` manual fora do guard.
- `backend/tests/test_spec004_r2.py` simula uma URL herdada externa via mock de subprocesso, verifica ambiente efetivo e rejeita URL não-descartável antes de chamar Alembic.

**Reprodução independente:** executei o **pytest backend completo** com `COBALANCE_ALEMBIC_DATABASE_URL=postgresql://blocked:blocked@127.0.0.1:1/never_use` e `COBALANCE_ALEMBIC_URL=postgresql://blocked:blocked@127.0.0.1:1/also_never_use`, enquanto os testes usavam `127.0.0.1:55439`; **PASS**. A execução com URLs herdadas falsas foi propositalmente local, não um teste de conexão a um servidor externo.

**Limite:** o runner ainda depende do ambiente de testes identificado na porta 55439; em outro computador é preciso validar outro banco descartável explicitamente, **não relaxar o guard**.

### F2 / P2 — **RESOLVIDO (GREEN)**

**Evidências no código revisado:** `frontend/src/pages/Loans/NewLoanTab.jsx` mantém `formGeneration` monotônico em ref, incrementado a cada alteração aceita do formulário e a cada nova simulação. Respostas antigas não alteram `sim`, `error` ou a chave idempotente. `readySim` exige igualdade do snapshot do **formulário inteiro** (`JSON.stringify(form)`), incluindo tomador e descrição, e `save()` permanece condicionado à prévia atual e ao hash validado pelo backend.

**Testes independentes:** `frontend/src/pages/Loans/spec004-r2.test.jsx` reproduz Promises atrasadas com troca A→B, A→B→A e descrição alterada; uma simulação nova reabilita corretamente o salvamento com tomador, hash e descrição atual. Vitest **59 PASS**.

**Limite:** não foi feita prova de latência em rede real fora do ambiente E2E, mas a corrida sinalizada na R1 agora é testada e protegida por token de geração.

### F3 / P2 — **RESOLVIDO (GREEN)**

**Evidências no código revisado:** `backend/loans/service.py::_build` captura `ValueError` e `OverflowError` **somente no cálculo do calendário** e retorna erro de domínio HTTP 422, preservando `ScheduleError` e os cálculos Price/fixed_addon. `frontend/src/pages/Loans/entryValidation.js::scheduleFitsCivilCalendar` verifica o último vencimento em frequências mensais ou de dias fixos sem `Date.parse`/fuso; `terms.js` evita enviar cronograma que ultrapasse o ano 9999.

**Testes independentes:** `backend/tests/test_spec004_r2.py` cobre HTTP 422 para mensal, quinzenal e a cada 365 dias além de 31/12/9999 válido em uma parcela. `frontend/src/pages/Loans/spec004-r2.test.jsx` testa limites equivalentes. Backend completo e Vitest passaram.

## 3. Gates reproduzidos nesta revisão

| Gate | Evidência verificada |
|---|---|
| Backend Pytest completo, com variáveis de Alembic herdadas apontando à porta local falsa 1 | **194 PASS / 10 SKIP** conforme inventário do executor, execução integral independente com exit 0; nenhum FAIL |
| Migrations SPEC001/SPEC003/SPEC004, incluindo `alembic check` e downgrade bloqueado com `VOIDED` | **PASS**, no conjunto backend anterior |
| SPEC001 / `tests/run_spec001_postgres.sh` — `pg_virtualenv` PG16 efêmero | **16 PASS**, cluster descartado |
| Frontend `npm test -- --run` | **59 PASS**, 10 suítes |
| Frontend `npm run build` | **PASS**; aviso de tamanho de bundle anterior, não bloqueante |
| ESLint restrito aos arquivos modificados na R2 | **PASS** |
| Playwright `npm run test:e2e` — Chromium desktop + emulação Pixel 7 | **26 PASS** |
| `git diff --check` | **PASS** |

Os **10 SKIP** do pytest principal correspondem aos testes PostgreSQL SPEC001 que usam runner separado com `COBALANCE_SPEC001_TEST_DATABASE_URL`; foram efetivamente executados no cluster próprio com **16 PASS**. O teste mobile é Chromium Pixel 7, **não Safari/iPhone real**.

Comandos de referência reproduzidos:
- Backend: `COBALANCE_TEST_DB_DISPOSABLE=1` + `COBALANCE_TEST_DATABASE_URL` local `...:55439/cobalance_spec003_test` + variáveis `COBALANCE_ALEMBIC_*` apontando a `127.0.0.1:1` falsa; `backend/.venv/bin/python -m pytest -q -p no:cacheprovider -ra --disable-warnings`.
- SPEC001: `bash backend/tests/run_spec001_postgres.sh`.
- Frontend: `npm test -- --run`, `npm run build`, lint do escopo da R2 e `npm run test:e2e`.

## 4. Riscos e limites para a próxima etapa

1. **Anulação ACTIVE:** exige atestação humana de que não houve transferência real. Não equivale a estorno bancário; contratos com movimentos financeiros registrados continuam bloqueados. Esta é regra consciente da SPEC004.
2. **Migration SPEC004:** `spec004_0001` ainda **não aplicada** em Neon Primary/copy nem no banco local persistente; revalidar a cadeia contra uma cópia descartável que represente produção antes de qualquer deploy. Planejar backup, verificação da identidade do alvo e manutenção do banco; não usar o runner de testes para migration produtiva.
3. **WIP e estado de Git:** a branch `feat/spec004-emprestimos-correcao-ux` tem arquivos não rastreados de especificações anteriores, enquanto `main` está publicada separadamente; exige integração consciente do escopo e controle de artefatos antes de commit/merge/push.
4. **Gates informativos:** lint global ainda contém erros legados de fora do escopo e há aviso de chunk grande no Vite. Teste Safari/iPhone físico permanece manual, se desejado.
5. **Critério de autorização:** este parecer encerra os achados R1 e libera **planejamento da integração**, não realiza nem autoriza por si só deploy, dados reais ou alterações remotas.

## 5. Parecer final

**`SPEC004_R2_GREEN_LOCAL_VERIFIED`**

Os três achados de revisão R1 (**F1/P1, F2/P2, F3/P2**) foram corrigidos e validados de forma independente. Não restaram achados P0/P1/P2 **dentro do escopo de correção R2** identificados nesta revisão.

O código pode seguir à **preparação controlada de integração** com revisão de diff/escopo, seguida de planejamento separado de migration no Neon e publicação. A SPEC004 **não está publicada**; não houve commit, push, merge, deploy ou escrita em banco persistente.

**Próxima etapa recomendada:** congelar o escopo de release em branch/worktree limpa, auditar arquivos untracked, preparar plano de migration `spec004_0001` para produção e solicitar autorização explícita antes de executar cada alteração remota.
