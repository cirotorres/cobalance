# Cobalance — SPEC001 | Registro de compra parcelada por requisição única

**Data:** 2026-11-01
**Estado:** contrato técnico saneado após revisão independente R3; implementação local autorizada, validação pendente
**Escopo:** backend FastAPI, persistência PostgreSQL e contrato HTTP
**Revisões:** [R2 — documental](../reviews/SPEC001-R2-revisao-documental.md) · [R3 — independente](../reviews/SPEC001-R3-revisao-independente.md)

## 1. Problema e objetivo

Hoje `POST /financial/` recebe um lançamento. O formulário em `frontend/src/pages/Home/LancamentosTab/LancamentosTab.jsx` chama esse endpoint **N vezes** para N parcelas; cada chamada recebe atualmente o mesmo `amount` integral informado pelo usuário, o que pode supercontabilizar a compra. O `POST /agente/` recebe uma requisição com linguagem natural, mas a IA entrega N lançamentos já discriminados; `backend/helpers/create_entries_llm.py` os inclui em um único `db.commit()`. Portanto **o agente não faz N HTTP POSTs**, mas tampouco oferece um contrato determinístico de compra total com N parcelas.

**Objetivo:** permitir ao cliente enviar **uma compra de valor integral + quantidade de parcelas** em **um POST autenticado**. O backend calcula e grava exatamente N lançamentos coerentes, no mesmo commit e com proteção a tentativas repetidas. Funciona inicialmente sem iOS; depois poderá ser consumido pelo Atalhos, sem exigir abertura da PWA.

## 2. Fontes do estado atual (conferidas em 2026-11-01)

| Arquivo | Fato relevante |
| --- | --- |
| `backend/main.py` | Roteador financeiro em `/financial`; autenticação existente via dependência. |
| `backend/routes/financial_entries.py` | `POST /` cria um único registro, com validação de pertencimento do participante. |
| `backend/schemas/financial_entries.py` | `amount: Decimal`, parcelas 1/1 como padrão no modelo legado; sem schema para compra total. |
| `backend/models/financial_entries.py` | `Numeric(10,2)`, `transaction_date`, `source`, números da parcela, `user_id` e `participant_id`. |
| `backend/routes/agente.py`, `backend/helpers/create_entries_llm.py`, `backend/services/llm_service.py` | IA distribui lançamentos e helper persiste vários com um commit; valor e datas dependem da saída da IA. |
| `frontend/src/pages/Home/LancamentosTab/LancamentosTab.jsx` | Laço de N POSTs e envio repetido do valor integral. |
| `backend/routes/participants.py` | `GET /participants/self` retorna participantes apenas do usuário. |
| `backend/alembic/env.py`, `backend/alembic/versions/` | Alembic configurado, mas `versions/` sem versões ativas no checkout; verificar baseline real antes de qualquer migração. |

`README.md` e `PROJECT_CONTEXT.md` contêm caminhos/descrições históricos, especialmente `frontend2`; **a árvore atual tem `frontend/` (React/Vite)**. Em divergências, conferir o código vigente.

## 3. Limites desta SPEC

### Incluído na implementação futura

1. Um endpoint dedicado `POST /financial/installments`, mantendo `POST /financial/` intacto.
2. Request Pydantic estrita; regras determinísticas de dinheiro, parcelas e datas.
3. Identidade do usuário resolvida pelo token; validação de `participant_id` vinculado a esse usuário.
4. Uma transação SQL para cabeçalho de operação, N linhas financeiras e resposta recuperável.
5. Idempotência durável por usuário e chave, inclusive sob requisições concorrentes.
6. Migração de persistência mínima, testes focados e regressão de endpoints existentes.
7. Corrigir o vazamento diretamente relacionado à leitura da operação: `GET /financial/{financial_id}` hoje não valida JWT nem proprietário. Exigir autenticação e `FinancialEntry.user_id == current_user.id`, inclusive para admin nesta rota de uso pessoal; registro alheio deve retornar `404`.

