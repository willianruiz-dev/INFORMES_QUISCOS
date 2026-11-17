# Compilación reproducible; solo los archivos estáticos pasan a la imagen final.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY angular.json tsconfig.json tsconfig.app.json tailwind.config.js postcss.config.js ./
COPY src ./src
ARG BASE_HREF=/
RUN npm run build -- --base-href="${BASE_HREF}"

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/nexo-informes/browser /usr/share/nginx/html
EXPOSE 8080
