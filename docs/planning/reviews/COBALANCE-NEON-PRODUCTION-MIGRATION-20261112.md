# CoBalance — Atualização Alembic no Neon Primary — 12/11/2026

**PARECER: PRODUCTION DATABASE MIGRATED / VALIDATED — APLICAÇÃO AINDA NÃO PUBLICADA.**

## Escopo autorizado e isolamento

- Solicitação expressa do proprietário: aplicar o upgrade Alembic em produção usando `PROD_DATABASE_URL` inserida no `.env`.
- Banco: **Neon Primary**, `neondb`, endpoint direto `ep-green-recipe-ak0lusoe.c-3.us-west-2.aws.neon.tech`; distinto do endpoint usado no ensaio na branch Neon `copy`.
- Trabalho executado no repositório `/home/ciro/dev/prog/cobalance`, branch `development` HEAD `578bf70`.
- Conexão para Alembic passada **apenas ao subprocesso de migração** via `COBALANCE_ALEMBIC_DATABASE_URL`, carregada de `PROD_DATABASE_URL` do `.env`, sem expor credenciais ou gravá-las no relatório.
- Nenhum comando `stamp`, `downgrade`, `revision --autogenerate`, git commit, push, merge ou deploy foi executado.
- Não alteramos a branch Neon `copy` nem o banco local `cobalancedb` nesta atualização de produção.

## Pré-check somente leitura

- Produção PostgreSQL 17.11; conexão direta Neon (não pooler).
- Estrutura inicial: apenas `users`, `participants`, `financial_entries`; tabela `alembic_version` ausente; novas tabelas SPEC001/SPEC003 ausentes.
- 4 usuários, 14 participantes e 547 lançamentos; índices legados e 3 FKs legadas confirmados.
- Identidade do endpoint de produção confirmada por hostname fixo distinto de `copy`; contagens e hashes de conteúdo das 3 tabelas legadas conferidos antes de executar.

## Backup recuperável anterior à migração

- Caminho (arquivo **sensível**, não versionar nem compartilhar):
  `/home/ciro/dev/prog/.cobalance-prod-pre-migration-20261112/neondb-primary-before-spec001-spec003.dump`
- Dump PostgreSQL 17.11, formato custom `pg_dump -Fc`, tamanho 44.072 bytes.
- SHA-256: `4bef5575d70138191c1d3e1e89763fc243ad53d84142219278ac533e8838ae8c`.
- Conteúdo auditado via `pg_restore --list`; inclui dados das três tabelas legadas.
- **Ensaio de recuperação real:** restaurado integralmente em PostgreSQL 17 descartável sem rede, sem volume persistente, com `pg_restore --no-owner --no-privileges --exit-on-error`. Comparados contagens e hashes dos registros:
  - `users`: 4, digest `6958dc41e278...`
  - `participants`: 14, digest `58639aaba179...`
  - `financial_entries`: 547, digest `f62b56ca1877...`
- Contêiner de recuperação descartável removido após o teste. O backup permanece guardado para contingência.

## Upgrade autorizado e efetivamente executado

Em ordem, Alembic transacional PostgreSQL:

1. `upgrade -> 20261101_spec001` — estrutura de lotes e idempotência SPEC001.
2. `upgrade 20261101_spec001 -> spec003_0001` — tabelas isoladas de Empréstimos SPEC003.

**Resultado: exit code 0.** Nenhum rollback destrutivo foi necessário.

## Pós-check no Neon Primary (somente leitura)

- `alembic_version` contém apenas **`spec003_0001`**.
- Total de **18 tabelas públicas**; 14 tabelas novas da SPEC001/SPEC003 verificadas, além das 3 legadas e `alembic_version`.
- As 3 tabelas antigas preservaram contagem e hashes de conteúdo anteriores ao upgrade:
  - `users=4`, hash igual;
  - `participants=14`, hash igual;
  - `financial_entries=547`, hash igual para as 12 colunas originais; nova coluna `batch_id` permanece `NULL` nos lançamentos antigos.
- Identificadores antigos permanecem `BIGINT`; índices `idx_financial_date`, `idx_financial_participant`, `idx_financial_user` preservados; 3 FKs com regras `ON DELETE` preservadas.
- **`alembic current --check-heads` PASS** — `spec003_0001 (head)`.
- **`alembic check` PASS** — `No new upgrade operations detected.`, com modelos ORM legados corrigidos localmente em `development`.

## Próximo gate — publicação do código (AINDA NÃO EXECUTADA)

- A base de produção está pronta estruturalmente para a SPEC001/SPEC003. O código publicado ainda pode ser o anterior.
- O código OAK, JWT R8 (Access 24h/Refresh 30d) e alinhamento ORM permanecem **sem commit/push** na `development`; não presumir que `main` já contém essas alterações.
- Fazer revisão de diferenças Git e do fluxo Vercel/backend; garantir que configurações de produção `ACCESS_TOKEN_EXPIRE_MINUTES=1440` e `REFRESH_TOKEN_EXPIRE_DAYS=30` estejam corretas; planejar reautenticação de sessões antigas pelo tipo JWT.
- Verificar os gates de publicação separadamente (incluindo regras financeiras Price/estornos e dívida do ESLint global), obter autorização específica antes de commit/push/merge/deploy.
- Nunca executar um novo `alembic upgrade` ou `stamp` no Neon sem verificar o estado de `alembic_version` e as alterações de migration.
