# CoBalance — SPEC003 | Ambientes Cartões e Empréstimos pessoais

**Criada em:** 2026-11-09
**Estado:** ESPECIFICAÇÃO DOCUMENTAL / CANDIDATA A REVISÃO INDEPENDENTE / NÃO IMPLEMENTADA
**Branch exclusiva:** `feat/spec003-modulo-emprestimos`
**Worktree:** `/home/ciro/dev/prog/cobalance-spec003-emprestimos`
**Baseline Git rastreada:** `578bf7064cb570453ee7b7c3d7c1521241b52efb` (`development`)
**Tipo de entrega:** feature em blocos TDD + E2E, com autorrevisão obrigatória em checkpoints, sem migração em banco existente, push de implementação ou deploy automático.
**Orquestração:** [Plano one-shot](../plans/SPEC003-one-shot-tdd-e2e.md) · [Prompt do executor](../prompts/SPEC003-one-shot-executor.md) · [Autorrevisão documental R0](../reviews/SPEC003-R0-autorrevisao-documental.md).

> Esta branch nasceu do HEAD **rastreado** de `development`. Implementação e documentação locais das SPEC001/002 no checkout canônico estavam **sem commit** e NÃO foram importadas para esta worktree. Não assumir que `POST /financial/installments` ou estruturas D-02I existem aqui. Não copiar alterações da worktree principal sem novo escopo. Esta SPEC tem de ser autossuficiente.

## 1. Visão de produto e decisões consolidadas

O CoBalance será uma plataforma pessoal com **dois ambientes financeiros independentes**:
- **Cartões**: experiência legada de empréstimo de cartão, com seus participantes, compras, lançamentos, balanços e cobranças. Preservar compatibilidade.
- **Empréstimos**: novo ambiente para capital próprio emprestado a pessoas, com juros, pagamentos, vencimentos, histórico, cobranças Pix e relatório mensal específico.
- **Usuários**: contas independentes por autenticação atual. Um usuário pode habilitar ambos os módulos e alternar contexto; escolher módulo padrão. **Não** mesclar contas de pessoas diferentes, mesmo de familiares.
- **Cadastros**: pessoas do módulo Cartões (`participants`) e tomadores do módulo Empréstimos (`loan_borrowers`) são distintos. A mesma pessoa pode aparecer em ambos sem compartilhar ID, cadastro, histórico, cor ou saldos.
- **Cálculos**: (A) adicional fixo de uma porcentagem do capital original **em cada parcela**; (B) Price, prestações fixas com juros sobre saldo devedor.
- **Prazos**: mensal (padrão), quinzenal a cada 15 dias, a cada X dias e datas customizadas por parcela.
- **Pagamentos**: integral por padrão; parcial somente como exceção explicitamente habilitada. Antecipação admite (i) amortização e recálculo Price, ou (ii) quitação antecipada de parcelas pelo valor programado, sem recálculo, escolhida por ocorrência.
- **Atrasos**: detecção automática; acréscimos **somente manuais**, informados/confirmados, sem cálculo automático.
- **Pessoa/contratos**: múltiplos empréstimos por tomador, cada um com cronograma independente, mas ficha e cobrança consolidáveis.
- **Recebimento múltiplo**: um único Pix recebido pode quitar parcelas selecionadas de diferentes empréstimos do **mesmo tomador e usuário**, em uma transação atômica.
- **Pix**: múltiplas contas/chaves de recebimento por proprietário, exatamente uma padrão entre as ativas; escolha no envio da cobrança. Conta de origem do empréstimo é independente da conta de recebimento.
- **Relatório**: mês de vencimento (previsto) separado do mês do recebimento (realizado); capital original/recuperado, juros previstos/recebidos, pendências e atrasos.
- **Excluídos**: ver seção 3. O sistema é registro e organização pessoal, não emissor de crédito ou banco.

## 2. Evidência e restrições da base

