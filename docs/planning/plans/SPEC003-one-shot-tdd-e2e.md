# SPEC003 — Plano de execução ONE-SHOT (TDD + E2E + autocontrole)

**Data:** 2026-11-09
**Base:** `feat/spec003-modulo-emprestimos` / `578bf70` / `/home/ciro/dev/prog/cobalance-spec003-emprestimos`
**Documento normativo:** [SPEC003](../specs/SPEC003-modulo-emprestimos.md).
**Estado:** plano documental; nenhuma implementação executada.

## Regra operacional

Executar num fluxo único com checkpoints internos R1–R5. **One-shot não quer dizer ignorar segurança ou falsificar GREEN.** Em P0/P1, risco de perda financeira/segurança, divergência matemática, ambiente não isolável ou falta de migrations seguras, parar no checkpoint, documentar achado e não avançar a blocos dependentes. Cada checkpoint é autorrevisão do executor (não substitui revisão independente).

Não tocar `/home/ciro/dev/prog/cobalance`, seu Git sujo, docs locais SPEC001/002, banco real, Neon, Render, Worker, D1, segredos, push/merge/deploy. Não executar comandos destrutivos sem identificar destino. A branch já está publicada apenas com documentação; **não dar push da implementação**.

## P0 — Pré-voo / inventário / evidência

1. `pwd`, `git rev-parse --show-toplevel`, `git branch --show-current`, `git status --porcelain`, `git rev-parse HEAD`, `git worktree list`. Garantir worktree correta e não sobrescrever alterações de outros agentes.
2. Ler SPEC003, este plano e prompt; inspecionar `backend/main.py`, ORM/models, auth, alembic, rotas, `frontend/src/routes/index.jsx`, `Home.jsx`, `api.jsx`, CSS e lockfile. Não assumir que código SPEC001/002 existe na branch. Não usar qualquer credential de banco real.
3. Registrar baseline `git diff --stat`, qualidade/testes disponíveis e versões, dependências necessárias, se Docker/PG descartável/browser Playwright estão disponíveis. Sem output de segredos.
4. Montar infraestrutura de testes isolada: Postgres efêmero com database/schema próprios e URL explicitamente de teste; nunca reutilizar `DATABASE_URL`/`DATABASE_URL_LOCAL` sem prová-la descartável. Se impossível, bloquear testes de integração com justificativa.
5. Escrever primeiro um mapa pequeno de módulos/rotas/tabelas e um contrato testável dos endpoints, respeitando convenções existentes. Não iniciar “grande refatoração”.

## P1 — Persistência e escopo (TDD → R1)

**RED:** testes de ownership, troca de módulo, nomes duplicados em áreas diferentes, CRUD de tomador/conta Pix, ativação condicionada, abertura de contrato e isolamento inclusive de admin.

**GREEN:** models/schemas/services/routes próprios; registro de preferência dos módulos com fallback legado; usuário autenticado como único owner; constraints/indices. Migrations versionadas para banco **descartável**, sem aplicar em banco existente. Imports dos models no Alembic sem alterar o fluxo legado.

**REFACTOR:** centralizar ownership e validação sem bypass e sem tocar controllers de cartões.

**R1 (autorrevisão):** revisar diff limitado da fase, diagramas de FK, exclusão lógica, defaults, colunas sensíveis, queries, autorização cruzada; rodar integração PostgreSQL, migração up/down descartável e regressão básica login. Falha P0/P1 → STOP.

## P2 — Cálculos e calendário (TDD → R2)

**RED:** fixtures de Cleide 3000/3/5% (1150 cada) e Lívia 1000/4/5% (300 cada), 1 parcela, 0%, divisão com centavos, leap years, mensal dia 31, quinzenal 15 dias, intervalos X, datas individuais, Price com saldo final 0 e recálculo de término.

**GREEN:** serviço Python `Decimal`/inteiro cents com funções puras: gerar cronograma Modelo A, gerar Price regular e irregular, explicar composição por parcela, validar 0 e limite, gerar preview sem gravar.

**REFACTOR:** taxas e periodicidade isoladas em objetos de domínio testáveis; resposta estabilizada string decimal.

**R2:** conferir cálculos à mão/planilha independente e invariantes Σcapital=P, Σjuros calculados, Σprestações=total, não negativo e saldo final 0; verificar ausência de float e comportamento de vencimentos curtos; STOP em discrepância financeira.

## P3 — Recebimentos, ajustes, antecipação, auditoria (TDD → R3)

**RED:** parcial excepcional, recebimento total normal, adiantamento de parcelas sem recálculo, Price A1 mantém prazo/A2 mantém prestação, histórico imutável, multi-empréstimo mesmo tomador, tentativa cross-user/cross-borrower, replay com idempotência, double submit/corrida, rollback se parcela já liquidada, estorno único, acréscimo manual não implícito.

**GREEN:** recibo financeiro transacional; allocations por componente; versões de cronograma e eventos; alocação a parcelas; fechamento automático contrato somente sem saldo; endpoint de preview não causa escrita; recibo consolidado atomicamente.

**REFACTOR:** separar command services dos handlers e queries dos cálculos; manter lógica financeira no backend, nunca no frontend.

**R3:** testes PostgreSQL concorrentes e transacionais; simular erro no meio do recibo, repetir chave, tentar pagar parcela de outro user, antecipar em excesso, estornar e conferir relatório; inspecionar transações e locking; STOP em dinheiro inconsistente.

## P4 — UI, cobranças Pix e dashboard (TDD → R4)

