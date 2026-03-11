# Integração Supabase — GRUPO SANEP

O sistema pode usar **Supabase** para autenticação (e opcionalmente base de dados). Sem configurar as variáveis de ambiente, a aplicação continua a funcionar com autenticação local (localStorage + seed).

## 1. Configuração

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Copie o ficheiro de exemplo e preencha com os dados do projeto:
   ```bash
   cp .env.example .env
   ```
3. No dashboard do Supabase: **Settings → API**. Copie:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
4. Reinicie o servidor de desenvolvimento (`npm run dev`).

## 2. Base de dados (Auth + todas as tabelas)

O projecto tem duas migrações SQL:

1. **`20250306000000_create_profiles.sql`** — Tabela `profiles` ligada a `auth.users` (obrigatória para login).
2. **`20250306100000_create_all_tables.sql`** — Todas as tabelas do domínio com relacionamentos:
   - **empresas**, **departamentos**
   - **colaboradores** → empresas
   - **centros_custo**, **projectos** → empresas
   - **reunioes**; **actas** → reunioes
   - **contratos** → empresas
   - **requisicoes** → empresas, colaboradores (requisitante)
   - **pagamentos** → requisicoes
   - **movimentos_tesouraria** → empresas, centros_custo, projectos, requisicoes
   - **ferias**, **faltas**, **recibos_salario**, **declaracoes** → colaboradores
   - **processos_judiciais**, **prazos_legais**, **riscos_juridicos** → empresas
   - **processos_disciplinares** → empresas, colaboradores
   - **rescisoes_contrato** → contratos, empresas
   - **correspondencias**, **documentos_oficiais**, **notificacoes**, **pendencias_documentais**
   - **relatorios_planeamento** → empresas (campos em JSONB)

Execute as migrações pelo **SQL Editor** do Supabase (1ª depois 2ª) ou use a CLI:

```bash
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

### Popular dados de exemplo (seed)

Com as tabelas criadas e as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env`, pode inserir dados de exemplo:

```bash
npm run seed
```

Para apagar os dados das tabelas e voltar a inserir o seed:

```bash
npm run seed:clear
```

Os dados vêm de `src/data/seed.ts` (empresas, colaboradores, contratos, requisições, férias, etc.) e são inseridos pela ordem correta de dependências.

### Criar utilizador Admin (recomendado)

Para poder fazer login com Supabase, crie o primeiro utilizador Admin com o script:

1. No **Dashboard Supabase → Settings → API**, copie a chave **service_role** (secret).
2. No ficheiro **`.env`** (na raiz do projeto), adicione:
   ```
   SUPABASE_SERVICE_ROLE_KEY=eyJ...sua_chave_service_role...
   ```
   **Não commite esta chave** (mantenha o `.env` no `.gitignore`).
3. Execute:
   ```bash
   npm run create-admin
   ```
4. Por defeito o script cria:
   - **Email:** `admin@sanep.ao`
   - **Password:** `Admin123!`
   - **Perfil:** Admin (empresa = Grupo)
5. No ecrã de login: escolha **Grupo** e use o email e a password acima. Para alterar email/password, defina no `.env` antes de correr o script:
   ```
   ADMIN_EMAIL=seu@email.com
   ADMIN_PASSWORD=SuaSenhaSegura123!
   ADMIN_NOME=Seu Nome
   ```

### Criar outros utilizadores (manual)

1. **Auth → Users → Add user** (ou signup pela aplicação, se implementar registo).
2. Defina a **password** do utilizador.
3. Insira manualmente uma linha em **Table Editor → profiles** (ou via SQL), por exemplo:
   ```sql
   insert into public.profiles (auth_user_id, nome, email, perfil, cargo, departamento, empresa_id)
   values (
     'uuid-do-auth-user',
     'Nome do Utilizador',
     'email@sanep.ao',
     'Admin',           -- Admin | PCA | RH | Financeiro | Juridico | Colaborador | ...
     'Cargo',
     'Departamento',
     null               -- null = Grupo (Admin/PCA); número = id da empresa
   );
   ```
   O `auth_user_id` é o **UUID** do utilizador em **Authentication → Users**.

### Valores de `perfil` e `empresa_id`

- **perfil**: um de `Admin`, `PCA`, `Planeamento`, `Director`, `RH`, `Financeiro`, `Contabilidade`, `Secretaria`, `Juridico`, `Colaborador`.
- **empresa_id**: `null` para utilizadores de Grupo (Admin, PCA, Planeamento); número (ex.: 1, 2) para utilizadores de uma empresa específica. No ecrã de login o utilizador escolhe "Grupo" ou a empresa; o sistema valida que o perfil tem essa empresa (ou Grupo).

## 3. Convenções do esquema

- **Nomes de colunas**: snake_case na base de dados (ex.: `empresa_id`, `data_inicio`). Na aplicação os tipos TypeScript usam camelCase; ao ler/escrever no Supabase convém mapear (ex.: `empresaId` ↔ `empresa_id`) ou usar um adapter.
- **IDs**: `bigserial` (equivalente a integer 64) com chave primária em todas as tabelas.
- **Arrays e objetos**: listas simples em `text[]` ou `bigint[]`; estruturas (ex.: histórico, medidas propostas, linhas de planeamento) em `jsonb`.

## 4. Uso de dados (opcional)

Os dados da aplicação (contratos, processos, colaboradores, etc.) continuam em estado local (React + seed). Para persistir no Supabase:

1. Crie as tabelas no Supabase (espelhando as entidades em `src/types/index.ts`).
2. No código, substitua ou complemente o `DataContext` com chamadas a `supabase.from('tabela').select()`, `.insert()`, `.update()`, `.delete()`.
3. O cliente já está disponível em `src/lib/supabase.ts`; use `supabase` quando `isSupabaseConfigured()` for `true`.

## 5. Storage (ficheiros PDF)

Para anexos (ex.: PDFs do processo disciplinar), pode usar **Supabase Storage**:

- Crie um bucket (ex.: `juridico-docs`) com políticas de acesso adequadas.
- No frontend: `supabase.storage.from('juridico-docs').upload(path, file)` e guarde o caminho ou URL na entidade.

## 6. Resumo

| Funcionalidade   | Sem Supabase        | Com Supabase (.env)   |
|------------------|---------------------|------------------------|
| Login            | Seed + localStorage | Supabase Auth + profiles |
| Dados da app     | Estado + seed       | Estado + seed (pode migrar para DB) |
| Ficheiros        | Nome em texto       | Pode usar Storage      |

Com **VITE_SUPABASE_URL** e **VITE_SUPABASE_ANON_KEY** definidos, o login passa a ser feito contra o Supabase; sem estas variáveis, o comportamento é o anterior (contas de demonstração e seed).