### Excluído

- Criar automação Apple Atalhos, coletar notificações, pedir seleção no iPhone ou distribuir um atalho instalável.
- Alterar o formulário web, o importador CSV ou o agente IA nesta fase; uma integração posterior deverá eliminar o laço de N POSTs do frontend.
- Consultar saldo/cobrança do Nubank, inferir vencimento ou ciclo da fatura, realizar conciliação automática do CSV, criar autenticação sem usuário ou ativar deploy.
- Corrigir outros problemas de CRUD/retention/importação sem ligação direta com a nova operação.

## 4. Contrato HTTP proposto

`POST /financial/installments` com `Authorization: Bearer <token>` e `Idempotency-Key: <uuid-v4>` (obrigatória, nova UUID por compra lógica; reutilizar a **mesma chave** em tentativas de reenviar **essa mesma compra**).

Corpo JSON (o cliente envia valor **total da compra**, jamais valor unitário da parcela):

```json
{
  "participant_id": 2,
  "amount": "300.01",
  "transaction_date": "2026-11-01",
  "description": "COMPRA EM LOJA EXEMPLO",
  "source": "credito",
  "installment_total": 3
}
```

Campos e regras:

| Campo | Contrato |
| --- | --- |
| `participant_id` | Inteiro obrigatório e positivo; participante deve existir e pertencer ao usuário autenticado. Ausente/ inválido: `422`; inexistente ou alheio: `404` sem revelar o dono. |
| `amount` | Montante integral **positivo**, transmitido **exclusivamente como string JSON decimal** (`"300.01"`). Não aceitar número JSON (evita parse via float), expoente, separador de milhares ou vírgula; permitir `"300"`, `"300.0"`, `"300.00"` como intenção equivalente após normalização em centavos. Máximo 2 casas, sem arredondamento silencioso; respeitar `Numeric(10,2)`. |
| `transaction_date` | Data civil ISO `YYYY-MM-DD`, usada como **data contábil da primeira parcela**. As demais terão datas contábeis nos meses subsequentes; o sistema agrupa por `transaction_date`, portanto uma compra parcelada aparecerá distribuída entre meses futuros nos balanços. **Decisão de contrato D-01**, preservando o comportamento de distribuição mensal já adotado na UI, sem alegar correspondência com ciclo/vencimento real do cartão. |
| `description` | Texto obrigatório após trim, 1–255 caracteres; não inferir estabelecimento a partir de banco. |
| `source` | `credito`, `debito` ou `pix`; para `installment_total > 1`, exigir `credito`. Não aceitar `extrato` nesta criação manual. |
| `installment_total` | Inteiro entre 1 e 36; padrão `1`. Não aceitar booleano, fração ou string textual. |
| `installment_number`, `user_id`, `is_reviewed` | Não aceitos no request: números derivados de 1 a N, `user_id` do JWT, `is_reviewed=false` no servidor. Campos extras rejeitados. |

Limites: valor total em centavos deve ser **ao menos N**, para não gerar parcelas `0.00`; cada parcela e o total devem caber em `Numeric(10,2)` (máximo `99.999.999,99`). Rejeitar `NaN`, infinito, valor zero/negativo e excesso de precisão, sem arredondar silenciosamente a compra original.

**Normalização:** converter string diretamente com `Decimal`, validar formato e escala e converter a inteiro de centavos; serializar a intenção canônica com `amount_cents` inteiro, `user_id`, `participant_id`, `transaction_date` ISO, `description` já aparada, `source` e `installment_total` inteiros, em ordem de chaves estável UTF-8 antes do SHA-256. Normalizações equivalentes do valor (`"300.0"`/`"300.00"`) e espaços externos da descrição produzem o mesmo hash. Não utilizar `float` em nenhuma etapa. `bool`, `null`, arrays ou objetos no lugar de valores esperados retornam `422`.

