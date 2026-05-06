import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserBody {
  email: string;
  username: string;
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
  numero_mec?: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Variáveis de ambiente não configuradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 🔐 Verificar se é Admin
    const authHeader = req.headers.get("Authorization");
    if (anonKey && authHeader) {
      const clientAnon = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });

      const { data: { user: caller } } = await clientAnon.auth.getUser();

      if (!caller?.id) {
        return new Response(JSON.stringify({ error: "Não autenticado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

      const { data: callerProfile } = await supabaseAdmin
        .from("profiles")
        .select("perfil")
        .eq("auth_user_id", caller.id)
        .maybeSingle();

      if ((callerProfile as any)?.perfil !== "Admin") {
        return new Response(JSON.stringify({ error: "Apenas Admin pode criar utilizadores" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = (await req.json()) as CreateUserBody;

    const username = (body.username ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");

    const emailLocal = body.email?.trim()
      ? body.email.split("@")[0].toLowerCase()
      : "";

    const finalUsername = username || emailLocal;

    if (!body.email || !body.password || !body.nome || !body.perfil || !finalUsername) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios em falta" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let numero_mec = body.numero_mec ?? null;

    if (!numero_mec && body.colaborador_id) {
      const { data } = await supabase
        .from("colaboradores")
        .select("numero_mec")
        .eq("id", body.colaborador_id)
        .maybeSingle();

      numero_mec = (data as any)?.numero_mec ?? null;
    }

    // 👤 Criar no Auth
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
      });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authUserId = authData?.user?.id;

    // 📄 Criar profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        auth_user_id: authUserId,
        nome: body.nome,
        email: body.email,
        username: finalUsername,
        perfil: body.perfil,
        cargo: body.cargo ?? "",
        departamento: body.departamento ?? "",
        avatar:
          body.avatar ||
          body.nome
            .split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase(),
        permissoes: body.permissoes ?? [],
        modulos: body.modulos ?? null,
        empresa_id: body.empresa_id ?? null,
        colaborador_id: body.colaborador_id ?? null,
        numero_mec,
        primeiro_acesso_pendente: body.perfil === "Colaborador",
      })
      .select()
      .single();

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(profile), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});