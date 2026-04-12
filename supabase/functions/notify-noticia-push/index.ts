// Envia Web Push quando uma notícia é publicada (chamada pelo admin após guardar).
// Secrets: SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ex.: mailto:suporte@empresa.ao)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Body {
  noticiaId?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:sanep-hub@localhost';

    if (!serviceRoleKey || !vapidPublic || !vapidPrivate) {
      return new Response(
        JSON.stringify({ error: 'Push não configurado (VAPID ou service role em falta)' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: userData, error: userErr } = await clientUser.auth.getUser();
    if (userErr || !userData.user?.id) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as Body;
    const noticiaId = body.noticiaId;
    if (noticiaId == null || typeof noticiaId !== 'number' || !Number.isFinite(noticiaId)) {
      return new Response(JSON.stringify({ error: 'noticiaId inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: noticia, error: nErr } = await admin
      .from('noticias')
      .select('id, titulo, empresa_id, publicado')
      .eq('id', noticiaId)
      .maybeSingle();

    if (nErr || !noticia) {
      return new Response(JSON.stringify({ error: 'Notícia não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const row = noticia as { id: number; titulo: string; empresa_id: number; publicado: boolean };
    if (!row.publicado) {
      return new Response(JSON.stringify({ ok: true, skipped: 'not_published' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('perfil, empresa_id')
      .eq('auth_user_id', userData.user.id)
      .maybeSingle();

    const cp = callerProfile as { perfil?: string; empresa_id?: number | null } | null;
    const perfil = cp?.perfil ?? '';
    if (perfil !== 'Admin' && perfil !== 'PCA') {
      return new Response(JSON.stringify({ error: 'Sem permissão' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callerEmpresa = cp?.empresa_id ?? null;
    if (callerEmpresa != null && callerEmpresa !== row.empresa_id) {
      return new Response(JSON.stringify({ error: 'Empresa não coincide com a notícia' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const empresaId = row.empresa_id;

    const [{ data: byEmpresa, error: e1 }, { data: grupoAdmins, error: e2 }] = await Promise.all([
      admin.from('profiles').select('auth_user_id').eq('empresa_id', empresaId),
      admin.from('profiles').select('auth_user_id').in('perfil', ['Admin', 'PCA']).is('empresa_id', null),
    ]);

    if (e1 || e2) {
      console.error('profiles query', e1, e2);
      return new Response(JSON.stringify({ error: 'Erro ao resolver destinatários' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recipientIds = new Set<string>();
    for (const p of [...(byEmpresa ?? []), ...(grupoAdmins ?? [])]) {
      const id = (p as { auth_user_id?: string }).auth_user_id;
      if (typeof id === 'string' && id.length) recipientIds.add(id);
    }

    if (recipientIds.size === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: subs, error: sErr } = await admin
      .from('web_push_subscriptions')
      .select('user_id, endpoint, p256dh, auth_key')
      .in('user_id', [...recipientIds]);

    if (sErr) {
      console.error('subs query', sErr);
      return new Response(JSON.stringify({ error: 'Erro ao ler subscrições' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const payload = JSON.stringify({
      title: 'Nova notícia',
      body: row.titulo,
      url: `/comunicacao-interna/noticias/${row.id}`,
      tag: `noticia-${row.id}`,
    });

    let sent = 0;
    const list = (subs ?? []) as {
      user_id: string;
      endpoint: string;
      p256dh: string;
      auth_key: string;
    }[];

    for (const sub of list) {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth_key },
      };
      try {
        await webpush.sendNotification(pushSub, payload, { TTL: 86_400 });
        sent++;
      } catch (e: unknown) {
        const status = (e as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await admin.from('web_push_subscriptions').delete().eq('endpoint', sub.endpoint);
        } else {
          console.error('webpush', sub.endpoint.slice(0, 48), e);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, candidates: list.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
