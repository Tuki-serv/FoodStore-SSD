# Imagen del frontend en dos objetivos (docker build --target <dev|prod>):
#   dev  - servidor de desarrollo de Vite (lo usa docker-compose por defecto).
#   prod - sitio estatico (build de Vite) servido por nginx. Es la ultima etapa: sin --target se construye esta.
# El build necesita design-system/ (queda fuera del contexto ./frontend): se pasa como contexto adicional
#   docker build --build-context design-system=../design-system --build-arg VITE_API_URL=<url> --target prod .
# (en compose: `additional_contexts`, ver el servicio frontend-prod).

FROM node:24-alpine AS dev

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

# --host 0.0.0.0 para que el puerto publicado por compose sea alcanzable desde el host.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]


FROM dev AS build

# La URL del backend se fija al construir (Vite la incrusta en el bundle); sin ella el build falla (DD-18).
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# `../design-system` desde /app resuelve a /design-system, igual que en local.
COPY --from=design-system . /design-system
RUN npm run build


FROM nginx:alpine AS prod

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