Conferido no checkout original em 09/11/2026:
- Backend `backend/main.py` em FastAPI com routers `/auth`, `/users`, `/participants`, `/financial`, `/agente`; ORM SQLAlchemy/PostgreSQL; JWT em `backend/core/security.py`.
- `backend/models/participant.py` define `participants(id,user_id,name,color)`. `backend/models/financial_entries.py` tem `user_id` e `participant_id`, `Numeric(10,2)`.
- `backend/routes/participants.py` tem `GET /participants/self` por titular, mas rotas administrativas podem acessar outras contas. **Empréstimos não herdarão bypass administrativo nem aceitarão owner_id em requests.** A autenticação existente também não diferencia explicitamente JWT access e refresh (dívida técnica registrada na SPEC002): revisar riscos e impedir que isso seja anunciado como segurança de produção resolvida pela SPEC003.
- Frontend React 19 + Vite; `frontend/src/routes/index.jsx` mapeia `/home` como rota protegida, `frontend/src/pages/Home/Home.jsx` contém tabs legadas e `AppLayout`/`Header` dão shell. Há `frontend/src/services/api.jsx`.
- `frontend/package.json` tem lint/build, porém **não traz scripts de teste unitário/E2E**; criação de harness Vitest/Testing Library e Playwright em devDependencies requer documentação, lockfile e gates. `backend/pyproject.toml` também não inclui pytest como dependência de projeto atualmente.
- SPEC001 backend tem GREEN LOCAL R7 (16/16) **somente no checkout original sujo**; migração em banco existente e frontend bloqueados. SPEC002 D-02I GREEN LOCAL R6 (25/25), porém **pausada** e sem integração/publicação. Estas frentes não podem ser trazidas implicitamente.
- Baseline Alembic no git deve ser inspecionada; **NUNCA rodar upgrade/stamp/DDL no Neon nem em banco existente sem autorização separada**. Testes de migração somente em PostgreSQL descartável.

## 3. Escopo da execução one-shot

### Dentro do escopo, por milestones

**M1 — Domínio e persistência isolada:** preferências de módulos por usuário, cadastro de tomadores, contas Pix, empréstimos, simulação, ativação mediante confirmação da transferência, parcelas/vencimentos, eventos auditáveis e engine monetária das duas modalidades; migrations versionadas apenas como arquivos.

**M2 — Recebimentos e integridade:** quitação integral/pagamento parcial excepcional, alocação proporcional, antecipação de parcelas, amortização Price (reduzir prestação ou prazo), pagamentos consolidados de um tomador, acrescimentos manuais, estorno auditável, status derivados, extratos e idempotência.

**M3 — Experiência React e relatórios:** troca explícita Cartões/Empréstimos, áreas separadas (Pessoas, Empréstimos, Recebimentos, Balanço, Cobranças, Configurações), cadastro e simulação com preview, confirmação de transferência, ficha por pessoa, filtros, responsividade desktop/mobile, report mensal previsto x realizado e saldos.

**M4 — Cobranças Pix manuais:** composição por parcelas selecionadas, chave/conta de destino selecionável com default, resumo compartilhável, QR estático e Copia e Cola com valor fixo quando suportado; histórico de cobrança gerada/compartilhada sem inferir pagamento; confirmação humana para quitação.

**M5 — Qualidade e entrega local:** bateria de unit/integration/E2E, autorrevisão checkpoint a checkpoint, documentação de instalação/teste, revisão final de diff. Entrega local na worktree, não deploy.

### Fora do escopo

- Importar ou concluir SPEC001/002; alterar Atalhos iOS, Worker, D1, Render cron, push notifications ou integração de notificações bancárias.
- CDI, caixinhas, investimentos e cálculo de custo de oportunidade.
- Cobrança automática ao devedor; envio WhatsApp sem ação humana; APIs bancárias; Pix dinâmico/recorrente; boletos bancários reais; conciliação de conta.
- Termos jurídicos, tributação, contrato assinado, compliance documental: não são objeto do produto nesta fase.
- Acesso/mutation a dados reais, segredos, Neon de produção, migrations aplicadas a bancos preexistentes, alterações na worktree original, merge, release e deploy.
- Refatoração do agente LLM, CSV Nubank, endpoint legado de cartão ou subsistemas não necessários à feature.

## 4. Navegação e autonomia dos módulos

