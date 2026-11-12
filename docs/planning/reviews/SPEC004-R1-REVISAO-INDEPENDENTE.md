# CoBalance — SPEC004 | Revisão independente R1

**Data:** 12/11/2026 (Fortaleza)
**Revisor:** ChatGPT — sessão separada do executor ONE-SHOT
**Branch:** `feat/spec004-emprestimos-correcao-ux`
**Checkout:** `/home/ciro/dev/prog/cobalance`, HEAD `1dff28f` (SPEC004 no WIP não commitado)
**Parecer:** **NOT READY / CORREÇÕES PONTUAIS ANTES DE PUBLICAR**
**Operações realizadas:** inspeção de código, testes em PostgreSQL descartável, Vitest, Playwright, build, lint restrito; **sem commit, push, merge, deploy, migrations em banco persistente ou acesso ao Neon**.

## 1. Escopo e resumo

Foi lido o relatório do executor `docs/planning/reviews/SPEC004-EXECUTOR-REPORT.md` e confrontado com a SPEC004, fontes do backend, migrations, interface, testes e logs. O relatório é consistente com o código na maior parte: nova anulação lógica `VOIDED`, trilha auditável, bloqueio de recibos/ajustes/cobranças, juros 0% no fluxo de criação, datas BR e pastilhas acessíveis.

**Pontos positivos comprovados:** anulação não gera recibo falso; `ACTIVE` exige declaração de não transferência e não admite movimentos associados; `SETTLED` é bloqueado; as validações de titular/módulo continuam; `VOIDED` é excluído do balanço e do relatório de funding; a migration preserva o contrato existente e bloqueia downgrade que apagaria dados de contratos anulados. Cobrança e anulação usam locks de empréstimos. Juros 0% reaproveita motores matemáticos da SPEC003, sem mudança da fórmula.

Apesar dos testes aprovados, há três achados de revisão abaixo. **A presença de um P1 impede a liberação para integração/produção.**

## 2. Achados, por prioridade

### F1 — P1: variáveis herdadas podem redirecionar o runner de migration para banco real

**Fontes:**
- `backend/alembic/env.py`: a URL de migration é escolhida em ordem `COBALANCE_ALEMBIC_DATABASE_URL` > `COBALANCE_ALEMBIC_URL` > `DATABASE_URL_LOCAL`.
- `backend/tests/test_p1_migration.py::_alembic`: constrói subprocesso com `{**os.environ, "COBALANCE_ALEMBIC_URL": MIGR_URL, ...}`, **sem remover nem sobrescrever** `COBALANCE_ALEMBIC_DATABASE_URL`.
- `backend/tests/test_spec004_migration.py`: subprocesso de downgrade repete o mesmo padrão de herdar ambiente sem anular a variável prioritária.

**Cenário:** se o usuário tiver exportado `COBALANCE_ALEMBIC_DATABASE_URL` no terminal para qualquer Neon, executar os testes que chamam `alembic upgrade`/`downgrade` **pode apontar para essa URL**, ignorando a `MIGR_URL` descartável do teste. A flag `COBALANCE_TEST_DB_DISPOSABLE=1` e a checagem do SQLAlchemy `migr_engine` **não protegem** o subprocesso Alembic contra essa precedência.

**Evidência:** inspeção estática confirmou ambas as variáveis e a precedência. **Nenhuma migration em banco externo foi tentada** para reproduzir o risco. Nesta revisão a reprodução dos testes foi intencionalmente executada com `env -u COBALANCE_ALEMBIC_DATABASE_URL -u COBALANCE_ALEMBIC_URL`; portanto os resultados independentes usaram apenas a base de teste.

**Correção exigida:** forçar explicitamente ambas as variáveis de URL do subprocesso ao mesmo `MIGR_URL` validado como `127.0.0.1/localhost` e banco `*_migr_test` (ou remover a variável prioritária herdada); aplicar idêntica proteção aos subprocessos de downgrade. Criar teste de regressão que injeta valor falso na variável herdada, **sem conectar à URL externa**, e verifica os argumentos/ambiente passados ao subprocesso. Se não houver identidade de banco descartável confiável, falhar antes de chamar Alembic.

**Origem:** risco herdado de `test_p1_migration.py` e reutilizado pela SPEC004; não significa que o executor tenha modificado produção. É bloqueio de segurança para futuras execuções.

### F2 — P2: resposta atrasada de simulação pode habilitar salvamento após troca de tomador

**Fonte:** `frontend/src/pages/Loans/NewLoanTab.jsx`.

- `change()` executa `setSim(null)` ao alterar qualquer campo.
- `simulate()` usa `await loansApi.simulate(terms)` e depois faz `setSim(...)` **sem verificar se o formulário foi alterado enquanto aguardava a rede**.
- `readySim` compara apenas `JSON.stringify(buildTerms(form).terms)` com o snapshot. `buildTerms` não inclui `borrower_id` nem `description`.
- `save()` usa o **tomador atual**, que pode ser diferente daquele da interação que disparou `simulate()`.

