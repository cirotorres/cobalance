# CoBalance — SPEC004 | Prompt único para Executor Individual

**Papel:** Executor Individual da SPEC004 — ONE-SHOT, TDD, testes de integração e E2E, autorrevisão e relatório final.
**Escopo:** quatro correções de Empréstimos (anulação, juros 0%, datas/números, pastilhas de tomadores).
**Resultado esperado:** código local revisável; **sem commit, push, merge, deploy ou escrita em bancos existentes**.

## 1. Entrada obrigatória — antes de qualquer edição

Você está atuando no checkout único `/home/ciro/dev/prog/cobalance`, **sem criar worktree**. A branch autorizada é `feat/spec004-emprestimos-correcao-ux`.

**Leia integralmente, antes de agir:**

`docs/planning/specs/SPEC004-emprestimos-correcao-e-ux-mobile.md`

Essa SPEC é o contrato normativo da tarefa, inclusive elegibilidade de anulação, APIs, migração, UX mobile, segurança e testes. Consulte também as partes pertinentes da SPEC003, da revisão R8 JWT e dos relatórios de migração Neon de 12/11, apenas como contexto.

**PRECHECK obrigatório:** `pwd`, `git branch --show-current`, `git rev-parse HEAD`, `git status --short` e `git worktree list`. A branch foi criada de `development`, cujo HEAD histórico era `578bf70`, e o checkout contém **muitas alterações pré-existentes não commitadas e arquivos untracked** de SPEC001/002/003/PWA. O código integrado de Empréstimos está nesse WIP, não necessariamente no commit `HEAD`. Nunca interpretar arquivos untracked existentes como lixo.

**PROIBIDO:** `git reset --hard`, `git clean`, `git stash`, checkout que sobrescreva WIP, pull/rebase/merge automático, nova worktree, `git add .`, alteração de projetos vizinhos, commit/push ou modificar `main`/`development`. Não tentar "sincronizar" o checkout com `origin/main` para resolver o contexto. Preserve integralmente arquivos de SPEC002/Cloudflare/PWA fora do escopo.

**Proteção de banco:** `PROD_DATABASE_URL` no `.env` aponta para Neon de produção. Não ler/exibir credenciais nem utilizar essa variável. Não executar migrations ou testes destrutivos em Neon `Primary` ou `copy`, nem no PostgreSQL persistente de development (`127.0.0.1:55483`, volume `cobalance-proj_postgres_data`). Toda migração, downgrade, reset e teste transacional deverá usar **PostgreSQL local explicitamente descartável**, com identidade e guarda verificadas. Não executar `alembic upgrade head` solto.

## 2. Objetivo de produto — implemente os quatro pontos, sem ampliá-los

**A. Excluir empréstimo cadastrado por engano, sem registrar pagamento.** A ação da interface pode ser `Excluir empréstimo`, mas a semântica técnica é **anulação lógica auditável** (`VOIDED`), nunca DELETE físico, quitação artificial, zerar valores, remover eventos nem fazer estorno fictício. Siga a seção 3 da SPEC004: habilitar `DRAFT`, `CANCELLED` e `ACTIVE` comprovadamente sem transferência real e sem operações financeiras associadas; bloquear `SETTLED` ou qualquer histórico de recibo (até estornado), ajuste, cobrança ou recálculo; `ACTIVE` exige confirmação adicional explícita de não transferência. Exigir motivo de 3–300 caracteres, confirmação em duas etapas para estado financiado, atualizar as telas sem recarga, ocultar anulados das listas comuns e disponibilizar `Mostrar anulados`. `VOIDED` não entra na carteira, em desembolsos realizados, previstos, atrasos ou cobranças. Preserve a trilha de auditoria. Proteja usuário A contra acesso ou ação sobre empréstimo de B. Faça comando idempotente, atômico e seguro à concorrência.

Implemente `POST /loans/contracts/{loan_id}/void` com payload estrito (`reason`, `idempotency_key`, `confirm_no_transfer`), status `VOIDED`, `voided_at` e `void_reason`, evento `contract_voided` e uma **nova revisão Alembic `spec004_0001`** derivada de `spec003_0001`. Atualize os checks `ck_loans_status` e `ck_loans_funded`, modelo, API, serializer, service, relatório, dashboard e ficha. Não modifique a migration SPEC003 já aplicada em produção, nem tabelas antigas. Faça migração up/down **somente em banco descartável**; não aplique a SPEC004 em produção.

**B. Empréstimo a 0% de juros.** Reproduza primeiro a falha relatada no fluxo completo. Há suporte existente no backend: `parse_rate("0")`, `fixed_addon_schedule` e `price_schedule`, com testes unitários positivos. **Não reescreva o motor financeiro sem evidência.** Inclua opção evidente `Sem juros` na criação, normalizando para `interest_method="fixed_addon"` e `rate="0"`; manter suporte Price 0% quando selecionado. Aceitar `0` e `0,0` no input, eventualmente `0%` colado, convertendo apenas na interface; API continua recebendo string decimal. Exemplo de aceitação: R$1.000,00 em 3 parcelas ⇒ R$333,34 + R$333,33 + R$333,33, juros R$0,00, total R$1.000,00. Demonstrar equivalência simulação/termos salvos, desembolso, recebimento e relatórios; proteger juros >0, Price normal e arredondamento em centavos.