Resposta de criação: `201 Created`. Resposta de repetição da mesma chave e mesmo payload: `200 OK`, **mesmo corpo/snapshot de criação**, sem novos lançamentos:

```json
{
  "batch_id": 41,
  "total_amount": "300.01",
  "installment_total": 3,
  "entries": [
    {"id": 101, "user_id": 9, "participant_id": 2, "amount": "100.01", "transaction_date": "2026-11-01", "description": "COMPRA EM LOJA EXEMPLO", "source": "credito", "is_reviewed": false, "installment_number": 1, "installment_total": 3, "created_at": "2026-11-01T13:00:00", "updated_at": "2026-11-01T13:00:00"},
    {"id": 102, "user_id": 9, "participant_id": 2, "amount": "100.00", "transaction_date": "2026-12-01", "description": "COMPRA EM LOJA EXEMPLO", "source": "credito", "is_reviewed": false, "installment_number": 2, "installment_total": 3, "created_at": "2026-11-01T13:00:00", "updated_at": "2026-11-01T13:00:00"},
    {"id": 103, "user_id": 9, "participant_id": 2, "amount": "100.00", "transaction_date": "2027-01-01", "description": "COMPRA EM LOJA EXEMPLO", "source": "credito", "is_reviewed": false, "installment_number": 3, "installment_total": 3, "created_at": "2026-11-01T13:00:00", "updated_at": "2026-11-01T13:00:00"}
  ]
}
```

IDs e horários acima são **ilustrativos**, não dados reais. Manter formato de cada item compatível com `FinancialEntryResponse`; `batch_id`, `total_amount` e `entries` compõem a nova resposta agregada. Arrays ordenados por `installment_number`. Opcionalmente `Location` da operação apenas se houver GET correspondente; não prometer link inexistente.

Erros: `401` sem autenticação; `404` participante fora do escopo; `422` contrato/validação; `409` mesma chave com corpo lógico diferente; `500` ou resposta de erro de banco em falha transacional, com rollback. Nunca transformar erro de banco em sucesso parcial.

## 5. Regras determinísticas

### Dinheiro e arredondamento

1. Converter o total para `Decimal`, validar escala de centavos e converter a `total_cents: int` de maneira exata.
2. Calcular `base, remainder = divmod(total_cents, installment_total)`.
3. Para cada parcela `i` de 1 a N, atribuir `base + 1` centavo se `i <= remainder`, senão `base`. A soma resulta exatamente no valor original; remanescentes ficam **nas primeiras parcelas**.
4. Ex.: R$ 300,01 / 3 → R$ 100,01; R$ 100,00; R$ 100,00. Ex.: R$ 0,04 / 3 → R$ 0,02; R$ 0,01; R$ 0,01.

### Calendário

Para `i = 0..N-1`, calcular a data por deslocamento de `i` meses **sempre a partir da data original**. Dia alvo = `min(dia_original, último_dia_do_mês_alvo)`. Não usar sucessivos `+30 dias` nem acumular um dia reduzido em fevereiro.

Ex.: data-base 31/01/2027 → 31/01, 28/02, 31/03; 31/01/2028 → 31/01, 29/02, 31/03. Para uma única parcela, usar a data recebida, sem deslocamento. Datas fora do intervalo suportado são `422`. Não há inferência de ciclo/vencimento da fatura, fechamento de cartão ou data do push.

### Representação no produto

Persistir `description` simples e `installment_number/total` separados, para que componentes já existentes renderizem `Parcela 1 de 3` sem depender de sufixo textual. Evitar duplicar o número da parcela na descrição; não alterar edições isoladas atuais nem presumir que a mudança de participante após criação propague para outras parcelas.

## 6. Persistência, atomicidade e idempotência

**Estrutura proposta (sujeita à validação da baseline Alembic):**

