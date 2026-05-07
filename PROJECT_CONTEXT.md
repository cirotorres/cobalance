# Organizador Financeiro — Contexto do Projeto

> Documento de contexto para servir de referência sobre o que é, como está estruturado e para onde vai o projeto. Atualizar conforme o sistema evolui.

---

## 1. Visão Geral

**Tipo:** Sistema pessoal de organização financeira.

**Propósito:** Registrar, classificar e acompanhar gastos — incluindo gastos compartilhados entre participantes (ex.: divisão de fatura de cartão de crédito). O usuário cadastra participantes e lança despesas vinculadas a cada um, podendo consultar totais por participante e ter um panorama das suas finanças.

**Estado atual:** Backend funcional em nível MVP com base sólida (auth, CRUDs, importação CSV, integração com LLM). Frontend ainda em fase inicial — apenas scaffold de login. Próximo grande foco: desenvolvimento do frontend com boa UX.

**Princípios:** Simplicidade, evolução gradual, fonte única de dados, utilidade real (não construir features hipotéticas).

---

## 2. Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Backend | FastAPI 0.136 (Python 3.12) + Uvicorn |
| ORM | SQLAlchemy 2.0 |
| Migrations | Alembic |
| Banco | PostgreSQL 15-alpine |
| Auth | JWT (PyJWT) + OAuth2PasswordBearer |
| Hash de senha | pwdlib (Argon2 → Bcrypt) |
| Validação | Pydantic 2 |
| CSV | pandas |
| LLM | Ollama + langchain-ollama |
| Frontend | React 19 (CRA) |
| Web server (front) | Nginx alpine (com proxy `/api/*` → backend) |
| Orquestração | Docker Compose |

---

## 3. Estrutura de Pastas (raiz)

```
Proj_Pessoal/
├── backend/                         # API FastAPI
├── frontend/                        # React (foco atual de desenvolvimento)
├── frontend2/                       # IGNORAR — apenas testes
├── docker-compose.yml
├── Makefile                         # atalhos para docker / migrations
├── DOCKER.md
├── README.md
├── guia_organizador_financeiro.md   # documento de visão / roadmap
└── .env                             # API_KEY, POSTGRES_*, SECRET_KEY, LLM_*
```

---

## 4. Backend

### 4.1 Estrutura

```
backend/
├── main.py                  # entrypoint FastAPI + CORS
├── Dockerfile               # python:3.12-slim, uvicorn --reload
├── requirements.txt
├── alembic/                 # migrations (3 versões aplicadas)
├── core/
│   ├── config.py            # carrega .env
│   └── security.py          # JWT, hash, get_current_user
├── db/database.py           # SQLAlchemy session factory
├── models/                  # User, Participant, FinancialEntry
├── schemas/                 # Pydantic (request/response)
├── routes/                  # auth, users, participants, financial_entries, agente
├── services/
│   ├── llm_service.py       # cliente Ollama
│   └── import_csv_nu.py     # importação de CSV do Nubank
└── helpers/
    ├── create_entries_llm.py
    ├── find_participant.py  # fuzzy match por nome
    └── apply_filters.py
```

### 4.2 Modelos (PostgreSQL)

**User**
- `id`, `email` (unique), `name`, `password_hash`, `is_admin`, `age?`
- Relacionamentos: 1→N participants (cascade delete), 1→N financial_entries

**Participant**
- `id`, `user_id` (FK User), `name`
- Relacionamentos: pertence a um user; 1→N financial_entries

**FinancialEntry**
- `id`, `user_id` (FK), `participant_id` (FK, nullable), `amount` (Numeric 10,2)
- `transaction_date`, `description`, `source` (`web` | `CSV` | `IA`)
- `is_reviewed` (bool), `installment_number`, `installment_total`
- `created_at`, `updated_at`

### 4.3 Endpoints

**`/auth`**
- `POST /auth/login` — OAuth2 password flow → JWT
- `GET /auth/me` — perfil do usuário autenticado

**`/users`**
- `POST /` — criar usuário
- `GET /` — listar (admin)
- `GET /{id}`, `DELETE /{id}` (admin)

**`/participants`**
- `POST /`, `GET /` (admin), `GET /self`, `GET /{id}`, `DELETE /{id}`

