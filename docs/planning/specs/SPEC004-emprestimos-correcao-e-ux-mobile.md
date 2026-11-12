# CoBalance — SPEC004 | Correção de contratos de Empréstimos e UX mobile

**Estado:** ESPECIFICAÇÃO APROVÁVEL PARA EXECUÇÃO LOCAL — não implementada
**Data:** 12/11/2026
**Origem:** quatro necessidades relatadas após a publicação da SPEC003
**Branch de trabalho:** `feat/spec004-emprestimos-correcao-ux`
**Checkout único:** `/home/ciro/dev/prog/cobalance` (sem criar worktree)
**Documento executivo:** `docs/planning/prompts/SPEC004-one-shot-executor.md`

## 1. Objetivo e limites

Corrigir **quatro** aspectos do módulo de Empréstimos: (A) remover da carteira um contrato cadastrado por engano, **sem simular pagamento**; (B) permitir empréstimo **sem juros (0%)** de ponta a ponta; (C) oferecer entrada guiada de datas `DD/MM/AAAA` e campos exclusivamente inteiros para parcelas/intervalo; (D) tornar a lista de pessoas facilmente selecionável por toque no celular, com botões em formato de **pastilha/chip**.

Preservar a implementação OAK da SPEC003 e as correções R6/R7/R8 JWT, SPEC001, módulo Cartões, Pix, Tabela Price, centavos, histórico e isolamento por titular. Não criar funcionalidade de renegociação, exclusão de tomadores, juros automáticos ou refatorações paralelas.

**Termos da interface:** o usuário pode ver a ação `Excluir empréstimo`, mas a implementação deverá chamar `Anular registro` e ser **lógica/auditável**, não `DELETE FROM loans`. O histórico deve esclarecer que um erro de cadastro foi corrigido sem entrada fictícia de dinheiro.

## 2. Evidências do código atual — não confundir hipótese com fato

- `backend/routes/loans.py` expõe `POST /loans/contracts/{id}/cancel`; `backend/loans/service.py::cancel_contract` aceita **somente DRAFT**. `frontend/src/pages/Loans/BorrowerStatement.jsx` expõe apenas `Cancelar rascunho`. Não existe hoje ação genérica de retirada de um contrato indevido.
- `backend/models/loans.py` e migration `spec003_0001` limitam status a `DRAFT/ACTIVE/SETTLED/CANCELLED`, com CHECK adicional `ck_loans_funded`. Recebimentos, cronogramas, cobrança, ajuste, eventos e chaves de idempotência mantêm FKs: **não fazer exclusão física**.
- `backend/loans/money.py::parse_rate` aceita `0`; os motores `fixed_addon_schedule` e `price_schedule` já possuem tratamento de taxa zero. Testes existentes: `test_addon_zero_rate_and_tiny_principal` e `test_price_zero_rate_equals_division` em `backend/tests/test_p2_schedule.py`. O defeito relatado deve ser **reproduzido no fluxo de interface/termos/API** antes de mexer no motor.
- `frontend/src/pages/Loans/NewLoanTab.jsx` usa `type=date` para início e primeiro vencimento, datas manuais num único campo de strings `AAAA-MM-DD`, `type=number` para parcelas e `buildTerms` faz `parseInt` sem rejeitar integralmente entradas como `3.5` ou `3abc`. O seletor de frequência já oferece mensal, quinzenal, a cada X dias e manual.
- `frontend/src/pages/Loans/BorrowersTab.jsx` apresenta nomes como links com área de toque pequena (`styles.link/linkActive`); `Loans.module.css` precisa de estilos específicos para pastilhas e foco.
- Relatórios em `backend/loans/reports.py`: saldo em aberto considera status `ACTIVE`; realizado mensal considera `ACTIVE/SETTLED`, mas `statement` inclui todos os contratos. Considerar anulação tanto em métricas como nas listas default.
- O banco **Neon Primary** recebeu SPEC001 + SPEC003 e passou em `alembic check` em 12/11. **Não tocar nele nesta SPEC.** Qualquer mudança estrutural exige migration nova e ensaio descartável.
- A branch local `development` contém alterações de código ainda **não commitadas** e está historicamente atrás de `main`; a branch SPEC004 foi criada sem mover, limpar ou integrar essa worktree. **Não presumir que HEAD contenha a implementação da SPEC003.**

## 3. Frente A — exclusão lógica/anulação de registro equivocado

### 3.1. Comportamento de produto

Exibir `Excluir empréstimo` na ficha do tomador, claramente diferenciado de `Marcar como pago`, `Estornar recebimento` e `Cancelar rascunho`. Ao clicar:

