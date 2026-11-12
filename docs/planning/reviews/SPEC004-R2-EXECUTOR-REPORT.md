# CoBalance — SPEC004 | R2 Executor: correções da revisão independente R1

**Data:** 12/11/2026 (Fortaleza, UTC-3)
**Checkout autorizado:** `/home/ciro/dev/prog/cobalance`
**Branch:** `feat/spec004-emprestimos-correcao-ux`
**HEAD inicial/final:** `1dff28fa6a75729e0513d27e15f7278a5dea093c`
**Parecer de executor:** **READY_FOR_INDEPENDENT_REVIEW**
**Fonte normativa:** `docs/planning/reviews/SPEC004-R1-REVISAO-INDEPENDENTE.md` (lido integralmente, 85 linhas).
**Limites:** preservar todo WIP anterior; não criar worktree, commit, push, merge, deploy ou migrations em bancos existentes.

> **AUTORREVISÃO DO EXECUTOR — NÃO SUBSTITUI REVISÃO INDEPENDENTE.** O status R1 `CHANGES_REQUIRED` permanece como último parecer independente até uma nova revisão.

## 1. Preflight e preservação

Confirmados com `pwd`, `git branch --show-current`, `git rev-parse HEAD`, `git status --short`, `git diff --check` e `git worktree list`. A branch e checkout são os autorizados. Existiam dezenas de alterações `M` e diretórios `??` de SPEC001/002/003, R8, PWA e SPEC004; **todos preservados**, sem reset/clean/stash/rebase/checkout destrutivo. O código do módulo é majoritariamente untracked e não pode ser avaliado apenas pelo `git diff` convencional.

Apenas os arquivos do R2 listados abaixo foram editados. Os documentos SPEC004, o relatório do executor original e a revisão independente R1 foram mantidos intactos.

## 2. F1 — P1: proteção obrigatória dos subprocessos Alembic

**Causa confirmada:** `backend/alembic/env.py` prioriza `COBALANCE_ALEMBIC_DATABASE_URL` acima de `COBALANCE_ALEMBIC_URL`. O runner de testes anterior definia apenas a variável de prioridade inferior, aceitando uma URL superior herdada.

**Correção:**
- Em `backend/tests/test_p1_migration.py`, foi criado `_safe_migration_url()`: antes de criar o banco de ensaio e antes de chamar subprocessos, exige `COBALANCE_TEST_DB_DISPOSABLE=1`, esquema PostgreSQL, host local `127.0.0.1`/`localhost`, **porta 55439** do contêiner conhecido (tmpfs), banco exatamente `cobalance_spec003_migr_test`, e usuário/senha/porta correspondentes ao `TEST_URL` local já validado no harness.
- O runner compartilhado `_run_alembic(*args)` impõe explicitamente **`COBALANCE_ALEMBIC_DATABASE_URL=MIGR_URL`, `COBALANCE_ALEMBIC_URL=MIGR_URL` e `DATABASE_URL=MIGR_URL`**, anulando precedência herdada. `_alembic` mantém a exigência de exit code 0 para operações que devem ter êxito.
- Em `backend/tests/test_spec004_migration.py`, a operação intencionalmente falha (downgrade com contratos VOIDED) também utiliza **o mesmo runner verificado**; saiu o `subprocess.run` manual inseguro.
- `backend/tests/test_spec004_r2.py` testa ambas as variáveis herdadas falsas com subprocesso **mockado**, confirma os parâmetros efetivamente enviados e o bloqueio de URL não-descartável **antes de executar Alembic**. Não tentou conexão externa.
- Teste integrado de migration, separado, foi executado com variáveis herdadas **deliberadamente falsas, apontadas a 127.0.0.1:1**, enquanto a URL efetiva do ensaio era `127.0.0.1:55439/cobalance_spec003_migr_test`; upgrade, check e downgrade seguro passaram. Nenhuma URL externa foi usada.

**Risco residual / exigência de operação:** a porta 55439 é um guard conservador ligado ao contêiner de testes identificado. Em ambiente diferente é necessário conferir a identidade descartável e alterar explicitamente o guard; não relaxar para uma porta persistente. Para upgrade real em Neon ainda é necessária autorização formal separada; este runner é exclusivo de testes.

## 3. F2 — P2: simulação assíncrona e alteração de tomador

**Causa confirmada:** o snapshot financeiro ignorava `borrower_id` e `description` e respostas antigas de `loansApi.simulate` eram sempre aceitas após `await`.

