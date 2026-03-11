/**
 * Cria o utilizador Admin no Supabase (Auth + perfil em profiles).
 * Necessário para fazer login quando se usa Supabase.
 *
 * Requer no .env:
 *   VITE_SUPABASE_URL=
 *   SUPABASE_SERVICE_ROLE_KEY=   (Dashboard Supabase → Settings → API → service_role secret)
 *
 * Opcional (valores por defeito):
 *   ADMIN_EMAIL=admin@sanep.ao
 *   ADMIN_PASSWORD=Admin123!
 *   ADMIN_NOME=Administrador
 *
 * Se o utilizador já foi criado em Authentication (Dashboard):
 *   ADMIN_EMAIL=naym.mupoia@gruposanep.co.ao  (o email do user no Auth)
 *   CREATE_PROFILE_ONLY=1
 *   npm run create-admin
 * Ou: npm run create-admin -- --profile-only
 *
 * Uso: npx tsx scripts/create-admin.ts
 *      npm run create-admin
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_EMAIL = 'admin@sanep.ao';
const DEFAULT_PASSWORD = 'Admin123!';
const DEFAULT_NOME = 'Administrador';

function loadEnv(): void {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const m = line.match(/^\s*([^#=]+)=(.*)$/);
        if (m) {
          const key = m[1].trim();
          const val = m[2].trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  } catch {
    // ignore
  }
}

loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL ?? DEFAULT_EMAIL;
const password = process.env.ADMIN_PASSWORD ?? DEFAULT_PASSWORD;
const nome = process.env.ADMIN_NOME ?? DEFAULT_NOME;
const profileOnly = process.env.CREATE_PROFILE_ONLY === '1' || process.argv.includes('--profile-only');

if (!url || !serviceRoleKey) {
  console.error('Defina no .env:');
  console.error('  VITE_SUPABASE_URL=...');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=...  (Supabase Dashboard → Settings → API → service_role)');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

async function run(): Promise<void> {
  let authUserId: string;

  if (profileOnly) {
    // Apenas criar/atualizar perfil: utilizador já existe em Authentication
    const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!existing) {
      console.error('Nenhum utilizador em Authentication com o email:', email);
      console.error('Crie o utilizador em Supabase Dashboard → Authentication → Users → Add user');
      process.exit(1);
    }
    authUserId = existing.id;
    console.log('Utilizador Auth encontrado:', email);
  } else {
    // 1. Criar utilizador no Auth (ou obter se já existir)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes('already been registered') || authError.message.includes('already exists')) {
        const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const existing = list?.users?.find((u) => u.email === email);
        if (existing) {
          authUserId = existing.id;
          console.log('Utilizador Auth já existe:', email);
        } else {
          console.error('Erro Auth:', authError.message);
          process.exit(1);
        }
      } else {
        console.error('Erro ao criar utilizador Auth:', authError.message);
        process.exit(1);
      }
    } else if (authData?.user?.id) {
      authUserId = authData.user.id;
      console.log('Utilizador Auth criado:', email);
    } else {
      console.error('Resposta inesperada do Auth');
      process.exit(1);
    }
  }

  if (!authUserId) {
    console.error('authUserId em falta');
    process.exit(1);
  }

  // 2. Inserir ou actualizar perfil em public.profiles
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  const profileRow = {
    auth_user_id: authUserId,
    nome,
    email,
    perfil: 'Admin',
    cargo: 'Administrador',
    departamento: 'Direcção',
    avatar: 'AD',
    permissoes: ['TODOS_MODULOS', 'CRUD_TOTAL'],
    empresa_id: null as number | null,
  };

  if (existingProfile) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        nome: profileRow.nome,
        perfil: profileRow.perfil,
        cargo: profileRow.cargo,
        departamento: profileRow.departamento,
        avatar: profileRow.avatar,
        permissoes: profileRow.permissoes,
        empresa_id: profileRow.empresa_id,
        updated_at: new Date().toISOString(),
      })
      .eq('auth_user_id', authUserId);
    if (updateError) {
      console.error('Erro ao actualizar perfil:', updateError.message);
      process.exit(1);
    }
    console.log('Perfil actualizado em public.profiles (Admin).');
  } else {
    const { error: insertError } = await supabase.from('profiles').insert(profileRow);
    if (insertError) {
      console.error('Erro ao inserir perfil:', insertError.message);
      process.exit(1);
    }
    console.log('Perfil criado em public.profiles (Admin).');
  }

  console.log('');
  console.log('--- Utilizador Admin pronto ---');
  console.log('  Email:', email);
  if (!profileOnly) {
    console.log('  Password:', '(a que definiu no .env ou padrão)');
  } else {
    console.log('  Password: (a que definiu no Authentication ao criar o user)');
  }
  console.log('  No login: escolha "Grupo" como empresa (Admin é utilizador de grupo).');
  console.log('');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