1. Abrir confirmação acessível (teclado e mobile) com contrato, valor, status, nome do tomador e aviso **"Esta ação não registra pagamento nem devolução"**.
2. Exigir motivo (`3–300` caracteres), confirmação explícita de anulação e, quando houver envio registrado (`ACTIVE`), confirmação adicional: **"Confirme que o dinheiro não foi realmente transferido; se foi, não use anulação"**.
3. Enquanto envia, desabilitar ações e impedir duplo clique; em sucesso, atualizar ficha, lista e relatórios sem refresh manual.
4. Por padrão **ocultar contratos anulados** da lista/ficha normal; oferecer filtro `Mostrar anulados` para consulta histórica, com status `Anulado — registro desconsiderado`, data, motivo e sem controles de cobrança/recebimento.
5. Não apagar tomador, dados de Pix de outras operações, cronogramas, eventos, valores históricos, IDs ou referências de terceiros.

### 3.2. Elegibilidade segura (servidor é autoridade)

- **Permitir** anular `DRAFT` e `CANCELLED`, mesmo que já constem na ficha; `DRAFT` ainda pode usar `Cancelar rascunho`, mas "Excluir" serve para retirar o erro da lista default.
- **Permitir** anular `ACTIVE` **somente** quando (i) o operador declara expressamente que não houve transferência real; (ii) **não existe** nenhum recebimento/alocação, nem mesmo revertido; (iii) nenhum ajuste, nem mesmo revertido; (iv) nenhuma cobrança vinculada a qualquer parcela do contrato, mesmo antiga/compartilhada; (v) nenhuma versão posterior ou outro movimento financeiro material associado. A simples transição `funded` registrada pelo erro é auditada, não apagada.
- **Rejeitar `SETTLED`** e qualquer contrato com movimentações/obrigações já registradas: `409` com orientação clara (`"Contrato com movimentos financeiros; regularize por fluxo auditável separado"`). Não remover recebimento ou cobrança para contornar a regra.
- Se o dinheiro **foi transferido de verdade**, mesmo sem recibos lançados, a pessoa não deve utilizar "Excluir"; correção/estorno de desembolso real é **outra SPEC**. A UI deve impedir o uso irrefletido.
- Repetição idempotente: mesma chave + payload retorna a mesma anulação, sem duplicar evento; chave igual + payload diferente => `409`. Uso simultâneo: transação e `SELECT FOR UPDATE` no contrato/objetos relacionados; bloqueio atômico diante de recebimento/ajuste/cobrança concorrente. `404` para contrato de outra pessoa; `403` módulo desabilitado.
- Nunca criar `loan_receipt`, `loan_receipt_allocation` ou evento `paid` por uma anulação.

### 3.3. Contrato técnico esperado

- Novo comando `POST /loans/contracts/{loan_id}/void`, request estrito com `reason`, `idempotency_key` e `confirm_no_transfer` obrigatório e `true` quando status `ACTIVE`. Resposta `200` com estado atualizado; ``invalid/409` em condições inelegíveis; sem endpoint genérico destrutivo.
- Novo estado `VOIDED`, data `voided_at`, motivo `void_reason`; ator via `LoanEvent.user_id` e evento `contract_voided` com status anterior. A auditoria não deve conter segredos.
- **Nova migration versionada** `spec004_0001`, `down_revision = spec003_0001`. Ajustar na migration e no ORM `ck_loans_status` e `ck_loans_funded` para o estado adicional; novas colunas anuláveis para contratos antigos e restrição para não permitir `VOIDED` sem data/motivo. Não editar migration `spec003_0001`, não mudar tabela legada. Aplicar/testar **apenas** em Postgres local de teste descartável, com baseline anterior e contratos reais fictícios.
- Consulta ``GET /loans/contracts` e ficha: parâmetro opcional `include_voided=false` preservando comportamento atual para demais status e mostrando anulados apenas sob solicitação; acesso direto a um anulado pode retornar detalhe histórico com sinalização (nunca 404 falso do titular).
- Atualizar ``loans/serializers.py`, ``loans/reports.py`, dashboard, extrato por tomador, totais realizados/previstos, overdue, próximos vencimentos, faturamento Pix e restrições de mutação. Em status `VOIDED`, o desembolso registrado equivocadamente **não compõe relatórios financeiros**, mantendo trilha de anulação separada. Não zerar/editar centavos ou apagar recibos existentes.
- Testar anulados excluídos dos saldos e relatórios **inclusive no mês original do suposto funding**, sem lançar retorno recebido. `VOIDED` não deve ser reativável nem voltar a `ACTIVE` por outro comando.
- Teste de segurança obrigatória: usuário A não anula ID de B, e GET/relatórios B não expõem contratos/valores de A.

## 4. Frente B — empréstimo sem juros