- Criar `financial_entry_batches`: `id`, `user_id` (FK), `idempotency_key` (UUID/string canonical), `request_hash` (SHA-256 do payload normalizado, **incluindo o usuário no escopo da chave**, sem segredo), `response_snapshot` (JSONB), `created_at`; `UNIQUE (user_id, idempotency_key)`.
- Adicionar `financial_entries.batch_id` anulável (FK) para agrupar apenas registros novos; entradas antigas continuam válidas com `NULL`.
- Inserir batch, N `FinancialEntry` e `response_snapshot` na **mesma transação SQL**, com flush para obter IDs e valores materializados; **commit único** ao final. Responder após commit confirmado. Nenhuma chamada externa ou LLM dentro da transação.
- `GET /participants/self` continua a fonte para seleção de participantes no futuro cliente; a API autentica e revalida a associação no POST. `user_id` nunca vem do payload.

**Protocolo de idempotência:**

1. Chave obrigatória e validada no header. Gerar UUID-v4 por compra lógica, reutilizar durante retries por timeout/perda de conexão. **Criar UUID diferente em cada retry quebraria a proteção.**
2. Normalizar dados para comparar intenção: usuário, participante, centavos, data, descrição já normalizada, source e número de parcelas; gerar hash determinístico, sem depender da ordem JSON nem do formato textual `300.0`/`300.00`.
3. Sob chamadas concorrentes com mesma chave e mesmo usuário, o `UNIQUE` do banco arbitra; exatamente uma transação poderá gravar a operação. Após `IntegrityError`, **sempre chamar `db.rollback()`** antes de qualquer reconsulta na sessão SQLAlchemy; reabrir transação/consulta após rollback: mesmo hash → snapshot `200`; hash diferente → `409`. Não capturar indiscriminadamente outras falhas de integridade como colisão idempotente.
4. Nunca confiar em `SELECT` prévio como única proteção; ele não impede corrida. Uma falha **antes** de commit deixa zero entries e nenhuma chave reservada. Se o servidor cai **depois** de commit e antes da resposta, o retry com mesma chave retorna snapshot sem duplicação.
5. Gerar `response_snapshot` usando serialização JSON Pydantic (`model_dump(mode="json")`) para converter `Decimal`, `date` e `datetime` de modo serializável no JSONB; no retry devolver os **mesmos campos e valores** do snapshot.
6. O snapshot é do momento de criação; se uma parcela for editada depois na aplicação, a resposta de retry continua sendo o snapshot original. Para estado atual, usar apenas GET autenticado com escopo de proprietário (`GET /financial/financial-entries` e `GET /financial/{id}` após correção da falha descrita).

**Limite conhecido:** notificações bancárias não trazem, nesta integração, ID de transação garantidamente estável. A idempotência cobre reenvios com a mesma chave, **não** duas automações que gerem chaves distintas para a mesma compra. Não deduplicar por heurística de valor/data/estabelecimento, pois existem compras iguais legítimas. Planejar eventual conciliação com CSV em SPEC distinta.

## 7. Plano de implementação do backend (a executar em etapa própria)

1. **Preparação:** confirmar banco/migrations efetivamente utilizados; inspecionar versão alembic instalada e script de inicialização sem expor credenciais. Resolver baseline de `alembic/versions/` vazio antes de migration; não rodar `create_all` ou upgrade em produção por suposição. Estratégia local documentada em [plano de implementação](../plans/SPEC001-backend-implementation-plan.md): revisão manual reversível + baseline verificada num PostgreSQL descartável; **qualquer aplicação num banco existente continua bloqueada** até confirmação de schema e `alembic_version` daquele ambiente.
2. **Contrato:** criar schemas separados para `InstallmentPurchaseCreate` e `InstallmentPurchaseResponse`, validação Pydantic 2 (`extra=forbid` e validação de dinheiro); endpoint em `backend/routes/financial_entries.py` antes de rota dinâmica `/{id}`, protegido por JWT.
3. **Domínio:** serviço Python puro para distribuir centavos e calcular meses a partir da data-base; isolado da sessão/HTTP para testes unitários.
4. **Storage:** modelo batch, FK opcional, migração versionada conforme baseline comprovada; controle de concorrência pelo índice único de idempotência.
5. **Transação:** service de aplicação cria batch + entries + snapshot, trata erros concorrentes com rollback e reconsulta; um commit; nenhum commit dentro dos helpers intermediários.
6. **Verificação:** testes unitários de arredondamento/calendário e testes de integração com PostgreSQL para auth, 404 (incluindo regressão de acesso indevido do GET), criação/rollback, retry e corrida com duas sessões reais. Revalidar rotas legadas `/financial/`, `/agente/`, importação CSV e leitura pelo frontend.
7. **Handoff:** evidências, risco de migração, status do Git e limite de autorização; não integrar frontend/iOS nem executar deploy como consequência.

