# CoBalance — SPEC004 | EXECUTOR REPORT

**Data:** 12/11/2026 (Fortaleza, UTC-3)
**Responsável:** Executor individual — ONE-SHOT, TDD, integração PostgreSQL descartável, E2E real, autorrevisão
**Parecer:** **READY_FOR_INDEPENDENT_REVIEW**
**Autorizações:** somente execução local. Sem commit, push, merge, deploy, nova worktree ou acesso destrutivo a bancos existentes.

> AUTORREVISÃO DO EXECUTOR — NÃO SUBSTITUI REVISÃO INDEPENDENTE.

## 1. Baseline e pré-voo

- Checkout exclusivo: /home/ciro/dev/prog/cobalance
- Branch inicial/final: feat/spec004-emprestimos-correcao-ux
- HEAD inicial/final: 1dff28fa6a75729e0513d27e15f7278a5dea093c (abreviado 1dff28f).
- Lidos integralmente antes de editar: docs/planning/specs/SPEC004-emprestimos-correcao-e-ux-mobile.md (127 linhas) e docs/planning/prompts/SPEC004-one-shot-executor.md (55 linhas).
- Pré-voo executado: pwd, git branch --show-current, git rev-parse HEAD, git status --short, git diff --check, git worktree list. Checkout/branch conferidos e corretos.
- Worktree já possuía **muitos M e ??** do proprietário (SPEC001/002/003, JWT R8, PWA, Cloudflare). O HEAD não contém sozinho o módulo Empréstimos: o código integrado está no WIP. **Nenhum arquivo foi descartado, feito stash/clean/reset, integrado ou movido.** Não foi criada worktree.
- Nenhuma modificação em main, development, repositórios vizinhos, Cloudflare, Neon, deploy, variáveis produtivas ou Obsidian.
- O diff global de Git mostra mudanças anteriores de SPEC001/002/003/PWA e pode omitir arquivos ??; por isso a seção 6 identifica exclusivamente os itens da SPEC004.

### Segurança do banco de testes

- Container utilizado: cobalance-spec003-test-pg (postgres:15-alpine), **Mounts=[]**, armazenamento do PostgreSQL em **tmpfs /var/lib/postgresql/data**, porta local restrita a **127.0.0.1:55439**.
- O container estava parado. Antes de iniciá-lo foram verificados os mounts, tmpfs, mapeamento de porta e a identidade; depois foi confirmado pg_isready e database cobalance_spec003_test.
- Pytest: cobalance_spec003_test, guardado por backend/tests/conftest.py, host local, nome *_test e COBALANCE_TEST_DB_DISPOSABLE=1.
- Playwright: cobalance_spec003_e2e_test, reset permitido somente a *_e2e_test, script frontend/e2e/start-backend.sh com URL local explicitamente descartável.
- Migração: cobalance_spec003_migr_test, gerenciado pela fixture backend/tests/test_p1_migration.py, recriado apenas no container tmpfs; variáveis Alembic isoladas no subprocesso de testes.
- SPEC001: script backend/tests/run_spec001_postgres.sh usa pg_virtualenv PostgreSQL 16 com cluster descartável próprio.
- **Explicitamente NÃO usados:** Neon Primary/copy, PROD_DATABASE_URL, PostgreSQL de development 127.0.0.1:55483 com volume persistente cobalance-proj_postgres_data, banco manual OAK 55463. Não houve migration em banco persistente.

## 2. Frente A — anulação lógica auditável, não pagamento

A ação visível é **Excluir empréstimo**; a operação efetiva é **Anular registro**. Não há DELETE físico nem crédito fictício.

