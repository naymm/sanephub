# Relatório de desenvolvimento atual — SANEP Hub

**Data do relatório:** 19 de abril de 2026  
**Repositório:** aplicação web interna do **Grupo SANEP** (intranet multi-módulo), com dados em **Supabase** (PostgreSQL, Auth, Storage, Edge Functions, Realtime).

Este documento resume a **stack**, a **arquitectura**, os **módulos funcionais** e as **evoluções recentes** mais relevantes (incluindo Dashboard, comunicados e configuração organizacional). Não pretende listar cada linha de código: para o detalhe histórico completo das migrações, ver `supabase/migrations/`.

---

## 1. Visão geral do produto

- **Nome interno do pacote:** `vite_react_shadcn_ts` (template base Vite).
- **Função:** portal corporativo com **menu horizontal por módulos**, **multi-empresa (tenant)**, perfis de utilizador (Admin, PCA, RH, etc.), **portal do colaborador**, notificações, chat e listagens alimentadas por **Supabase** com opcional **tempo real (Realtime + gateway SSE)**.

---

## 2. Stack tecnológica

| Camada | Tecnologias |
|--------|-------------|
| Frontend | **React 18**, **TypeScript**, **Vite**, **React Router** |
| UI | **Tailwind CSS**, **shadcn/ui** (Radix), **lucide-react**, **date-fns** (locale `pt`) |
| Estado / dados | **@tanstack/react-query**, contextos React (`Auth`, `Data`, `Tenant`, `Notification`, `Chat`, …) |
| Backend | **Supabase** (PostgREST, RLS, Storage, Edge Functions) |
| Tempo real | **Supabase Realtime** + gateway opcional **SSE** (`server/sse-gateway.ts`, variável `VITE_SSE_URL` — ver `README.md`) |
| Testes | **Vitest** (`npm test`) |
| Scripts auxiliares | **tsx** (`scripts/seed-db.ts`, `scripts/create-admin.ts`, …) |

---

## 3. Arquitectura da aplicação

### 3.1 Entrada e rotas

- Ficheiro principal de rotas: `src/App.tsx`.
- Redireccionamento raiz `/` → `/dashboard`.
- Rotas protegidas sob `Layout` (autenticação e shell da intranet).

### 3.2 Contextos principais

- **`AuthContext`** — sessão, utilizador, `hasModuleAccess`, perfis.
- **`TenantContext`** — empresa actual (`currentEmpresaId`: número ou `'consolidado'`), persistência em `localStorage` (`sanep_tenant_empresa_id`).
- **`DataContext`** — carregamento de tabelas via `src/lib/supabaseData.ts`, filtros por tenant, mutações, **realtime** por tabela, `organizacaoSettings` (módulos/recursos/banner).
- **`NotificationContext`**, **`ChatProvider`**, etc.

### 3.3 Camada de dados

- **`src/lib/supabaseData.ts`** — leitura/escrita mapeada para tipos em `src/types/index.ts`.
- **`src/lib/supabaseMappers.ts`** — convenções de nomes DB ↔ app.
- **`src/utils/publicMediaUrl.ts`** — normalização de URLs públicas (Storage / media).

### 3.4 Supabase

- **`supabase/migrations/`** — esquema evolutivo (perfil `profiles`, empresas, módulos de negócio, RLS, storage, realtime).
- **`supabase/functions/`** — Edge Functions, por exemplo:
  - `birthdays` — aniversários para o dashboard / calendário.
  - `create-user`, `notify-noticia-push`, `gue-publicacao-nome`.

---

## 4. Módulos e áreas funcionais (rotas)

Resumo por área (páginas em `src/modules/` e `src/pages/`).