- Manter `/home` como Cartões compatível; sugerir novas rotas protegidas `/loans` e `/loans/*` sem interferir nas páginas existentes.
- Uma preferência por usuário guarda `cards_enabled` (true para legado), `loans_enabled` (false até ativação) e `default_module` (`cards`/`loans`). A UI não pode ficar sem módulo ativo; desativar só oculta o módulo, nunca apaga dados.
- `GET /modules/me` lista habilitados/default; `PATCH /modules/me` atualiza apenas opções do titular. Mecanismo de enable loans é self-service; nunca por parâmetro de outro usuário. Novo endpoint de empréstimos exige módulo ativo (definir `403` para módulo desativado). Não quebrar endpoints legados de cartões na primeira migração: preferências têm propósito de navegação e gate do **novo** módulo, não revogação retroativa do legado.
- Entradas na navegação e telas devem exibir claramente o ambiente selecionado. Persistir escolha local (não substituir default persistido automaticamente). Os dados não são agregados entre ambientes.
- Usuário A nunca pode consultar/alterar cadastro, Pix, empréstimo, cobrança ou recibo de B por ID. Registro de `owner_user_id` deriva de autenticação em toda gravação; em leitura/edição usar filtro composto `id + owner`; negar como `404` para não revelar existência. Isolamento também ao selecionar alocações de um recibo.
- Acesso admin **não** implica enxergar carteira privada de terceiros no módulo de Empréstimos.

## 5. Contrato de domínio e modelo proposto

Tabelas candidatas (ajustar nomenclatura com consistência, sem reaproveitar `participants`/`financial_entries`):

| Entidade | Campos mínimos/restrições |
| --- | --- |
| `user_module_preferences` | `user_id` PK/FK, `cards_enabled`, `loans_enabled`, `default_module`, timestamp; fallback seguro para usuários sem linha |
| `loan_borrowers` | `id`, `user_id`, `name` (normalizado apenas para pesquisa), contato opcional, nota opcional, timestamps, arquivamento lógico |
| `loan_pix_accounts` | `id`, `user_id`, rótulo, instituição opcional, titular da chave, cidade do recebedor (para BR Code estático), chave Pix validável, `is_default`, `is_active`, timestamps; restrição de uma default ativa por titular |
| `loans` | `id`, `user_id`, `borrower_id`, descrição opcional, `principal_cents`, `interest_method`, taxa decimal em texto/NUMERIC, unidade da taxa, `installment_count`, `frequency`/`interval_days`, `funded_on`, conta de origem/forma/identificador ou comprovante opcional, status, versão cronograma, timestamps |
| `loan_schedule_versions` | `id`, `loan_id`, número, motivo, autor, timestamp, referência ao recebimento que provocou recálculo |
| `loan_installments` | `id`, `loan_id`, versão, número, `due_on`, `principal_cents`, `interest_cents`, `adjustment_cents`, `total_cents`, status derivado (ou materializado e verificado), timestamps |
| `loan_receipts` | `id`, `user_id`, `borrower_id`, `received_on`, `amount_cents`, meio/conta recebida, tipo, `idempotency_key`, observação, estorno/reversão, timestamps |
| `loan_receipt_allocations` | `id`, `receipt_id`, `installment_id` e versão, `principal_cents`, `interest_cents`, `adjustment_cents`, tipo, vínculo ao empréstimo; somas exatas |
| `loan_adjustments` | `id`, `user_id`, `loan_id`, `installment_id`, valor e motivo explícito, timestamp, evento de reversão, sem autojuros |
| `loan_charges` e itens | `id`, `user_id`, `borrower_id`, conta Pix + snapshot de dados exibidos, total congelado, data de geração, itens da cobrança e estado `generated/shared` sem status de pagamento bancário |
| `loan_events` | `id`, `loan_id` ou referência ao recebimento, tipo, actor, timestamp, payload de auditoria sem segredos, referência a transição/reversão |