- Novo endpoint estrito POST /loans/contracts/{loan_id}/void com motivo (3–300 caracteres), idempotency_key e confirm_no_transfer booleano estrito obrigatório; usuário autenticado e módulo habilitado são exigidos pelo mesmo mecanismo owner de SPEC003.
- Modelo: estado VOIDED, voided_at e void_reason; evento contract_voided com ator user_id, estado anterior, motivo e declaração de não transferência; valor principal e funding anterior **não são alterados**.
- Elegíveis: DRAFT e CANCELLED, além de ACTIVE sem **nenhum** recebimento/alocação (inclusive estornado), ajuste (inclusive estornado), cobrança vinculada, versão de cronograma posterior, parcela paga/substituída ou evento financeiro material desconhecido. ACTIVE exige declaração explícita confirm_no_transfer=true.
- Inelegíveis: SETTLED, já VOIDED, contratos com qualquer movimento ou funding real segundo a declaração humana. Erros de movimento retornam **409** com orientação de regularização auditável. Cross-user retorna **404**; módulo desabilitado **403**; body inválido **422**.
- Transação: SELECT FOR UPDATE no Loan (antes de parcelas), verificação de alocações, ajustes e itens Pix, evento e atualização do status no mesmo commit. O fluxo de criação de cobrança Pix recebeu lock de empréstimos e parcelas na mesma ordem global para impedir a corrida charge/void. Testes concorrentes cobrem replay com cinco threads e disputa charge vs void.
- Idempotência: mesma chave/payload retorna mesmo recurso sem duplicar evento; mesma chave com payload diferente 409; chave nova após anulado 409.
- Consultas: contratos anulados ficam ocultos por padrão em GET /loans/contracts e na ficha; include_voided=true ou status explicitamente VOIDED permite consulta owner-scoped. Detalhe direto por ID permanece auditável. A ficha exibe motivo, data e status, sem seleção, cobrança ou recebimento.
- Balanço e relatórios: VOIDED sai de saldos ativos, vencimentos, overdue, contagem padrão e **desembolso realizado no mês do funding equivocado**, sem inventar entrada de recebimento ou devolução. Histórico, IDs, cronograma e eventos permanecem disponíveis.
- UI: confirmação com identidade do tomador, ID, valor, estado, aviso literal **"Esta ação não registra pagamento nem devolução"**, motivo, checkbox de confirmação, segundo checkbox para ACTIVE (confirmar ausência de transferência real), controles bloqueados durante request, botão de desistência antes de executar, erro 409 mantido visível, refresh de ficha sem recarregar navegador, filtro **Mostrar anulados**.
- **Risco conscientemente preservado:** o servidor não consegue verificar uma transferência externa real só pelo seu banco. Por isso a elegibilidade ACTIVE exige declaração humana; estorno de dinheiro que de fato saiu é uma SPEC separada. Nunca tentar simular quitação para contornar isso.

## 3. Migration SPEC004, somente no PostgreSQL descartável

- Nova revisão Alembic: backend/alembic/versions/spec004_0001_void_loans.py.
- revision = spec004_0001; down_revision = spec003_0001 (migration SPEC003 **não alterada**).
- Upgrade inclui voided_at, void_reason, status VOIDED nos checks ck_loans_status e ck_loans_funded, e check adicional ck_loans_void_audit impedindo VOIDED sem data/motivo não vazios.
- Downgrade restaura exatamente os checks anteriores e remove colunas apenas se **nenhum** contrato VOIDED estiver presente. Com VOIDED, lança SAFETY STOP de downgrade para não destruir auditoria.
- Testes migraram uma base sintética com schema anterior e contrato DRAFT fictício: SPEC003→SPEC004, preservação do contrato e dos valores, **alembic check PASS**, downgrade reversível para SPEC003 quando seguro, reupgrade e tentativa de downgrade com VOIDED **corretamente bloqueada**. Outros testes continuam validando SPEC001→SPEC003→HEAD.
- Nenhuma migration executada no Neon, no banco persistente ou nos volumes de desenvolvimento.

## 4. Frente B — juros zero sem alteração do motor matemático

- Inspeção comprovou que backend/loans/money.py::parse_rate e backend/loans/schedule.py já suportam taxa zero. O teste backend de zero% no estado inicial **PASS**; portanto **não houve reescrita de Price ou fixed_addon**.
- A causa prática era a falta de seleção evidente e de normalização/validação adequada no formulário.
- Botão explícito **Sem juros** define interest_method=fixed_addon, rate=0; taxa zero digitada como 0, 0,0 ou 0% é normalizada apenas no frontend. Métodos originais e Price a 0% permanecem válidos.
- Em API real: empréstimo de R$ 1.000,00 em três parcelas gera **333.34 + 333.33 + 333.33**, juros 0.00, principal total exato 1000.00; simulação, terms_hash, contrato salvo, funding, recebimento e relatório sem receita de juros foram testados. Não há terceiro motor nem enum.
- Alteração dos termos invalida a prévia e impede usar uma simulação obsoleta; versão final liga a prévia a um snapshot JSON dos termos normalizados, inclusive quando uma chamada antiga chega fora de ordem. O backend continua validando terms_hash.