| Área | Exemplos de funcionalidade / rotas |
|------|-----------------------------------|
| **Dashboard** | `src/pages/Dashboard.tsx` — resumo, KPIs, notícias, calendário, comunicados, documentos, **banners dinâmicos** (ver secção 6). |
| **Conselho de Administração** | Decisões, assinatura de actos, saúde financeira, actividade, empresas. |
| **Planeamento** | Relatórios, consolidação, dashboard de planeamento. |
| **Capital Humano** | Colaboradores, férias, faltas, recibos, declarações, processamento salarial, marcações de ponto, zonas (geofences). |
| **Finanças** | Requisições, bancos, contas, tesouraria, centros de custo, projectos, relatórios. |
| **Contabilidade** | Pagamentos, pendências. |
| **Secretaria** | Reuniões, actas, documentos oficiais, correspondências, arquivo; **gestão documental** (`/gestao-documentos`). |
| **Património** | `PatrimonioPage` — activos, categorias, movimentos (migrações dedicadas em 202604*). |
| **Jurídico** | Contratos, processos, prazos, riscos, rescisões, arquivo. |
| **Comunicação interna** | Notícias, eventos, **comunicados**, aniversários; detalhes e listagens com anexos / imagens. |
| **Portal colaborador** | Dados, férias, recibos, declarações, requisições. |
| **Configurações** | Utilizadores, departamentos, **módulos e recursos** (`ModulosRecursosPage.tsx`). |
| **Chat / Notificações** | `ChatPage`, centro de notificações. |

---

## 5. Multi-tenant e permissões

- Dados filtrados por **empresa** (`empresaId`) ou visão **consolidada** conforme `TenantContext` e regras em `DataContext` (`filtered`).
- **RLS** nas tabelas Supabase por `profiles` / `empresa_id`.
- **`organizacao_settings`** — desactivação global de **módulos** e **recursos** (rotas); configurável em **Configuração → Módulos e recursos**.

### 5.1 Planeamento — perfil Director

- **Relatórios mensais:** o Director com `empresaId` definido pode **criar, editar e submeter** relatórios **apenas dessa empresa**; a listagem mostra só essa unidade; o formulário ignora `empresaId` na query se for outra empresa e bloqueia abrir relatório de outra unidade.
- **Consolidação e Dashboard de planeamento:** sem visão «Grupo», o Director vê **consolidação** e **dashboard** calculados **só com os relatórios submetidos da sua empresa** (mesma lógica de KPIs que na visão consolidada, mas com um único participante). Outros perfis continuam a precisar da visão consolidada (Grupo) para o dashboard global e para a consolidação multi-empresa.

---

## 6. Evoluções recentes do Dashboard e banners

### 6.1 Layout do topo

- Grelha: **coluna esquerda** (saudação + KPIs em grelha 2×2 quando há coluna de banner; **3–4 colunas em `lg`** quando **não** há banner, para recuperar o layout “largo”).
- **Coluna direita** só existe quando há conteúdo para mostrar (ver abaixo).

### 6.2 Critério de mostrar a coluna do banner

A coluna direita só é renderizada quando:

- existe **URL de imagem de feriado** resolvida, **ou**
- o utilizador tem **Comunicação interna**, os aniversários **já carregaram** e existe **pelo menos um aniversariante hoje**.

Caso contrário, a coluna **não aparece** (sem caixa vazia).

### 6.3 Imagem de feriado

- **Prioridade:** último comunicado com `tipo = 'feriado'` e `anexoUrl` que pareça imagem (extensão / parâmetros comuns).
- **Fallback:** `organizacao_settings.dashboard_banner_feriados_url` (configurável na UI).
- Normalização de URL: `normalizePublicMediaUrl`.

### 6.4 Banner de aniversário (cartão automático)

- Componente: `src/components/dashboard/DashboardTopBanners.tsx`.
- Para cada aniversariante do dia (quando aplicável): cartão com estilo “feliz aniversário”, confetis decorativos, **foto** (`colaboradores.fotoPerfilUrl` / avatar URL), nome, data de nascimento formatada (`formatDate`), **nome da empresa** (derivado do tenant / lista `empresas`).
- **Clique** no cartão: navegação para `/comunicacao-interna/aniversarios`.

### 6.5 Carrossel

- Se coexistirem **vários aniversariantes** e/ou **imagem de feriado**, usa-se **Embla** (`src/components/ui/carousel.tsx`): setas, indicadores, **auto-advance** (~6,5 s), `loop`.
- Ajuste de preenchimento: wrapper do `CarouselContent` com `h-full min-h-0` para os slides ocuparem a **altura da caixa**.

### 6.6 Responsividade do banner

