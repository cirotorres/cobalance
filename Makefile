include .env
export $(shell sed 's/=.*//' .env)


.PHONY: help rebuild up down logs shell-backend shell-db shell-frontend migrate 

help:
	@echo "Comandos disponíveis:"
	@echo "  make rebuild         - Reconstruir imagens Docker"
	@echo "  make up              - Subir containers"
	@echo "  make down            - Parar containers"
	@echo "  make logs            - Ver logs da aplicação (backend)"
	@echo "  make logs-frontend   - Ver logs do frontend"
	@echo "  make shell-backend   - Acessar shell do backend"
	@echo "  make shell-frontend  - Acessar shell do frontend"
	@echo "  make shell-db        - Acessar shell do PostgreSQL"
	@echo "  make migrate         - Rodar migrações Alembic"

rebuild:
	docker compose down --remove-orphans
	docker compose up --build -d

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f backend

logs-frontend:
	docker compose logs -f frontend

shell-backend:
	docker compose exec backend bash

shell-frontend:
	docker compose exec frontend sh

shell-db:
	docker compose exec postgres psql -U $$POSTGRES_USER -d $$POSTGRES_DB

migrate:
	docker compose exec backend alembic upgrade head