## 5. Frente C e D — entrada de datas/números e tomadores mobile

**Datas / inteiros:**
- Utilitário puro entryValidation.js, componente DateField.jsx e buildTerms atualizado.
- Entrada editável em **DD/MM/AAAA** para Data de início, Primeiro vencimento e cada parcela manual; teclado numeric, autoinsere "/", suporta colar somente dígitos ou formatado, backspace ao lado de barras, preserva cursor pela contagem de dígitos.
- Validação de calendário civil (mês, dias máximos, anos, bissexto, incompleto), sem Date.parse permissivo nem ambiguidade de fuso; mensagens de erro contextuais. Na API recebe apenas ISO YYYY-MM-DD.
- Frequência manual: exatamente N campos "Parcela 1" ... "Parcela N"; datas estritamente crescentes e posteriores ao início. Estado de datas existentes é preservado se a quantidade muda; o envio usa list[date] em ISO.
- Parcelas apenas algarismos, inteiro completo 1..120; intervalo apenas algarismos, 1..365. Não usa parseInt tolerante com lixo. Sinais, decimais, exponentes e texto são rejeitados no input ou na validação.
- As telas de Cartões e as datas históricas não foram alteradas.

**Pastilhas / acessibilidade:**
- BorrowersTab usa botão-pastilha cobrindo toda a superfície, min-height 48px, cor **e** check/underline para seleção, aria-pressed, foco visível, suporte nativo Enter/Espaço, nome longo com quebra de linha, responsivo.
- O layout foi testado em larguras de **320, 375 e 390px**, alternando duas pessoas, sem overflow horizontal. No contexto móvel Pixel 7 usa toque nativo tap(), e no desktop clique nativo.
- Cadastro, focusId e isolamento por titular mantidos; nenhuma alteração na tabela de tomadores.

## 6. Arquivos tocados exclusivamente pela SPEC004

### Backend
- backend/models/loans.py — estado VOIDED, colunas e checks.
- backend/schemas/loans.py — VoidRequest estrito.
- backend/routes/loans.py — endpoint void + include_voided.
- backend/loans/service.py — transação de anulação, idempotência, replay e lock de charge.
- backend/loans/reports.py — omissão de VOIDED nos totais/listas.
- backend/loans/serializers.py — auditoria, saldo exigível zero no histórico.
- backend/alembic/versions/spec004_0001_void_loans.py — **nova migration**.
- backend/tests/test_spec004_void.py — **novos testes integrados**, estados, histórico, 0%, concorrência e isolamento.
- backend/tests/test_spec004_migration.py — **novos testes** de migração, reversão segura e alembic check.

### Frontend
- frontend/src/pages/Loans/entryValidation.js — **novo** utilitário puro de datas/números.
- frontend/src/pages/Loans/DateField.jsx — **novo** campo mascarado.
- frontend/src/pages/Loans/terms.js — conversão API e validação estrita.
- frontend/src/pages/Loans/NewLoanTab.jsx — taxa zero, datas individuais, inteiros e snapshot simulação.
- frontend/src/pages/Loans/BorrowersTab.jsx — pastilhas acessíveis.
- frontend/src/pages/Loans/BorrowerStatement.jsx — UX anulação/histórico.
- frontend/src/pages/Loans/Loans.module.css — estilos escopados de pastilhas/formulário.
- frontend/src/services/loansService.js — void e include_voided.
- frontend/src/pages/Loans/spec004-terms.test.js — **novos testes** de máscara e termos.
- frontend/src/pages/Loans/spec004-components.test.jsx — **novos testes** de interação.
- frontend/src/pages/Loans/terms.test.js — atualização de fixtures de datas manuais para novo contrato.
- frontend/src/pages/Loans/components.test.jsx — fixtures de digitação DD/MM/AAAA em vez de input date.
- frontend/e2e/spec003.spec.js — atualizar preenchimento de datas nos cenários legados; sem afrouxar asserts.
- frontend/e2e/spec004.spec.js — **novos E2E reais** desktop/mobile.
- docs/planning/reviews/SPEC004-EXECUTOR-REPORT.md — este relatório.

**Não modificados por SPEC004:** migrations SPEC001/SPEC003 anteriores, backend/core/security.py, JWT R8, módulos Cartões, PWA/ícones, Cloudflare, package managers/lockfiles, ambiente real ou configuração de deploy.

## 7. TDD — evidência RED → GREEN

