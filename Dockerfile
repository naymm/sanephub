# syntax=docker/dockerfile:1
# Imagem final baseada em Debian Bookworm (imagem oficial nginx); adequada para correr em Ubuntu com Docker Engine.

FROM node:22-bookworm AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SUPABASE_ALLOW_HTTP=0
ARG VITE_VAPID_PUBLIC_KEY=

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_ALLOW_HTTP=$VITE_SUPABASE_ALLOW_HTTP
ENV VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY

RUN npm run build

FROM nginx:1.26-bookworm
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
