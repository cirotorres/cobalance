# 🐳 Docker Structure

## Organização do Projeto

```
project/
├── backend/
│   ├── Dockerfile          # Backend FastAPI
│   ├── .dockerignore       # Ignore patterns para backend
│   ├── requirements.txt    # Dependências Python
│   ├── main.py
│   └── ...
│
├── frontend/
│   ├── Dockerfile          # Frontend React
│   ├── .dockerignore       # Ignore patterns para frontend
│   ├── nginx.conf          # Configuração nginx
│   ├── package.json
│   └── ...
│
├── docker-compose.yml      # Orquestração de containers
├── Makefile                # Comandos auxiliares
└── .env                    # Variáveis de ambiente
```

## Services

### Backend
- **Image**: Python 3.12-slim
- **Port**: 8000
- **Path**: `./backend/Dockerfile`

### Frontend (quando pronto)
- **Image**: Node 20 Alpine → Nginx Alpine
- **Port**: 3000
- **Path**: `./frontend/Dockerfile`

### Database
- **Image**: PostgreSQL 15-alpine
- **Port**: 5433 (mapeado de 5432)

## Como Usar

### Iniciar todos os serviços
```bash
docker-compose up -d
```

### Construir uma imagem específica
```bash
# Backend
docker-compose build backend

# Frontend
docker-compose build frontend
```

### Acessar um container
```bash
# Backend
docker-compose exec backend bash

# Frontend
docker-compose exec frontend sh
```

## Variáveis de Ambiente

Configure em `.env`:
```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=123456
POSTGRES_DB=bancomovie
```

## Notas

- Cada serviço tem seu próprio `.dockerignore` para otimizar builds
- Frontend pode ser habilitado descomentando a seção em `docker-compose.yml`
- O nginx.conf no frontend facilita proxy para API backend
