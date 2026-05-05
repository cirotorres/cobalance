# Projeto de Estudo - Setup com Docker

## 🐳 Usando Docker (Recomendado)

O Docker garante que o ambiente funcione igual em Linux, WSL e qualquer outra plataforma.

### Pré-requisitos
- Docker Desktop instalado
- Docker Compose instalado

### Como rodar

#### 1. Construir e iniciar containers
```bash
make build
make up
```

Ou manualmente:
```bash
docker-compose build
docker-compose up -d
```

#### 2. Rodar migrações
```bash
make migrate
```

Ou:
```bash
docker-compose exec backend alembic upgrade head
```

#### 3. Acessar logs
```bash
make logs
```

#### 4. Parar containers
```bash
make down
```

### Comandos úteis

```bash
# Reiniciar tudo
make fresh

# Acessar shell do backend
make shell-backend

# Acessar banco de dados
make shell-db

# Ver help de todos os comandos
make help
```

---

## 🖥️ Setup Local (sem Docker)

Se preferir rodar localmente, siga estes passos:

### 1. Criar ambiente virtual
```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate  # Linux/WSL
# ou
.venv\Scripts\activate  # Windows PowerShell
```

### 2. Instalar dependências
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Configurar banco de dados
- Certifique-se de que PostgreSQL está rodando
- Atualize `.env` com suas credenciais

### 4. Rodar migrações
```bash
alembic upgrade head
```

### 5. Iniciar servidor
```bash
uvicorn main:app --reload
```

Acesse: `http://localhost:8000/docs`

---

## ⚠️ Soluções para problemas de compatibilidade

### Erro: `ModuleNotFoundError: No module named 'jwt'`
- **Causa**: `PyJWT` não estava no `requirements.txt`
- **Solução**: Use Docker ou reinstale com `pip install -r backend/requirements.txt`

### Diferenças entre Linux e WSL
- Docker elimina essas diferenças
- Recomenda-se usar Docker para desenvolvimento contínuo

---

## 📝 Variáveis de ambiente (`.env`)

```env
# API
API_KEY=1071952-LocalPro-AEE9854F
API_BASE_URL=https://tastedive.com/api/similar

# Banco de Dados
POSTGRES_USER=postgres
POSTGRES_PASSWORD=123456
POSTGRES_DB=bancomovie
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Token
SECRET_KEY=troque-essa-chave-por-uma-chave-forte
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

---

## 🚀 Estrutura do Projeto

```
.
├── backend/                    # Código da API FastAPI
│   ├── models/                # Modelos SQLAlchemy
│   ├── routes/                # Rotas da API
│   ├── schemas/               # Schemas Pydantic
│   ├── core/                  # Configuração e segurança
│   ├── db/                    # Conexão do banco
│   ├── alembic/               # Migrações
│   └── requirements.txt        # Dependências Python
├── frontend/                  # React (a fazer)
├── docker-compose.yml         # Orquestração de containers
├── Dockerfile                 # Imagem do backend
├── Makefile                   # Comandos úteis
├── .env                       # Variáveis de ambiente
└── README.md                  # Este arquivo
```

---

## 📚 Recursos úteis

- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [SQLAlchemy](https://www.sqlalchemy.org/)
- [Alembic](https://alembic.sqlalchemy.org/)
- [Docker](https://docs.docker.com/)
