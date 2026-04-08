// Edge Function: obtém a denominação no portal público GUE (fetch directo a gue.gov.ao).
// O browser não pode chamar o GUE por CORS; o fetch é feito aqui no servidor.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Equivalente ao parsing no cliente: 1.ª linha tbody, 2.ª célula, texto antes do <br>. */
function extrairNomeDaRespostaGue(html: string): { nome: string | null; error?: string } {
  const rowMatch = html.match(/<tbody[^>]*>[\s\S]*?<tr[^>]*>([\s\S]*?)<\/tr>/i);
  if (!rowMatch) {
    return { nome: null, error: 'Nenhum resultado encontrado no portal GUE para este NIF.' };
  }
  const tdMatches = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
  if (tdMatches.length < 2) {
    return { nome: null, error: 'Resposta do portal em formato inesperado.' };
  }
  let cellFragment = tdMatches[1][1];
  const brPos = cellFragment.search(/<br\s*\/?>/i);
  if (brPos !== -1) cellFragment = cellFragment.slice(0, brPos);
  const nome = cellFragment
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  if (!nome) {
    return { nome: null, error: 'Nome da empresa não encontrado na resposta.' };
  }
  return { nome };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !anonKey) {
      return new Response(JSON.stringify({ error: 'SUPABASE_URL/ANON_KEY em falta' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    let body: { nif?: string } | null = null;
    try {
      body = (await req.json()) as { nif?: string };
    } catch {
      return new Response(JSON.stringify({ error: 'Body JSON inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nif = (body?.nif ?? '').replace(/\D/g, '');
    if (!nif) {
      return new Response(JSON.stringify({ nome: null, error: 'Indique um NIF (apenas dígitos).' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const gueUrl = `https://gue.gov.ao/portal/publicacao?empresa=${encodeURIComponent(nif)}`;
    const gueRes = await fetch(gueUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; SanepHub/1.0)',
      },
    });

    if (!gueRes.ok) {
      return new Response(
        JSON.stringify({
          nome: null,
          error: `Portal GUE respondeu ${gueRes.status}. Tente novamente.`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const html = await gueRes.text();
    const parsed = extrairNomeDaRespostaGue(html);
    return new Response(JSON.stringify(parsed.nome ? { nome: parsed.nome } : parsed), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ nome: null, error: e instanceof Error ? e.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
