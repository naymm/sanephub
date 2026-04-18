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

    // Calendário local (alinhado ao client que envia nowISO): só MM-DD importa; o ano em data_nascimento é ignorado.
    const month = now.getMonth() + 1; // 1-12
    const day = now.getDate(); // 1-31

    const isGroupAdmin = (perfil === 'Admin' || perfil === 'PCA') && empresaIdProfile == null;

    let finalCompanyFilter: number | null | undefined = undefined;
    if (isGroupAdmin) {
      // Admin grupo: se o client passar company_id, usamos; senão, devolvemos tudo.
      finalCompanyFilter = company_id ?? null;
    } else {
      // Non-group admin: sempre usa empresa_id do perfil.
      finalCompanyFilter = empresaIdProfile;
    }

    const pEmpresaId = finalCompanyFilter === undefined ? null : finalCompanyFilter;

    // Filtro no PostgreSQL: EXTRACT(month/day) em data_nascimento (tipo date) — compara só MM-DD.
    const { data: rowsToday, error: errToday } = await supabase.rpc('colaboradores_aniversario_no_mes_dia', {
      p_mes: month,
      p_dia: day,
      p_empresa_id: pEmpresaId,
    });
    if (errToday) throw errToday;

    const { data: rowsMonth, error: errMonth } = await supabase.rpc('colaboradores_aniversario_no_mes', {
      p_mes: month,
      p_empresa_id: pEmpresaId,
    });
    if (errMonth) throw errMonth;

    const { data: rowsAll, error: errAll } = await supabase.rpc('colaboradores_com_data_nascimento', {
      p_empresa_id: pEmpresaId,
    });
    if (errAll) throw errAll;

    const rows = (rowsAll ?? []) as { id: number; nome: string; data_nascimento: string; empresa_id: number }[];

    const collaboratorIds = rows.map((r) => r.id).filter((x) => x != null);

    const { data: fotosRows } = collaboratorIds.length
      ? await supabase.from('colaboradores').select('id, foto_perfil_url').in('id', collaboratorIds)
      : { data: [] as any[] };

    const fotoByCollaboratorId = new Map<number, string | null>();
    for (const row of (fotosRows ?? []) as any[]) {
      const id = row.id as number;
      const u = (row.foto_perfil_url as string | null | undefined)?.trim();
      fotoByCollaboratorId.set(id, u || null);
    }

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

    const toPayload = (c: { id: number; nome: string; data_nascimento: string; empresa_id: number }) => ({
      id: c.id as number,
      name: c.nome as string,
      birth_date: c.data_nascimento as string,
      company_id: c.empresa_id as number,
      /** URL da foto (`colaboradores.foto_perfil_url`); fallback para `profiles.avatar` só se for URL (evita letra). */
      avatar: (() => {
        const foto = fotoByCollaboratorId.get(c.id);
        if (foto) return foto;
        const letter = avatarByCollaboratorId.get(c.id);
        if (letter && /^https?:\/\//i.test(String(letter).trim())) return String(letter).trim();
        return null;
      })(),
    });

    const todayBirthdays = (rowsToday ?? []).map(toPayload);
    const monthBirthdays = (rowsMonth ?? []).map(toPayload);
    const allBirthdays = rows.map(toPayload);

    return new Response(
      JSON.stringify({
        month_birthdays: monthBirthdays,
        today_birthdays: todayBirthdays,
        /** Todos os colaboradores activos com data de nascimento (para páginas que filtram por mês no cliente). */
        all_birthdays: allBirthdays,
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

