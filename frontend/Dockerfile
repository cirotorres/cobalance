FROM node:20-alpine

WORKDIR /app

# Copiar package.json e package-lock.json
COPY package*.json .

# Instalar dependências
RUN npm ci

# Copiar código da aplicação
COPY . .

# Build da aplicação
RUN npm run build

# Usar nginx para servir
FROM nginx:alpine
COPY --from=0 /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expor porta
EXPOSE 3000

# Comando para rodar nginx
CMD ["nginx", "-g", "daemon off;"]