**Backend:** após criar tests/test_spec004_void.py, execução direcionada em Postgres descartável registrou **5 FAIL e 1 PASS** (5 cenários VOID ausente; 0% já operava). Log: /tmp/cobalance_spec004_backend_red.log. Após implementação, teste focado **PASS** e novos cenários de concorrência **PASS** em /tmp/cobalance_spec004_backend_concurrency.log.

**Frontend:** novos tests SPEC004 antes da implementação: **5 testes de componentes FAIL**, e suite de validação inicialmente falhou ao importar o utilitário ainda não criado. Log: /tmp/cobalance_spec004_frontend_red.log. Após implementação: conjunto de 3 suites alvo **14 PASS**, log /tmp/cobalance_spec004_frontend_green2.log.

**E2E:** primeira rodada foi 4 PASS + 1 FAIL, pois um teste @mobile também executou no projeto desktop e tentou tap() sem contexto touch. Pixel 7 passou nessa primeira rodada. O teste foi corrigido para **click no desktop / tap no mobile**, sem force:true e sem alterar a UI por esse motivo. Repetição direcionada: **6 PASS**. Logs: /tmp/cobalance_spec004_e2e_target1.log e /tmp/cobalance_spec004_e2e_target2.log.

## 8. Comandos de validação executados e resultados reais

**Pré-voo seguro:**
    cd /home/ciro/dev/prog/cobalance
    pwd
    git branch --show-current
    git rev-parse HEAD
    git status --short
    git diff --check
    git worktree list
    docker inspect -f 'Name={{.Name}} State={{.State.Status}} Mounts={{json .Mounts}} Tmpfs={{json .HostConfig.Tmpfs}} Port={{json .HostConfig.PortBindings}}' cobalance-spec003-test-pg
    docker start cobalance-spec003-test-pg
    docker exec cobalance-spec003-test-pg pg_isready -U spec003_test

**Backend e migration:**
    cd backend
    COBALANCE_TEST_DB_DISPOSABLE=1 uv run pytest -q tests/test_spec004_void.py
    COBALANCE_TEST_DB_DISPOSABLE=1 uv run pytest -q tests/test_spec004_migration.py tests/test_p1_migration.py
    COBALANCE_TEST_DB_DISPOSABLE=1 uv run pytest -q
    bash tests/run_spec001_postgres.sh

**Frontend e E2E:**
    cd ../frontend
    npm test -- --run
    npm run test:e2e -- --grep SPEC004-E2E
    npm run test:e2e
    npm run build
    npx eslint src/pages/Loans/NewLoanTab.jsx src/pages/Loans/BorrowersTab.jsx src/pages/Loans/BorrowerStatement.jsx src/pages/Loans/terms.js src/pages/Loans/terms.test.js src/pages/Loans/DateField.jsx src/pages/Loans/entryValidation.js src/pages/Loans/spec004-terms.test.js src/pages/Loans/spec004-components.test.jsx src/pages/Loans/components.test.jsx src/services/loansService.js e2e/spec003.spec.js e2e/spec004.spec.js
    npm run lint

**Fecho:**
    cd ..
    git diff --check

| Gate | Resultado |
|---|---|
| Backend pytest completo | **187 PASS, 10 SKIP**, 0 FAIL, 0 ERROR, 0 XFAIL; warning de compatibilidade pytest/anyio |
| SKIP explicados | Testes PostgreSQL SPEC001 em pytest dependem de COBALANCE_SPEC001_TEST_DATABASE_URL; não é fornecida nesse runner para preservar isolamento; executados separadamente |
| SPEC001 pg_virtualenv PostgreSQL 16 | **16 PASS**, 0 FAIL, cluster efêmero descartado ao final |
| Migration SPEC003→SPEC004 / alembic check / downgrade | **2 PASS** de suíte migratória direcionada, 0 FAIL; inclui teste de downgrade com VOIDED bloqueado por design |
| Vitest frontend completo | **55 PASS** em 9 suites, 0 FAIL/SKIP |
| Playwright SPEC004 direcionado | **6 PASS**: 5 desktop Chromium e 1 mobile Chromium Pixel 7 |
| Playwright completo R6/R7/R8/SPEC004 | **26 PASS**, 0 FAIL/SKIP (23 desktop Chromium, 3 mobile Chromium Pixel 7) |
| Build Vite | **PASS** com aviso legado não bloqueante de bundle >500KB |
| ESLint restrito aos arquivos JS/JSX de SPEC004 | **PASS**, 0 erros/warnings. CSS não é processado pelo ESLint desse projeto |
| ESLint global | **FAIL: 10 erros + 1 warning preexistentes** fora do escopo SPEC004, idênticos ao baseline R6/R7/R8 |
| git diff --check | **PASS** |
| Python py_compile escopo | **PASS** |