- Na criação, oferecer opção **"Sem juros"** fácil de descobrir, além dos modelos existentes; preferência visual não cria terceiro motor, persistir o contrato com `interest_method='fixed_addon'` e `rate='0'`, salvo se usuário optar conscientemente por Price a 0%. **Não introduzir enum novo**.
- Permitir informar `0`, `0,0` e opcionalmente colar `0%` no campo **de interface**, normalizando de forma explícita para API `rate: "0"`. Taxa percentual maior que zero continua com mesma precisão/regra original; entradas inválidas ou negativas não viram zero silenciosamente.
- Garantir: `principal > 0`; soma de parcelas = principal, juros totais `0.00`, nenhuma receita de juros, números em centavos inteiros e restante no início das parcelas para divisão não exata; tanto em simulação quanto em gravação, funding, recibo e relatórios.
- A simulação deve produzir `terms_hash` compatível com a persistência; mudar qualquer campo após simular invalida a prévia e obriga simular novamente.
- Testes explícitos backend + frontend + E2E (ex.: R$ 1.000,00 em 3x: `333.34 + 333.33 + 333.33`; juros `0.00`). Cobrir modalidade original `fixed_addon` com juros >0, Price tradicional e Price a 0%.
- **Investigar a causa observável** do relato sem atribuir erro inexistente ao `parse_rate`: as funções de cálculo hoje já aceitam `0`.

## 5. Frente C — datas e campos numéricos no cadastro

- Exibição e edição de **Data de início**, **Primeiro vencimento** e, na frequência manual, **cada vencimento** em `DD/MM/AAAA`. Entrada numérica com separadores automáticos `/`; `type="text"`, `inputMode="numeric"`, limite de oito dígitos + duas barras, teclado numérico no iPhone/Android, suporte a colar `ddmmaaaa` ou `dd/mm/aaaa`, backspace, foco e cursor sem saltos incômodos.
- Validar data civil verdadeira (31/02, 29/02 não bissexto, mês 13, ano inválido, data incompleta), sem `new Date` permissivo ou ambiguidades de fuso. Apresentar mensagens curtas por campo; não salvar/simular se inválida. Converter para `YYYY-MM-DD` **somente na fronteira da API**; respostas continuam em ISO. Não alterar regra de negócio de `first_due_on > start_on`.
- Frequência `manual`: substituir o campo de lista ISO separada por vírgulas por **N campos de data mascarados com rótulos "Parcela 1", "Parcela 2" ...** (ou UX móvel equivalente que permita cada data sem ambiguidades). Deve exigir exatamente `installment_count` datas válidas estritamente crescentes, sem perdas silenciosas ao variar número de parcelas. No backend, `manual_dates` continua `list[date]`.
- **Parcelas:** entrada somente com algarismos (inclusive colar), sem sinal, decimal, `e`, `+`, `-` ou espaços dentro do valor; `type=text` com `inputMode=numeric` / sanitização ou rejeição explícita; no submit exigir inteiro completo entre `1..120`. `Intervalo (dias)` na frequência a cada X dias também apenas inteiros `1..365`. Não usar `parseInt` tolerante a lixo (`3abc`, `2.5`).
- Máscara e validador devem ser funções puras e testadas para manter a digitação previsível. Preferir componentes reutilizáveis somente dentro do escopo do cadastro de empréstimos; não alterar o comportamento de telas de Cartões.

## 6. Frente D — pastilhas de pessoas (mobile-first)

- Em `BorrowersTab`, substituir links de texto simples por botões-pastilha, com **toda a superfície clicável**, altura mínima de `44px` (preferir `48px`), área horizontal confortável, bordas arredondadas, contraste e estado selecionado evidente (não depender só de cor).
- Lista deve quebrar linhas ou rolar horizontalmente **sem overflow de viewport**, principalmente 320/375/390 px; nomes longos legíveis e sem sobreposição; foco `:focus-visible`, suporte a Tab/Enter/Espaço, `aria-pressed` ou semântica equivalente.
- Preservar criação de tomador, foco após cadastro, `focusId`, seleção A→B e atualização da ficha sem cruzamento de dados. Não alterar `loan_borrowers`.
- Validar no iPhone/Pixel emulado via Playwright, inclusive alternar tomadores sem clicar em texto minúsculo.

## 7. Arquivos impactados (diretriz, não limite rígido)

- Backend: `backend/models/loans.py`; `backend/alembic/versions/spec004_0001_*.py`; `backend/routes/loans.py`; `backend/schemas/loans.py`; `backend/loans/service.py`; `backend/loans/reports.py`; `backend/loans/serializers.py`; testes `backend/tests/`.
- Frontend: `frontend/src/pages/Loans/NewLoanTab.jsx`, `BorrowersTab.jsx`, `BorrowerStatement.jsx`, `Loans.module.css`, `terms.js`, novo utilitário/componente pequeno para máscara se necessário, `frontend/src/services/loansService.js`, `components.test.jsx`, `terms.test.js`, `frontend/e2e/spec003.spec.js` ou `spec004.spec.js`.
- Não mexer em `backend/core/security.py`, fluxo JWT, SPEC002 Cloudflare, Cartões, Service Worker/PWA ícones, configuração de Render/Vercel nem ativos de produção sem justificativa crítica.

