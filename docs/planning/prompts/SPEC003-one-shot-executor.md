# PROMPT ÚNICO — EXECUTOR SPEC003 / CoBalance Empréstimos / ONE-SHOT TDD + E2E

**Papel:** você é o EXECUTOR responsável por implementar **somente** a SPEC003 do CoBalance em um único ciclo orquestrado, com TDD estrito, validação end-to-end em navegador real e AUTORREVISÕES R1–R5. Você não é o revisor independente; seja rigoroso e transparente com o que efetivamente testou.

**Worktree obrigatória:** `/home/ciro/dev/prog/cobalance-spec003-emprestimos`
**Branch exclusiva:** `feat/spec003-modulo-emprestimos`
**Baseline documental:** `578bf7064cb570453ee7b7c3d7c1521241b52efb` (a branch documental poderá ter um commit posterior).
**Fonte normativa:** `docs/planning/specs/SPEC003-modulo-emprestimos.md`
**Plano obrigatório:** `docs/planning/plans/SPEC003-one-shot-tdd-e2e.md`
**R0 documental:** `docs/planning/reviews/SPEC003-R0-autorrevisao-documental.md`.

## Missão

Entregar na worktree isolada, sem interferir no projeto canônico, o novo ambiente **Empréstimos pessoais**, preservando **Cartões** exatamente como funciona na baseline rastreada. Ambos são ativáveis para cada usuário, sem compartilhar cadastros de pessoas, operações e balanços. Implementar Motor A (adicional % do capital original por parcela), Motor B (Price), cronogramas mensal/quinzenal/X dias/datas manuais, funding confirmado, recebimento integral por padrão, exceção parcial, antecipação com recálculo Price ou quitação sem recálculo, múltiplos empréstimos por tomador, quitação consolidada atômica, ajustes manuais por atraso, relatórios mensais previstos/realizados, várias contas Pix com uma padrão e cobrança manual por QR Pix estático/Copia e Cola. Push, Atalhos iOS, CDI e conciliação bancária ficam fora.

## Autorizações e proibições

- Permitido: modificar arquivos **somente na worktree acima**; criar testes, código, migrations como artefatos, docs e relatórios locais; criar banco **totalmente descartável** de testes após validar destino; instalar dependências de desenvolvimento isoladas; rodar lint/build/E2E.
- PROIBIDO: operar `/home/ciro/dev/prog/cobalance` ou suas alterações não commitadas; incorporar SPEC001/002 sem autorização; ler/divulgar segredos ou dados pessoais reais; executar upgrade/stamp/DDL em Neon, banco existente, homologação compartilhada ou produção; acessar Cloudflare/D1/Render; deploy, merge, release, push, ou commit do código sem autorização específica.
- É uma tarefa ONE-SHOT: execute P0→P5 na mesma sessão enquanto os gates estiverem verdes; NÃO peça confirmação em cada fase trivial. Se houver bloqueio sério (P0/P1, matemática incorreta, ownership, persistência não atômica, ambiente de teste não isolável), faça SAFETY STOP do bloco afetado, registre diagnóstico/evidência e entregue o máximo de escopo independente válido sem proclamar GREEN global.
- A worktree é baseada no Git rastreado: SPEC001 R7 e SPEC002 R6 existem como trabalho não commitado no checkout original. **Não dependem nem estão incluídas nesta worktree.** Novas tabelas/rotas devem ser autocontidas e não mudar `/financial/*`, `/participants/*` ou `/agente/*` por conveniência.

## Procedimento obrigatório

**P0 — Reconhecimento**
1. Verifique `pwd`, HEAD, branch, status e worktrees. Leia integralmente SPEC003 + plano + R0. Inspecione rotas/modelos atuais, autenticação JWT, Alembic e navegação React. Registre baseline. Antes de qualquer teste PostgreSQL, valide que URL/banco são descartáveis, com isolamento verdadeiro. Não exponha env/secrets.
2. Proponha em poucas linhas mapa de módulos, endpoints, migrações e estratégia de testes; prossiga sem aguardar aprovação se totalmente aderente à SPEC.

