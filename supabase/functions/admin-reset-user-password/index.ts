import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.1';
import { corsHeaders } from '../_shared/cors.ts';

const MIN_LEN = 8;

interface Body {
  target_profile_id?: number;
  new_password?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Variáveis de ambiente não configuradas' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!anonKey || !authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientAnon = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user: caller },
    } = await clientAnon.auth.getUser();
    if (!caller?.id) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('perfil')
      .eq('auth_user_id', caller.id)
      .maybeSingle();

    if ((callerProfile as { perfil?: string } | null)?.perfil !== 'Admin') {
      return new Response(JSON.stringify({ error: 'Apenas Admin pode repor senhas' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as Body;
    const targetId = Number(body.target_profile_id);
    const pwd = (body.new_password ?? '').trim();

    if (!Number.isFinite(targetId) || targetId <= 0) {
      return new Response(JSON.stringify({ error: 'target_profile_id inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (pwd.length < MIN_LEN) {
      return new Response(
        JSON.stringify({ error: `A palavra-passe temporária deve ter pelo menos ${MIN_LEN} caracteres.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: target, error: tErr } = await admin
      .from('profiles')
      .select('id, auth_user_id')
      .eq('id', targetId)
      .maybeSingle();

    if (tErr || !target) {
      return new Response(JSON.stringify({ error: 'Utilizador não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authUserId = (target as { auth_user_id?: string }).auth_user_id;
    if (!authUserId) {
      return new Response(JSON.stringify({ error: 'Perfil sem auth_user_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: authErr } = await admin.auth.admin.updateUserById(authUserId, {
      password: pwd,
    });

    if (authErr) {
      return new Response(JSON.stringify({ error: authErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const patch: Record<string, unknown> = {
      obrigar_troca_senha: true,
      primeiro_acesso_pendente: false,
      login_failed_attempts: 0,
      login_locked_at: null,
      login_lock_reason: null,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: pErr } = await admin
      .from('profiles')
      .update(patch)
      .eq('id', targetId)
      .select(
        'id, auth_user_id, nome, email, username, perfil, cargo, departamento, avatar, permissoes, modulos, colaborador_id, empresa_id, numero_mec, assinatura_linha, assinatura_cargo, assinatura_imagem_url, primeiro_acesso_pendente, obrigar_troca_senha, created_at, updated_at',
      )
      .maybeSingle();

    if (pErr) {
      return new Response(JSON.stringify({ error: pErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(updated ?? target), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