**Correção:** em `frontend/src/pages/Loans/NewLoanTab.jsx`:
- `formGeneration` (useRef) é incrementado **a cada alteração aceita do formulário**, inclusive tomador, descrição, datas, parcelas, taxa, método e frequência, além de cada nova solicitação de simulação.
- Cada request captura sua geração; ao resolver ou rejeitar, somente a geração **atual** pode modificar simulação/erro ou alterar chave de idempotência. A→B→A não reabilita uma resposta antiga.
- O `readySim` exige igualdade do **formulário completo serializado** (`JSON.stringify(form)`), não apenas dos termos financeiros; logo também protege a escolha do tomador e a descrição.
- Save continua sujeito a validação `buildTerms`, disponibilidade de `readySim` e validação `terms_hash` no backend. Nenhuma troca de tomador silenciosa é aceita.
- Event handlers foram mantidos como callbacks reais (não leitura de ref durante render), com ESLint do escopo verde.
- Em `frontend/src/pages/Loans/spec004-r2.test.jsx`, testes com Promises controladas reproduzem resposta atrasada após A→B, A→B→A e mudança de descrição; todos bloqueiam Save. Nova simulação permite salvar apenas com tomador, hash e descrição atuais.

## 4. F3 — P2: overflow do calendário civil 9999

**Causa confirmada:** `schedule.due_dates` pode gerar `ValueError/OverflowError` quando uma parcela cai depois de 31/12/9999; o serviço capturava apenas `ScheduleError`, levando a erro 500.

**Correção:**
- Em `backend/loans/service.py::_build`, apenas a etapa de geração de datas passou a converter `ValueError` e `OverflowError` em `invalid(...)` com resposta de domínio **HTTP 422** e mensagem curta `Vencimentos excedem o limite do calendário (ano 9999).`.
- Em `frontend/src/pages/Loans/entryValidation.js`, função pura `scheduleFitsCivilCalendar`: verifica se o último vencimento mensal ou por intervalo (quinzenal / a cada X dias) cabe no ano 9999, usando contagem civil aritmética, sem parse permissivo nem fuso horário. A `terms.js` apresenta erro contextual antes de simular.
- Manuais já têm datas individuais com ano 1..9999, estritamente crescentes; não exigem cálculo de vencimentos futuros automático. O cálculo financeiro, Price e centavos **não foram alterados**.
- Testes backend parametrizados provam 422 nas três frequências de overflow (mensal, quinzenal, a cada 365 dias) e aceitação do limite válido 31/12/9999 com uma parcela. Testes frontend provam erros equivalentes e preservação do caso de borda válido.

## 5. Evidência TDD RED → GREEN

| Etapa | Evidência |
|---|---|
| RED backend (F1/F3), antes dos patches | **5 FAIL + 2 PASS**, incluindo URL herdada, import do runner protegido ausente e overflow; `/tmp/cobalance_spec004_r2_backend_red.log` |
| RED frontend (F2/F3), antes dos patches | **4 FAIL**, duas corridas e dois limites de calendário; `/tmp/cobalance_spec004_r2_frontend_red.log` |
| GREEN backend direcionado | **7 PASS**; `/tmp/cobalance_spec004_r2_backend_green1.log` |
| GREEN frontend direcionado | **4 PASS**; `/tmp/cobalance_spec004_r2_frontend_green2.log` |
| GREEN migration com variáveis herdadas falsas | **9 PASS** (inclui 7 R2 + 2 migration preexistentes); `/tmp/cobalance_spec004_r2_migration_guard.log` |

Nenhuma reprodução envolveu Neon. A variável herdada falsa usada para o teste integrado de migration apontava apenas para uma porta local inválida; os testes com URL `invalid.example` são inteiramente mockados, sem chamada de rede.

## 6. Gates completos e comandos reproduzíveis

Ambiente de testes: PostgreSQL `cobalance-spec003-test-pg` (porta local `127.0.0.1:55439`, `Mounts=[]`, PostgreSQL em `tmpfs`), base `cobalance_spec003_test`; Alembic em `cobalance_spec003_migr_test`; E2E em `cobalance_spec003_e2e_test`. SPEC001 via `pg_virtualenv` PostgreSQL 16 efêmero. **Não usar banco persistente de development na porta 55483, volume cobalance-proj_postgres_data nem Neon Primary/copy.**

Comandos efetivamente executados (resumidos):

```bash
cd /home/ciro/dev/prog/cobalance/backend
COBALANCE_TEST_DB_DISPOSABLE=1 uv run pytest -q tests/test_spec004_r2.py
COBALANCE_TEST_DB_DISPOSABLE=1 \
  COBALANCE_ALEMBIC_DATABASE_URL='postgresql://blocked:blocked@127.0.0.1:1/never_use' \
  COBALANCE_ALEMBIC_URL='postgresql://blocked:blocked@127.0.0.1:1/also_never_use' \
  uv run pytest -q tests/test_spec004_r2.py tests/test_spec004_migration.py tests/test_p1_migration.py
COBALANCE_TEST_DB_DISPOSABLE=1 \
  COBALANCE_ALEMBIC_DATABASE_URL='postgresql://blocked:blocked@127.0.0.1:1/not_allowed' \
  COBALANCE_ALEMBIC_URL='postgresql://blocked:blocked@127.0.0.1:1/also_not_allowed' \
  uv run pytest -q
bash tests/run_spec001_postgres.sh

cd ../frontend
npm test -- --run
npm run build
npx eslint src/pages/Loans/NewLoanTab.jsx src/pages/Loans/terms.js \
  src/pages/Loans/entryValidation.js src/pages/Loans/spec004-r2.test.jsx
npm run test:e2e
npm run lint

cd ..
git diff --check
```