**P1 / R1 — Testes de isolamento primeiro**
3. Escreva testes RED para user A/B, cartões/emprestimos separados, cadastro repetido de mesmo nome em áreas distintas, módulo desativado, Pix default e validações. Implemente modelos/serviços/rotas com owner sempre do token, sem bypass de admin. Migrations somente em banco descartável. Rode RED→GREEN→REFACTOR e AUTORREVISÃO R1; grave relatório com resultados reais. P0/P1 ⇒ STOP.

**P2 / R2 — Matemática**
4. Comece por fixtures Cleide 3000 3x 5%=1150×3, Lívia 1000 4x 5%=300×4, centavos e datas limite; cubra adicional fixo e Price com Decimal e centavos exatos. Faça cálculo puro + simulação sem persistência, comparações independentes, testes negativos e de calendário. RED→GREEN→REFACTOR→AUTORREVISÃO R2. Confira saldo final 0 e convergência do Price irregular. Discrepância financeira ⇒ STOP.

**P3 / R3 — Transações**
5. Teste antes de implementar funding confirmado, recibos integrais, parcial explícito, antecipação de parcelas fixas, amortização Price com redução de prazo ou prestação, versionamento, acréscimo manual, estorno, replay/idempotência e recibo consolidado de um tomador em dois empréstimos. Use transação real PostgreSQL + concorrência/rollback e ownership em cada relacionamento. RED→GREEN→REFACTOR→AUTORREVISÃO R3. Double pay, cross-user, saldo inconsistente ⇒ STOP.

**P4 / R4 — Frontend e Pix**
6. Implemente experiência React separada e responsiva: troca de ambientes, ficha por pessoa, simulador, contratos e parcelas, confirmação de envio, confirmação de recebimento, seleção consolidada, balanço mensal e contas Pix com uma padrão. Preserve shell e componentes legados, minimizando refactor.
7. Adicione testes de componentes e E2E em browser real (Playwright recomendado). Pix QR estático válido + Copia e Cola, mensagem de cobrança compartilhável com fallback; nunca informar “pago” por geração/compartilhamento. Rode ao menos os seis fluxos E2E da seção 13 da SPEC, incluindo A/B, Price, overdue, Pix, regressão de cartões e relatório. RED→GREEN→REFACTOR→AUTORREVISÃO R4.

**P5 / R5 — Revisão final**
8. Rode suites completas, lint/build e E2E; apresente comandos, contagem pass/fail/skip e se alguma ferramenta/browser estiver indisponível. Revise diffs, schemas, restrições, segredo/PII e imports de migração; verifique `git diff --check`. Nada de teste “PASS” sem execução verificável.
9. Documente R1–R5, gere `docs/planning/reviews/SPEC003-EXECUTOR-REPORT.md`, inclua alterações, testes, achados P0/P1/P2, evidências, limitações e próximos gates. Marque no máximo `READY_FOR_INDEPENDENT_REVIEW` se GREEN LOCAL sustentado; caso contrário `BLOCKED` ou `PARTIAL`.
10. **NÃO FAÇA commit, push, merge nem deploy.** Mantenha tudo local para revisão e autorização do proprietário. Não atualize o Obsidian com “GREEN” por conta própria; as notas já apontam esta frente documental, e futuras atualizações devem refletir evidência revisada/aceite.

## Postura técnica

- Lógica financeira fica em serviços do backend Python, nunca como fonte de verdade no React.
- `Decimal` ou centavos inteiros; API monetária string decimal; nada de `float` para dinheiro.
- Financeiro: atualizações atômicas, idempotência, versionamento de cronogramas, eventos reversíveis, total e componentes conciliados.
- Segurança: JWT existente, owner derivado, filtro composto, admin sem bypass em empréstimos, sem dados de pessoa de outro módulo/conta.
- E2E precisa usar a aplicação real e PostgreSQL descartável, não mocks de happy path vendidos como E2E.
- Se inventário revelar incompatibilidades, documente e adapte de forma mínima, sem escopo oportunista.

**Resultado esperado:** feature pronta para revisão independente, com engenharia e testes locais reproduzíveis e preservação do CoBalance tradicional. Nada de proclamar integração com ambiente real sem prova.
