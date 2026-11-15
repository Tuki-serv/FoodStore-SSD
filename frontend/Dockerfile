# Servidor de desarrollo de Vite (no es una imagen de produccion: eso corresponde a la entrega, C-25b).
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

# --host 0.0.0.0 para que el puerto publicado por compose sea alcanzable desde el host.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