| Gate | Resultado |
|---|---|
| Pytest backend total | **194 PASS, 10 SKIP**, nenhum FAIL/XFAIL/ERROR; aviso compatibilidade anyio/pytest |
| SPEC001 PostgreSQL 16 descartável | **16 PASS**, cluster efêmero descartado |
| Migration com URL de maior precedência deliberadamente falsa | **9 PASS**, sem conexão ao alvo falso |
| Vitest frontend completo | **59 PASS** em 10 suites |
| Playwright real completo | **26 PASS** — desktop Chromium **23** + Pixel 7 Chromium **3**; R6/R7/R8, Pix, Price, Cartões, UX SPEC004 |
| Build Vite | **PASS**; aviso existente bundle >500 kB |
| ESLint restrito a arquivos JS/JSX R2 | **PASS**, zero erros/avisos |
| ESLint global | **FAIL preexistente: 10 erros + 1 aviso** fora do escopo R2, igual R1 |
| `git diff --check` e `python3 -m py_compile` | **PASS** |

Evidências completas: `/tmp/cobalance_spec004_r2_pytest_full.log`, `/tmp/cobalance_spec004_r2_spec001_pg.log`, `/tmp/cobalance_spec004_r2_migration_guard.log`, `/tmp/cobalance_spec004_r2_vitest_full.log`, `/tmp/cobalance_spec004_r2_e2e_full.log`, `/tmp/cobalance_spec004_r2_build.log`, `/tmp/cobalance_spec004_r2_lint_scope.log`, `/tmp/cobalance_spec004_r2_lint_global.log`.

Os 10 SKIP do pytest principal são testes SPEC001 sem o contexto `COBALANCE_SPEC001_TEST_DATABASE_URL`, mas foram exercitados pelo runner próprio `pg_virtualenv` com 16 PASS. O Playwright mobile é Chromium Pixel 7, não Safari real em iPhone.

## 7. Inventário exato das alterações R2

1. `backend/tests/test_p1_migration.py` — guard de alvo + runner Alembic único.
2. `backend/tests/test_spec004_migration.py` — usa runner verificado inclusive em downgrade de falha esperada.
3. `backend/tests/test_spec004_r2.py` — **novo**, regressões F1/F3.
4. `backend/loans/service.py` — erro de overflow convertido para HTTP 422 no cálculo de datas.
5. `frontend/src/pages/Loans/NewLoanTab.jsx` — geração monotônica, snapshot completo e invalidação de respostas tardias.
6. `frontend/src/pages/Loans/entryValidation.js` — verificador puro de calendário completo.
7. `frontend/src/pages/Loans/terms.js` — erro preventivo de calendário no cadastro.
8. `frontend/src/pages/Loans/spec004-r2.test.jsx` — **novo**, regressões de corrida e calendário.
9. `docs/planning/reviews/SPEC004-R2-EXECUTOR-REPORT.md` — **novo**, esta entrega.

Não se alteraram migrations versionadas existentes, schema ORM, JWT, Cartões, PWA, Cloudflare, configurações de produção, prompt/especificação SPEC004 nem a revisão R1.

## 8. Autorrevisão, limites e handoff

- F1: tanto as migrações com sucesso quanto o downgrade intencionalmente reprovado usam **o mesmo guard**; o guard ocorre antes do `DROP DATABASE` de ensaio. Não há subprocesso Alembic dentro do escopo desses testes que escape ao runner.
- F2: mudança do tomador e descrição invalida simulação; A→B→A e concorrência/chegada fora de ordem testadas; body de criação usa identidade atual e hash novo; a UI não mantém botão de salvar com dados obsoletos.
- F3: cronograma que atravessa 9999 retorna 422 em vez de 500; frontend impede requisição inválida; anos válidos e valores históricos permanecem sem alteração.
- Regressões de financiamento, Pix/cobrança, recebimentos, Price, isolamento, JWT R8 e Cartões: todas passam nos gates. Não houve commit/push/merge/deploy/worktree nova/migrations em bancos reais.
- **Riscos residuais:** avaliação humana continua necessária para anular um ACTIVE sem transferência real (decisão da SPEC004); o guard F1 usa porta fixa 55439 do container confirmado e não é portátil sem reidentificação; lint global legado permanece; revisão Safari/iPhone real não foi executada; qualquer execução no Neon continua vedada sem autorização distinta.

**Parecer de AUTORREVISÃO R2: READY_FOR_INDEPENDENT_REVIEW.** Solicitar **revisão independente R2 focada em F1/F2/F3**, sem considerar este documento aprovação de produção. O parecer independente R1 segue formalmente em `CHANGES_REQUIRED` até nova verificação.

> **AUTORREVISÃO DO EXECUTOR — NÃO SUBSTITUI REVISÃO INDEPENDENTE.**