- Chaves estrangeiras, índices `(user_id, borrower_id)`, `(loan_id, due_on)`, unicidade de versão+parcela, CHECK de valores, restrições de integridade e exclusão/restrição de cascatas que preservem histórico financeiro.
- Valores monetários convertidos no backend a **inteiros de centavos** e enviados como strings decimais na API; taxas em `Decimal`, não float. Se optar por `Numeric(10,2)` internamente, comprovar invariantes e escopo. Nunca aceitar centavos negativos onde o negócio não permite.
- Rejeitar erros de owner, tomador de outro usuário, cobrança cross-owner, rate/interval inválidos e registros com parcelas de mais de um tomador em recibo consolidado. Limites conservadores (tamanho de string, nº parcelas, valor máximo, data, precisão) devem ser centralizados, documentados e testados.
- Não coletar CPF como cadastro adicional do tomador, senha bancária, token bancário, credenciais ou comprovantes sem necessidade de produto. A própria chave Pix pode ser CPF/CNPJ e será tratada como dado pessoal: mascarar onde apropriado, nunca logar payload integral. Comprovante anexo é opcional futuro se não houver storage seguro já disponível.

## 6. Motor financeiro A — adicional fixo por parcela

**Regra específica do usuário** (não confundir com juros compostos):
- `P` capital original em centavos, `n` número de parcelas, `r` taxa porcentual por parcela aplicada **sempre sobre P**.
- `J_unidade = round_cent(P * r)`; `J_total = n * J_unidade`; `total = P + J_total`.
- Dividir `P` em `n` cotas inteiras (quociente/remainder distribuído deterministicamente às primeiras), adicionar a cada uma `J_unidade`. Garantir soma dos principais == P e soma das parcelas == total.
- Exemplos obrigatórios: Cleide P=3000, n=3, r=5% → 3×1150, juros=450, total=3450. Lívia P=1000, n=4, r=5% → 4×300, juros=200, total=1200.
- Em 1x, `P + 5% P`. Datas/frequência não alteram esta tarifa, salvo renegociação explícita.
- Em pagamento parcial excepcional, distribuir valor entre componentes em proporção ao valor **remanescente da parcela**, com arredondamento determinístico e prioridade documentada para o último centavo; nunca alocar mais que cada saldo.
- Se pedir “amortização com recálculo” neste modelo, **não inventar fórmula**: permitir quitação antecipada das parcelas programadas ou exigir uma renegociação manual com novo total/acordo e trilha auditável. Price é o modelo com recálculo matemático automático.

## 7. Motor financeiro B — Tabela Price

- `P > 0`, `n >= 1`, `i` taxa efetiva por período, `i=0` permite divisão simples.
- Periodicidade mensal com vencimentos mensais regulares: `A = P * i / (1 - (1 + i)^(-n))`; principal amortizado de cada parcela = prestação − juros do saldo; juros do período = saldo antes da parcela × taxa; prestação igual em centavos salvo ajuste final documentado para saldo zero.
- Taxa com unidade explícita, **mensal por padrão**, não chamar 5% por parcela de 5% ao mês automaticamente no Modelo A.
- **Convenção executável proposta para frequência não mensal:** converter taxa efetiva mensal `i_m` para período de Δ dias corridos: `i_Δ = (1+i_m)^(Δ/30) - 1`; usar `Decimal` e precisão suficiente, arredondar dinheiro apenas no boundary definido. Para datas irregulares, prestação constante obtida pelo valor presente dos fluxos (fatores de desconto acumulados por período), com ajuste final de centavos. Uma execução ONE-SHOT deve documentar essa convenção e compará-la com fixtures independentes; se divergência material/ambiguidade insolúvel, bloquear o checkpoint em vez de entregar Price matematicamente incorreto.
- Para frequência mensal, calendário preserva dia contratado e trata fevereiro/meses curtos sem drift; distinguir “todo mês dia 31 (último dia quando necessário)” de somar 30 dias. Quinzenal = 15 dias corridos; personalizado X inteiro >0; manual = N datas estritamente crescentes.
- Capital+juros por parcela devem fechar a soma e amortizar exatamente o principal; saldo final 0. Não usar float nem arredondar períodos intermediários de modo não reprodutível.
- Não criar juros extras pela simples passagem do vencimento. Em atraso, conservar composição contratual atual até recebimento/renegociação explícita.

## 8. Datas, estados e ativação