## 8. Critérios de aceite

- `300.01`/3 salva três linhas de `100.01, 100.00, 100.00`; soma exata de 30001 centavos; `1/1` não duplica.
- Data-base no fim do mês preserva o dia original quando possível; ano bissexto correto.
- Um usuário não consegue lançar para participante de outro usuário, inclusive admin usando rota de usuário comum.
- `GET /financial/{id}` exige token e filtra sempre por proprietário; acesso a outra conta responde `404` (também com usuário admin).
- Erro na N-ésima gravação ou no snapshot causa rollback integral; nenhuma linha parcial observável.
- Retry pós-commit com mesma chave não cria novas linhas e devolve mesmos IDs; chave reutilizada com payload diferente retorna `409`.
- Duas requisições concorrentes com mesma chave criam somente um batch e N lançamentos, sem `500` espúrio por colisão normal.
- Input inválido (montante zero/negativo, >2 casas, valor insuficiente para N, overflow, source parcelada incompatível, N fora dos limites, participante inválido, payload extra) não persiste nada.
- Números JSON para `amount` são rejeitados (`422`); strings equivalentes monetárias produzem o mesmo hash idempotente. `response_snapshot` serializa Decimal e datas sem erro JSONB.
- Legacy `POST /financial/` e `POST /agente/` seguem respondendo sem regressão; nenhuma nova alteração exigida para consumir seus contratos anteriores.
- Provas com banco de teste isolado e migração reversível ou rollback documentado; nenhuma inferência de integridade apenas por mocks.

## 9. Decisões e dependências antes da execução

**Convenções assumidas para esta implementação local**, diante da autorização para executar a SPEC001: máximo 36 parcelas; permitir `credito` parcelado, `credito|debito|pix` à vista; data informada é data contábil da primeira parcela e meses seguintes entram nos saldos dos respectivos meses (D-01); centavos excedentes nas primeiras parcelas; chave UUID-v4 obrigatória. Estas são decisões novas deste contrato e precisam de validação de comportamento pelo usuário antes de futura implantação pública.

**Bloqueador técnico verificável:** `backend/alembic/versions/` está vazio neste checkout e há scripts em `backend/alembic_backup/`. Deve-se confirmar a estratégia de migrations e o estado real do banco antes de escolher DDL/migration. Não autoriza recriar schema ou apagar dados.

**Dependência de produto futura:** o formulário web hoje duplica o valor integral para cada parcela, e a nova operação **não corrige automaticamente** esse caminho. Planejar integração frontend como tarefa separada antes de declarar resolvido o fluxo do usuário. Futuro iOS terá de gerar/reutilizar Idempotency-Key e obter token autorizado por fluxo seguro; nada disso é implementado nesta SPEC.

## 10. Situação deste documento

Esta SPEC foi refinada a partir dos riscos levantados na [revisão independente R3](../reviews/SPEC001-R3-revisao-independente.md). Seu backend recebeu **GREEN LOCAL na [R7 independente](../reviews/SPEC001-R7-rerevisao-independente-green-local.md)** após correções R6 e 16/16 testes em PostgreSQL descartável. Isso ainda não equivale a migração aplicada em banco existente, aceite financeiro do usuário, integração do frontend/iOS ou autorização de produção.