**`/financial`**
- `POST /` — lançamento manual
- `GET /` — listar (admin)
- `GET /soma` — total do usuário
- `GET /summary/{participant_id}` — total por participante
- `GET /financial-filters` — filtros por participante / reviewed / source / mês / dia
- `POST /import-csv` — upload de CSV do Nubank
- `GET /{id}`, `PATCH /{id}`, `DELETE /{id}`

**`/agente`** (LLM)
- `POST /` — recebe texto em linguagem natural, interpreta intent via Ollama:
  - `create_financial_entries` — cria lançamentos a partir de mensagem
  - `get_participant_total` — consulta saldo de participante
  - `unknown` — não suportado

### 4.4 Autenticação
- JWT HS256, expiração configurável via `ACCESS_TOKEN_EXPIRE_MINUTES`
- Token contém email + user_id
- Dependency `get_current_user` resolve o usuário em rotas protegidas
- `is_admin` para RBAC simples

### 4.5 Integração LLM (Ollama)
- Configurado por `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`
- `services/llm_service.py` envia system prompt + texto do usuário e espera JSON puro
- `helpers/create_entries_llm.py` materializa as entries, resolvendo participantes por fuzzy match

### 4.6 Importação CSV (Nubank)
- Lê CSV, extrai parcelas via regex `(\d+)/(\d+)`
- Ignora valores negativos (estornos)
- Persiste com `source="CSV"`

### 4.7 Migrations
1. `91bb65954eb0` — schema inicial (vazio)
2. `3b6def9f7fa7` — cria tabelas (users, participantes, transactions)
3. `d2d23f9df851` — renomeia para `participants` e `financial_entries`

---

## 5. Frontend (estado atual)

**Estado:** Esqueleto inicial. Apenas página de login com inputs de email/senha (ainda sem chamada à API).

```
frontend/
├── package.json             # React 19 + react-scripts (CRA)
├── Dockerfile               # multistage: node 20-alpine → nginx alpine
├── nginx.conf               # SPA fallback + proxy /api/* → backend:8000
└── src/
    ├── index.js
    ├── App.js
    └── pages/login.js
```

**Ainda não há:** routing, gerenciador de estado, biblioteca de UI, integração com API, design system. Tudo isso será definido conforme o frontend for desenvolvido — foco em UX prática.

---

## 6. Docker / Orquestração

`docker-compose.yml` define:

- **backend** — build `./backend`, porta `8000:8000`, volume `./backend:/app` (hot reload), depende do postgres
- **postgres** — `postgres:15-alpine`, porta `5433:5432`, volume nomeado `postgres_data`
- **frontend** — *atualmente comentado* (será habilitado quando o front estiver pronto): build `./frontend`, porta `3000:3000`, depende do backend, env `REACT_APP_API_URL=http://localhost:8000`

Todos os serviços usam `.env` na raiz. Comunicação interna por nome de serviço (ex.: `http://backend:8000`).

**Makefile** disponibiliza: `build`, `up`, `down`, `logs`, `logs-frontend`, `shell-backend`, `shell-db`, `migrate`.

---

## 7. Roadmap / Intenções Futuras

**Próximo passo imediato:** desenvolver o frontend (login → dashboard → cadastro de participantes → lançamentos → importação CSV → totais).

**Médio prazo:**
- Fluxo no **n8n** integrando o `/agente` ao **WhatsApp** e/ou **Telegram**, permitindo lançamentos por mensagem ("gastei 50 no mercado, divide com Maria").
- Reconciliação CSV vs lançamentos manuais.
- Classificação de despesas (categorias).
- Dashboard com visualizações.

**Longo prazo:** plataforma pessoal de organização financeira com múltiplas integrações (email, IA conversacional, automações).

---

## 8. Observações para Desenvolvimento

- CORS está aberto (`*`) — restringir antes de produção.
- Dockerfile do backend usa `--reload` (apropriado para dev, ajustar se for para prod).
- `services/book_api.py` e `services/external_api.py` são código legado/abandonado, podem ser removidos.
- Source de dados de uma `FinancialEntry` (`web` / `CSV` / `IA`) é importante para rastreabilidade — manter ao adicionar novos canais (ex.: WhatsApp via n8n provavelmente entrará como `IA` ou nova source).