- Empréstimo começa `DRAFT`; simulação não é dinheiro real nem entra em relatório financeiro de desembolso. Ativar somente ao confirmar envio; guardar `funded_on` e forma de envio (Pix é padrão sugerido, outros meios permitidos), conta de origem opcional e nota.
- Cronograma pode ter primeira data de vencimento informada; sugerir mensalidade a partir dela, não inferir mês do funding. Data de funding <=? primeiro vencimento deve ser validada/documentada, com exceções explícitas e alertas de UX.
- Estados do contrato: `DRAFT`, `ACTIVE`, `SETTLED`, `CANCELLED` (cancelar apenas sem funding/efeito financeiro, ou com estorno auditável separado). Parcela: `PENDING`, `PARTIALLY_PAID`, `PAID`; `OVERDUE` é **visão derivada** quando vencida, com saldo >0 e data atual > due_on.
- Hora/timezone: usar data civil e timezone `America/Fortaleza` como convenção inicial de apresentação, com relógio injetável nos testes. Não comparar timestamp UTC bruto para determinar vencimento.
- Correção/renegociação exige versionamento e evento; preservar recibos e parcelas antigas, impedir edição silenciosa de termos após funding.
- Se uma parcela for antecipada e quitada, não reabri-la ao gerar cronograma futuro. Recebimentos não podem ficar órfãos após recálculo.

## 9. Pagamentos e antecipações

- Fluxo principal: usuário seleciona parcela(s), vê total exato e confirma **recebimento integral** com data real. Não assumir que compartilhar cobrança, gerar QR ou conferir Pix é recebimento.
- Exceção: habilitar checkbox e escolher valor parcial >0 e <= saldo, explicitamente; alocação proporcional no Modelo A, no Price respeitar componentes remanescentes do cronograma com arredondamento determinístico.
- **Antecipação A (Price):** quantia destinada à amortização extraordinária reduz principal vigente; permitir escolher (A1) manter última data e reduzir prestação, ou (A2) manter prestação aproximada e reduzir prazo. Registrar principal/juros pagos até a data e gerar nova versão só do futuro. Definir e testar casos de quitação integral, amortização maior que saldo, data no mesmo dia e saldo de centavos.
- **Antecipação B (ambos):** liquidar parcelas futuras selecionadas pelo valor programado, incluindo seus juros, sem recálculo; manter data original no histórico, registrar data real recebida. Diferenciar de amortização Price.
- **Consolidado:** selecionar somente parcelas do mesmo `user_id` + `borrower_id`, inclusive em contratos diferentes. Um `loan_receipt` com N alocações, operação inteira no mesmo commit. Falha de uma alocação → rollback total. No MVP, recebimento consolidado é **integral** por padrão; parcial requer UX explícita e alocação detalhada, sem quitação silenciosa de todos.
- Idempotência de gravação de recibos, ativações e ajustes monetários: chave por evento lógico + fingerprint de payload. Replay idêntico recupera mesmo resultado; mesma chave e payload distinto ⇒ `409`. Concorrência contra double pay deve usar lock/transação e checks de saldos em PostgreSQL real descartável.
- Estorno: não deletar recibo. Registrar evento reversor ligado ao original, impedir dupla reversão, recompor saldo e status sem duplicação; preservação cronológica do relatório.
- Ajuste manual de atraso: o calendário calcula atraso, mas só usuário confirma acréscimo por valor e motivo; o valor entra como **ajuste** separado de principal/juros e é reversível. Não recalcular juros automaticamente.

## 10. Cobranças Pix e histórico de envio