Logs reais desta execução (máquina do proprietário): /tmp/cobalance_spec004_backend_red.log, /tmp/cobalance_spec004_frontend_red.log, /tmp/cobalance_spec004_backend_green1.log, /tmp/cobalance_spec004_backend_concurrency.log, /tmp/cobalance_spec004_migration_green1.log, /tmp/cobalance_spec004_vitest_final.log, /tmp/cobalance_spec004_e2e_target2.log, /tmp/cobalance_spec004_e2e_full.log, /tmp/cobalance_spec004_pytest_full.log, /tmp/cobalance_spec004_spec001_postgres.log, /tmp/cobalance_spec004_build.log, /tmp/cobalance_spec004_lint_scope_final.log, /tmp/cobalance_spec004_lint_global.log.

## 9. Autorrevisão final e riscos pendentes

**A — Auditoria e finanças:** VOIDED não é dívida nem pagamento. Valor histórico preservado, recibos/ajustes/cobranças anteriores bloqueiam, estado SETTLED bloqueia, usuário proprietário é derivado do JWT. A emissão de cobrança e void serializam via lock de contrato. Replays não duplicam evento. Relatórios não contam o falso funding anterior. Migration adicional com checks e downgrade não destrutivo. **A atestação de ausência de transferência real é necessariamente humana**; não é comprovável apenas pelo banco.

**B — Matemática:** 0% em fixed_addon e Price conserva centavos exatos; a correção não mexeu no motor financeiro já validado. Rate inválida/negativa não vira zero. Termos alterados invalidam simulação; backend ainda valida hash.

**C/D — UX:** calendário estrito (bissexto), ISO só na fronteira, intervalo/parcela inteiros, quantidade exata de datas manuais, teclado mobile, pastilhas com aria-pressed, foco, toque de 48px, nomes longos e sem overflow a 320/375/390. As abas OAK e Cartões preservadas.

**Regressão e integridade:** suíte Pytest 187 PASS/10 SKIP explicado + SPEC001 runner 16 PASS, Vitest 55 PASS, Playwright 26 PASS, build e lint de escopo PASS, git diff --check PASS. Nenhum commit/push/merge/deploy/worktree nova e nenhum acesso destrutivo a banco real. Arquivos M/?? anteriores preservados.

**Riscos residuais a revisar independentemente:**
1. Anulação de ACTIVE exige confirmação humana de que **não houve transferência real**, não verificação bancária; corrigir desembolso real pertence a outra SPEC.
2. A migration spec004_0001 só foi exercitada em PostgreSQL descartável; **não existe autorização** para aplicá-la no Neon ou volume persistente. O downgrade bloqueia intencionalmente quando existe VOIDED, para preservar auditoria.
3. Auditoria e locks de concorrência exigem revisão independente antes de qualquer publicação.
4. 10 skips do pytest possuem teste SPEC001 com runner efêmero separado (16 PASS); nenhum deve ser anunciado como aprovado no pytest principal.
5. Lint global e aviso de bundle são dívidas anteriores fora deste escopo; não alterados.
6. Estornos reais, alterações ao JWT R8/SPEC002, Cartões e redesign OAK não foram abordados.

## 10. Parecer e handoff

**READY_FOR_INDEPENDENT_REVIEW** — quatro correções implementadas localmente, com evidências RED→GREEN, migration ensaiada em banco descartável, regressão completa incluindo Chromium Pixel 7, e sem falhas críticas conhecidas dentro do escopo da SPEC004.

**NÃO** é aprovação para produção. O revisor independente deverá inspecionar a consistência financeira, o locking, o novo schema, a reversibilidade segura, o frontend e o diff incluindo todos os arquivos não rastreados; qualquer impeditivo encontrado requer correção focada antes de integrar/publicar. **Não há autorização para commit, push, merge, deploy ou migrations em bancos reais.**

> AUTORREVISÃO DO EXECUTOR — NÃO SUBSTITUI REVISÃO INDEPENDENTE.