**RED:** testes React sobre navegação e isolamento, preview→funding, parcial oculto, Price, confirmação explícita, status overdue, seleção consolidada, default Pix, relatório mês vencido vs recebido, não lançamento por compartilhar Pix.

**GREEN:** construir módulo React em `frontend/src/pages/Loans` (ou organização coerente), services e componentes, seletor em shell sem reescrever `Home`. A navegação de cartões deve continuar idêntica quando selecionada. Consultas a APIs com auth existente, loading/error/empty states.
- Configurações: diversas chaves Pix, uma padrão; no documento de cobrança guardar snapshot e origem correta.
- Gerar Pix estático válida e determinístico (Copia e Cola + QR) de acordo com dados de titular/valor; validar CRC e fixtures; sem consultar banco. Compartilhar por ação do usuário via API nativa quando possível e fallback de cópia; nenhuma confirmação automática de pagamento.
- Relatório com duas lentes: por vencimento previsto e por efetivamente recebido; capital, juros, ajustes e caixa líquido separados.
- Adicionar harness Vitest/Testing Library, Playwright, scripts no package.json + lockfile; backend pytest em dependências de desenvolvimento isoladas. Evitar bibliotecas pesadas sem justificativa.

**R4:** lint/build/unit frontend; snapshots/queries sem vazamento de dados entre módulos; responsividade com viewport mobile, labels/a11y; rodar E2E 1–6 da SPEC com browser **real**, URL backend apontando para PostgreSQL descartável; STOP se cenários financeiros E2E críticos não passarem.

## P5 — Verificação final e relatório (R5)

1. Rodar suíte backend completa disponível, testes novos PostgreSQL, suites React, lint/build e E2E browser real; repetir testes críticos para detectar flakiness.
2. Auditar `git status --short`, `git diff --check`, `git diff --stat`, `git diff` e arquivos não rastreados; avaliar impacto em rotas legadas, auth, migration e lockfiles. Não incluir `.env`, `node_modules`, dumps, senhas, tokens, data real ou logs sensíveis.
3. Inspecionar o efeito de falha de rede/double click, tentativa de acessar resource ID alheio, refresh inválido, erro de banco no meio de pagamento, vencimento no limite de fuso, arredondamento difícil e Pix com chave alterada.
4. Criar `docs/planning/reviews/SPEC003-R1-...` até `R5-...` (ou um consolidado com sections R1–R5 e links), junto de `SPEC003-EXECUTOR-REPORT.md`. Cada revisão deve incluir escopo, commits/arquivos, comandos executados, resultados observados, P0/P1/P2, riscos e status (GREEN LOCAL vs BLOCKED).
5. Parecer final restrito: `READY_FOR_INDEPENDENT_REVIEW` apenas se todos gates locais passarem; nunca afirmar READY_FOR_DEPLOY. Não commitar/push/merge sem nova autorização.

## Checkpoints — matriz mínima

| Gate | Deve comprovar | Falha bloqueante |
| --- | --- | --- |
| R1 — isolamento | Cada conta e módulo isolados; schema migra em PG descartável; legado preservado | Acesso cross-user, migration insegura, dados mesclados |
| R2 — matemática | A, Price e datas fecham em centavos, 0 saldo final; fixtures independentes | Dinheiro calculado incorretamente, float, drift calendário |
| R3 — transações | Recibos/estornos idempotentes, rollback, lock concorrente e versões | Dupla quitação, perda de recibo, juros errados, cross-owner |
| R4 — fluxo E2E | UI e browser real cobrem criação, Pix, consolidado, Price e regressão | E2E inventado, tela saldos errados, módulo legado quebrado |
| R5 — release local | Build/lint/testes/comandos e diff auditados; secrets ausentes | P0/P1 ou ausência de evidência para claim GREEN |

## Cenários de teste adicionais que aumentam confiança

- Mesmo tomador “Cleide” em Cartões e Empréstimos: IDs independentes; pessoas de contas diferentes com mesmo nome também independentes.
- R$0,01 dividido por parcelas inválidas; limite máximo; taxa negativa/alta, input NaN/exp string, vírgula vs ponto, meia unidade arredondada; 0% Price.
- Funded em dia 31 → mensal fevereiro e março sem encurtamento progressivo; DST não muda date-only.
- Parcelas pagas antes, parcialmente e depois estornadas; antecipação Price depois de parcela vencida não pode apagar a dívida vencida; versão nova preserva todas allocations existentes.
- Consolidação envolvendo pessoa de outro usuário ou uma parcela já paga deve ser rejeitada sem quitação parcial dos outros itens.
- Atualização do default Pix sob concorrência deixa uma única conta padrão; excluir/desativar uma conta exige nova default quando existem outras; cobrança histórica não muda ao editar chave.
- Cobrança gerada no mês anterior, pago depois: receipt aparece só no mês efetivo; ajuste manual sempre separado dos juros contratuais.
- Quando não houver suporte à API de compartilhamento, fluxo copiar texto e código Pix deve funcionar no browser.

## Saída obrigatória do executor

Relatório final:
- Branch, worktree, HEAD e lista de arquivos alterados.
- Quais componentes/rotas/tabelas novas, sem afirmar migrations executadas em banco real.
- Contagens exatas de testes backend, frontend e E2E, comandos, fixtures usadas, falhas/saltos e motivos.
- Evidência por checkpoint R1–R5, riscos remanescentes e eventuais bloqueios.
- Estado final do Git (sem push/merge/deploy), instruções para revisor independente e próximos gates de aplicação no banco existente.