- Usuário cadastra diversas chaves Pix com apelido, titular e instituição opcional; escolhe uma única padrão ativa; desativar chave em uso histórico não apaga snapshot da cobrança.
- Selecionar parcelas do mesmo tomador; exibir contrato, número, data de vencimento, valor, valor total e conta Pix escolhida. A cobrança consolidada não altera saldos.
- Gerar Pix Copia e Cola e QR **estático** com valor, chave, nome e cidade do recebedor no padrão Pix quando a chave/dados permitirem, com validação local de formato/CRC e fixtures independentes. Sem integração com banco ou consulta de confirmação. Não afirmar que é “boleto” ou cobrança registrada.
- Mensagem compartilhável por ação humana (Web Share API onde suportado, fallback copiar texto e Pix), sem envio automático. PDF/impressão simples é opcional apenas se encaixar no timebox; não bloquear Pix mínimo.
- `loan_charges` guarda itens e snapshot da chave/beneficiário/valor/data na emissão. Se parcelas forem pagas depois, a cobrança original é histórica, e a UI informa que valores atuais podem divergir. `GENERATED` / `SHARED` são ações locais, não recibo externo confirmado.
- Recebimentos devem ser lançados por confirmação manual; conciliação automática é fora de escopo.

## 11. Relatórios — fonte e semântica

- **Carteira atual:** principal a recuperar = principal total de empréstimos ativos menos principal efetivamente amortizado, ajustado por reversões. Juros futuros previstos = componente de juros remanescente do cronograma **vigente**, separado de juros realizados. Total a receber = todos os componentes pendentes (principal, juros, ajustes).
- **Relatório mensal realizado:** desembolsos por `funded_on`; recebimentos por `received_on`; decompostos em principal recuperado, juros recebidos e ajustes recebidos. Mostrar fluxo de caixa líquido (entradas − desembolsos) **separado** do resultado de juros; não chamar recebimento bruto de lucro.
- **Relatório previsto:** parcelas do cronograma vigente por `due_on` (e possibilidade de reconstituir histórico conforme versões); identificar vencidas em aberto e a vencer. Pagamento previsto em outubro e realizado em novembro aparece nos dois períodos adequados, sem duplicar realizado.
- **Ficha tomador:** visão consolidada de contratos ativos/quitados, parcelas selecionáveis por contrato, total em aberto, recebimentos, próximos vencimentos, atrasos e cobrança consolidada; sempre isolada do módulo Cartões.
- Filtros mês, ano, pessoa, método, status e ordenação determinística. Exibir valores de exemplo apenas em mocks, jamais assumir transações reais.

## 12. APIs candidatas e erros

| Grupo | Endpoints sugeridos (a fixar antes da implementação) |
| --- | --- |
| Módulos | `GET/PATCH /modules/me` |
| Tomadores | `GET/POST /loans/borrowers`, `GET/PATCH /loans/borrowers/{id}`, arquivamento lógico |
| Contas Pix | `GET/POST /loans/pix-accounts`, `PATCH /loans/pix-accounts/{id}`, `POST /loans/pix-accounts/{id}/default` |
| Contratos | `POST /loans/simulate` sem persistência; `GET/POST /loans/contracts`, `GET /loans/contracts/{id}`, `POST /loans/contracts/{id}/fund`, `POST /loans/contracts/{id}/cancel` |
| Recebimentos | `POST /loans/receipts` (inclui múltiplas alocações, idempotência), `POST /loans/receipts/{id}/reverse` |
| Antecipações | `POST /loans/contracts/{id}/prepayment-preview` e registro transacional no fluxo de recibos; nunca alterar cronograma apenas por preview |
| Ajustes | `POST /loans/installments/{id}/adjustments`; reversão explícita |
| Cobranças | `POST /loans/charges`, `GET /loans/charges/{id}`, listagem por tomador |
| Painel | `GET /loans/dashboard?month=YYYY-MM`, `GET /loans/reports/monthly`, `GET /loans/borrowers/{id}/statement` |

Contrato de entrada:
- `amount` e `rate` como strings decimais; IDs de pessoa/parcela nunca determinam proprietário; owner vem do JWT. Somente campos permitidos e validação estrita `extra=forbid`.
- `201` novo / `200` leitura e replay; `400/422` inválido; `401` sessão inválida; `403` módulo inativo; `404` objeto não pertencente; `409` conflito e replay com payload distinto; `500` falha operacional sem sucesso parcial. Respostas monetárias em string decimal, datas ISO, mensagem sanitizada.
- Endpoint de criação/simulação deve exibir preview **idêntico** ao que será persistido se termos não mudarem, com token/versão de simulação ou hash de termos, e proteção contra submit duplo.
- API não terá alterações implicitamente exigidas nas rotas `/financial`, `/participants` e `/agente`.

