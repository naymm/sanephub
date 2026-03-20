// Edge Function: aniversários (Comunicação Interna)
// Retorna aniversários do mês e do dia.
//
// Idealmente: chamada GET /birthdays
// (no Supabase, no client costuma-se chamar via supabase.functions.invoke, que faz POST;
// por isso aceitamos qualquer método e permitimos passar company_id em query ou body).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type BirthdaysPayload = {
  company_id?: number | null;
  nowISO?: string;
};

function parseCompanyIdFromRequest(req: Request): number | null | undefined {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('company_id');
  if (fromQuery != null) {
    const n = Number(fromQuery);
    return Number.isFinite(n) ? n : null;
  }
  return undefined;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY não configuradas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientAnon = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const {
      data: { user },
    } = await clientAnon.auth.getUser();
    if (!user?.id) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Lê profile para decidir tenant/filter.
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: profile } = await supabase
      .from('profiles')
      .select('perfil, empresa_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    const perfil = (profile as { perfil?: string } | null)?.perfil;
    const empresaIdProfile = (profile as { empresa_id?: number | null } | null)?.empresa_id ?? null;

    const parsedCompanyIdFromQuery = parseCompanyIdFromRequest(req);

    let body: BirthdaysPayload | null = null;
    try {
      // Pode falhar se o client enviar sem body (ex.: GET real).
      body = (await req.json()) as BirthdaysPayload;
    } catch {
      body = null;
    }

    const company_id = body?.company_id ?? parsedCompanyIdFromQuery;
    const now = body?.nowISO ? new Date(body.nowISO) : new Date();

    const month = now.getUTCMonth() + 1; // 1-12
    const day = now.getUTCDate(); // 1-31

    const isGroupAdmin = (perfil === 'Admin' || perfil === 'PCA') && empresaIdProfile == null;

    let finalCompanyFilter: number | null | undefined = undefined;
    if (isGroupAdmin) {
      // Admin grupo: se o client passar company_id, usamos; senão, devolvemos tudo.
      finalCompanyFilter = company_id ?? null;
    } else {
      // Non-group admin: sempre usa empresa_id do perfil.
      finalCompanyFilter = empresaIdProfile;
    }

    // Query colaboradores
    let q = supabase
      .from('colaboradores')
      .select('id, nome, data_nascimento, empresa_id')
      .order('nome', { ascending: true });

    // A relação "profiles(avatar)" depende do relacionamento/foreign key.
    // Como não temos o relacionamento tipado neste repo, caso falhe na prática,
    // o código ainda funciona no formato SQL suportado pelo Supabase.
    // (Se não houver FK, será necessário trocar por um join explícito.)

    if (finalCompanyFilter != null) {
      q = q.eq('empresa_id', finalCompanyFilter);
    }

    const { data: colaboradores } = await q;

    const rows = (colaboradores ?? []) as any[];

    const collaboratorIds = rows.map(r => r.id).filter((x: any) => x != null);
    const { data: avatarsRows } = collaboratorIds.length
      ? await supabase
          .from('profiles')
          .select('colaborador_id, avatar')
          .in('colaborador_id', collaboratorIds)
      : { data: [] as any[] };

    const avatarByCollaboratorId = new Map<number, string | null>();
    for (const pr of (avatarsRows ?? []) as any[]) {
      const cid = pr.colaborador_id as number;
      avatarByCollaboratorId.set(cid, (pr.avatar as string | null) ?? null);
    }

    const monthBirthdays = [];
    const todayBirthdays = [];

    for (const c of rows) {
      const d = new Date(c.data_nascimento);
      const m = d.getUTCMonth() + 1;
      const dd = d.getUTCDate();
      const avatar = avatarByCollaboratorId.get(c.id) ?? null;
      const birthDate = c.data_nascimento as string;

      const payload = {
        id: c.id as number,
        name: c.nome as string,
        birth_date: birthDate,
        company_id: c.empresa_id as number,
        avatar,
      };

      if (m === month) monthBirthdays.push(payload);
      if (m === month && dd === day) todayBirthdays.push(payload);
    }

    return new Response(
      JSON.stringify({
        month_birthdays: monthBirthdays,
        today_birthdays: todayBirthdays,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