**Cenário fundamentado pelo fluxo do código:** simular com pessoa A; antes da resposta, selecionar pessoa B mantendo valores e datas; a resposta antiga chega, os termos financeiros ainda coincidem e a UI pode exibir `Salvar como rascunho` para B sem uma nova simulação, contrariando a regra da SPEC de invalidar qualquer alteração de formulário.

**Correção exigida:** associar cada simulação a uma revisão monotônica do formulário (`useRef`/contador ou `AbortController` com token), invalidá-la em **qualquer mudança** e ignorar respostas anteriores. O snapshot/gate de salvamento também deve verificar `borrower_id` e campos extras que exigem revalidação. Testar com Promise de simulação deliberadamente atrasada seguida de troca do tomador; validar que o botão de salvar continua indisponível.

**Verificação:** achado de revisão de fluxo de código, sem teste automatizado específico executado pelo revisor para essa corrida. Não foi demonstrado prejuízo financeiro real; não afirmar que houve corrupção.

### F3 — P2: ano civil máximo pode levar a `ValueError` não tratado em periodicidade mensal

**Fontes:** `frontend/src/pages/Loans/entryValidation.js::parseCivilDate`, `frontend/src/pages/Loans/terms.js::buildTerms`, `backend/loans/schedule.py::add_months` e `backend/loans/service.py::_build`.

A máscara aceita anos até `9999` como data civil. Porém, uma simulação mensal iniciada em 9999, com primeiro vencimento em fevereiro de 9999 e 120 parcelas, ultrapassa o limite do módulo `datetime.date` do Python. O motor propaga `ValueError: year 10000 is out of range`; `_build` captura `ScheduleError`, mas não esse `ValueError`. Isso pode resultar em erro HTTP 500 para entrada formalmente aceita.

**Evidência reproduzida sem banco:** instanciei `Terms` com principal `1000.00`, taxa 0%, `installment_count=120`, `frequency=monthly`, `start_on=date(9999,1,1)` e `first_due_on=date(9999,2,1)`; `service.simulate(terms)` lançou exatamente `ValueError: year 10000 is out of range`.

**Correção exigida:** validar que o cronograma completo cabe no intervalo suportado ou converter exceção de overflow em erro de domínio `422` sem expor stack trace; cobrir no teste de API e manter validação do frontend coerente. Caso de borda raro, mas entrada do usuário não deve provocar 500. A lógica de calendário antecede a SPEC004; a nova validação de data não preveniu o problema.

## 3. Gates reproduzidos independentemente

| Verificação | Resultado do revisor |
|---|---|
| `pytest` backend completo contra `cobalance_spec003_test` em PostgreSQL tmpfs local | **187 PASS / 10 SKIP**, 0 falhas |
| Testes direcionados `test_spec004_void.py`, `test_spec004_migration.py` e `test_p1_migration.py` | **PASS** (com variáveis Alembic herdadas explicitamente removidas) |
| SPEC001 via `pg_virtualenv` PostgreSQL 16 efêmero | **16 PASS** |
| `npm test -- --run` | **55 PASS** em 9 suites |
| `npm run build` | **PASS**, aviso de bundle >500 KB preexistente |
| ESLint restrito a fontes SPEC004 | **PASS** |
| `npm run test:e2e` Chromium desktop/mobile Pixel 7 | **26 PASS** |
| `git diff --check` | **PASS** |

**Observações:** 10 SKIPs correspondem a testes PostgreSQL SPEC001 não configurados no runner principal; reproduzidos separadamente no cluster efêmero. Os E2E mobile usam Chromium com perfil Pixel 7, **não Safari real no iPhone**. A ausência de teste Safari não invalida o escopo móvel solicitado, mas limita as afirmações específicas sobre iOS.

As verificações usaram contêiner `cobalance-spec003-test-pg` com `Mounts=[]`, PostgreSQL em `tmpfs` e porta `127.0.0.1:55439`, além do `pg_virtualenv` para SPEC001. Não foram usadas credenciais Neon nem aplicações em banco persistente.

## 4. Recomendação de próximo ciclo — R2 executor

1. **F1 obrigatório/P1:** corrigir a seleção da URL de migração em todos os subprocessos de teste e adicionar teste de regressão para variável prioritária herdada. Reexecutar migration up/check/down apenas na base descartável explicitamente identificada.
2. **F2/P2:** invalidar simulações em trânsito ao mudar tomador, descrição ou qualquer entrada, com teste controlando atraso e chegada fora de ordem.
3. **F3/P2:** tratar datas mensais próximas de `9999` como erro validado de entrada, não exceção interna; teste backend e frontend pertinentes.
4. Reproduzir gates completos após as correções; não mexer em ambiente Neon/Primary/copy nem aplicar `spec004_0001` fora de PostgreSQL descartável.
5. Realizar nova revisão independente focada dos três patches e das regressões antes de aprovar publicação.

**Status final R1:** `CHANGES_REQUIRED / NOT READY_FOR_PRODUCTION`. Nenhuma migração da SPEC004 pode ser promovida com este parecer. O relatório do executor original continua preservado e permanece uma autorrevisão, não substitui esta revisão independente.