## 13. Testes e critérios de aceite (mínimos)

**TDD unitário RED→GREEN por fatia**: converter centavos/juros, arredondamento, fixtures Cleide/Lívia, parcelas de 0% e 1x, limite de valores, calendário 29/30/31 e leap year, Price mensal/frequência quinzenal/custom/manual, soma de amortização, saldo final zero, antecipação A1/A2 e B, parcial com centavos, reversão.

**Integração PostgreSQL DESCARTÁVEL**: migrations up/down sem tocar ambientes existentes, constraints, multiusuário e isolamento cruzado, módulos/cadastros duplicados sem cruzamento, corrida de recibos, replay/idempotência, rollback completo de batch consolidado, desativação de chave padrão, charge snapshot, estorno duplo, não duplicação de relatório mensal e administração sem bypass.

**Frontend unitário/integrado**: seletor entre módulos, isolamento de estados/queries/cache, simulação sem persistência, confirmação de funding, parcial escondido por padrão, vencimentos, seleção consolidada, reversão confirmada, Pix selecionar default/alternativa, responsividade, acessibilidade labels/teclado.

**E2E (Playwright ou equivalente real browser):**
1. Usuário A faz login → habilita Empréstimos → cadastra Cleide → simula Modelo A (R$3000 3x 5%) → confirma funding → vê parcelas e balanço; Cartões segue intacto.
2. A cadastra segundo empréstimo e escolhe parcelas de ambos → gera cobrança com Pix padrão → confirma um recebimento integral → duas parcelas quitadas, 1 receipt e 2 allocations, relatório realizado do mês correto.
3. Usuário B tenta abrir URL/IDs do tomador, contrato, Pix, cobrança e recibo de A → sempre negado sem vazamento (no backend e pela UI).
4. Modelo Price → antecipação com recálculo (prestação ou prazo) e antecipação sem recálculo, com versões e saldos coerentes; teste de pagamento parcial como exceção.
5. Data vencida → badge atraso sem alterar valores; ajuste manual aparece separado; chave Pix alternativa e default persistem após reload.
6. Regressão: `/home` legacy, login/refresh e listagem de participantes Cartões continuam funcionando.

**Gates:** contagem exata, comandos, evidências e falhas registradas no relatório; sem simular teste/browser inexistente. A falha preexistente de access/refresh JWT sem tipo (SPEC002) deve constar como risco herdado e gate de segurança antes de produção, sem correção oportunista nesta SPEC. Falha P0/P1 ou falta de isolamento/centavos/atomicidade/E2E impede GREEN. Falha ambiental deve ser classificada e relatada, não maquiada.

## 14. Entregas, revisão e não regressão

- Trabalhar exclusivamente na worktree da branch `feat/spec003-modulo-emprestimos`. Não usar `git add .` indiscriminado; não copiar `docs/`/`cloudflare/` não rastreados da worktree principal.
- Entregar código FastAPI/SQLAlchemy/Alembic, React/Vite, harness/testes, documentação, scripts isolados e relatório de execução **somente** dentro da worktree.
- Autorrevise obrigatoriamente ao final dos checkpoints R1 estrutura/isolamento, R2 cálculos/datas, R3 pagamentos/transações, R4 frontend/Pix/E2E e R5 revisão final do diff. Revalidar critérios e diffs; proibir autorrevisão como “revisão independente”.
- Registrar `docs/planning/reviews/SPEC003-R{1..5}-...md` (ou relatório consolidado com seções separadas e evidências) e `docs/planning/reviews/SPEC003-EXECUTOR-REPORT.md`, com riscos pendentes e decisões não comprovadas.
- Revisão independente posterior preferível para migrar/publicar; one-shot local final pode ser `READY_FOR_INDEPENDENT_REVIEW`, **não** `PRODUCTION_GREEN`.
- Não realizar commits/push do código, merge, mudanças em banco existente, deploy ou publicação no escopo do executor sem autorização posterior explícita. A criação/push desta **branch documental** é etapa separada, previamente autorizada pelo usuário.
