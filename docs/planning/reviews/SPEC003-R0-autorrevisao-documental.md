# SPEC003 — R0 | Autorrevisão documental e análise pré-execução

**Data:** 2026-11-09
**Autor:** coordenador/redator da SPEC003. **NÃO é revisão independente.**
**Escopo verificado:** confronto de decisões da conversa com SPEC003, plano one-shot e inventário de código no checkout original; criação da worktree isolada.
**Estado:** `DOCUMENTED / CONDITIONAL FOR LOCAL ONE-SHOT / NOT READY FOR DEPLOY`.
**Evidência:** branch `feat/spec003-modulo-emprestimos` criada da baseline rastreada `578bf70`; checkouts separados. Nenhum teste de implementação SPEC003 executado.

## Cobertura das decisões de produto

- [x] Contas distintas de usuários; ambos os ambientes habilitáveis por usuário.
- [x] Pessoas de Cartões e Empréstimos distintas, sem vínculo automático, mesmo se nome idêntico.
- [x] Registro próprio por tomador e múltiplos empréstimos.
- [x] Modalidade A (5% do principal **em cada parcela**) e Price; duas fixtures reais **apenas como valores de referência** sem dados pessoais sensíveis.
- [x] Mensal padrão, 15 dias, X dias e datas manuais.
- [x] Parcela integral como regra; parcial somente exceção e distribuição proporcional no Modelo A.
- [x] Antecipação: recálculo do saldo Price ou quitação do valor programado.
- [x] Detecção de atraso sem acréscimo automático, ajuste manual com histórico.
- [x] Um recebimento consolidado quita parcelas selecionadas do mesmo tomador/owner atomicamente.
- [x] Várias contas Pix, uma padrão, QR estático/compartilhamento manual, nunca confirmar recebimento automaticamente.
- [x] Indicadores de capital, juros, cashflow previsto e realizado por mês.
- [x] Push/CDI/Atalhos/integração bancária fora de escopo.
- [x] TDD, E2E browser real, autorrevisões R1–R5, limites sobre produção e checkout original.

## Checagens técnicas do repositório original

- `backend/main.py` tem apenas routers antigos; manter contratos.
- `backend/models/participant.py` e `financial_entries.py` justificam novo domínio `loans`.
- `backend/routes/participants.py` tem bypass admin em certas rotas; não transportar para Empréstimos.
- `frontend/src/routes/index.jsx` e `Home.jsx` justificam nova rota sem substituir `/home`.
- `frontend/package.json` não contém harness de testes; exigir criação e execução reais.
- `backend/core/security.py` emite access/refresh sem marca de tipo validada (dívida técnica preexistente).
- `git ls-files docs` retornou vazio: SPEC001/002 e R7/R6 no checkout original são **arquivos não rastreados**, indisponíveis na nova worktree. SPEC003 deve funcionar independente e não referenciar links internos inválidos.

## Achados e riscos — classificação

**R0-F1 (P1 herdado, gate de publicação):** access e refresh JWT não são distinguidos por tipo no backend atual. Não foi introduzido pela SPEC003, mas deve ser tratado antes de uso financeiro em produção. Não ampliar o escopo do executor para reescrever auth/SPEC002 às cegas. Atestar e comunicar bloqueio de publicação.

**R0-F2 (P1 ambiente):** estado/migração do banco existente não foi validado, e scripts Alembic ativos não estão na baseline Git; executar migrações **somente em PG descartável**. Publicação/banco existente bloqueados até revisão do schema real e decisão separada.

**R0-F3 (P2 hipótese de cálculo):** Price de períodos não mensais e datas irregulares terá convenção proposta `(1+i_m)^(dias/30)-1` e resolução por desconto. Precisa fixtures independentes e aceite explícito antes de publicação; para one-shot local, implementação pode seguir a convenção documental e marcar no relatório como premissa proposta.

**R0-F4 (P2 Pix):** QR estático exige dados de recebedor, cidade e CRC conforme formato real; a SPEC incluiu cidade e obriga teste com fixture independente. Bloquear cobrança na interface se chave ou dados estiverem inválidos; sem fallback para QR inventado.

**R0-F5 (P2 complexidade):** M1–M5 têm escopo grande para uma única execução; o plano exige checkpoints, RED→GREEN, abortar em falha financeira e entrega parcial honesta. Não existe autorização para dispensa de testes em nome de one-shot.

**R0-F6 (P2 retrocompatibilidade):** habilitar/desabilitar módulo e preferência não pode apagar dados do Cartões nem quebrar `/home` ou APIs legadas. Implementação do gate do módulo novo deve respeitar fallback para usuários antigos.

## Ajustes já incorporados na SPEC

1. Dados da cidade do recebedor na conta Pix e no QR, com validação de formato.
2. Tratamento de chave Pix possivelmente CPF/CNPJ como dado pessoal, sem proibir desnecessariamente chaves válidas.
3. Registro explícito do problema de JWT como risco herdado e gate de produção, sem apropriar correção da SPEC002.
4. Preservação do baseline rastreado sem importar work-in-progress da SPEC001/002.

## Parecer

**R0 DOCUMENTED / ONE-SHOT LOCAL CONDICIONAL.** A documentação está apta para uma implementação local controlada com os gates descritos. **Não existe revisão independente, código SPEC003 implementado, teste E2E executado nem validação de publicação.** A classificação final depende integralmente dos relatórios R1–R5 do executor e de revisão posterior independente.