## 8. Aceites obrigatórios TDD / regressão

### Backend / Postgres descartável

1. RED→GREEN para anular `DRAFT`, `CANCELLED` e `ACTIVE` elegível; demonstrar status, motivo, ator/evento e resposta idempotente.
2. Anulação não altera contagens financeiras por pagamento e exclui falso funding do mensal; saldos/projeções zerados para o contrato, cartão/usuários intactos; IDs/dados preservados.
3. Bloqueio `409` para `SETTLED`, `ACTIVE` com recibo mesmo estornado, ajuste, cobrança, cronograma recálculo ou `confirm_no_transfer` ausente. Não existe success parcial após falha.
4. Cross-user `404`; gate `403` módulo desligado; concorrência/simultaneidade sem estados intermediários; FKs e integridade.
5. Migration `spec003_0001 → spec004_0001` e downgrade **somente** em PostgreSQL descartável, conferindo dados legados e checks sem drift; `alembic check` PASS no ambiente de teste. **Nunca executar comandos destrutivos fora do teste.**
6. Cobertura de juros zero em dois métodos, diferentes parcelas/centavos e relatório realizado; manter fixtures Price e juros >0.

### Frontend e E2E

7. Juros zero: simulador aceita, apresenta R$ 0,00 em juros, permite salvar/ativar e receber sem juros, sem duplicar balanço.
8. Exclusão: confirmação completa em mobile; anular tira da lista comum, fica no histórico, não cria recebido, respeita bloqueio/erro e permite desfazer a **confirmação antes de executar**, não reativar contrato depois.
9. Datas: simulação/solicitação API recebem ISO correto; validação de data real, bissexto, anos, backspace/colar; frequência manual 1..N datas, ordenação estrita; parcelas/dias não admitem texto/decimal.
10. Pastilhas mobile: toque na superfície, seleção evidente, tab/teclado/ARIA, listas longas e 320px sem overflow.
11. Regressão: 0% e juros normais, Price, pagamento parcial, Pix/cobranças, histórico, R7 logout/troca de módulo, JWT R8, Cartões e PWA iOS inalterados.

### Gates de execução

- `pytest` backend integrado; SPEC001 em PostgreSQL descartável; `npm test`, `npm run build`, lint **do escopo alterado**, E2E Playwright desktop e mobile **sobre banco descartável**. Apontar falhas legadas globais separadamente, sem mascarar falhas introduzidas.
- Se a implementação exigir uma decisão financeira incompatível com auditoria, **bloquear só essa fatia** e reportar claramente; não fazer "exclusão" fraudulenta via recibo fictício.
- Autorrevise diff, schema, isolamento e operações financeiras. Não chamar autorrevisão de independente.

## 9. Ambiente e restrições duras

- Trabalhar **apenas** em `/home/ciro/dev/prog/cobalance` e na branch `feat/spec004-emprestimos-correcao-ux`, **sem nova worktree**.
- O checkout contém **muitas alterações/untracked anteriores** de SPEC001/002/003/PWA que pertencem ao proprietário; **não usar** `git reset --hard`, `git clean`, `git stash`, checkout destrutivo, `git add .`, nem alterar arquivos de projetos vizinhos.
- Atenção: branch nasceu de `development` no commit `578bf70`, mas o código integrado da SPEC003 está **na worktree não commitada**. A `main` já foi publicada separadamente (última versão de ícone PWA `1872080`). **Não executar merge/pull/rebase automático** para "sincronizar"; revisar contexto sem destruir WIP.
- **Nunca conectar a banco Neon `Primary` ou `copy` para escrita**, nem utilizar `PROD_DATABASE_URL` ou migrate default; migrations/downgrades apenas com URL explicitamente descartável em PostgreSQL de teste local, sem afetar o volume persistente `cobalance-proj_postgres_data`.
- Sem commit, push, merge, deploy, alteração de ambiente real, publicação no Render/Vercel ou mudanças no Neon durante a **execução do prompt**. A SPEC004 só produz código local e relatório de revisão.

## 10. Entrega do executor

Criar `docs/planning/reviews/SPEC004-EXECUTOR-REPORT.md` com: branch e HEAD inicial, inventário WIP, decisões de domínio, RED→GREEN, migrations criadas mas **não aplicadas em produção**, comandos exatos / contagens, E2E mobile, riscos remanescentes, autorrevisão do diff restrito e inventário dos arquivos tocados. Parecer final somente `READY_FOR_INDEPENDENT_REVIEW` ou `BLOCKED`; nunca `PRODUCTION_GREEN`.

**FIM DA SPEC004.**