- Mobile / tablet: **aspect-ratio** (16:9, depois 21:9 em `sm`) com **teto em `vh`**.
- Desktop (`lg`): coluna segue a **altura** do bloco da esquerda; imagem com `object-cover object-center`.

---

## 7. Base de dados e configuração (trechos relevantes)

### 7.1 `organizacao_settings`

- Tabela para flags globais da organização.
- Migração **`20260416180000_organizacao_dashboard_banner_feriados.sql`:** coluna `dashboard_banner_feriados_url` (texto, opcional) para URL do banner de feriado quando não há imagem no comunicado.

### 7.2 Comunicados

- Migração **`20260416120000_comunicacao_interna_comunicados.sql`:** tabela `comunicados` (tipos incl. `feriado`), anexos, RLS, bucket Storage `comunicados`.
- Migração **`20260416140000_comunicado_leituras.sql`:** leituras de comunicados (popup / tracking conforme UI).

### 7.3 Tipos e API de dados

- `OrganizacaoSettings` em `src/types/index.ts` inclui `dashboardBannerFeriadosUrl`.
- `fetchOrganizacaoSettings` / `upsertOrganizacaoSettings` em `src/lib/supabaseData.ts` mapeiam `dashboard_banner_feriados_url`.
- **`ModulosRecursosPage.tsx`:** campo para URL do banner de feriados e envio no **guardar** para não sobrescrever o valor ao gravar só módulos/recursos.

---

## 8. Migrações e domínio (panorama)

Existem **dezenas** de migrações em `supabase/migrations/` que cobrem, entre outros:

- Perfis, empresas, documentos oficiais, requisições, notificações.
- Comunicação interna (notícias, eventos, comentários, gostos, galeria).
- Geofences, colaborador–geofence, marcações de ponto, biométrico.
- Gestão documental (pastas, permissões, auditoria).
- Património (activos, categorias, subcategorias, quantidades, computadores, viaturas, RLS).
- Planeamento (relatórios mensais, campos de resultado, web push, etc.).

Para o **histórico exacto** e ordem de aplicação, usar a pasta de migrações ou `supabase db` no ambiente.

---

## 9. Como correr o projecto (desenvolvimento)

```bash
npm install
npm run dev
```

- Variáveis: ficheiro **`.env`** (URL Supabase, chaves, opcional `VITE_SSE_URL`).
- Migrações: aplicar com a CLI Supabase no projecto ligado (`supabase migration up` / `db push`, conforme o vosso fluxo).

Comandos úteis (do `package.json`):

- `npm run build` — build de produção.
- `npm run lint` — ESLint.
- `npm test` — Vitest.
- `npm run seed` / `npm run create-admin` — scripts de dados / admin.

---

## 10. Ficheiros-chave desta linha de evolução (Dashboard / banners)

| Ficheiro | Papel |
|----------|--------|
| `src/pages/Dashboard.tsx` | Layout topo, KPIs, `hasTopBannerColumn`, integração `DashboardTopBanners`, nome da organização. |
| `src/components/dashboard/DashboardTopBanners.tsx` | Slides feriado + aniversário, carrossel, cartão de aniversário. |
| `src/components/ui/carousel.tsx` | Embla; altura do viewport do carrossel. |
| `src/modules/config/ModulosRecursosPage.tsx` | URL opcional do banner de feriados + `updateOrganizacaoSettings`. |
| `src/lib/supabaseData.ts` | Fetch/upsert `organizacao_settings`. |
| `src/context/DataContext.tsx` | Estado `organizacaoSettings`. |
| `src/types/index.ts` | Tipo `OrganizacaoSettings`. |
| `supabase/migrations/20260416180000_organizacao_dashboard_banner_feriados.sql` | Coluna URL do banner. |

---

## 11. Notas e limitações

- O banner de feriado a partir do comunicado depende de **`anexoUrl`** com ficheiro que **pareça imagem**; PDF ou outros formatos não substituem a imagem no banner (pode usar-se a URL manual em configuração).
- Aniversários no dashboard dependem da Edge Function **`birthdays`** e de sessão válida.
- Este relatório foi **redigido com base na estrutura do repositório** na data indicada; commits locais não listados aqui podem acrescentar detalhe incremental.

---

*Documento gerado para acompanhamento interno de desenvolvimento. Actualizar conforme novas entregas.*