**C. Máscara e validação de datas e inteiros no novo empréstimo.** Para `Data de início`, `Primeiro vencimento` e cada vencimento manual, mostrar e aceitar **`DD/MM/AAAA`**, teclado numérico mobile (`inputMode="numeric"`), inserir barras automaticamente, aceitar colar 8 dígitos ou com barras, operar corretamente backspace/cursor. Validar calendário real (inclui bissexto), datas incompletas, limites e ordenação, com erro contextual; transmitir para o backend apenas **ISO `YYYY-MM-DD`**. Para frequência `manual`, ter campo mascarado por parcela (N entradas com rótulos claros), mantendo `manual_dates` como lista ISO na API. Para `Parcelas` e `Intervalo (dias)`, permitir somente dígitos, rejeitar sinais, expoente, fração, texto e `parseInt` permissivo; exigir inteiros ``1..120` e ``1..365`, respectivamente. Não quebrar data/frequência de contratos históricos.

**D. Pastilhas clicáveis para escolher pessoas.** Na lista em `BorrowersTab`, substituir texto pequeno por botões-pastilha com superfície inteira clicável e alvo de toque mínimo 44 px (preferir 48), seleção evidente, contraste, foco visível, teclado/ARIA, nomes longos e responsividade de 320 a 390 px. Preservar `focusId`, cadastro e seleção de outra pessoa, sem vazamento de dados. Não modificar módulo Cartões.

## 3. Estratégia de execução ONE-SHOT — seguir TDD e checkpoints

**Checkpoint 0 — mapa e riscos.** Inspecione código real: ``backend/routes/loans.py`, `backend/loans/service.py`, `backend/models/loans.py`, `backend/loans/reports.py`, `backend/loans/serializers.py`, `backend/schemas/loans.py`, `backend/alembic/versions`, ``frontend/src/pages/Loans`, `frontend/src/services/loansService.js` e testes existentes. Liste os arquivos já alterados no WIP para preservar a base, identifique as FKs, restrições de status, efeitos de balanço, rotas e os mocks/testes atuais. Se houver achado incompatível com a SPEC, registre no relatório e escolha a abordagem conservadora; não invente exclusão insegura.

**Checkpoint 1 — RED.** Adicione testes que inicialmente falham para: anular elegíveis e bloquear inelegíveis, replays/conflitos/concorrência/ownership, preservar auditoria e relatórios, 0% ponta a ponta, datas/parcelas inválidas, pastilhas acessíveis no celular. Faça a falha demonstrável antes das alterações de produção do código. Não manipule DB fora de sandbox.

**Checkpoint 2 — GREEN backend e migration.** Implemente exclusivamente os domínios necessários: serviço transacional de anulação, checks de vínculo, alteração de schema em nova migration, dependências/serializers e filtros financeiros, mais correção comprovada de taxa zero se existir. Reproduza migration upgrade/downgrade e `alembic check` somente em PostgreSQL descartável **que represente uma base migrada à SPEC003 com dados fictícios**, preservando contratos já criados. Isolamento cross-user, nunca dados reais.

**Checkpoint 3 — GREEN frontend.** Implemente confirmação de exclusão com avisos e razão, opção sem juros, componentes/parse estritos de datas e inteiros, pastilhas mobile. A simulação deve ser invalidada quando os termos mudarem; não gerar valores reais em estados de rascunho/anulado. Integre rotas em `loansService.js`. Cubra interações e erros com Vitest/Testing Library.

**Checkpoint 4 — E2E e regressão.** Execute os gates completos: backend Pytest em base de teste isolada, runner PostgreSQL SPEC001, testes unitários frontend, `npm run build`, ESLint dos arquivos de escopo, Playwright desktop e mobile com backend real em PostgreSQL descartável. Acrescente E2E para: anulação sem mexer em recebido/balanço; erro `409` em contrato com recibo/cobrança; zero em 3x; entrada de datas `DD/MM/AAAA` e ida ISO; parcelas somente dígitos; seleção de pastilhas com toque mobile. Preserve cenários JWT R8, Cartões, Pix, Price e logout R7. Relate falhas pré-existentes separadamente, sem esconder regressões.

**Checkpoint 5 — autorrevisão e entrega.** Releia `git diff` no escopo das alterações, confira migrations/status/filtros, ordem dos locks, event sourcing, acessibilidade, índices/constraints e proteção das credenciais. **Não confunda autorrevisão com revisão independente**. Se não conseguir demonstrar um P0/P1 ou se banco descartável não estiver disponível, registre `BLOCKED` em vez de afirmar GREEN.

## 4. Entregas e limites

Escreva **`docs/planning/reviews/SPEC004-EXECUTOR-REPORT.md`** com: contexto/branch/HEAD inicial e WIP protegido; arquivos tocados; decisões sobre anulação e 0%; evidência RED→GREEN; migration nova e validação exclusivamente descartável; comandos e números de testes; E2E mobile; eventuais falhas e riscos; autoinspeção final; status **`READY_FOR_INDEPENDENT_REVIEW`** ou **`BLOCKED`**.

Nesta execução você **não está autorizado** a fazer commit, push, merge, PR, deploy no Vercel/Render, ou migration em qualquer banco persistente/Neon, mesmo que os testes deem PASS. Também não faça novas worktrees. Preserve a pasta `docs/planning/specs/` e este prompt, sem reescrever requisitos aprovados.

**Execute agora a SPEC004 por completo, em one-shot, dentro dos limites acima.**
