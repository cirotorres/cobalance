# CoBalance — Alinhamento ORM / schema legado Neon (12/11/2026)

**Resultado: GREEN LOCAL / AGUARDANDO `alembic check` NA BRANCH NEON `copy`.** Este ajuste é exclusivamente de **metadados SQLAlchemy + testes**. Não houve alteração no schema ou nos registros da produção e não foi executado `alembic upgrade`, `stamp`, `downgrade`, `revision --autogenerate`, commit, push ou deploy.

## Contexto

- Worktree canônica: `/home/ciro/dev/prog/cobalance`.
- Branch `development`, HEAD rastreado `578bf70`, alterações locais pré-existentes preservadas.
- Nas consultas manuais apresentadas pelo proprietário, o PostgreSQL legado do Neon contém `users`, `participants`, `financial_entries`, identificadores `BIGINT`, índices financeiros `idx_financial_date`, `idx_financial_participant` e `idx_financial_user`, e constraints `fk_participant_user ON DELETE CASCADE`, `fk_financial_user ON DELETE CASCADE` e `fk_financial_participant ON DELETE SET NULL`.
- Na branch `copy`, o proprietário mostrou `alembic current --check-heads` em `spec003_0001`, tabelas SPEC001/SPEC003 presentes e contagens de 4 usuários, 14 participantes e 547 lançamentos. Mas `alembic check` acusava drift legado.
- A última linha acima é evidência fornecida pelo proprietário. **Não foi feita nesta rodada conexão remota direta à Neon `copy` ou `Primary`.**

## Correção realizada, apenas no código

1. `backend/models/user.py`: `users.id` declarado `BigInteger`.
2. `backend/models/participant.py`: `participants.id` e `user_id` como `BigInteger`; FK `fk_participant_user` com `ondelete='CASCADE'`.
3. `backend/models/financial_entries.py`: `id`, `user_id` e `participant_id` como `BigInteger`; índice extra não existente `ix_financial_entries_id` retirado da declaração; índices legados `idx_financial_date`, `idx_financial_participant`, `idx_financial_user` declarados; FKs nomeadas e `ondelete='CASCADE'` / `ondelete='SET NULL'`. O campo `batch_id` da SPEC001 e seu índice permanecem intactos.
4. `backend/tests/test_p1_migration.py`: fixture do banco **descartável** reproduz BIGINT, FKs e índices legados reais (pré-SPEC001), para que `alembic check` teste uma base representativa do Neon.
5. **Novo** `backend/tests/test_legacy_schema_contract.py`: contrato para tipos, índices e FKs legadas, com evidências RED antes do ajuste (13 subfalhas) e GREEN depois (3 testes).

Nenhuma migration existente foi editada. Nenhuma coluna, índice, FK ou registro foi modificado **nos bancos persistentes de desenvolvimento ou Neon**. Os testes PostgreSQL utilizaram somente bancos descartáveis.

## Evidências de validação independente da execução

| Gate | Resultado |
|---|---|
| Metadados do ORM (novo `unittest`) | **3 PASS** |
| Alembic no PostgreSQL local `127.0.0.1:55483/cobalancedb` | `current --check-heads` **PASS** — `spec003_0001` |
| Alembic `check` no PostgreSQL local | **PASS** — `No new upgrade operations detected.` |
| Backend Pytest integrado, PostgreSQL de teste `55439` com tmpfs | **177 PASS / 10 SKIP** (SPEC001 usa runner separado) |
| SPEC001, PostgreSQL 16 descartável `pg_virtualenv` | **16 PASS** |
| Playwright Chromium desktop/Pixel 7 emulado, banco E2E descartável | **20 PASS** |
| `git diff --check` | **PASS** |

Nenhuma suíte foi executada contra o banco Neon ou o banco local real com reset; suites com limpeza de schema utilizaram exclusivamente o PostgreSQL de testes com volume `tmpfs`. Alembic foi usado **somente em modo leitura** no banco local real.

## Passo restante: read-only na branch Neon `copy`

Na **mesma sessão de terminal do proprietário** que possui a variável `COBALANCE_ALEMBIC_DATABASE_URL` apontando para a `copy`:

```bash
cd /home/ciro/dev/prog/cobalance/backend
alembic current --check-heads
alembic check
```

**Confirmar previamente no console do Neon que a URL corresponde à branch `copy`.** Os comandos acima verificam o schema e não aplicam migrations. Resultado esperado: `spec003_0001 (head)` e `No new upgrade operations detected.`. Se houver qualquer diferença, coletar o erro e interromper a preparação de deploy.

## Limites e observações

- O sucesso do `alembic check` local **não substitui** sua repetição na branch `copy` e a análise de pré-release.
- O banco de produção **Primary não foi acessado ou alterado**.
- O controle das migrations SPEC001 e SPEC003 e o schema PostgreSQL já existente não foram modificados.
- O novo contrato de metadados preserva o comportamento SQL das tabelas antigas. Novas tabelas introduzidas por SPEC001/SPEC003 mantêm suas definições `Integer` já migradas, inclusive FKs para usuários legados `BIGINT`; uma harmonização futura dessas FKs exigiria investigação e migration separadas, não parte deste ajuste.
- As decisões financeiras Price/estornos e os demais gates de publicação continuam independentes. **Nenhum commit/push/merge/deploy autorizado ou realizado nesta rodada.**
