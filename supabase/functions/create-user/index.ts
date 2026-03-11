// Edge Function: cria utilizador no Supabase Auth e perfil em public.profiles.
// Chamada pelo Admin ao adicionar um novo utilizador na app.
// Requer: SUPABASE_SERVICE_ROLE_KEY nas secrets do projeto.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserBody {
  email: string;
  password: string;
  nome: string;
  perfil: string;
  cargo?: string;
  departamento?: string;
  avatar?: string;
  permissoes?: string[];
  modulos?: string[] | null;
  empresa_id?: number | null;
  colaborador_id?: number | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar que o caller está autenticado e é Admin (verify_jwt está false no config).
    const authHeader = req.headers.get('Authorization');
    if (anonKey && authHeader) {
      const clientAnon = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data: { user: caller } } = await clientAnon.auth.getUser();
      if (!caller?.id) {
        return new Response(
          JSON.stringify({ error: 'Não autenticado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data: callerProfile } = await supabaseAdmin
        .from('profiles')
        .select('perfil')
        .eq('auth_user_id', caller.id)
        .maybeSingle();
      const perfil = (callerProfile as { perfil?: string } | null)?.perfil;
      if (perfil !== 'Admin') {
        return new Response(
          JSON.stringify({ error: 'Apenas utilizadores Admin podem criar utilizadores' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const body = (await req.json()) as CreateUserBody;
    const { email, password, nome, perfil, cargo = '', departamento = '', avatar = '', permissoes = [], modulos = null, empresa_id = null, colaborador_id = null } = body;

    if (!email?.trim() || !password || !nome?.trim() || !perfil?.trim()) {
      return new Response(
        JSON.stringify({ error: 'email, password, nome e perfil são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
    });

    if (authError) {
      const msg = authError.message || '';
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return new Response(
          JSON.stringify({ error: 'Já existe um utilizador com este email.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: msg || 'Erro ao criar utilizador no Auth' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authUserId = authData?.user?.id;
    if (!authUserId) {
      return new Response(
        JSON.stringify({ error: 'Resposta inesperada do Auth' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        auth_user_id: authUserId,
        nome: nome.trim(),
        email: email.trim(),
        perfil: perfil.trim(),
        cargo: (cargo || '').trim(),
        departamento: (departamento || '').trim(),
        avatar: (avatar || '').trim() || nome.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase(),
        permissoes: Array.isArray(permissoes) ? permissoes : [],
        modulos: Array.isArray(modulos) ? modulos : null,
        empresa_id: empresa_id ?? null,
        colaborador_id: colaborador_id ?? null,
      })
      .select()
      .single();

    if (profileError) {
      return new Response(
        JSON.stringify({ error: profileError.message || 'Erro ao criar perfil' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(profile), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
